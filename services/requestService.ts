import { supabase } from '../lib/supabase';
import { LeaveRequest, RequestStatus } from '../types';
import { calculateLeaveHours, calculateOTHours, countWorkdays } from '../lib/leaveUtils';

export const requestService = {
    async createRequest(request: Omit<LeaveRequest, 'id' | 'created_at' | 'status'> & { car_id?: string }): Promise<{ success: boolean; data?: any; error?: string }> {
        try {
            // 獲取申請人資訊以進行後續判斷
            const { data: empData } = await supabase
                .from('employees')
                .select('id, name, is_supervisor, is_chairman, manager_id, rest_days, manager:employees!manager_id(is_chairman)')
                .eq('id', request.employee_id)
                .single();

            // 計算工作日天數
            const startDate = new Date(request.start_date);
            const endDate = new Date(request.end_date);
            const workdaysCount = countWorkdays(startDate, endDate, empData || {});

            // 判斷是否需要理事長審核（5 個工作日含以上）
            let requiresChairmanApproval = workdaysCount >= 5;
            let status = RequestStatus.PENDING;
            let approvedAt = null;
            let approverId = null;

            // 判斷是否為「直隸於理事長」的人員（包含主管與一般同仁）
            // 邏輯：直屬主管是理事長，或者是沒有直屬主管的人（視同直隸理事長，除非是理事長本人）
            const isDirectReportToChairman = 
                empData && (
                    (empData as any).manager?.is_chairman || 
                    (empData.manager_id === null && !empData.is_chairman)
                );

            if (empData && isDirectReportToChairman) {
                // 若工作日天數小於 5 天，則不須理事長核准（改為自動核准）
                if (workdaysCount < 5) {
                    requiresChairmanApproval = false;
                    status = RequestStatus.APPROVED;
                    approvedAt = new Date().toISOString();
                    approverId = (empData as any).manager_id || '153bf58a-bba6-4ba2-bd81-77f52299b0ad';
                } else {
                    // 若工作日天數超過 5 天（含），仍要簽到理事長
                    requiresChairmanApproval = true;
                    status = RequestStatus.PENDING;
                    approvedAt = null;
                }
            }

            const { data, error } = await supabase
                .from('leave_requests')
                .insert([
                    {
                        ...request,
                        status: status,
                        approved_at: approvedAt,
                        approver_id: approverId,
                        requires_chairman_approval: requiresChairmanApproval,
                        is_makeup_workday: (request as any).is_makeup_workday || false
                    }
                ])
                .select()
                .single();

            if (error) {
                console.error('Error creating request:', error);
                return { success: false, error: error.message };
            }

            return { success: true, data };
        } catch (err: any) {
            console.error('Unexpected error creating request:', err);
            return { success: false, error: 'Network or system error' };
        }
    },

    async getEmployeeRequests(employeeId: string, year?: number, department?: string): Promise<LeaveRequest[]> {
        try {
            let query = supabase
                .from('leave_requests')
                .select(`
                    *,
                    leave_type:leave_types(*),
                    employee:employees!leave_requests_employee_id_fkey(id, name, department, manager_id),
                    deputy:employees!leave_requests_deputy_id_fkey(id, name, department, manager_id)
                `)
                .neq('status', RequestStatus.WITHDRAWN)
                .or('is_modified.is.null,is_modified.eq.false');

            if (department) {
                // 如果有提供部門，則查詢該部門所有同仁的紀錄
                const { data: deptEmployees } = await supabase
                    .from('employees')
                    .select('id')
                    .eq('department', department);
                
                const deptIds = deptEmployees?.map(e => e.id) || [];
                if (deptIds.length > 0) {
                    query = query.in('employee_id', deptIds);
                } else {
                    query = query.eq('employee_id', employeeId);
                }
            } else {
                query = query.eq('employee_id', employeeId);
            }

            if (year) {
                const startDate = `${year}-01-01T00:00:00+08:00`;
                const endDate = `${year}-12-31T23:59:59+08:00`;
                query = query
                    .gte('start_date', startDate)
                    .lte('start_date', endDate);
            }

            const { data, error } = await query
                .order('start_date', { ascending: false })
                .limit(10000);

            if (error) {
                console.error('Error fetching requests for employee:', employeeId, error);
                return [];
            }

            return data || [];
        } catch (err) {
            console.error('Unexpected error fetching requests for employee:', employeeId, err);
            return [];
        }
    },

    /**
     * 取得所有請假申請（管理員用）
     */
    async getAllRequests(): Promise<LeaveRequest[]> {
        try {
            const { data, error } = await supabase
                .from('leave_requests')
                .select(`
                    *,
                    leave_type:leave_types(*),
                    employee:employees!leave_requests_employee_id_fkey(name, department),
                    deputy:employees!leave_requests_deputy_id_fkey(id, name, department)
                `)
                .or('is_modified.is.null,is_modified.eq.false')
                .order('created_at', { ascending: false })
                .limit(5000); // 提升上限以應對大量歷史紀錄

            if (error) {
                console.error('Error fetching all requests:', error);
                return [];
            }

            // 將 employee.name 映射到 employee_name
            return (data || []).map((req: any) => ({
                ...req,
                employee_name: req.employee?.name
            }));
        } catch (err) {
            console.error('Unexpected error fetching all requests:', err);
            return [];
        }
    },

    /**
     * 更新請假申請狀態（核准/拒絕）
     * 支援多層級審核：主管 -> 理事長
     */
    async updateRequestStatus(
        requestId: string,
        status: RequestStatus,
        approverId?: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            // 先獲取申請資訊，確認是否包含 car_id 和是否需要理事長審核
            const { data: requestData, error: fetchError } = await supabase
                .from('leave_requests')
                .select('car_id, requires_chairman_approval, supervisor_approved_at, status, modification_reason')
                .eq('id', requestId)
                .single();

            if (fetchError) throw fetchError;

            // 如果審核人存在，檢查其角色
            let isChairman = false;
            if (approverId) {
                const { data: approverData } = await supabase
                    .from('employees')
                    .select('is_chairman, is_supervisor')
                    .eq('id', approverId)
                    .single();

                isChairman = approverData?.is_chairman || false;
            }

            const updates: any = {};

            // 處理拒絕狀態：無論哪一層審核拒絕，都直接設為 REJECTED
            if (status === RequestStatus.REJECTED) {
                // 如果目前的狀態是撤回待審，拒絕動作代表「拒絕撤回」，應恢復原狀態
                if (requestData?.status === RequestStatus.WITHDRAW_PENDING) {
                    let originalStatus = RequestStatus.APPROVED; // 預設恢復為已核准
                    if (requestData.modification_reason?.startsWith('PRE_WITHDRAW_STATUS:')) {
                        const statusStr = requestData.modification_reason.split(':')[1];
                        originalStatus = statusStr as RequestStatus;
                    }
                    updates.status = originalStatus;
                    // 清除撤回標記
                    updates.modification_reason = null;
                } else {
                    updates.status = RequestStatus.REJECTED;
                    updates.approved_at = new Date().toISOString();
                    if (approverId) {
                        updates.approver_id = approverId;
                    }
                }
            }
            // 處理核准狀態
            else if (status === RequestStatus.APPROVED) {
                // 如果目前的狀態是撤回待審，核准動作代表「核准撤回」
                if (requestData?.status === RequestStatus.WITHDRAW_PENDING) {
                    updates.status = RequestStatus.WITHDRAWN;
                    updates.approved_at = new Date().toISOString();
                    updates.approver_id = approverId;

                    // 如果是撤回變更申請，需要恢復原申請的變更標記（與原 withdrawRequest 邏輯一致）
                    const { data: reqWithOriginal } = await supabase
                        .from('leave_requests')
                        .select('original_request_id')
                        .eq('id', requestId)
                        .single();

                    if (reqWithOriginal?.original_request_id) {
                        await supabase
                            .from('leave_requests')
                            .update({
                                is_modified: false,
                                modified_by_request_id: null
                            })
                            .eq('id', reqWithOriginal.original_request_id);
                    }
                }
                // 如果需要理事長審核
                else if (requestData?.requires_chairman_approval) {
                    // 理事長審核或管理員強制核准（未提供 approverId 代表管理員）
                    if (isChairman || !approverId) {
                        updates.status = RequestStatus.APPROVED;
                        updates.approved_at = new Date().toISOString();
                        updates.chairman_approved_at = new Date().toISOString();
                        if (approverId) {
                            updates.chairman_approved_by = approverId;
                            updates.approver_id = approverId;
                        }
                    }
                    // 主管審核（第一層）
                    else {
                        // 保持 PENDING 狀態，等待理事長審核
                        updates.status = RequestStatus.PENDING;
                        updates.supervisor_approved_at = new Date().toISOString();
                        updates.supervisor_approved_by = approverId;
                    }
                }
                // 不需要理事長審核（單層審核）
                else {
                    updates.status = RequestStatus.APPROVED;
                    updates.approved_at = new Date().toISOString();
                    if (approverId) {
                        updates.approver_id = approverId;
                    }
                }
            }

            const { error } = await supabase
                .from('leave_requests')
                .update(updates)
                .eq('id', requestId);

            if (error) {
                console.error('Error updating request status:', error);
                return { success: false, error: error.message };
            }

            // 如果核准且有借車，更新車輛狀態
            if (status === RequestStatus.APPROVED && requestData?.car_id) {
                // 只有在真正核准（不是等待理事長審核）時才更新車輛狀態
                if (!requestData.requires_chairman_approval || isChairman) {
                    await supabase
                        .from('cars')
                        .update({ status: 'IN_USE' })
                        .eq('id', requestData.car_id);
                }
            }

            return { success: true };
        } catch (err: any) {
            console.error('Unexpected error updating request status:', err);
            return { success: false, error: 'Network or system error' };
        }
    },

    /**
     * 批量更新請假申請狀態（批量核准/拒絕）
     */
    async batchUpdateRequestStatus(
        requestIds: string[],
        status: RequestStatus,
        approverId?: string
    ): Promise<{
        success: boolean;
        total: number;
        succeeded: number;
        failed: number;
        errors: string[];
    }> {
        try {
            if (!requestIds || requestIds.length === 0) {
                return {
                    success: false,
                    total: 0,
                    succeeded: 0,
                    failed: 0,
                    errors: ['沒有提供任何請假申請 ID']
                };
            }

            // 使用 Promise.allSettled 並行處理所有請求
            const results = await Promise.allSettled(
                requestIds.map(id => this.updateRequestStatus(id, status, approverId))
            );

            // 統計結果
            const succeeded = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
            const failed = results.length - succeeded;
            const errors: string[] = [];

            results.forEach((result, index) => {
                if (result.status === 'rejected') {
                    errors.push(`請求 ${requestIds[index].slice(0, 8)}: ${result.reason}`);
                } else if (!result.value.success) {
                    errors.push(`請求 ${requestIds[index].slice(0, 8)}: ${result.value.error || '未知錯誤'}`);
                }
            });

            return {
                success: failed === 0,
                total: requestIds.length,
                succeeded,
                failed,
                errors
            };
        } catch (err: any) {
            console.error('Unexpected error in batch update:', err);
            return {
                success: false,
                total: requestIds.length,
                succeeded: 0,
                failed: requestIds.length,
                errors: ['批量操作發生系統錯誤']
            };
        }
    },

    /**
     * 建立變更申請
     */
    async createModificationRequest(
        originalRequestId: string,
        modificationData: {
            start_date: string;
            end_date: string;
            reason: string;
            modification_reason: string;
            leave_type_id?: string;
            type: string;
            hours?: number;
            manual_break_hours?: number;
            is_makeup_workday?: boolean;
            is_makeup_holiday?: boolean;
            attachment_url?: string;
            attachment_name?: string;
            attachment_drive_id?: string;
            attachment_expires_at?: string;
        },
        employeeId: string
    ): Promise<{ success: boolean; data?: any; error?: string }> {
        try {
            // 1. 驗證原申請存在且狀態為已審核
            const { data: originalRequest, error: fetchError } = await supabase
                .from('leave_requests')
                .select('*')
                .eq('id', originalRequestId)
                .eq('employee_id', employeeId)
                .single();

            if (fetchError || !originalRequest) {
                return { success: false, error: '找不到原始申請' };
            }

            if (originalRequest.status === 'PENDING') {
                return { success: false, error: '待審核的申請無法變更,請直接取消後重新申請' };
            }

            // 2. 檢查是否已有待審核的變更申請
            const { data: existingModification } = await supabase
                .from('leave_requests')
                .select('id')
                .eq('original_request_id', originalRequestId)
                .eq('status', 'PENDING')
                .maybeSingle();

            if (existingModification) {
                return { success: false, error: '已有待審核的變更申請,請等待審核完成' };
            }

            // 3. 建立新的變更申請
            const { data: newRequest, error: insertError } = await supabase
                .from('leave_requests')
                .insert([{
                    employee_id: employeeId,
                    type: modificationData.type,
                    leave_type_id: modificationData.leave_type_id,
                    start_date: modificationData.start_date,
                    end_date: modificationData.end_date,
                    reason: modificationData.reason,
                    status: RequestStatus.PENDING,
                    original_request_id: originalRequestId,
                    modification_reason: modificationData.modification_reason,
                    hours: modificationData.hours,
                    manual_break_hours: modificationData.manual_break_hours,
                    is_makeup_workday: modificationData.is_makeup_workday || false,
                    deputy_id: originalRequest.deputy_id,
                    attachment_url: modificationData.attachment_url,
                    attachment_name: modificationData.attachment_name,
                    attachment_drive_id: modificationData.attachment_drive_id,
                    attachment_expires_at: modificationData.attachment_expires_at
                }])
                .select()
                .single();

            if (insertError) {
                console.error('Error creating modification request:', insertError);
                return { success: false, error: insertError.message };
            }

            // 4. 更新原申請的變更標記
            const { error: updateError } = await supabase
                .from('leave_requests')
                .update({
                    is_modified: true,
                    modified_by_request_id: newRequest.id
                })
                .eq('id', originalRequestId);

            if (updateError) {
                console.error('Error updating original request:', updateError);
                // 嘗試刪除剛建立的變更申請
                await supabase.from('leave_requests').delete().eq('id', newRequest.id);
                return { success: false, error: '更新原申請失敗' };
            }

            return { success: true, data: newRequest };
        } catch (err: any) {
            console.error('Unexpected error creating modification request:', err);
            return { success: false, error: '系統錯誤' };
        }
    },

    /**
     * 查詢申請的變更歷史
     */
    async getRequestModificationHistory(requestId: string): Promise<LeaveRequest[]> {
        try {
            const { data, error } = await supabase
                .from('leave_requests')
                .select(`
                    *,
                    leave_type:leave_types(*),
                    employee:employees!leave_requests_employee_id_fkey(name, department),
                    deputy:employees!leave_requests_deputy_id_fkey(id, name, department)
                `)
                .eq('original_request_id', requestId)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching modification history:', error);
                return [];
            }

            return (data || []).map((req: any) => ({
                ...req,
                employee_name: req.employee?.name
            }));
        } catch (err) {
            console.error('Unexpected error fetching modification history:', err);
            return [];
        }
    },

    /**
     * 檢查申請是否可以變更
     */
    async canModifyRequest(requestId: string, employeeId: string): Promise<{ canModify: boolean; reason?: string }> {
        try {
            // 1. 檢查申請存在且屬於該員工
            const { data: request, error: fetchError } = await supabase
                .from('leave_requests')
                .select('status, is_modified')
                .eq('id', requestId)
                .eq('employee_id', employeeId)
                .single();

            if (fetchError || !request) {
                return { canModify: false, reason: '找不到申請記錄' };
            }

            // 2. 檢查狀態
            if (request.status === 'PENDING') {
                return { canModify: false, reason: '待審核的申請無法變更' };
            }

            // 3. 檢查是否已有待審核的變更申請
            const { data: pendingModification } = await supabase
                .from('leave_requests')
                .select('id')
                .eq('original_request_id', requestId)
                .eq('status', 'PENDING')
                .maybeSingle();

            if (pendingModification) {
                return { canModify: false, reason: '已有待審核的變更申請' };
            }

            return { canModify: true };
        } catch (err) {
            console.error('Error checking if request can be modified:', err);
            return { canModify: false, reason: '系統錯誤' };
        }
    },

    /**
     * 撤回待審核申請
     */
    async withdrawRequest(requestId: string, employeeId: string): Promise<{ success: boolean; error?: string }> {
        try {
            // 1. 檢查申請存在且屬於該員工
            const { data: request, error: fetchError } = await supabase
                .from('leave_requests')
                .select('status, original_request_id, car_id')
                .eq('id', requestId)
                .eq('employee_id', employeeId)
                .single();

            if (fetchError || !request) {
                return { success: false, error: '找不到申請記錄' };
            }

            // 2. 檢查狀態是否為待審核或已核准
            if (request.status !== RequestStatus.PENDING && request.status !== RequestStatus.APPROVED) {
                return { success: false, error: '只有待審核或已核准的申請可以撤回' };
            }

            // 3. 更新申請狀態為撤回待審
            // 我們將原本的狀態存放在 modification_reason 欄位，格式為 "PRE_WITHDRAW_STATUS:[STATUS]"
            // 這樣主管如果拒絕撤回，我們可以恢復原狀態
            const preWithdrawStatus = `PRE_WITHDRAW_STATUS:${request.status}`;

            const { error: updateError } = await supabase
                .from('leave_requests')
                .update({
                    status: RequestStatus.WITHDRAW_PENDING,
                    modification_reason: preWithdrawStatus
                })
                .eq('id', requestId);

            if (updateError) {
                console.error('Error withdrawing request:', updateError);
                return { success: false, error: '申請撤回失敗' };
            }

            // 4. 如果是變更申請,需要更新原申請的變更標記
            if (request.original_request_id) {
                const { error: resetError } = await supabase
                    .from('leave_requests')
                    .update({
                        is_modified: false,
                        modified_by_request_id: null
                    })
                    .eq('id', request.original_request_id);

                if (resetError) {
                    console.error('Error resetting original request:', resetError);
                    // 不返回錯誤,因為主要操作已成功
                }
            }

            // 5. 如果申請包含公務車,釋放車輛預約
            if (request.car_id) {
                // 車輛預約會在審核時處理,這裡不需要額外操作
                // 因為撤回的申請不會影響車輛可用性
            }

            return { success: true };
        } catch (err: any) {
            console.error('Unexpected error withdrawing request:', err);
            return { success: false, error: '系統錯誤' };
        }
    },

    /**
     * 取得等待理事長審核的申請
     * （主管已審核但理事長未審核）
     */
    async getChairmanPendingRequests(): Promise<LeaveRequest[]> {
        try {
            const { data, error } = await supabase
                .from('leave_requests')
                .select(`
                    *,
                    leave_type:leave_types(*),
                    employee:employees!leave_requests_employee_id_fkey(name, department),
                    deputy:employees!leave_requests_deputy_id_fkey(id, name, department)
                `)
                .eq('requires_chairman_approval', true)
                .eq('status', 'PENDING')
                .not('supervisor_approved_at', 'is', null)
                .is('chairman_approved_at', null)
                .or('is_modified.is.null,is_modified.eq.false')
                .order('supervisor_approved_at', { ascending: true });

            if (error) {
                console.error('Error fetching chairman pending requests:', error);
                return [];
            }

            return (data || []).map((req: any) => ({
                ...req,
                employee_name: req.employee?.name
            }));
        } catch (err) {
            console.error('Unexpected error fetching chairman pending requests:', err);
            return [];
        }
    },

    /**
     * 上傳附件至 Google Drive (透過 Edge Function)
     */
    async uploadAttachment(file: File): Promise<{ data?: { driveId: string; url: string }; error?: string }> {
        try {
            const formData = new FormData();
            formData.append('file', file);

            // 改用 fetch 直接呼叫，以便捕捉完整的 HTTP 錯誤內容
            const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
            const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;
            
            const response = await fetch(`${supabaseUrl}/functions/v1/upload-attachment`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${supabaseAnonKey}`,
                    'apikey': supabaseAnonKey
                },
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('[requestService] Edge Function HTTP Error:', response.status, errorData);
                return { error: errorData.error || `伺服器回傳錯誤 (${response.status})` };
            }

            const data = await response.json();
            return { data };
        } catch (err: any) {
            console.error('Unexpected error in uploadAttachment:', err);
            // 列印詳細錯誤訊息，方便在 F12 控制台查看原因
            if (err.message) console.error('Error message:', err.message);
            if (err.stack) console.error('Error stack:', err.stack);

            return { error: `連線至上傳服務失敗: ${err.message || '未知網路錯誤'}` };
        }
    },

    /**
     * 批量匯入請假紀錄
     */
    async importLeaveRequests(requests: any[]): Promise<{ success: boolean; succeeded: number; skipped: number; failed: number; errors: any[] }> {
        try {
            // 1. 獲取所有員工和請假類型以便查找
            const { data: employees, error: empError } = await supabase.from('employees').select('id, name, pin, work_start_time, work_end_time, break_start_time, break2_start_time, break2_end_time, break3_start_time, break3_end_time');
            if (empError) throw empError;

            const { data: leaveTypes, error: ltError } = await supabase.from('leave_types').select('id, name, code');
            if (ltError) throw ltError;

            const leaveTypeMap = leaveTypes?.reduce((acc, type) => {
                acc[type.name] = { id: type.id, code: type.code, name: type.name };
                return acc;
            }, {} as Record<string, { id: string; code: string; name: string }>) || {};

            // 2. 準備要檢查重複的員工 ID 清單
            const employeeIds = Array.from(new Set(
                requests.map(req => employees?.find(e => e.pin === req.pin || e.name === req.name)?.id)
                    .filter(id => !!id)
            )) as string[];

            // 3. 獲取現有的請假紀錄以便檢查重複
            // 增加 limit 以確保能抓到足夠的歷史紀錄比對
            const { data: existingRequests, error: exError } = await supabase
                .from('leave_requests')
                .select('employee_id, start_date, end_date, status, leave_type_id')
                .in('employee_id', employeeIds)
                .order('start_date', { ascending: false })
                .limit(2000);

            if (exError) throw exError;

            const results = {
                success: true,
                succeeded: 0,
                skipped: 0,
                failed: 0,
                errors: [] as any[]
            };

            // 4. 獲取可能受影響的員工的所有歷史班表
            const { data: historicalSchedules, error: schedError } = await supabase
                .from('employee_schedules')
                .select('*')
                .in('employee_id', employeeIds)
                .order('effective_date', { ascending: false });

            if (schedError) {
                console.warn('Could not fetch historical schedules for import, using current settings instead:', schedError);
            }

            const insertData: any[] = [];
            // 用於追蹤本次匯入中已處理的記錄，防止 CSV 內部重複
            const processedInThisBatch = new Set<string>();

            for (let i = 0; i < requests.length; i++) {
                const req = requests[i];
                const lineNum = i + 2;

                // 查找員工
                const employee = employees?.find(e => e.pin === req.pin || e.name === req.name);
                if (!employee) {
                    results.failed++;
                    results.errors.push({ line: lineNum, name: req.name, error: `找不到員工 (PIN: ${req.pin})` });
                    continue;
                }

                // 查找請假類型
                let leaveTypeName = req.leave_type_name;
                let leaveTypeInfo = leaveTypeMap[leaveTypeName];

                // 模糊匹配：處理常見名稱差異 (例如：加班折算 -> 加班折算補休)
                if (!leaveTypeInfo) {
                    const possibleMatch = Object.values(leaveTypeMap).find(t =>
                        t.name.includes(leaveTypeName) || leaveTypeName.includes(t.name)
                    );
                    if (possibleMatch) {
                        leaveTypeInfo = possibleMatch;
                    }
                }

                if (!leaveTypeInfo) {
                    results.failed++;
                    results.errors.push({ line: lineNum, name: req.name, error: `找不到請假類型: ${req.leave_type_name}` });
                    continue;
                }

                // 解析日期並標準化為 ISO 字串（這會根據環境時區轉換為 UTC）
                const parseSafeDate = (ds: string) => {
                    if (!ds) return new Date('');
                    if (ds.includes('T')) return new Date(ds);
                    return new Date(ds.replace(/-/g, '/'));
                };
                const startDate = parseSafeDate(req.start_date);
                const endDate = parseSafeDate(req.end_date);

                if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                    results.failed++;
                    results.errors.push({ line: lineNum, name: req.name, error: `日期格式錯誤: ${req.start_date}` });
                    continue;
                }

                const startIso = startDate.toISOString();
                const endIso = endDate.toISOString();

                // 檢查是否與本次批次中已有的記錄重複
                const batchKey = `${employee.id}_${startIso}_${endIso}_${leaveTypeInfo.id}`;
                if (processedInThisBatch.has(batchKey)) {
                    results.skipped++;
                    continue;
                }

                // 檢查是否已存在於資料庫中 (相同員工、相同開始與結束時間、相同類型)
                const isDuplicate = existingRequests?.some(er => {
                    // 如果現有紀錄是已撤回，則不視為重複，允許重新匯入
                    if (er.status === RequestStatus.WITHDRAWN) return false;

                    const exStartIso = new Date(er.start_date).toISOString();
                    const exEndIso = new Date(er.end_date).toISOString();
                    return er.employee_id === employee.id &&
                        exStartIso === startIso &&
                        exEndIso === endIso &&
                        er.leave_type_id === leaveTypeInfo.id;
                });

                if (isDuplicate) {
                    results.skipped++;
                    processedInThisBatch.add(batchKey); // 同時加入 batch 追蹤以免後續重複
                    continue;
                }

                // 判斷是否為「掙得型」加班 (需套用勞基法時數限制)
                const isOTEarning = leaveTypeInfo.code === 'OT';

                // 判斷是否為「使用型」或「折算型」 (包含補休、加班折算、特休折現等)
                const isLeaveUsageOrCashout =
                    leaveTypeInfo.code === 'TOIL' ||
                    leaveTypeInfo.code === 'CO' ||
                    leaveTypeInfo.code === 'ALC' ||
                    leaveTypeInfo.name?.includes('折算') ||
                    leaveTypeInfo.name?.includes('補休');

                // 計算時數
                let hours = req.hours;
                if (isOTEarning) {
                    // 只有「加班登記」一律重新計算或校正時數 (套用平日/休息日上限)
                    const empSchedules = (historicalSchedules || []).filter(s => s.employee_id === employee.id);
                    hours = calculateOTHours(startDate, endDate, employee, empSchedules, req.manual_break_hours || 0);
                } else if (!hours) {
                    // 其他類型 (包含補休使用) 若未提供時數，使用一般請假計算 (依班表扣除休息，但不限時數)
                    const empSchedules = (historicalSchedules || []).filter(s => s.employee_id === employee.id);
                    // 若是補休使用或折算，計算時忽略工作視窗限制 (ignoreWorkWindow=true) 以確保能計入完整時段，但仍扣除休息
                    const ignoreWorkWindow = isLeaveUsageOrCashout;
                    hours = calculateLeaveHours(startDate, endDate, employee, ignoreWorkWindow, true, empSchedules, req.manual_break_hours || 0);
                }

                insertData.push({
                    employee_id: employee.id,
                    type: 'LEAVE',
                    leave_type_id: leaveTypeInfo.id,
                    start_date: startIso,
                    end_date: endIso,
                    reason: req.reason || '',
                    status: RequestStatus.APPROVED,
                    hours: hours,
                    manual_break_hours: req.manual_break_hours || 0,
                    is_makeup_workday: req.is_makeup_workday || false,
                    approved_at: new Date().toISOString()
                });

                processedInThisBatch.add(batchKey);
            }

            if (insertData.length > 0) {
                const { error } = await supabase.from('leave_requests').insert(insertData);
                if (error) {
                    console.error('Error bulk inserting leave requests:', error);
                    return { success: false, succeeded: 0, skipped: 0, failed: requests.length, errors: [{ line: 0, name: '系統', error: error.message }] };
                }
                results.succeeded = insertData.length;
            }

            return results;
        } catch (err: any) {
            console.error('Unexpected error in importLeaveRequests:', err);
            return { success: false, succeeded: 0, skipped: 0, failed: requests.length, errors: [{ line: 0, name: '系統', error: err.message || '系統錯誤' }] };
        }
    }
    ,

    /**
     * 批量撤回申請
     */
    async batchWithdrawRequests(requestIds: string[], employeeId: string): Promise<{
        success: boolean;
        total: number;
        succeeded: number;
        failed: number;
        errors: string[];
    }> {
        try {
            if (!requestIds || requestIds.length === 0) {
                return {
                    success: false,
                    total: 0,
                    succeeded: 0,
                    failed: 0,
                    errors: ['沒有提供任何申請 ID']
                };
            }

            // 使用 Promise.allSettled 並行處理所有撤回
            const results = await Promise.allSettled(
                requestIds.map(id => this.withdrawRequest(id, employeeId))
            );

            // 統計結果
            const succeeded = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
            const failed = results.length - succeeded;
            const errors: string[] = [];

            results.forEach((result, index) => {
                if (result.status === 'rejected') {
                    errors.push(`申請 ${requestIds[index].slice(0, 8)}: ${result.reason}`);
                } else if (!result.value.success) {
                    errors.push(`申請 ${requestIds[index].slice(0, 8)}: ${result.value.error || '未知錯誤'}`);
                }
            });

            return {
                success: failed === 0,
                total: requestIds.length,
                succeeded,
                failed,
                errors
            };
        } catch (err: any) {
            console.error('Unexpected error in batch withdraw:', err);
            return {
                success: false,
                total: requestIds.length,
                succeeded: 0,
                failed: requestIds.length,
                errors: ['批量操作發生系統錯誤']
            };
        }
    },

    /**
     * 取得特定日期範圍內的請假紀錄
     */
    async getLeaveRequestsByRange(employeeId: string, startDate: string, endDate: string, leaveType: string | string[]): Promise<LeaveRequest[]> {
        try {
            let query = supabase
                .from('leave_requests')
                .select(`
                    *,
                    leave_type:leave_types(*)
                `)
                .eq('employee_id', employeeId)
                .neq('status', RequestStatus.WITHDRAWN)
                .eq('type', 'LEAVE')
                .neq('is_modified', true) // 排除已被變更的舊紀錄
                .gte('start_date', startDate)
                .lt('start_date', endDate)
                .order('start_date', { ascending: false });

            if (leaveType) {
                const codes = Array.isArray(leaveType) ? leaveType : [leaveType];

                // First get the type ids for these codes
                const { data: typeData } = await supabase
                    .from('leave_types')
                    .select('id')
                    .in('code', codes);

                if (typeData && typeData.length > 0) {
                    const ids = typeData.map(t => t.id);
                    query = query.in('leave_type_id', ids);
                }
            }

            const { data, error } = await query;
            if (error) throw error;
            return data || [];
        } catch (err) {
            console.error('Error fetching requests by range:', err);
            return [];
        }
    },

    /**
     * 取得特定日期範圍內的額度調整紀錄 (包含折現)
     */
    async getAdjustmentsByRange(employeeId: string, startDate: string, endDate: string, leaveTypeCode?: string): Promise<any[]> {
        try {
            let query = supabase
                .from('leave_balance_adjustments')
                .select('*')
                .eq('employee_id', employeeId)
                .gte('created_at', startDate)
                .lt('created_at', endDate)
                .order('created_at', { ascending: false });

            if (leaveTypeCode) {
                query = query.eq('leave_type_code', leaveTypeCode);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data || [];
        } catch (err) {
            console.error('Error fetching adjustments by range:', err);
            return [];
        }
    },

    /**
     * 取得特定日期範圍內的加班紀錄
     * 包含：加班登記 (OT)、加班折現 (CO)、加班折算補休 (ALC)
     */
    async getOvertimeRequestsByRange(employeeId: string, startDate: string, endDate: string): Promise<LeaveRequest[]> {
        try {
            // 先取得所有加班相關的請假類型
            const { data: overtimeTypes, error: typeError } = await supabase
                .from('leave_types')
                .select('id')
                .or('code.eq.OT,code.eq.CO,name.ilike.%加班%');

            if (typeError) throw typeError;

            if (!overtimeTypes || overtimeTypes.length === 0) {
                return [];
            }

            const overtimeTypeIds = overtimeTypes.map(t => t.id);

            // 查詢該員工在指定日期範圍內的加班紀錄
            const { data, error } = await supabase
                .from('leave_requests')
                .select(`
                    *,
                    leave_type:leave_types(*)
                `)
                .eq('employee_id', employeeId)
                .eq('status', RequestStatus.APPROVED)
                .in('leave_type_id', overtimeTypeIds)
                .neq('is_modified', true) // 排除已被變更的舊紀錄
                .gte('start_date', startDate)
                .lt('start_date', endDate)
                .order('start_date', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (err) {
            console.error('Error fetching overtime requests by range:', err);
            return [];
        }
    },

    /**
     * 永久刪除請假申請紀錄 (管理者用)
     */
    async deleteRequest(requestId: string): Promise<{ success: boolean; error?: string }> {
        try {
            const { data, error } = await supabase
                .from('leave_requests')
                .delete()
                .eq('id', requestId)
                .select('id');

            if (error) throw error;
            return { success: (data || []).length > 0 };
        } catch (err: any) {
            console.error('Error deleting request:', err);
            return { success: false, error: err.message };
        }
    },

    /**
     * 批量永久刪除請假申請紀錄 (管理者用)
     */
    async batchDeleteRequests(requestIds: string[]): Promise<{
        success: boolean;
        succeeded: number;
        failed: number;
        errors: string[];
    }> {
        try {
            const { data, error } = await supabase
                .from('leave_requests')
                .delete()
                .in('id', requestIds)
                .select('id');

            if (error) throw error;

            const succeeded = (data || []).length;
            const failed = requestIds.length - succeeded;

            return {
                success: failed === 0,
                succeeded,
                failed,
                errors: failed > 0 ? ['部分紀錄因外鍵約束或權限限制無法刪除'] : []
            };
        } catch (err: any) {
            console.error('Error batch deleting requests:', err);
            return {
                success: false,
                succeeded: 0,
                failed: requestIds.length,
                errors: [err.message]
            };
        }
    },

    /**
     * 新增額度調整紀錄
     */
    async addLeaveAdjustment(data: {
        employee_id: string;
        leave_type_code: string;
        adjustment_type: 'GRANT' | 'CASHOUT' | 'CORRECTION';
        amount_hours: number;
        reason?: string;
    }): Promise<{ success: boolean; error?: string }> {
        try {
            const { error } = await supabase
                .from('leave_balance_adjustments')
                .insert([data]);

            if (error) throw error;
            return { success: true };
        } catch (err: any) {
            console.error('Error adding leave adjustment:', err);
            return { success: false, error: err.message };
        }
    }
};

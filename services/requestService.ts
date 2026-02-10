import { supabase } from '../lib/supabase';
import { LeaveRequest, RequestStatus } from '../types';

export const requestService = {
    async createRequest(request: Omit<LeaveRequest, 'id' | 'created_at' | 'status'> & { car_id?: string }): Promise<{ success: boolean; data?: any; error?: string }> {
        try {
            // 計算請假天數（從開始日期到結束日期的完整天數）
            const startDate = new Date(request.start_date);
            const endDate = new Date(request.end_date);

            // 計算跨越的日曆天數
            // 例如：2/15 08:00 到 2/17 17:00 = 3 天 (2/15, 2/16, 2/17)
            const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
            const endDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
            const daysDiff = Math.round((endDay.getTime() - startDay.getTime()) / (1000 * 60 * 60 * 24)) + 1;

            // 判斷是否需要理事長審核（3 日含以上）
            const requiresChairmanApproval = daysDiff >= 3;

            const { data, error } = await supabase
                .from('leave_requests')
                .insert([
                    {
                        ...request,
                        status: RequestStatus.PENDING,
                        requires_chairman_approval: requiresChairmanApproval
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

    async getEmployeeRequests(employeeId: string): Promise<LeaveRequest[]> {
        try {
            const { data, error } = await supabase
                .from('leave_requests')
                .select(`
                    *,
                    leave_type:leave_types(*),
                    deputy:employees!leave_requests_deputy_id_fkey(id, name, department)
                `)
                .eq('employee_id', employeeId)
                .order('created_at', { ascending: false });

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
                .order('created_at', { ascending: false });

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
                .select('car_id, requires_chairman_approval, supervisor_approved_at')
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
                updates.status = RequestStatus.REJECTED;
                updates.approved_at = new Date().toISOString();
                if (approverId) {
                    updates.approver_id = approverId;
                }
            }
            // 處理核准狀態
            else if (status === RequestStatus.APPROVED) {
                // 如果需要理事長審核
                if (requestData?.requires_chairman_approval) {
                    // 理事長審核
                    if (isChairman) {
                        updates.status = RequestStatus.APPROVED;
                        updates.approved_at = new Date().toISOString();
                        updates.chairman_approved_at = new Date().toISOString();
                        updates.chairman_approved_by = approverId;
                        updates.approver_id = approverId;
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
                    modification_reason: modificationData.modification_reason
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

            // 3. 更新申請狀態為已撤回
            const { error: updateError } = await supabase
                .from('leave_requests')
                .update({ status: RequestStatus.WITHDRAWN })
                .eq('id', requestId);

            if (updateError) {
                console.error('Error withdrawing request:', updateError);
                return { success: false, error: '撤回失敗' };
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
    }
};

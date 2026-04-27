import { supabase } from '../lib/supabase';
import { ShiftRequest, ShiftType, RequestStatus, DayOverrideType, EmployeeDayOverride } from '../types';
import { format, startOfMonth, endOfMonth } from 'date-fns';

export const shiftService = {
    /**
     * 獲取當月已申請次數
     */
    async getMonthlyShiftCount(employeeId: string, date: Date): Promise<number> {
        const start = format(startOfMonth(date), 'yyyy-MM-dd');
        const end = format(endOfMonth(date), 'yyyy-MM-dd');

        const { count, error } = await supabase
            .from('shift_requests')
            .select('*', { count: 'exact', head: true })
            .eq('employee_id', employeeId)
            .neq('status', RequestStatus.WITHDRAWN)
            .neq('status', RequestStatus.REJECTED)
            .gte('created_at', start)
            .lte('created_at', end);

        if (error) {
            console.error('Error getting monthly shift count:', error);
            return 0;
        }

        return count || 0;
    },

    /**
     * 建立挪移申請
     */
    async createShiftRequest(request: Omit<ShiftRequest, 'id' | 'created_at' | 'status'>): Promise<{ success: boolean; data?: any; error?: string }> {
        try {
            // 1. 檢查當月限制 (預設上限 2 次)
            const count = await this.getMonthlyShiftCount(request.employee_id, new Date());
            if (count >= 2) {
                return { success: false, error: '當月挪移申請次數已達上限 (2次)' };
            }

            // 2. 判斷是否為「直屬於理事長的主管」以進行自動核准
            const { data: empData } = await supabase
                .from('employees')
                .select('is_supervisor, manager_id, manager:employees!manager_id(is_chairman)')
                .eq('id', request.employee_id)
                .single();

            let status = RequestStatus.PENDING;
            let approvedAt = null;
            let approverId = null;

            if (empData && empData.is_supervisor && (empData as any).manager?.is_chairman) {
                status = RequestStatus.APPROVED;
                approvedAt = new Date().toISOString();
                approverId = (empData as any).manager_id;
            }

            // 3. 寫入資料庫
            const { data, error } = await supabase
                .from('shift_requests')
                .insert([
                    {
                        ...request,
                        status: status,
                        approved_at: approvedAt,
                        approver_id: approverId
                    }
                ])
                .select()
                .single();

            if (error) throw error;

            // 4. 若自動核准，則需立即處理日期覆蓋記錄 (比照 updateShiftStatus)
            if (status === RequestStatus.APPROVED && data) {
                const overrides: Partial<EmployeeDayOverride>[] = [];
                if (data.type === ShiftType.SWAP_REST_DAY) {
                    overrides.push({
                        employee_id: data.employee_id,
                        override_date: data.original_rest_date,
                        day_type: DayOverrideType.WORKDAY,
                        request_id: data.id
                    });
                    overrides.push({
                        employee_id: data.employee_id,
                        override_date: data.new_rest_date,
                        day_type: DayOverrideType.REST_DAY,
                        request_id: data.id
                    });
                } else if (data.type === ShiftType.HOURS_ADJUSTMENT) {
                    overrides.push({
                        employee_id: data.employee_id,
                        override_date: data.target_date,
                        day_type: DayOverrideType.CUSTOM_HOURS,
                        work_start_time: data.new_work_start_time,
                        work_end_time: data.new_work_end_time,
                        break_start_time: data.new_break_start_time,
                        break_end_time: data.new_break_end_time,
                        request_id: data.id
                    });
                }

                if (overrides.length > 0) {
                    await supabase
                        .from('employee_day_overrides')
                        .upsert(overrides, { onConflict: 'employee_id,override_date' });
                }
            }

            return { success: true, data };
        } catch (err: any) {
            console.error('Error creating shift request:', err);
            return { success: false, error: err.message || '連線錯誤' };
        }
    },

    /**
     * 獲取員工的挪移申請紀錄
     */
    async getEmployeeShiftRequests(employeeId: string): Promise<ShiftRequest[]> {
        const { data, error } = await supabase
            .from('shift_requests')
            .select('*')
            .eq('employee_id', employeeId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching shift requests:', error);
            return [];
        }
        return data || [];
    },

    /**
     * 獲取待審核的挪移申請 (管理員) - 擴充為支援所有狀態
     */
    async getShiftRequests(status?: RequestStatus): Promise<ShiftRequest[]> {
        let query = supabase
            .from('shift_requests')
            .select('*, employee:employees!employee_id(name, department)')
            .order('created_at', { ascending: false });

        if (status) {
            if (status === RequestStatus.PENDING) {
                // 如果是查「待處理」，自動包含「撤回待審」
                query = query.in('status', [RequestStatus.PENDING, RequestStatus.WITHDRAW_PENDING]);
            } else {
                query = query.eq('status', status);
            }
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching shift requests:', JSON.stringify(error));
            return [];
        }
        return (data || []).map(item => ({
            ...item,
            employee_name: (item as any).employee?.name
        }));
    },

    /**
     * 獲取主管的下屬挪移申請 (主管審核用)
     */
    async getSubordinateShiftRequests(managerId: string, status?: RequestStatus): Promise<ShiftRequest[]> {
        console.log(`[shiftService] Fetching subordinate shift requests for manager: ${managerId}`);
        // 1. 先獲取下屬 ID
        const { data: subordinates, error: subError } = await supabase
            .from('employees')
            .select('id, name')
            .eq('manager_id', managerId);

        if (subError) {
            console.error('[shiftService] Error fetching subordinates:', subError);
            return [];
        }

        const subIds = (subordinates || []).map(s => s.id);
        console.log(`[shiftService] Found subordinates: ${subordinates?.map(s => s.name).join(', ') || 'None'} (Total: ${subIds.length})`);
        
        if (subIds.length === 0) return [];

        // 2. 查詢申請 (包含 PENDING 與 WITHDRAW_PENDING)
        let query = supabase
            .from('shift_requests')
            .select('*, employee:employees!employee_id(name, department)')
            .in('employee_id', subIds)
            .order('created_at', { ascending: false });

        if (status) {
            query = query.eq('status', status);
        }

        const { data, error } = await query;
        if (error) {
            console.error('[shiftService] Error fetching subordinate shift requests:', JSON.stringify(error));
            return [];
        }
        
        console.log(`[shiftService] Found ${data?.length || 0} shift requests for subordinates`);
        
        return (data || []).map(item => ({
            ...item,
            employee_name: (item as any).employee?.name
        }));
    },

    /**
     * 撤回挪移申請 (設為撤回待審)
     */
    async withdrawShiftRequest(requestId: string, employeeId: string): Promise<{ success: boolean; error?: string }> {
        try {
            // 1. 檢查申請存在且屬於該員工
            const { data: request, error: fetchError } = await supabase
                .from('shift_requests')
                .select('status')
                .eq('id', requestId)
                .eq('employee_id', employeeId)
                .single();

            if (fetchError || !request) return { success: false, error: '找不到申請紀錄' };

            // 2. 只有待審核或已核准可以撤回
            if (request.status !== RequestStatus.PENDING && request.status !== RequestStatus.APPROVED) {
                return { success: false, error: '此狀態無法撤回' };
            }

            // 3. 更新狀態
            // 暫時將原狀態存在 review_comment 的開頭（前端不會直接顯示給員工看，直到主管處理）
            const preWithdrawStatus = `PRE_WITHDRAW_STATUS:${request.status}`;
            
            const { error: updateError } = await supabase
                .from('shift_requests')
                .update({
                    status: RequestStatus.WITHDRAW_PENDING,
                    review_comment: preWithdrawStatus
                })
                .eq('id', requestId);

            if (updateError) throw updateError;
            return { success: true };
        } catch (err: any) {
            console.error('Error withdrawing shift request:', err);
            return { success: false, error: err.message || '撤回失敗' };
        }
    },

    /**
     * 獲取指定範圍的日期覆蓋紀錄 (考勤月曆用)
     */
    async getEmployeeDayOverrides(employeeId: string, startDate: string, endDate: string): Promise<EmployeeDayOverride[]> {
        const { data, error } = await supabase
            .from('employee_day_overrides')
            .select('*')
            .eq('employee_id', employeeId)
            .gte('override_date', startDate)
            .lte('override_date', endDate);

        if (error) {
            console.error('Error fetching day overrides:', error);
            return [];
        }
        return data || [];
    },

    /**
     * 審核挪移申請
     */
    async updateShiftStatus(
        requestId: string,
        status: RequestStatus,
        approverId: string,
        comment?: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            // 1. 獲取申請詳情
            const { data: request, error: fetchError } = await supabase
                .from('shift_requests')
                .select('*')
                .eq('id', requestId)
                .single();

            if (fetchError || !request) throw new Error('找不到申請紀錄');

            let finalStatus = status;
            let finalComment = comment;

            // 處理「撤回待審」的審核邏輯
            if (request.status === RequestStatus.WITHDRAW_PENDING) {
                if (status === RequestStatus.APPROVED) {
                    // 主管核准「撤回」-> 最終狀態為 WITHDRAWN
                    finalStatus = RequestStatus.WITHDRAWN;
                } else if (status === RequestStatus.REJECTED) {
                    // 主管拒絕「撤回」-> 恢復原狀態
                    let originalStatus = RequestStatus.APPROVED; // 預設
                    if (request.review_comment?.startsWith('PRE_WITHDRAW_STATUS:')) {
                        const parts = request.review_comment.split(':');
                        originalStatus = parts[1] as RequestStatus;
                        // 清除暫存的狀態標記
                        finalComment = comment || ''; 
                    }
                    finalStatus = originalStatus;
                }
            }

            // 2. 更新狀態
            const { error: updateError } = await supabase
                .from('shift_requests')
                .update({
                    status: finalStatus,
                    approver_id: approverId,
                    approved_at: new Date().toISOString(),
                    review_comment: finalComment
                })
                .eq('id', requestId);

            if (updateError) throw updateError;

            // 3. 處理覆蓋紀錄 (employee_day_overrides)
            // A. 如果是「核准」一般申請 -> 寫入生效紀錄
            if (finalStatus === RequestStatus.APPROVED) {
                const overrides: Partial<EmployeeDayOverride>[] = [];

                if (request.type === ShiftType.SWAP_REST_DAY) {
                    overrides.push({
                        employee_id: request.employee_id,
                        override_date: request.original_rest_date,
                        day_type: DayOverrideType.WORKDAY,
                        request_id: requestId
                    });
                    overrides.push({
                        employee_id: request.employee_id,
                        override_date: request.new_rest_date,
                        day_type: DayOverrideType.REST_DAY,
                        request_id: requestId
                    });
                } else if (request.type === ShiftType.HOURS_ADJUSTMENT) {
                    overrides.push({
                        employee_id: request.employee_id,
                        override_date: request.target_date,
                        day_type: DayOverrideType.CUSTOM_HOURS,
                        work_start_time: request.new_work_start_time,
                        work_end_time: request.new_work_end_time,
                        break_start_time: request.new_break_start_time,
                        break_end_time: request.new_break_end_time,
                        request_id: requestId
                    });
                }

                if (overrides.length > 0) {
                    const { error: overrideError } = await supabase
                        .from('employee_day_overrides')
                        .upsert(overrides, { onConflict: 'employee_id,override_date' });
                    
                    if (overrideError) console.error('Error applying day overrides:', overrideError);
                }
            }
            // B. 如果是「撤回」-> 刪除已生效的過往紀錄
            else if (finalStatus === RequestStatus.WITHDRAWN) {
                const { error: deleteError } = await supabase
                    .from('employee_day_overrides')
                    .delete()
                    .eq('request_id', requestId);
                
                if (deleteError) console.error('Error deleting day overrides for withdrawn request:', deleteError);
            }

            return { success: true };
        } catch (err: any) {
            console.error('Error updating shift status:', err);
            return { success: false, error: err.message || '審核失敗' };
        }
    }
};

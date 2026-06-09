import { supabase } from '../lib/supabase';
import { LeaveBalance } from '../types';

// 獲取員工資訊（包含是否為部門主管）
export const getEmployeeInfo = async (employeeId: string) => {
    try {
        const { data, error } = await supabase
            .from('employees')
            .select('*')
            .eq('id', employeeId)
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error fetching employee info:', error);
        return null;
    }
};

// 建立補登申請
export const createMakeupRequest = async (employeeId: string, data: {
    requestDate: string;
    checkType: 'IN' | 'OUT';
    requestTime: string;
    reason: string;
}) => {
    try {
        // 1. 判斷是否為「直屬於理事長的主管」以進行自動核准
        const { data: empData } = await supabase
            .from('employees')
            .select('is_supervisor, manager_id, manager:employees!manager_id(is_chairman)')
            .eq('id', employeeId)
            .single();

        let status = 'PENDING';
        let reviewerId = null;
        let reviewedAt = null;

        const isDirectReportToChairman = 
            empData && (
                (empData as any).manager?.is_chairman || 
                (empData.manager_id === null && !empData.is_chairman)
            );

        if (empData && isDirectReportToChairman) {
            status = 'APPROVED';
            reviewerId = (empData as any).manager_id || '153bf58a-bba6-4ba2-bd81-77f52299b0ad';
            reviewedAt = new Date().toISOString();
        }

        // 2. 建立申請紀錄
        const { data: request, error: insertError } = await supabase
            .from('makeup_attendance_requests')
            .insert([{
                employee_id: employeeId,
                request_date: data.requestDate,
                check_type: data.checkType,
                request_time: data.requestTime,
                reason: data.reason,
                status: status,
                reviewer_id: reviewerId,
                reviewed_at: reviewedAt
            }])
            .select()
            .single();

        if (insertError) throw insertError;

        // 3. 若為自動核准，需同步建立打卡記錄
        if (status === 'APPROVED' && request) {
            const timestamp = new Date(request.request_date);
            const [hours, minutes] = request.request_time.split(':');
            timestamp.setHours(parseInt(hours), parseInt(minutes), 0, 0);

            const { error: logError } = await supabase
                .from('attendance_logs')
                .insert([{
                    employee_id: employeeId,
                    check_type: request.check_type,
                    timestamp: timestamp.toISOString(),
                    is_makeup: true
                }]);

            if (logError) console.error('Error auto-creating attendance log:', logError);
        }

        return { success: true };
    } catch (error: any) {
        console.error('Error creating makeup request:', error);
        return { success: false, error: error.message };
    }
};

// 獲取員工的補登申請
export const getEmployeeMakeupRequests = async (employeeId: string) => {
    try {
        const { data, error } = await supabase
            .from('makeup_attendance_requests')
            .select('*')
            .eq('employee_id', employeeId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching employee makeup requests:', error);
        return [];
    }
};

// 獲取員工差勤餘額 (特休、補休)
export const getEmployeeLeaveBalances = async (employeeId: string): Promise<LeaveBalance | null> => {
    try {
        const { data, error } = await supabase
            .rpc('get_employee_leave_balances', {
                target_employee_id: employeeId
            });

        if (error) throw error;

        // Transform SQL response to match frontend LeaveBalance type
        if (data && typeof data === 'object') {
            const transformed: LeaveBalance = {
                annual: {
                    entitlement: data.annual?.entitlement || 0,
                    used: data.annual?.used || 0,
                    cashout: data.annual?.cashout || 0,
                    remaining: data.annual?.remaining || 0,
                    periods: data.annual?.periods || []
                },
                compensatory: {
                    entitlement: data.compensatory?.entitlement || 0,
                    used: data.compensatory?.used || 0,
                    cashout: data.compensatory?.cashout || 0,
                    remaining: data.compensatory?.remaining || 0,
                    overtime_total: data.compensatory?.overtime_total || 0,
                    periods: data.compensatory?.periods || []
                }
            };
            return transformed;
        }

        return null;
    } catch (error) {
        console.error('Error fetching leave balances:', error);
        return null;
    }
};

// 獲取所有員工的差勤餘額 (批次 RPC)
export const getAllEmployeesLeaveBalances = async (): Promise<{ employee_id: string; balance: LeaveBalance }[] | null> => {
    try {
        const { data, error } = await supabase.rpc('get_all_employees_leave_balances');
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error fetching all employees leave balances:', error);
        return null;
    }
};


// 獲取員工年資中斷記錄
export const getSenioritySuspensions = async (employeeId: string): Promise<any[]> => {
    try {
        const { data, error } = await supabase
            .from('seniority_suspensions')
            .select('*')
            .eq('employee_id', employeeId)
            .order('start_date', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching seniority suspensions:', error);
        return [];
    }
};

// 新增年資中斷記錄
export const addSenioritySuspension = async (data: {
    employee_id: string;
    start_date: string;
    end_date: string;
    reason?: string;
}) => {
    try {
        const { error } = await supabase
            .from('seniority_suspensions')
            .insert([data]);

        if (error) throw error;
        return { success: true };
    } catch (error: any) {
        console.error('Error adding seniority suspension:', error);
        return { success: false, error: error.message };
    }
};

// 刪除年資中斷記錄
export const deleteSenioritySuspension = async (id: string) => {
    try {
        const { error } = await supabase
            .from('seniority_suspensions')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return { success: true };
    } catch (error: any) {
        console.error('Error deleting seniority suspension:', error);
        return { success: false, error: error.message };
    }
};

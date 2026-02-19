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
        const { error } = await supabase
            .from('makeup_attendance_requests')
            .insert([{
                employee_id: employeeId,
                request_date: data.requestDate,
                check_type: data.checkType,
                request_time: data.requestTime,
                reason: data.reason,
                status: 'PENDING'
            }]);

        if (error) throw error;
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

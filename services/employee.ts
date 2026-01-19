import { supabase } from '../lib/supabase';

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

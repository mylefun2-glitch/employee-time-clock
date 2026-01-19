import { supabase } from '../lib/supabase';
import { Employee } from '../types';

export interface DashboardStats {
    totalEmployees: number;
    activeEmployees: number;
    todayAttendance: number;
}

export const getDashboardStats = async (): Promise<DashboardStats> => {
    try {
        // Total Employees
        const { count: totalEmployees, error: err1 } = await supabase
            .from('employees')
            .select('*', { count: 'exact', head: true });

        if (err1) throw err1;

        // Active Employees
        const { count: activeEmployees, error: err2 } = await supabase
            .from('employees')
            .select('*', { count: 'exact', head: true })
            .eq('is_active', true);

        if (err2) throw err2;

        // Today's Attendance
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { count: todayAttendance, error: err3 } = await supabase
            .from('attendance_logs')
            .select('*', { count: 'exact', head: true })
            .gte('timestamp', today.toISOString());

        if (err3) throw err3;

        return {
            totalEmployees: totalEmployees || 0,
            activeEmployees: activeEmployees || 0,
            todayAttendance: todayAttendance || 0
        };
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        return { totalEmployees: 0, activeEmployees: 0, todayAttendance: 0 };
    }
};

export const getRecentActivity = async () => {
    try {
        const { data, error } = await supabase
            .from('attendance_logs')
            .select(`
                *,
                employees (name, department)
            `)
            .order('timestamp', { ascending: false })
            .limit(30);

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error fetching recent activity:', error);
        return [];
    }
}

export const createEmployee = async (data: Partial<Employee>) => {
    try {
        const { error } = await supabase
            .from('employees')
            .insert([{
                ...data,
                is_active: true
            }]);

        if (error) throw error;
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
};

export const updateEmployee = async (id: string, updates: Partial<Employee>) => {
    try {
        const { error } = await supabase
            .from('employees')
            .update(updates)
            .eq('id', id);

        if (error) throw error;
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
};

export const deleteEmployee = async (id: string) => {
    try {
        // 使用軟刪除：將 is_active 設為 false，而非真正刪除記錄
        // 這樣可以保留歷史打卡記錄，避免外鍵約束問題
        const { error } = await supabase
            .from('employees')
            .update({ is_active: false })
            .eq('id', id);

        if (error) throw error;
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
};

export const getAttendanceLogs = async (startDate?: string, endDate?: string) => {
    try {
        let query = supabase
            .from('attendance_logs')
            .select(`
                *,
                employees (name, department, pin)
            `)
            .order('timestamp', { ascending: false });

        if (startDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            query = query.gte('timestamp', start.toISOString());
        }

        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            query = query.lte('timestamp', end.toISOString());
        }

        const { data, error } = await query;

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error fetching attendance logs:', error);
        return [];
    }
};

export const deleteAttendanceLog = async (id: string) => {
    try {
        const { error } = await supabase
            .from('attendance_logs')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return { success: true };
    } catch (error: any) {
        console.error('Error deleting attendance log:', error);
        return { success: false, error: error.message };
    }
};

// 補登申請管理（直屬主管審核）
export const getMakeupRequests = async (status?: string, managerId?: string) => {
    try {
        console.log('[getMakeupRequests] Called with:', { status, managerId });

        let query = supabase
            .from('makeup_attendance_requests')
            .select(`
                *,
                employee:employees(name, department, pin, manager_id)
            `)
            .order('created_at', { ascending: false });

        if (status && status !== 'ALL') {
            query = query.eq('status', status);
        }

        const { data, error } = await query;

        if (error) {
            console.error('[getMakeupRequests] Supabase error:', error);
            throw error;
        }

        console.log('[getMakeupRequests] Raw data from Supabase:', {
            count: data?.length || 0,
            data: data
        });

        // 如果指定了主管 ID，只返回該主管的直屬下屬的申請
        if (managerId) {
            const filtered = (data || []).filter((req: any) => {
                const match = req.employee?.manager_id === managerId;
                console.log('[getMakeupRequests] Filtering:', {
                    requestId: req.id,
                    employeeName: req.employee?.name,
                    employeeManagerId: req.employee?.manager_id,
                    targetManagerId: managerId,
                    match: match
                });
                return match;
            });

            console.log('[getMakeupRequests] Filtered results:', {
                count: filtered.length,
                data: filtered
            });

            return filtered;
        }

        return data;
    } catch (error) {
        console.error('Error fetching makeup requests:', error);
        return [];
    }
};

export const approveMakeupRequest = async (id: string, reviewerId: string, comment?: string) => {
    try {
        // 獲取申請資料
        const { data: request, error: fetchError } = await supabase
            .from('makeup_attendance_requests')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;

        // 建立打卡記錄
        const timestamp = new Date(request.request_date);
        const [hours, minutes] = request.request_time.split(':');
        timestamp.setHours(parseInt(hours), parseInt(minutes), 0, 0);

        const { error: insertError } = await supabase
            .from('attendance_logs')
            .insert([{
                employee_id: request.employee_id,
                check_type: request.check_type,
                timestamp: timestamp.toISOString(),
                is_makeup: true
            }]);

        if (insertError) throw insertError;

        // 更新申請狀態
        const { error: updateError } = await supabase
            .from('makeup_attendance_requests')
            .update({
                status: 'APPROVED',
                reviewer_id: reviewerId,
                reviewed_at: new Date().toISOString(),
                review_comment: comment
            })
            .eq('id', id);

        if (updateError) throw updateError;

        return { success: true };
    } catch (error: any) {
        console.error('Error approving makeup request:', error);
        return { success: false, error: error.message };
    }
};

export const rejectMakeupRequest = async (id: string, reviewerId: string, comment?: string) => {
    try {
        const { error } = await supabase
            .from('makeup_attendance_requests')
            .update({
                status: 'REJECTED',
                reviewer_id: reviewerId,
                reviewed_at: new Date().toISOString(),
                review_comment: comment
            })
            .eq('id', id);

        if (error) throw error;
        return { success: true };
    } catch (error: any) {
        console.error('Error rejecting makeup request:', error);
        return { success: false, error: error.message };
    }
};

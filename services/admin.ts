import { supabase } from '../lib/supabase';
// import { Employee } from './attendance'; // We will define types here or import

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
            .limit(10);

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error fetching recent activity:', error);
        return [];
    }
}

export const createEmployee = async (name: string, pin: string, department: string) => {
    try {
        const { error } = await supabase
            .from('employees')
            .insert([{ name, pin, department }]);

        if (error) throw error;
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
};

export const updateEmployee = async (id: string, updates: { name?: string; pin?: string; department?: string; is_active?: boolean }) => {
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

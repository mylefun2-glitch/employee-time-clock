
import { supabase } from '../lib/supabase';
import { LogEntry, CheckType, Employee } from '../types';

export const checkPin = async (pin: string): Promise<Employee | null> => {
    try {
        const { data, error } = await supabase
            .from('employees')
            .select('id, name, department')
            .eq('pin', pin)
            .eq('is_active', true)
            .single();

        if (error) {
            if (error.code !== 'PGRST116') { // PGRST116 is "The result contains 0 rows"
                console.error('Error checking PIN:', error);
            }
            return null;
        }

        return data as Employee;
    } catch (err) {
        console.error('Unexpected error checking PIN:', err);
        return null;
    }
};

export const logAttendance = async (
    employeeId: string,
    type: 'IN' | 'OUT',
    location?: { latitude: number; longitude: number; accuracy: number }
): Promise<{ success: boolean; error?: string }> => {
    try {
        // 檢查 5 分鐘內是否有重複的相同類型打卡
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

        const { data: recentLogs, error: checkError } = await supabase
            .from('attendance_logs')
            .select('id')
            .eq('employee_id', employeeId)
            .eq('check_type', type)
            .gt('timestamp', fiveMinutesAgo)
            .limit(1);

        if (checkError) {
            console.error('Error checking duplicate attendance:', checkError);
        } else if (recentLogs && recentLogs.length > 0) {
            return { success: false, error: '請勿在 5 分鐘內連續進行相同的打卡操作' };
        }

        const logData: any = {
            employee_id: employeeId,
            check_type: type,
            timestamp: new Date().toISOString()
        };

        // 如果有位置資訊，加入到記錄中
        if (location) {
            logData.latitude = location.latitude;
            logData.longitude = location.longitude;
            logData.location_accuracy = location.accuracy;
        }

        const { error } = await supabase
            .from('attendance_logs')
            .insert([logData]);

        if (error) {
            console.error('Error logging attendance:', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (err) {
        console.error('Unexpected error logging attendance:', err);
        return { success: false, error: 'Network or system error' };
    }
};

export const getRecentAttendance = async (employeeId: string, limit: number = 5): Promise<any[]> => {
    try {
        const { data, error } = await supabase
            .from('attendance_logs')
            .select('*')
            .eq('employee_id', employeeId)
            .order('timestamp', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Error fetching recent attendance:', error);
            return [];
        }

        return data || [];
    } catch (err) {
        console.error('Unexpected error fetching attendance logs:', err);
        return [];
    }
};

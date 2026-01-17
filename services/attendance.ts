
import { supabase } from '../lib/supabase';
import { LogEntry, CheckType } from '../types';

export interface Employee {
    id: string;
    name: string;
    department: string;
}

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

export const logAttendance = async (employeeId: string, type: 'IN' | 'OUT'): Promise<{ success: boolean; error?: string }> => {
    try {
        const { error } = await supabase
            .from('attendance_logs')
            .insert([
                {
                    employee_id: employeeId,
                    check_type: type,
                    timestamp: new Date().toISOString()
                }
            ]);

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

import { supabase } from '../lib/supabase';
import { EmployeeMovement } from '../types';

export const getEmployeeMovements = async (employeeId: string): Promise<EmployeeMovement[]> => {
    try {
        const { data, error } = await supabase
            .from('employee_movements')
            .select('*')
            .eq('employee_id', employeeId)
            .order('effective_date', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching employee movements:', error);
        return [];
    }
};

export const createEmployeeMovement = async (data: Omit<EmployeeMovement, 'id' | 'created_at'>) => {
    try {
        const { error } = await supabase
            .from('employee_movements')
            .insert([data]);

        if (error) throw error;
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
};

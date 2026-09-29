import { supabase } from '../lib/supabase';
import { CompanyHoliday } from '../types';

export const companyHolidayService = {
    async getAll(): Promise<CompanyHoliday[]> {
        const { data, error } = await supabase
            .from('company_holidays')
            .select('*')
            .order('holiday_date', { ascending: true });
        if (error) {
            console.error('Error fetching company holidays:', error);
            return [];
        }
        return data || [];
    },

    async create(input: Omit<CompanyHoliday, 'id' | 'created_at' | 'updated_at'>) {
        const { data, error } = await supabase
            .from('company_holidays')
            .insert([input])
            .select()
            .single();
        return error ? { success: false, error: error.message } : { success: true, data };
    },

    async update(id: string, input: Partial<Omit<CompanyHoliday, 'id' | 'created_at' | 'updated_at'>>) {
        const { data, error } = await supabase
            .from('company_holidays')
            .update(input)
            .eq('id', id)
            .select()
            .single();
        return error ? { success: false, error: error.message } : { success: true, data };
    },

    async remove(id: string) {
        const { error } = await supabase.from('company_holidays').delete().eq('id', id);
        return error ? { success: false, error: error.message } : { success: true };
    }
};

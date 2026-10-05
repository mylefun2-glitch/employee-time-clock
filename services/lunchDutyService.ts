import { supabase } from '../lib/supabase';

export interface LunchDuty {
    employee_id: string;
    duty_date: string;
    enabled: boolean;
    updated_by: string;
    updated_at: string;
}

export const lunchDutyService = {
    async list(employeeId: string, start: string, end: string): Promise<LunchDuty[]> {
        const { data, error } = await supabase.from('employee_lunch_duties')
            .select('employee_id,duty_date,enabled,updated_by,updated_at')
            .eq('employee_id', employeeId).gte('duty_date', start).lte('duty_date', end);
        if (error) throw error;
        return data || [];
    },
    async set(employeeId: string, localDate: string, enabled: boolean): Promise<LunchDuty> {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) throw new Error('請先以管理員身分登入');
        const payload = { enabled, updated_by: user.id, updated_at: new Date().toISOString() };
        const existing = await this.list(employeeId, localDate, localDate);
        const query = existing.length
            ? supabase.from('employee_lunch_duties').update(payload)
                .eq('employee_id', employeeId).eq('duty_date', localDate)
            : supabase.from('employee_lunch_duties').insert({ employee_id: employeeId, duty_date: localDate, ...payload });
        const { data, error } = await query.select().single();
        if (error) throw error;
        return data;
    }
};

import { supabase } from '../lib/supabase';

export type ActivityScope = 'ALL' | 'DEPARTMENTS' | 'EMPLOYEES';

export interface ImportantActivity {
    id: string;
    title: string;
    activity_date: string;
    start_time: string;
    end_time: string;
    scope_type: ActivityScope;
    departments?: string[];
    employee_ids?: string[];
    created_by?: string | null;
    created_at?: string;
    updated_at?: string;
}

const UNIT_ORDER = [
    '心安居',
    '居家',
    '行政',
    '專案組-社區交通車',
    '專案組-家事',
    '專案組-送餐',
    '專案組-乾燥車',
    '專案組-A單位'
];

export function sortDepartments(departments: string[]): string[] {
    const order = new Map(UNIT_ORDER.map((name, index) => [name, index]));
    return [...new Set(departments.map(d => d.trim()).filter(Boolean))].sort((a, b) => {
        const ai = order.get(a);
        const bi = order.get(b);
        if (ai !== undefined && bi !== undefined) return ai - bi;
        if (ai !== undefined) return -1;
        if (bi !== undefined) return 1;
        return a.localeCompare(b, 'zh-Hant');
    });
}

export const importantActivityService = {
    async getDepartments(): Promise<string[]> {
        const { data, error } = await supabase
            .from('employees')
            .select('department')
            .eq('is_active', true);
        if (error) throw error;
        return sortDepartments((data || []).map(row => row.department || ''));
    },

    async getEmployees(): Promise<{ id: string; name: string; department?: string | null }[]> {
        const { data, error } = await supabase
            .from('employees')
            .select('id, name, department')
            .eq('is_active', true)
            .order('name');
        if (error) throw error;
        return data || [];
    },

    async getForEmployee(employeeId: string, employeeDepartment: string, startDate: string, endDate: string): Promise<ImportantActivity[]> {
        const { data, error } = await supabase
            .from('important_activities')
            .select('*')
            .gte('activity_date', startDate)
            .lte('activity_date', endDate)
            .order('activity_date')
            .order('start_time');
        if (error) throw error;
        const activities = (data || []) as ImportantActivity[];
        const departmentActivityIds = new Set<string>();
        const employeeActivityIds = new Set<string>();
        if (employeeDepartment.trim()) {
            const { data: departmentRows, error: departmentError } = await supabase
                .from('important_activity_departments')
                .select('activity_id, department')
                .eq('department', employeeDepartment.trim());
            if (departmentError) throw departmentError;
            (departmentRows || []).forEach((row: any) => departmentActivityIds.add(row.activity_id));
        }
        if (employeeId) {
            const { data: employeeRows, error: employeeError } = await supabase
                .from('important_activity_employees')
                .select('activity_id, employee_id')
                .eq('employee_id', employeeId);
            if (employeeError) throw employeeError;
            (employeeRows || []).forEach((row: any) => employeeActivityIds.add(row.activity_id));
        }
        return activities.filter(activity =>
            activity.scope_type === 'ALL' ||
            (activity.scope_type === 'DEPARTMENTS' && departmentActivityIds.has(activity.id)) ||
            (activity.scope_type === 'EMPLOYEES' && employeeActivityIds.has(activity.id))
        );
    },

    async getAll(): Promise<ImportantActivity[]> {
        const { data, error } = await supabase
            .from('important_activities')
            .select('*, important_activity_departments(department), important_activity_employees(employee_id)')
            .order('activity_date', { ascending: false })
            .order('start_time', { ascending: false });
        if (error) throw error;
        return (data || []).map((row: any) => ({
            ...row,
            departments: (row.important_activity_departments || []).map((item: any) => item.department),
            employee_ids: (row.important_activity_employees || []).map((item: any) => item.employee_id)
        }));
    },

    async create(input: Omit<ImportantActivity, 'id' | 'departments' | 'employee_ids'> & { departments?: string[], employee_ids?: string[] }) {
        const { departments = [], employee_ids = [], ...activity } = input;
        const { data, error } = await supabase.from('important_activities').insert(activity).select().single();
        if (error) throw error;
        if (activity.scope_type === 'DEPARTMENTS' && departments.length) {
            const { error: unitError } = await supabase.from('important_activity_departments').insert(
                departments.map(department => ({ activity_id: data.id, department }))
            );
            if (unitError) throw unitError;
        }
        if (activity.scope_type === 'EMPLOYEES' && employee_ids.length) {
            const { error: employeeError } = await supabase.from('important_activity_employees').insert(
                employee_ids.map(employee_id => ({ activity_id: data.id, employee_id }))
            );
            if (employeeError) throw employeeError;
        }
        return data as ImportantActivity;
    },

    async update(id: string, input: Partial<Omit<ImportantActivity, 'id' | 'departments' | 'employee_ids'>> & { departments?: string[], employee_ids?: string[] }) {
        const { departments, employee_ids, ...activity } = input;
        const { data, error } = await supabase.from('important_activities').update(activity).eq('id', id).select().single();
        if (error) throw error;
        if (departments) {
            const { error: deleteError } = await supabase.from('important_activity_departments').delete().eq('activity_id', id);
            if (deleteError) throw deleteError;
            if (data.scope_type === 'DEPARTMENTS' && departments.length) {
                const { error: insertError } = await supabase.from('important_activity_departments').insert(
                    departments.map(department => ({ activity_id: id, department }))
                );
                if (insertError) throw insertError;
            }
        }
        if (employee_ids) {
            const { error: deleteError } = await supabase.from('important_activity_employees').delete().eq('activity_id', id);
            if (deleteError) throw deleteError;
            if (data.scope_type === 'EMPLOYEES' && employee_ids.length) {
                const { error: insertError } = await supabase.from('important_activity_employees').insert(
                    employee_ids.map(employee_id => ({ activity_id: id, employee_id }))
                );
                if (insertError) throw insertError;
            }
        }
        return data as ImportantActivity;
    },

    async remove(id: string) {
        const { error } = await supabase.from('important_activities').delete().eq('id', id);
        if (error) throw error;
    }
};

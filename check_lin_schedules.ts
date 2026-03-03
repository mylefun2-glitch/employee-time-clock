import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function diag() {
    const { data: emp } = await supabase.from('employees').select('id').eq('name', '林立心').single();
    if (!emp) {
        console.error('Employee not found');
        return;
    }

    const { data: schedules } = await supabase
        .from('employee_schedules')
        .select('*')
        .eq('employee_id', emp.id)
        .order('effective_date', { ascending: false });

    console.log('Employee Schedules for 林立心:');
    console.log(JSON.stringify(schedules, null, 2));

    const { data: empData } = await supabase
        .from('employees')
        .select('standard_daily_hours, work_start_time, work_end_time, break_start_time, break_end_time')
        .eq('id', emp.id)
        .single();

    console.log('\nCurrent Employee defaults:');
    console.log(JSON.stringify(empData, null, 2));
}

diag();

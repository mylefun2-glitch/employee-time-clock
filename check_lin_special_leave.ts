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

    const { data: types } = await supabase.from('leave_types').select('id').eq('code', 'ANNUAL');
    const annualId = types?.[0]?.id;

    const { data: reqs } = await supabase
        .from('leave_requests')
        .select('id, start_date, end_date, hours, status, type')
        .eq('employee_id', emp.id)
        .eq('leave_type_id', annualId)
        .gte('start_date', '2025-01-01')
        .order('start_date', { ascending: false });


    console.log('Special Leave Records for 林立心:');
    reqs?.forEach(r => {
        console.log(`${r.start_date} ~ ${r.end_date} | Hours: ${r.hours} | Status: ${r.status}`);
    });
}

diag();

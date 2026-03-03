import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function diag() {
    const { data: emp } = await supabase.from('employees').select('id, name').eq('name', '林立心').single();

    console.log('\nLin Li-xin 2019 Requests (Detailed):');
    const { data: reqs } = await supabase
        .from('leave_requests')
        .select('id, start_date, hours, status, type, leave_type_id, leave_types(code, name)')
        .eq('employee_id', emp.id)
        .gte('start_date', '2019-01-01')
        .lt('start_date', '2020-01-01');

    reqs.forEach(r => {
        console.log(`- ${r.start_date}: ${r.hours}h, Status: ${r.status}, Type: "${r.type}", LeaveCode: "${r.leave_types?.code}"`);
    });

    const filtered = reqs.filter(r => r.status === 'APPROVED' && r.type === 'LEAVE' && r.leave_types?.code === 'ANNUAL');
    console.log('\nFiltered (APPROVED + LEAVE + ANNUAL):', filtered.length, 'records');
    console.log('Total Hours of Filtered:', filtered.reduce((s, r) => s + (r.hours || 0), 0));
}

diag();

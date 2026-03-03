import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function backfill() {
    console.log('Fetching Lin Li-xin...');
    const { data: emp } = await supabase.from('employees').select('id').eq('name', '林立心').single();
    if (!emp) return;

    const { data: reqs } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('employee_id', emp.id)
        .is('hours', null);

    console.log(`Found ${reqs?.length || 0} records with NULL hours.`);
    if (!reqs) return;

    for (const r of reqs) {
        const start = new Date(r.start_date);
        const end = new Date(r.end_date);
        const diffMs = end.getTime() - start.getTime();
        const h = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;

        console.log(`Updating ${r.start_date} ~ ${r.end_date}: ${h}h`);

        await supabase
            .from('leave_requests')
            .update({ hours: h })
            .eq('id', r.id);
    }

    console.log('Backfill complete.');
}

backfill();

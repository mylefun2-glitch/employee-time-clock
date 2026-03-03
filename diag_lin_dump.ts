import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function diag() {
    const empId = '9c5c2330-09fb-4410-be2c-d37b733fbb55';
    const { data: types } = await supabase.from('leave_types').select('id').eq('code', 'ANNUAL');
    const annualId = types?.[0]?.id;

    const { data: reqs } = await supabase
        .from('leave_requests')
        .select('id, start_date, hours')
        .eq('employee_id', empId)
        .eq('leave_type_id', annualId)
        .eq('status', 'APPROVED');

    console.log(`Analyzing ${reqs?.length || 0} records...`);

    let total = 0;
    const stats: any = {};

    reqs?.forEach(r => {
        const h = r.hours || 0;
        total += h;
        const year = r.start_date.substring(0, 4);
        stats[year] = (stats[year] || 0) + h;
        if (h > 0) {
            console.log(`[NON-ZERO] ${r.start_date}: ${h}h (ID: ${r.id})`);
        }
    });

    console.log('\nYearly Totals:');
    console.log(JSON.stringify(stats, null, 2));
    console.log(`\nGrand Total: ${total}`);
}

diag();

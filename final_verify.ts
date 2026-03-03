import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
    const ids = [
        '9c5c2330-09fb-4410-be2c-d37b733fbb55',
        'a61d4e6a-c732-4b1c-8400-cede859241fe',
        'eda1c7e8-2b5d-4542-b96e-0a6bb3173e17'
    ];

    for (const id of ids) {
        console.log(`\nVerifying Employee ID: ${id}`);
        const { data, error } = await supabase.rpc('get_employee_leave_balances', { target_employee_id: id });

        if (error) {
            console.error('Error calling RPC:', JSON.stringify(error, null, 2));
            continue;
        }

        console.log('Raw Data Type:', typeof data);
        console.log('Raw Data:', JSON.stringify(data, null, 2));

        if (!Array.isArray(data)) {
            console.log('No balance data found (data is not an array).');
            continue;
        }

        const special = data.find(l => l.leave_type_name === '特休');
        console.log(`Special Leave Total Used: ${special?.total_used_hours ?? 0}h`);

        // Find 2017 rule period if exists
        const p2017 = data.find(l => l.period_label?.includes('2017'));
        if (p2017) {
            console.log(`2017 Rule Period: ${p2017.period_label}, Entitlement: ${p2017.entitlement_hours}h`);
        }
    }
}

verify();

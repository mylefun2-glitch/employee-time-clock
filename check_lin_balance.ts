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

    const { data: balance, error } = await supabase.rpc('get_employee_leave_balances', {
        target_employee_id: emp.id,
        target_date: '2026-02-19'
    });

    if (error) {
        console.error('Error fetching balance:', error);
        return;
    }

    console.log('Leave Balance for 林立心:');
    console.log(JSON.stringify(balance, null, 2));
}

diag();

import { createClient } from '@supabase/supabase-js';

const VITE_SUPABASE_URL = "https://dqnaeesdovovmblsyuma.supabase.co";
const VITE_SUPABASE_ANON_KEY = "sb_publishable_d0sbSqQRwllVCV7ydQNU7Q_VPQAs1tj";
const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

async function run() {
    const { data: emps } = await supabase.from('employees').select('id, name').eq('name', '陳諒');
    if (!emps || emps.length === 0) {
        console.log("No Chen Liang found");
        return;
    }
    const empId = emps[0].id;
    const { data, error } = await supabase.rpc('get_employee_leave_balances', { target_employee_id: empId });
    if(error) {
        console.error(error);
    } else {
        console.log("Annual Cashout:", data.annual.cashout);
        console.log("Comp Cashout:", data.compensatory.cashout);
    }
}
run();

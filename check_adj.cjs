
const { createClient } = require('@supabase/supabase-js');
const VITE_SUPABASE_URL = "https://dqnaeesdovovmblsyuma.supabase.co";
const VITE_SUPABASE_ANON_KEY = "sb_publishable_d0sbSqQRwllVCV7ydQNU7Q_VPQAs1tj";
const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);
async function run() {
    const { data } = await supabase.from('leave_balance_adjustments').select('*').eq('employee_id', '9c5c2330-09fb-4410-be2c-d37b733fbb55');
    console.log(JSON.stringify(data, null, 2));
}
run();

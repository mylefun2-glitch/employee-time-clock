const { createClient } = require('@supabase/supabase-js');
const VITE_SUPABASE_URL = "https://dqnaeesdovovmblsyuma.supabase.co";
const VITE_SUPABASE_ANON_KEY = "sb_publishable_d0sbSqQRwllVCV7ydQNU7Q_VPQAs1tj";
const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

async function check() {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: `
        SELECT prosrc 
        FROM pg_proc 
        WHERE proname = 'get_employee_leave_balances';
    `});
    if (error) console.error(error);
    else console.log(data);
}
check();

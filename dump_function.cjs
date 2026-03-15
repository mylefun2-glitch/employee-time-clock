const { createClient } = require('@supabase/supabase-js');
const VITE_SUPABASE_URL = "https://dqnaeesdovovmblsyuma.supabase.co";
const VITE_SUPABASE_ANON_KEY = "sb_publishable_d0sbSqQRwllVCV7ydQNU7Q_VPQAs1tj";
const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

async function run() {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: "SELECT pg_get_functiondef('get_employee_leave_balances(uuid, date)'::regprocedure);" });
    if (error) {
        console.error("Error:", error);
    } else {
        console.log("SUCCESS:");
        console.log(JSON.stringify(data));
    }
}
run();

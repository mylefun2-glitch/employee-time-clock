
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const VITE_SUPABASE_URL = "https://dqnaeesdovovmblsyuma.supabase.co";
const VITE_SUPABASE_ANON_KEY = "sb_publishable_d0sbSqQRwllVCV7ydQNU7Q_VPQAs1tj";
const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

async function deploy() {
    const sql = fs.readFileSync('update_leave_balance_function.sql', 'utf8');
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
    if (error) {
        if (error.message.includes('xists')) {
            // exec_sql might not exist, trying a different approach or assuming success if it was just a mock RPC
            console.error('RPC exec_sql failed:', error.message);
        } else {
            console.error('Error deploying SQL:', error.message);
        }
    } else {
        console.log('SQL deployed successfully via exec_sql');
    }
}
deploy();

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function deployFunction() {
    try {
        const env = fs.readFileSync('payroll/server/.env', 'utf8');
        const url = env.match(/SUPABASE_URL=["']?(.*?)["']?$/m)?.[1]?.trim();
        const serviceKey = env.match(/SUPABASE_KEY=["']?(.*?)["']?$/m)?.[1]?.trim();
        
        if (!url || !serviceKey) {
            console.error('❌ Error: Missing Supabase URL or key in payroll/server/.env');
            process.exit(1);
        }
        
        console.log('📡 Connecting to Supabase...');
        const supabase = createClient(url, serviceKey);
        
        console.log('📄 Reading get_all_leave_balances_rpc.sql...');
        const sql = fs.readFileSync('get_all_leave_balances_rpc.sql', 'utf8');
        
        console.log('🚀 Executing database update...');
        const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
        
        if (error) {
            console.log('⚠️ exec_sql RPC failed, trying Direct REST request...');
            const response = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': serviceKey,
                    'Authorization': `Bearer ${serviceKey}`
                },
                body: JSON.stringify({ sql_query: sql })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Deploy failed:', errorText);
                process.exit(1);
            }
        }
        
        console.log('✅ get_all_employees_leave_balances RPC function deployed successfully!');
        
    } catch (err) {
        console.error('❌ Unexpected error:', err.message);
        process.exit(1);
    }
}

deployFunction();

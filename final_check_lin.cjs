
const { createClient } = require('@supabase/supabase-js');
const VITE_SUPABASE_URL = "https://dqnaeesdovovmblsyuma.supabase.co";
const VITE_SUPABASE_ANON_KEY = "sb_publishable_d0sbSqQRwllVCV7ydQNU7Q_VPQAs1tj";
const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

const LIN_ID = '9c5c2330-09fb-4410-be2c-d37b733fbb55';

async function check() {
    const { data: balance, error } = await supabase.rpc('get_employee_leave_balances', {
        target_employee_id: LIN_ID
    });

    if (error) {
        console.error('Error fetching balance:', error);
        return;
    }

    console.log('--- Special Leave (Annual) Summary ---');
    console.log('Total Entitlement:', balance.annual.entitlement);
    console.log('Total Used:', balance.annual.used);
    console.log('Total Remaining:', balance.annual.remaining);

    console.log('\n--- Periods Detail ---');
    balance.annual.periods.forEach(p => {
        console.log(`${p.label}: Entitlement ${p.entitlement}, Used ${p.used}, Remaining ${p.remaining}`);
    });
}

check();

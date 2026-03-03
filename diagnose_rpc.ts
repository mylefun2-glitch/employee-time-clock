import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf8');
const env: Record<string, string> = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
        env[key.trim()] = value.trim();
    }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function diagnose() {
    const eid = '9c5c2330-09fb-4410-be2c-d37b733fbb55'; // Lin Li-xin
    const { data, error } = await supabase.rpc('get_employee_leave_balances', {
        target_employee_id: eid,
        target_date: new Date().toISOString().split('T')[0]
    });

    if (error) {
        console.error('RPC Error:', error);
        return;
    }

    console.log('--- Detailed Periods for Lin Li-xin ---');
    data.annual.periods.forEach((p: any) => {
        console.log(`\nLabel: ${p.label}`);
        console.log(`Range: ${p.start_date} ~ ${p.end_date}`);
        console.log(`Date Formula: ${p.date_formula || '(No shift)'}`);
        console.log(`Hours Formula: ${p.formula}`);
    });
}

diagnose();

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

async function checkData() {
    const eid = '9c5c2330-09fb-4410-be2c-d37b733fbb55'; // Lin Li-xin

    const { data: emp } = await supabase.from('employees').select('join_date').eq('id', eid).single();
    const { data: suspensions } = await supabase.from('seniority_suspensions').select('*').eq('employee_id', eid).order('start_date', { ascending: true });

    console.log('Employee Join Date:', emp?.join_date);
    console.log('Suspensions:');
    suspensions?.forEach(s => {
        console.log(`- ${s.start_date} ~ ${s.end_date} (${s.reason})`);
    });
}

checkData();

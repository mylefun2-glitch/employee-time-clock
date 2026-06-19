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

async function check() {
    const { data: emp } = await supabase.from('employees').select('*').like('name', '%林淑禎%').single();
    if (!emp) return;

    const { data: scheds } = await supabase.from('monthly_salary_schedules')
        .select('*')
        .eq('employee_id', emp.id)
        .gte('service_date', '2026-05-01')
        .lte('service_date', '2026-05-31');
    
    console.log("May Monthly Salary Schedules:");
    console.log(scheds);
}

check();

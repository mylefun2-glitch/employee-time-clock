import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// read .env
const envContent = fs.readFileSync('.env', 'utf-8');
const env: Record<string, string> = {};
for (const line of envContent.split('\n')) {
    const parts = line.split('=');
    if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim().replace(/['"]/g, '');
        env[key] = val;
    }
}

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseKey = env['VITE_SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing supabase url or key in env', env);
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log('Fetching Zeng Zeyu');
    // Find Zeng Zeyu
    const { data: employee, error: empErr } = await supabase
        .from('employees')
        .select('id, name')
        .eq('name', '曾澤瑜')
        .single();
    
    if (empErr) {
        console.error('Emp err:', empErr);
        return;
    }
    console.log('Employee:', employee);

    // Find the pending request
    const { data: reqs, error: reqErr } = await supabase
        .from('leave_requests')
        .select('id, start_date, end_date, leave_type_id, status, hours')
        .eq('employee_id', employee.id)
        .eq('status', 'PENDING')
        .order('start_date', { ascending: false });
    
    if (reqErr) {
        console.error('Req error:', reqErr);
        return;
    }
    console.log('Pending requests:', reqs);

    if (reqs && reqs.length > 0) {
        // Find the specific one from "2026-04-27"
        const targetReq = reqs.find(r => r.start_date.includes('2026-04-27')) || reqs[0];
        console.log('Trying to approve:', targetReq);
        const { error: updErr, data } = await supabase
            .from('leave_requests')
            .update({ status: 'APPROVED' })
            .eq('id', targetReq.id)
            .select();
        console.log('Update result data:', data);
        if (updErr) {
            console.error('Update error:', updErr);
        }
    }
}

main();

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

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
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { data: reqs } = await supabase
        .from('leave_requests')
        .select('id, start_date, end_date, status, requires_chairman_approval')
        .eq('employee_id', '3170c360-350c-42c9-bdd9-4e5a7d0520c5') // Zeng Zeyu
        .eq('start_date', '2026-04-27T00:00:00+00:00');

    console.log(reqs);

    // Also revert it back to PENDING so Chairman can see it
    if (reqs && reqs.length > 0 && reqs[0].status === 'APPROVED') {
        console.log('Reverting back to PENDING...');
        await supabase
            .from('leave_requests')
            .update({ status: 'PENDING' })
            .eq('id', reqs[0].id);
        console.log('Reverted');
    }
}

main();

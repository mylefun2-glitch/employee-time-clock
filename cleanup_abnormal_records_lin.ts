
import { createClient } from '@supabase/supabase-js';

const VITE_SUPABASE_URL = "https://dqnaeesdovovmblsyuma.supabase.co";
const VITE_SUPABASE_ANON_KEY = "sb_publishable_d0sbSqQRwllVCV7ydQNU7Q_VPQAs1tj";

const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

async function cleanup() {
    const employeeId = '9c5c2330-09fb-4410-be2c-d37b733fbb55';

    // 1. Get ANNUAL leave type ID
    const { data: leaveTypes } = await supabase
        .from('leave_types')
        .select('id')
        .eq('code', 'ANNUAL');

    if (!leaveTypes || leaveTypes.length === 0) {
        console.error('Annual leave type not found');
        return;
    }
    const annualId = leaveTypes[0].id;

    // 2. Scan for candidates
    const { data: candidates, error } = await supabase
        .from('leave_requests')
        .select('id, start_date, hours, reason, status')
        .eq('employee_id', employeeId)
        .eq('status', 'APPROVED')
        .eq('type', 'LEAVE')
        .eq('leave_type_id', annualId)
        .gte('start_date', '2020-01-01')
        .lte('start_date', '2021-12-31')
        .eq('hours', 4)
        .or('reason.eq.,reason.is.null');

    if (error) {
        console.error('Error fetching candidates:', error);
        return;
    }

    console.log(`Found ${candidates.length} abnormal records for deletion.`);

    if (candidates.length === 0) {
        console.log('No records matching criteria found.');
        return;
    }

    // 3. Batch delete (handling potential foreign key issues in a loop if needed, but these are simple requests)
    // To avoid circular refs like last time, we'll try to delete them one by one or in small chunks
    let deletedCount = 0;
    for (const rec of candidates) {
        // First clear references just in case there's modification links
        await supabase.from('leave_requests').update({ original_request_id: null, modified_by_request_id: null }).eq('id', rec.id);

        const { error: delErr } = await supabase
            .from('leave_requests')
            .delete()
            .eq('id', rec.id);

        if (delErr) {
            console.error(`Failed to delete ${rec.id}:`, delErr.message);
        } else {
            deletedCount++;
        }
    }

    console.log(`Successfully deleted ${deletedCount} records.`);

    // 4. Final Verification via RPC
    const { data: balance, error: rpcErr } = await supabase.rpc('get_employee_leave_balances', {
        target_employee_id: employeeId
    });

    if (rpcErr) {
        console.error('Error calling RPC:', rpcErr);
    } else {
        console.log('New Annual Leave Summary:');
        console.log(JSON.stringify(balance.annual, null, 2));
    }
}

cleanup();

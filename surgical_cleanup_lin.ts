
import { createClient } from '@supabase/supabase-js';

const VITE_SUPABASE_URL = "https://dqnaeesdovovmblsyuma.supabase.co";
const VITE_SUPABASE_ANON_KEY = "sb_publishable_d0sbSqQRwllVCV7ydQNU7Q_VPQAs1tj";
const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

async function surgicalCleanup() {
    const employeeId = '9c5c2330-09fb-4410-be2c-d37b733fbb55';

    // 1. Get ANNUAL leave type ID
    const { data: lt } = await supabase.from('leave_types').select('id').eq('code', 'ANNUAL');
    const leave_type_id = lt[0].id;

    // 2. Identify the 48 records in 2020
    const { data: targets, error } = await supabase
        .from('leave_requests')
        .select('id, start_date, hours, reason')
        .eq('employee_id', employeeId)
        .eq('status', 'APPROVED')
        .eq('leave_type_id', leave_type_id)
        .gte('start_date', '2020-01-01')
        .lte('start_date', '2020-12-31')
        .eq('hours', 4)
        .or('reason.eq.,reason.is.null');

    if (error) {
        console.error('Error identifying targets:', error);
        return;
    }

    console.log(`Identified ${targets.length} records in 2020 for deletion (Expected: 48).`);

    if (targets.length === 0) {
        console.log('No records found.');
        return;
    }

    // 3. Clear associations and delete
    let count = 0;
    for (const t of targets) {
        // Break the links
        await supabase.from('leave_requests').update({
            original_request_id: null,
            modified_by_request_id: null
        }).eq('id', t.id);

        // Also check if any OTHER record refers to this one and nullify it
        await supabase.from('leave_requests').update({ original_request_id: null }).eq('original_request_id', t.id);
        await supabase.from('leave_requests').update({ modified_by_request_id: null }).eq('modified_by_request_id', t.id);

        const { error: delErr } = await supabase.from('leave_requests').delete().eq('id', t.id);
        if (delErr) {
            console.error(`Failed to delete ${t.id}:`, delErr.message);
        } else {
            count++;
        }
    }

    console.log(`Successfully deleted ${count} records.`);

    // 4. Final Verification
    const { data: balance } = await supabase.rpc('get_employee_leave_balances', { target_employee_id: employeeId });
    console.log(`Final Used Hours: ${balance.annual.used}`);
    console.log(`Expected: 452`);
}

surgicalCleanup();

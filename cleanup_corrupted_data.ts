import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanup() {
    console.log('Searching for corrupted leave requests...');

    // Affected employee IDs found earlier
    const affectedIds = [
        '9c5c2330-09fb-4410-be2c-d37b733fbb55',
        'a61d4e6a-c732-4b1c-8400-cede859241fe',
        'eda1c7e8-2b5d-4542-b96e-0a6bb3173e17'
    ];

    const { data: allReqs, error } = await supabase
        .from('leave_requests')
        .select('id, start_date, end_date, hours, reason')
        .in('employee_id', affectedIds);

    if (error) {
        console.error('Error fetching records:', error);
        return;
    }

    const corrupted = allReqs?.filter(r => {
        const start = new Date(r.start_date);
        const end = new Date(r.end_date);
        return (r.hours < 0) || (end < start);
    });

    console.log(`Found ${corrupted?.length || 0} corrupted records.`);
    if (!corrupted || corrupted.length === 0) return;

    for (const r of corrupted) {
        console.log(`Fixing [ID: ${r.id}] ${r.start_date} ~ ${r.end_date} (Hours: ${r.hours})`);
        const { error: updateErr } = await supabase
            .from('leave_requests')
            .update({
                hours: 0,
                status: 'WITHDRAWN',
                reason: (r.reason || '') + ' [系統自動修復：結束時間早於開始時間]'
            })
            .eq('id', r.id);

        if (updateErr) {
            console.error(`Failed to update ${r.id}:`, updateErr);
        }
    }

    console.log('Cleanup complete.');
}

cleanup();

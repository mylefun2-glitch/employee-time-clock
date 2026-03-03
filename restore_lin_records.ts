
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const VITE_SUPABASE_URL = "https://dqnaeesdovovmblsyuma.supabase.co";
const VITE_SUPABASE_ANON_KEY = "sb_publishable_d0sbSqQRwllVCV7ydQNU7Q_VPQAs1tj";
const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

async function restore() {
    const content = fs.readFileSync('lin_detailed_reasons.txt', 'utf8');

    // Extract the JSON arrays for 2020 and 2021
    const rec2020Match = content.match(/--- Detailed Records for 2020 ---\n([\s\S]*?)\n--- Detailed Records for 2021 ---/);
    const rec2021Match = content.match(/--- Detailed Records for 2021 ---\n([\s\S]*?)$/);

    if (!rec2020Match || !rec2021Match) {
        console.error('Could not find record arrays in log file');
        return;
    }

    const rec2020 = JSON.parse(rec2020Match[1]);
    const rec2021 = JSON.parse(rec2021Match[1]);
    const allOriginal = [...rec2020, ...rec2021];

    console.log(`Original records in log: ${allOriginal.length}`);

    // Fetch current existing IDs to avoid duplicates
    const { data: existing } = await supabase.from('leave_requests').select('id').eq('employee_id', '9c5c2330-09fb-4410-be2c-d37b733fbb55');
    const existingIds = new Set(existing.map(r => r.id));

    const toRestore = allOriginal.filter(r => !existingIds.has(r.id));
    console.log(`Needs restoration: ${toRestore.length}`);

    // Note: We need the full record data to restore. 
    // Wait, lin_detailed_reasons.txt only has (id, start_date, hours, status, is_modified, reason).
    // Is this enough? No, leave_type_id, employee_id, type etc are missing!
    // BUT... I can fetch one existing record from 2024 to get the employee_id, leave_type_id (ANNUAL), and type.

    const { data: sample } = await supabase.from('leave_requests').select('*').eq('employee_id', '9c5c2330-09fb-4410-be2c-d37b733fbb55').limit(1);
    const employee_id = sample[0].employee_id;
    const type = 'LEAVE';

    const { data: lt } = await supabase.from('leave_types').select('id').eq('code', 'ANNUAL');
    const leave_type_id = lt[0].id;

    for (const r of toRestore) {
        // Reconstruct start/end time. 
        // Since original logs didn't have end_date, we'll assume start_date is the 08:00 start and end is start + hours.
        // Actually, start_date in DB is a timestamp. 
        // Let's check start_date format in log: "2020-01-10T00:00:00+00:00"
        const start = new Date(r.start_date);
        const end = new Date(start.getTime() + (r.hours * 60 * 60 * 1000));

        const { error } = await supabase.from('leave_requests').insert({
            id: r.id,
            employee_id,
            leave_type_id,
            type,
            start_date: r.start_date,
            end_date: end.toISOString(),
            hours: r.hours,
            status: r.status,
            is_modified: r.is_modified,
            reason: r.reason,
            created_at: r.start_date // Use start_date as created_at for historical records
        });

        if (error) {
            console.error(`Error restoring ${r.id}:`, error.message);
        }
    }

    console.log('Restoration attempt finished.');
}

restore();

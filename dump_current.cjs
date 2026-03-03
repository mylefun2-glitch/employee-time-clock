
const { createClient } = require('@supabase/supabase-js');
const VITE_SUPABASE_URL = "https://dqnaeesdovovmblsyuma.supabase.co";
const VITE_SUPABASE_ANON_KEY = "sb_publishable_d0sbSqQRwllVCV7ydQNU7Q_VPQAs1tj";
const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

const LIN_ID = '9c5c2330-09fb-4410-be2c-d37b733fbb55';

async function run() {
    const { data, error } = await supabase.from('leave_requests')
        .select('start_date, end_date, hours')
        .eq('employee_id', LIN_ID)
        .eq('status', 'APPROVED')
        .eq('type', 'LEAVE')
        .in('leave_type_id', (await supabase.from('leave_types').select('id').eq('code', 'ANNUAL')).data.map(t => t.id))
        .order('start_date', { ascending: true });

    if (error) {
        console.error(error);
        return;
    }

    data.forEach(r => {
        const start = new Date(r.start_date);
        const dateStr = start.getFullYear() + '/' + (start.getMonth() + 1) + '/' + start.getDate();
        const startTime = start.getHours().toString().padStart(2, '0') + ':' + start.getMinutes().toString().padStart(2, '0');

        const end = new Date(r.end_date);
        const endDateStr = end.getFullYear() + '/' + (end.getMonth() + 1) + '/' + end.getDate();
        const endTime = end.getHours().toString().padStart(2, '0') + ':' + end.getMinutes().toString().padStart(2, '0');

        console.log(`${dateStr}\t${startTime}\t${endDateStr}\t${endTime}\t${r.hours}`);
    });
}
run();

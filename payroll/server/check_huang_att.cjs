const { createClient } = require('@supabase/supabase-js');

const VITE_SUPABASE_URL = "https://dqnaeesdovovmblsyuma.supabase.co";
const VITE_SUPABASE_ANON_KEY = "sb_publishable_d0sbSqQRwllVCV7ydQNU7Q_VPQAs1tj";
const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data: logs } = await supabase.from('attendance_logs')
    .select('*')
    .eq('employee_id', '9980cfaf-b375-4db6-8338-91a98ad5b6e8')
    .gte('clock_in_time', '2026-05-01')
    .lte('clock_in_time', '2026-05-31');
  console.log(`Supabase attendance_logs count: ${logs?.length}`);
}

check();

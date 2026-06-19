const { createClient } = require('@supabase/supabase-js');

const VITE_SUPABASE_URL = "https://dqnaeesdovovmblsyuma.supabase.co";
const VITE_SUPABASE_ANON_KEY = "sb_publishable_d0sbSqQRwllVCV7ydQNU7Q_VPQAs1tj";
const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data: emp } = await supabase.from('employees').select('id, name').like('name', '%黃筱柔%').single();
  const { data: scheds } = await supabase.from('employee_schedules').select('*').eq('employee_id', emp.id);
  console.log('Employee Schedules:', scheds);
}
run();

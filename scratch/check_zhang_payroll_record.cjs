const { createClient } = require('@supabase/supabase-js');

const VITE_SUPABASE_URL = "https://dqnaeesdovovmblsyuma.supabase.co";
const VITE_SUPABASE_ANON_KEY = "sb_publishable_d0sbSqQRwllVCV7ydQNU7Q_VPQAs1tj";
const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data: emp } = await supabase.from('employees').select('id, name').like('name', '%張秀卿%').single();
  
  const { data: pr, error } = await supabase.from('payroll_records')
    .select('*')
    .eq('employee_id', emp.id)
    .eq('year', 2026)
    .eq('month', 5);
    
  console.log('Payroll Records:', JSON.stringify(pr, null, 2));
  if (error) console.error(error);
}

check();

import { createClient } from '@supabase/supabase-js';

const VITE_SUPABASE_URL = "https://dqnaeesdovovmblsyuma.supabase.co";
const VITE_SUPABASE_ANON_KEY = "sb_publishable_d0sbSqQRwllVCV7ydQNU7Q_VPQAs1tj";
const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data: emps, error: err } = await supabase.from('employees').select('id, name, join_date').limit(3);
  if (err) { console.error(err); return; }
  
  if (emps && emps.length > 0) {
    for (let emp of emps) {
      console.log("Testing with employee:", emp.name, emp.join_date);
      const { data, error } = await supabase.rpc('get_employee_leave_balances', {
        target_employee_id: emp.id,
        target_date: '2026-05-15'
      });
      console.log(error || JSON.stringify(data.annual.periods, null, 2));
    }
  }
}
check();

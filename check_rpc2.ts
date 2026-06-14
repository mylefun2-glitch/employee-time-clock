import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const VITE_SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data: emps, error: err } = await supabase.from('employees').select('id, name').limit(1);
  if (err) { console.error(err); return; }
  
  if (emps && emps.length > 0) {
    console.log("Testing with employee:", emps[0].name, emps[0].id);
    const { data, error } = await supabase.rpc('get_employee_leave_balances', {
      target_employee_id: emps[0].id,
      target_date: '2026-05-15'
    });
    console.log(error || data);
  }
}
check();

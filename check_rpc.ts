import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const VITE_SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.rpc('get_employee_leave_balances', {
    target_employee_id: 'e63286df-bfcc-429f-a2e1-45da812b18aa', // I will need a valid employee ID, or I'll just skip
    target_date: '2026-05-15'
  });
  console.log(error || data);
}
check();

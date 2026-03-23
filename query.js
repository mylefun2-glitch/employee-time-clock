import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.from('leave_requests')
    .select('id, employee_id, start_date, end_date, car_id, type, status, leave_type:leave_types(name), car:cars(plate_number)')
    .gte('start_date', '2026-03-29')
    .lte('end_date', '2026-03-30');
    
  console.log(JSON.stringify(data, null, 2));
}

check();

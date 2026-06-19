import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data: emp, error: empErr } = await supabase.from('employees').select('id, name, work_type').like('name', '%張秀卿%').single();
  if (empErr) {
    console.error(empErr);
    return;
  }
  console.log('Employee:', emp);

  const { data: att, error: attErr } = await supabase.from('attendance_logs')
    .select('*')
    .eq('employee_id', emp.id)
    .gte('date', '2026-05-01')
    .lte('date', '2026-05-31')
    .order('date');
  
  console.log('Attendance Count:', att?.length);
  
  let totalOt = 0;
  att?.forEach(a => {
    if (a.overtime_hours > 0) {
      console.log(`Date: ${a.date}, OT Hours: ${a.overtime_hours}, Makeup: ${a.is_makeup_workday}, Shift: ${a.shift_type}, Rest/Holiday: ${a.is_rest_day}/${a.is_holiday}`);
      totalOt += Number(a.overtime_hours);
    }
  });
  console.log('Total OT Hours calculated:', totalOt);
}

check();

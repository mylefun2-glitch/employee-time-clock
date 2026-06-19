const { createClient } = require('@supabase/supabase-js');

const VITE_SUPABASE_URL = "https://dqnaeesdovovmblsyuma.supabase.co";
const VITE_SUPABASE_ANON_KEY = "sb_publishable_d0sbSqQRwllVCV7ydQNU7Q_VPQAs1tj";
const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data: emp, error: empErr } = await supabase.from('employees').select('*').like('name', '%張秀卿%').single();
  if (empErr) {
    console.error('Error fetching employee:', empErr);
    return;
  }
  console.log('Employee:', emp);

  const { data: att, error: attErr } = await supabase.from('attendance_logs')
    .select('*')
    .eq('employee_id', emp.id)
    .gte('date', '2026-05-01')
    .lte('date', '2026-05-31')
    .order('date');
  
  if (attErr) {
    console.error('Error fetching attendance:', attErr);
    return;
  }

  console.log('Attendance Count:', att.length);
  
  let totalOt = 0;
  let totalWorkHours = 0;
  att.forEach(a => {
    if (a.overtime_hours > 0 || a.working_hours > 0) {
      console.log(`Date: ${a.date}, Work Hrs: ${a.working_hours}, OT Hrs: ${a.overtime_hours}, Makeup: ${a.is_makeup_workday}, Rest/Hol: ${a.is_rest_day}/${a.is_holiday}`);
      totalOt += Number(a.overtime_hours || 0);
      totalWorkHours += Number(a.working_hours || 0);
    }
  });
  console.log('Total Work Hours:', totalWorkHours);
  console.log('Total OT Hours calculated:', totalOt);
}

check();

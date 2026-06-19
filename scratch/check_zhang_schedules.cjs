const { createClient } = require('@supabase/supabase-js');

const VITE_SUPABASE_URL = "https://dqnaeesdovovmblsyuma.supabase.co";
const VITE_SUPABASE_ANON_KEY = "sb_publishable_d0sbSqQRwllVCV7ydQNU7Q_VPQAs1tj";
const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data: emp, error: empErr } = await supabase.from('employees').select('id, name, salary_type').like('name', '%張秀卿%').single();
  if (empErr) {
    console.error('Error fetching employee:', empErr);
    return;
  }
  console.log('Employee:', emp);

  const { data: scheds, error: schedsErr } = await supabase.from('monthly_salary_schedules')
    .select('service_date, service_mins, shift_type')
    .eq('employee_id', emp.id)
    .gte('service_date', '2026-05-01')
    .lte('service_date', '2026-05-31')
    .order('service_date');
  
  if (schedsErr) {
    console.error('Error fetching schedules:', schedsErr);
    return;
  }

  console.log(`Found ${scheds.length} schedule records`);
  
  const dailyData = {};
  scheds.forEach(s => {
    if (s.service_mins > 0) {
      if (!dailyData[s.service_date]) {
        dailyData[s.service_date] = { mins: 0, types: new Set() };
      }
      dailyData[s.service_date].mins += s.service_mins;
      if (s.shift_type) dailyData[s.service_date].types.add(s.shift_type);
    }
  });

  let overtimeHours = 0;
  let regularHours = 0;
  
  for (const date of Object.keys(dailyData)) {
    const hrs = dailyData[date].mins / 60;
    const types = Array.from(dailyData[date].types);
    const isNatHoliday = types.some(t => t.includes('國假') || t.includes('國定假日'));
    const isRoutineDayOff = types.some(t => t.includes('例假日'));
    const isRestDay = types.some(t => t.includes('休息日'));

    console.log(`Date: ${date}, Hrs: ${hrs}, Types: ${types.join(', ')}`);

    if (isNatHoliday || isRoutineDayOff) {
      overtimeHours += hrs;
    } else if (isRestDay) {
      overtimeHours += hrs;
    } else {
      if (hrs > 8) {
        regularHours += 8;
        overtimeHours += (hrs - 8);
      } else {
        regularHours += hrs;
      }
    }
  }

  console.log(`\nRegular Hours: ${regularHours}`);
  console.log(`Overtime Hours: ${overtimeHours}`);
}

check();

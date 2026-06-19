const { createClient } = require('@supabase/supabase-js');

const VITE_SUPABASE_URL = "https://dqnaeesdovovmblsyuma.supabase.co";
const VITE_SUPABASE_ANON_KEY = "sb_publishable_d0sbSqQRwllVCV7ydQNU7Q_VPQAs1tj";
const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data: scheds } = await supabase.from('monthly_salary_schedules')
    .select('service_date, service_mins, shift_type')
    .eq('employee_id', '9980cfaf-b375-4db6-8338-91a98ad5b6e8')
    .gte('service_date', '2026-05-01')
    .lte('service_date', '2026-05-31');

  let totalMins = 0;
  const empDailyData = {};
  scheds.forEach(sched => {
    if (sched.service_mins > 0) {
      if (!empDailyData[sched.service_date]) {
        empDailyData[sched.service_date] = { mins: 0, types: new Set() };
      }
      empDailyData[sched.service_date].mins += sched.service_mins;
      if (sched.shift_type) empDailyData[sched.service_date].types.add(sched.shift_type);
    }
  });

  let regularHours = 0;
  for (const date of Object.keys(empDailyData)) {
    const hrs = empDailyData[date].mins / 60;
    const types = Array.from(empDailyData[date].types);
    const isNatHoliday = types.some(t => t.includes('國假') || t.includes('國定假日'));
    const isRoutineDayOff = types.some(t => t.includes('例假日'));
    const isRestDay = types.some(t => t.includes('休息日'));

    if (isNatHoliday || isRoutineDayOff) {
      // OT
    } else if (isRestDay) {
      // OT
    } else {
      if (hrs > 8) regularHours += 8;
      else regularHours += hrs;
    }
  }

  console.log(`Huang Regular Hours: ${regularHours.toFixed(2)}`);
}

check();

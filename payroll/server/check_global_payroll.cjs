const { createClient } = require('@supabase/supabase-js');

const VITE_SUPABASE_URL = "https://dqnaeesdovovmblsyuma.supabase.co";
const VITE_SUPABASE_ANON_KEY = "sb_publishable_d0sbSqQRwllVCV7ydQNU7Q_VPQAs1tj";
const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

async function run() {
  const monthStartStr = '2026-05-01';
  const monthEndStr = '2026-05-31';

  let monthlySchedulesData = [];
  let hasMore = true;
  let fromIndex = 0;
  const step = 1000;
  
  while (hasMore) {
    const { data, error } = await supabase
      .from('monthly_salary_schedules')
      .select('employee_id, service_date, shift_type, service_mins')
      .gte('service_date', monthStartStr)
      .lte('service_date', monthEndStr)
      .order('employee_id')
      .order('service_date')
      .range(fromIndex, fromIndex + step - 1);
      
    if (error || !data || data.length === 0) {
      hasMore = false;
    } else {
      monthlySchedulesData = monthlySchedulesData.concat(data);
      if (data.length < step) hasMore = false;
      fromIndex += step;
    }
  }

  const { data: sbEmpsAll } = await supabase.from('employees').select('id, username');
  const uuidToEmpNoAll = {};
  if (sbEmpsAll) {
    sbEmpsAll.forEach(sbEmp => {
      let employeeNo = '';
      if (sbEmp.username && sbEmp.username.includes('@')) {
        employeeNo = sbEmp.username.split('@')[0].toUpperCase();
      } else {
        employeeNo = `EMP-${sbEmp.id.substring(0, 4).toUpperCase()}`;
      }
      uuidToEmpNoAll[sbEmp.id] = employeeNo;
    });
  }

  const shiftTypeMap = {};
  const scheduledHoursMap = {};
  const empDailyData = {};
  monthlySchedulesData.forEach(sched => {
    const empNo = uuidToEmpNoAll[sched.employee_id];
    if (empNo) {
      if (sched.shift_type) {
        const key = `${empNo}_${sched.service_date}`;
        if (!shiftTypeMap[key]) shiftTypeMap[key] = new Set();
        shiftTypeMap[key].add(sched.shift_type);
      }
      if (sched.service_mins > 0) {
        if (!empDailyData[empNo]) empDailyData[empNo] = {};
        if (!empDailyData[empNo][sched.service_date]) {
          empDailyData[empNo][sched.service_date] = { mins: 0, types: new Set() };
        }
        empDailyData[empNo][sched.service_date].mins += sched.service_mins;
        if (sched.shift_type) empDailyData[empNo][sched.service_date].types.add(sched.shift_type);
      }
    }
  });

  const empNoTarget = 'L2249522';
  const dailyData = empDailyData[empNoTarget];
  let regularHours = 0, overtimeHours = 0;
  for (const date of Object.keys(dailyData)) {
    const hrs = dailyData[date].mins / 60;
    const types = Array.from(dailyData[date].types);
    const isNatHoliday = types.some(t => t.includes('國假') || t.includes('國定假日'));
    const isRoutineDayOff = types.some(t => t.includes('例假日'));
    const isRestDay = types.some(t => t.includes('休息日'));
    
    if (isNatHoliday || isRoutineDayOff) {
      overtimeHours += hrs;
    } else if (isRestDay) {
      overtimeHours += hrs;
    } else {
      if (hrs > 8) {
        regularHours += 8;
        const dailyOt = hrs - 8;
        overtimeHours += dailyOt;
      } else {
        regularHours += hrs;
      }
    }
  }

  console.log(`L2249522 Hours: Reg ${regularHours}, OT ${overtimeHours}`);
  
  // also count how many records were found for her
  const zhangRecords = monthlySchedulesData.filter(x => uuidToEmpNoAll[x.employee_id] === empNoTarget);
  console.log('Zhang records count:', zhangRecords.length);
}

run();

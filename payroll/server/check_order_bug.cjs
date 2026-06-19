const { createClient } = require('@supabase/supabase-js');

const VITE_SUPABASE_URL = "https://dqnaeesdovovmblsyuma.supabase.co";
const VITE_SUPABASE_ANON_KEY = "sb_publishable_d0sbSqQRwllVCV7ydQNU7Q_VPQAs1tj";
const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

async function run() {
  const monthStartStr = '2026-05-01';
  const monthEndStr = '2026-05-31';

  // WITH ORDER BY (Correct way)
  let monthlySchedulesDataWithOrder = [];
  let hasMoreOrder = true;
  let fromIndexOrder = 0;
  const step = 1000;
  
  while (hasMoreOrder) {
    const { data, error } = await supabase
      .from('monthly_salary_schedules')
      .select('employee_id, service_date, shift_type, service_mins')
      .gte('service_date', monthStartStr)
      .lte('service_date', monthEndStr)
      .order('employee_id')
      .order('service_date')
      .range(fromIndexOrder, fromIndexOrder + step - 1);
      
    if (error || !data || data.length === 0) {
      hasMoreOrder = false;
    } else {
      monthlySchedulesDataWithOrder = monthlySchedulesDataWithOrder.concat(data);
      if (data.length < step) hasMoreOrder = false;
      fromIndexOrder += step;
    }
  }

  // WITHOUT ORDER BY (Buggy way)
  let monthlySchedulesDataBuggy = [];
  let hasMoreBuggy = true;
  let fromIndexBuggy = 0;
  
  while (hasMoreBuggy) {
    const { data, error } = await supabase
      .from('monthly_salary_schedules')
      .select('employee_id, service_date, shift_type, service_mins')
      .gte('service_date', monthStartStr)
      .lte('service_date', monthEndStr)
      .range(fromIndexBuggy, fromIndexBuggy + step - 1);
      
    if (error || !data || data.length === 0) {
      hasMoreBuggy = false;
    } else {
      monthlySchedulesDataBuggy = monthlySchedulesDataBuggy.concat(data);
      if (data.length < step) hasMoreBuggy = false;
      fromIndexBuggy += step;
    }
  }

  const empId = '9980cfaf-b375-4db6-8338-91a98ad5b6e8';
  
  const correctRecords = monthlySchedulesDataWithOrder.filter(x => x.employee_id === empId);
  const buggyRecords = monthlySchedulesDataBuggy.filter(x => x.employee_id === empId);
  
  console.log(`Correct records count: ${correctRecords.length}`);
  console.log(`Buggy records count: ${buggyRecords.length}`);
  
  let correctMins = 0;
  correctRecords.forEach(x => correctMins += x.service_mins);
  
  let buggyMins = 0;
  buggyRecords.forEach(x => buggyMins += x.service_mins);
  
  console.log(`Correct hours: ${correctMins / 60}`);
  console.log(`Buggy hours: ${buggyMins / 60}`);
}

run();

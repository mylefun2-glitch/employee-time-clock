const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://dqnaeesdovovmblsyuma.supabase.co',
  'sb_publishable_d0sbSqQRwllVCV7ydQNU7Q_VPQAs1tj'
);

async function checkZeroMins() {
  const { data, error } = await supabase
    .from('monthly_salary_schedules')
    .select('id, employee_id, service_date, shift_type, service_mins, employees(name)')
    .eq('service_mins', 0);
    
  if (error) {
    console.error('Error fetching 0-min schedules:', error);
  } else {
    console.log(`Found ${data.length} records with 0 mins:`);
    console.log(data);
  }
}

checkZeroMins();

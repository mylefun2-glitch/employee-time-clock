const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://dqnaeesdovovmblsyuma.supabase.co',
  'sb_publishable_d0sbSqQRwllVCV7ydQNU7Q_VPQAs1tj'
);

async function deleteZeroMins() {
  const { data, error } = await supabase
    .from('monthly_salary_schedules')
    .delete()
    .eq('service_mins', 0);
    
  if (error) {
    console.error('Error deleting 0-min schedules:', error);
  } else {
    console.log('Successfully deleted 0-min schedules.');
  }
}

deleteZeroMins();

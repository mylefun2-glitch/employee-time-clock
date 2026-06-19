const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://dqnaeesdovovmblsyuma.supabase.co',
  'sb_publishable_d0sbSqQRwllVCV7ydQNU7Q_VPQAs1tj'
);

async function main() {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('name', '鄭敏惠');

  if (error) {
    console.error('Error fetching employee:', error);
  } else {
    console.log('Employee data:', data);
  }
}

main();

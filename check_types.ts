import { supabase } from './lib/supabase'; async function check() { const { data } = await supabase.from('leave_types').select('*'); console.log(JSON.stringify(data, null, 2)); } check();

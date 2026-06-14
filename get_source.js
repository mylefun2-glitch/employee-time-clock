import { createClient } from '@supabase/supabase-js';

const supabase = createClient("https://dqnaeesdovovmblsyuma.supabase.co", "sb_publishable_d0sbSqQRwllVCV7ydQNU7Q_VPQAs1tj"); // I'll just skip auth and see if there is another way. Wait, anon key can't query pg_proc.

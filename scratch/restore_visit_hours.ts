import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf8');
const env: Record<string, string> = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
        env[key.trim()] = value.trim();
    }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
    console.log('=== 還原何伶真家訪時數為 1.0 ===');

    const visits = [
        '2f173616-adb6-484e-9fab-8584094d0029',
        'b3f2aaa3-ec2b-42b2-a635-c32af7b22561'
    ];

    for (const id of visits) {
        const { data, error } = await supabase
            .from('leave_requests')
            .update({ hours: 1.0 })
            .eq('id', id)
            .select();

        if (error) {
            console.error(`更新失敗 ${id}:`, error);
        } else {
            console.log(`更新成功！ID: ${id}, 更新後時數: ${data?.[0]?.hours} 小時`);
        }
    }
}

run().catch(console.error);

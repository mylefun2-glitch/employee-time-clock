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
    console.log('=== 開始更新資料庫中歷史差勤的時數 ===');

    const targets = [
        { name: '何伶真', date: '2026-05-13', newHours: 2.0 },
        { name: '林立心', date: '2026-05-05', newHours: 1.5 }
    ];

    for (const item of targets) {
        console.log(`\n--- 處理員工: ${item.name} (${item.date}) ---`);
        
        // 1. 取得員工 ID
        const { data: emp, error: empError } = await supabase
            .from('employees')
            .select('id')
            .eq('name', item.name)
            .single();

        if (empError || !emp) {
            console.error(`找不到員工 ${item.name}:`, empError);
            continue;
        }

        // 2. 尋找該日期範圍的 leave_requests
        const { data: requests, error: reqError } = await supabase
            .from('leave_requests')
            .select('id, start_date, end_date, hours, status')
            .eq('employee_id', emp.id)
            .gte('start_date', `${item.date}T00:00:00`)
            .lte('start_date', `${item.date}T23:59:59`);

        if (reqError || !requests || requests.length === 0) {
            console.error(`在 ${item.date} 找不到 ${item.name} 的任何差勤申請:`, reqError);
            continue;
        }

        console.log(`找到的差勤申請:`, requests);

        // 3. 更新這幾筆申請的 hours 欄位
        for (const req of requests) {
            console.log(`更新前時數: ${req.hours} 小時`);
            
            const { data: updated, error: updateError } = await supabase
                .from('leave_requests')
                .update({ hours: item.newHours })
                .eq('id', req.id)
                .select();

            if (updateError) {
                console.error(`更新差勤 ${req.id} 失敗:`, updateError);
            } else {
                console.log(`更新成功！更新後時數:`, updated?.[0]?.hours, `小時`);
            }
        }
    }
}

run().catch(console.error);

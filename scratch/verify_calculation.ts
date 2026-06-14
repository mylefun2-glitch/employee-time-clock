import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import { calculateLeaveHoursDetailed } from '../lib/leaveUtils';
import { parseISO } from 'date-fns';

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
    console.log('=== 開始驗證修復後的計算結果 ===');

    const employees = [
        { name: '何伶真', date: '2026-05-13', leaveStart: '15:30', leaveEnd: '17:30' },
        { name: '林立心', date: '2026-05-05', leaveStart: '14:48', leaveEnd: '16:18' }
    ];

    for (const item of employees) {
        console.log(`\n--- 驗證員工: ${item.name} ---`);
        const { data: emp } = await supabase.from('employees').select('*').eq('name', item.name).single();
        if (!emp) {
            console.error('找不到員工');
            continue;
        }

        // 班表歷史
        const { data: schedules } = await supabase.from('employee_schedules')
            .select('*')
            .eq('employee_id', emp.id)
            .lte('effective_date', item.date)
            .order('effective_date', { ascending: false });

        const schedule = schedules && schedules[0] ? schedules[0] : {
            work_start_time: emp.work_start_time || '08:00',
            work_end_time: emp.work_end_time || '17:00'
        };

        // 打卡 logs
        const { data: logs } = await supabase.from('attendance_logs')
            .select('*')
            .eq('employee_id', emp.id)
            .gte('timestamp', `${item.date}T00:00:00`)
            .lte('timestamp', `${item.date}T23:59:59`)
            .order('timestamp', { ascending: true });

        console.log(`打卡紀錄:`, logs?.map(l => `${l.check_type}: ${new Date(l.timestamp).toLocaleTimeString('zh-TW', { hour12: false })}`));

        // 計算當天的 flexOffsetMs
        let flexOffsetMs = 0;
        if (logs && logs.length >= 2) {
            const checkInLog = logs.find(l => l.check_type === 'IN');
            if (checkInLog) {
                const actualIn = new Date(checkInLog.timestamp);
                const [sh, sm] = schedule.work_start_time.split(':').map(Number);
                const schedIn = new Date(`${item.date}T00:00:00`);
                schedIn.setHours(sh, sm, 0, 0);

                const diffInMs = actualIn.getTime() - schedIn.getTime();
                const flexWindowMs = 30 * 60 * 1000;

                if (diffInMs <= 0) {
                    flexOffsetMs = 0;
                } else if (diffInMs <= flexWindowMs) {
                    flexOffsetMs = diffInMs;
                } else {
                    flexOffsetMs = flexWindowMs;
                }
            }
        }

        console.log(`計算出的 flexOffsetMs: ${flexOffsetMs} ms (${flexOffsetMs / 1000 / 60} 分鐘)`);

        // 請假區間
        const startDateTime = new Date(`${item.date}T${item.leaveStart}:00`);
        const endDateTime = new Date(`${item.date}T${item.leaveEnd}:00`);

        // 呼叫 calculateLeaveHoursDetailed，傳入 flexOffsetMs 進行計算
        const result = calculateLeaveHoursDetailed(
            startDateTime,
            endDateTime,
            emp,
            false,
            true,
            schedules || undefined,
            0,
            false,
            false,
            undefined,
            flexOffsetMs
        );

        console.log(`【計算結果】請假區間: ${item.leaveStart} ~ ${item.leaveEnd}`);
        console.log(`【結果詳情】:`, result);
        console.log(`【最終請假時數】: ${result.finalHours} 小時`);
    }
}

run().catch(console.error);

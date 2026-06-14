import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
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
    console.log('--- 診斷開始 ---');

    // 1. 查找員工
    const { data: employees } = await supabase.from('employees').select('*').in('name', ['何伶真', '林立心']);
    console.log('員工列表:', employees?.map(e => ({ id: e.id, name: e.name, work_start: e.work_start_time, work_end: e.work_end_time, salary_type: e.salary_type })));

    if (!employees) return;

    for (const emp of employees) {
        const dateStr = emp.name === '何伶真' ? '2026-05-13' : '2026-05-05';
        console.log(`\n=== 員工: ${emp.name} (${dateStr}) ===`);

        // 獲取班表歷史
        const { data: schedules } = await supabase.from('employee_schedules')
            .select('*')
            .eq('employee_id', emp.id)
            .lte('effective_date', dateStr)
            .order('effective_date', { ascending: false });
        console.log('有效班表歷史:', schedules);

        // 獲取當日 override
        const { data: overrides } = await supabase.from('employee_day_overrides')
            .select('*')
            .eq('employee_id', emp.id)
            .eq('override_date', dateStr);
        console.log('當日覆蓋:', overrides);

        // 獲取打卡 logs
        const { data: logs } = await supabase.from('attendance_logs')
            .select('*')
            .eq('employee_id', emp.id)
            .gte('timestamp', `${dateStr}T00:00:00`)
            .lte('timestamp', `${dateStr}T23:59:59`)
            .order('timestamp', { ascending: true });
        console.log('當日打卡:', logs?.map(l => ({ check_type: l.check_type, timestamp: l.timestamp })));

        // 獲取差勤申請
        const { data: leaves } = await supabase.from('leave_requests')
            .select('*, leave_type:leave_types(name, color)')
            .eq('employee_id', emp.id)
            .neq('status', 'WITHDRAWN');
        
        // 過濾當天實際重疊的
        const dayLeaves = leaves?.filter(leave => {
            const s = parseISO(leave.start_date);
            const e = parseISO(leave.end_date);
            const startOfDay = parseISO(`${dateStr}T00:00:00`);
            const endOfDay = parseISO(`${dateStr}T23:59:59`);
            return s <= endOfDay && e >= startOfDay;
        });

        console.log('當日差勤申請:', dayLeaves?.map(l => ({
            id: l.id,
            type: l.type,
            leave_name: l.leave_type?.name,
            start_date: l.start_date,
            end_date: l.end_date,
            hours: l.hours,
            status: l.status
        })));
    }
}

run();

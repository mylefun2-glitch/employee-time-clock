import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf-8');
const env: Record<string, string> = {};
for (const line of envContent.split('\n')) {
    const parts = line.split('=');
    if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim().replace(/['"]/g, '');
        env[key] = val;
    }
}

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseKey = env['VITE_SUPABASE_ANON_KEY'];
const supabase = createClient(supabaseUrl, supabaseKey);

// 簡單的工作日計算
function countWorkdays(startStr: string, endStr: string): number {
    const start = new Date(startStr);
    const end = new Date(endStr);
    
    // 設定為天級別以避免時間差影響
    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    
    let count = 0;
    const curDate = new Date(startDay.getTime());
    while (curDate <= endDay) {
        const dayOfWeek = curDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // 排除週六週日
            count++;
        }
        curDate.setDate(curDate.getDate() + 1);
    }
    return count;
}

async function main() {
    // 1. 先獲取所有主任級同仁的資訊
    const { data: emps, error: empError } = await supabase
        .from('employees')
        .select('id, name, position');
    
    if (empError) {
        console.error('Error fetching employees:', empError);
        return;
    }

    const directors = emps.filter(e => 
        e.position?.includes('主任') || 
        e.position?.includes('總幹事') ||
        ['李玉鳳', '林懇', '林明珠', '陳佩伶'].includes(e.name)
    );
    
    const directorIds = directors.map(d => d.id);
    const directorMap = directors.reduce((acc, curr) => {
        acc[curr.id] = curr;
        return acc;
    }, {} as Record<string, any>);

    console.log('Directors found:', directors.map(d => `${d.name} (${d.position})`));

    // 2. 獲取這些主任目前狀態為 PENDING 的請假紀錄
    const { data: reqs, error: reqError } = await supabase
        .from('leave_requests')
        .select('*')
        .in('employee_id', directorIds)
        .eq('status', 'PENDING');

    if (reqError) {
        console.error('Error fetching requests:', reqError);
        return;
    }

    if (!reqs || reqs.length === 0) {
        console.log('No pending requests found for directors.');
        return;
    }

    console.log(`Found ${reqs.length} pending requests:`);
    for (const req of reqs) {
        const directorName = directorMap[req.employee_id]?.name || '未知';
        const workdays = countWorkdays(req.start_date, req.end_date);
        console.log(`- ID: ${req.id}, 申請人: ${directorName}, 時間: ${req.start_date} -> ${req.end_date}, 工作日: ${workdays}天, 小時數: ${req.hours || 0}H`);
        
        // 3. 進行一次性修復
        if (workdays < 5) {
            console.log(`  -> 天數 < 5天，執行自動核准`);
            const { error: updateError } = await supabase
                .from('leave_requests')
                .update({
                    status: 'APPROVED',
                    approved_at: new Date().toISOString(),
                    approver_id: '153bf58a-bba6-4ba2-bd81-77f52299b0ad', // 理事長林文明
                    requires_chairman_approval: false,
                    supervisor_approved_at: new Date().toISOString(),
                    supervisor_approved_by: '153bf58a-bba6-4ba2-bd81-77f52299b0ad'
                })
                .eq('id', req.id);
            if (updateError) console.error('     Update failed:', updateError);
            else console.log('     Successfully approved!');
        } else {
            console.log(`  -> 天數 >= 5天，執行呈送理事長`);
            const { error: updateError } = await supabase
                .from('leave_requests')
                .update({
                    requires_chairman_approval: true,
                    supervisor_approved_at: new Date().toISOString(),
                    supervisor_approved_by: req.employee_id // 自己已簽
                })
                .eq('id', req.id);
            if (updateError) console.error('     Update failed:', updateError);
            else console.log('     Successfully routed to Chairman!');
        }
    }
}

main();

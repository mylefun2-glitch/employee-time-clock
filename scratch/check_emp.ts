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

async function main() {
    // 查詢李玉鳳
    const { data: yufeng } = await supabase
        .from('employees')
        .select('*')
        .eq('name', '李玉鳳')
        .maybeSingle();
    
    console.log('--- 李玉鳳 的資料庫欄位 ---');
    console.log(JSON.stringify(yufeng, null, 2));

    if (yufeng) {
        // 查詢她的下屬
        const { data: subs, count } = await supabase
            .from('employees')
            .select('id, name, department', { count: 'exact' })
            .eq('manager_id', yufeng.id);
        
        console.log(`\n--- 李玉鳳 的下屬 (共 ${count} 人) ---`);
        console.log(subs);

        // 查詢下屬是否有待審核的請假申請
        if (subs && subs.length > 0) {
            const subIds = subs.map(s => s.id);
            const { data: reqs } = await supabase
                .from('leave_requests')
                .select('id, employee_id, status, created_at')
                .in('employee_id', subIds)
                .in('status', ['PENDING', 'WITHDRAW_PENDING']);
            
            console.log('\n--- 下屬的待審核請假申請 ---');
            console.log(reqs);
        }
    }
}

main();

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function deployFunction() {
    try {
        // 讀取環境變數
        const env = fs.readFileSync('.env', 'utf8');
        const url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim();
        const serviceKey = env.match(/VITE_SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1]?.trim();
        
        if (!url || !serviceKey) {
            console.error('❌ 錯誤: 找不到 Supabase 連線資訊');
            console.error('請確認 .env 檔案中有 VITE_SUPABASE_URL 和 VITE_SUPABASE_SERVICE_ROLE_KEY');
            process.exit(1);
        }
        
        console.log('📡 連接到 Supabase...');
        const supabase = createClient(url, serviceKey);
        
        // 讀取 SQL 檔案
        console.log('📄 讀取 SQL 更新腳本...');
        const sql = fs.readFileSync('update_leave_balance_function.sql', 'utf8');
        
        // 執行 SQL
        console.log('🚀 執行資料庫更新...');
        const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
        
        if (error) {
            // 如果 exec_sql 不存在，嘗試直接執行
            console.log('⚠️  exec_sql RPC 不存在，嘗試使用 Supabase Management API...');
            
            const response = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': serviceKey,
                    'Authorization': `Bearer ${serviceKey}`
                },
                body: JSON.stringify({ sql_query: sql })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ 更新失敗:', errorText);
                console.log('\n📋 請手動執行以下步驟：');
                console.log('1. 登入 Supabase Dashboard');
                console.log('2. 進入 SQL Editor');
                console.log('3. 複製 update_leave_balance_function.sql 的內容');
                console.log('4. 貼上並執行');
                process.exit(1);
            }
        }
        
        console.log('✅ 資料庫函數更新成功！');
        console.log('\n📊 請重新整理差勤額度頁面以查看更新結果');
        
    } catch (err) {
        console.error('❌ 發生錯誤:', err.message);
        console.log('\n📋 請手動執行以下步驟：');
        console.log('1. 登入 Supabase Dashboard');
        console.log('2. 進入 SQL Editor');
        console.log('3. 複製 update_leave_balance_function.sql 的內容');
        console.log('4. 貼上並執行');
        process.exit(1);
    }
}

deployFunction();

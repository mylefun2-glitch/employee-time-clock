import { createClient } from '@supabase/supabase-js';

// 直接從環境變數讀取
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    console.error('錯誤: 請設定 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY 環境變數');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * 查詢加班紀錄
 * 包含：加班登記 (OT)、加班折現 (CO)、加班折算補休 (ALC)
 */
async function queryOvertimeRecords() {
    try {
        console.log('正在查詢加班紀錄...\n');

        // 查詢所有加班相關的請假類型
        const { data: leaveTypes, error: typeError } = await supabase
            .from('leave_types')
            .select('id, code, name')
            .or('code.eq.OT,code.eq.CO,code.eq.ALC,name.ilike.%加班%');

        if (typeError) {
            console.error('查詢請假類型時發生錯誤:', typeError);
            return;
        }

        console.log('找到以下加班類型:');
        leaveTypes?.forEach(type => {
            console.log(`  - ${type.name} (${type.code})`);
        });
        console.log('');

        const leaveTypeIds = leaveTypes?.map(t => t.id) || [];

        if (leaveTypeIds.length === 0) {
            console.log('系統中沒有設定加班類型');
            return;
        }

        // 查詢加班紀錄
        const { data: overtimeRecords, error: recordError } = await supabase
            .from('leave_requests')
            .select(`
                id,
                start_date,
                end_date,
                hours,
                status,
                reason,
                created_at,
                approved_at,
                employee:employees!leave_requests_employee_id_fkey(name, department),
                leave_type:leave_types(name, code)
            `)
            .in('leave_type_id', leaveTypeIds)
            .order('start_date', { ascending: false })
            .limit(100);

        if (recordError) {
            console.error('查詢加班紀錄時發生錯誤:', recordError);
            return;
        }

        if (!overtimeRecords || overtimeRecords.length === 0) {
            console.log('目前沒有加班紀錄');
            return;
        }

        console.log(`共找到 ${overtimeRecords.length} 筆加班紀錄:\n`);
        console.log('='.repeat(120));

        // 按狀態分組統計
        const statusGroups = {
            APPROVED: overtimeRecords.filter(r => r.status === 'APPROVED'),
            PENDING: overtimeRecords.filter(r => r.status === 'PENDING'),
            REJECTED: overtimeRecords.filter(r => r.status === 'REJECTED'),
            WITHDRAWN: overtimeRecords.filter(r => r.status === 'WITHDRAWN')
        };

        console.log('\n📊 統計摘要:');
        console.log(`  ✅ 已核准: ${statusGroups.APPROVED.length} 筆 (${statusGroups.APPROVED.reduce((sum, r) => sum + (r.hours || 0), 0).toFixed(1)} 小時)`);
        console.log(`  ⏳ 待審核: ${statusGroups.PENDING.length} 筆 (${statusGroups.PENDING.reduce((sum, r) => sum + (r.hours || 0), 0).toFixed(1)} 小時)`);
        console.log(`  ❌ 已拒絕: ${statusGroups.REJECTED.length} 筆`);
        console.log(`  🔙 已撤回: ${statusGroups.WITHDRAWN.length} 筆`);
        console.log('');

        // 按員工分組統計（僅已核准）
        const employeeStats = new Map<string, { name: string; department: string; hours: number; count: number }>();
        statusGroups.APPROVED.forEach(record => {
            const empName = (record.employee as any)?.name || '未知';
            const empDept = (record.employee as any)?.department || '未知';
            const key = empName;

            if (!employeeStats.has(key)) {
                employeeStats.set(key, { name: empName, department: empDept, hours: 0, count: 0 });
            }

            const stat = employeeStats.get(key)!;
            stat.hours += record.hours || 0;
            stat.count += 1;
        });

        console.log('👥 員工加班統計 (已核准):');
        const sortedEmployees = Array.from(employeeStats.values()).sort((a, b) => b.hours - a.hours);
        sortedEmployees.forEach((stat, index) => {
            console.log(`  ${index + 1}. ${stat.name} (${stat.department}): ${stat.hours.toFixed(1)} 小時 (${stat.count} 筆)`);
        });
        console.log('');

        // 顯示詳細紀錄
        console.log('📋 詳細紀錄列表:');
        console.log('='.repeat(120));

        overtimeRecords.forEach((record, index) => {
            const empName = (record.employee as any)?.name || '未知';
            const empDept = (record.employee as any)?.department || '未知';
            const leaveTypeName = (record.leave_type as any)?.name || '未知';
            const startDate = new Date(record.start_date).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
            const endDate = new Date(record.end_date).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });

            const statusIcon = {
                APPROVED: '✅',
                PENDING: '⏳',
                REJECTED: '❌',
                WITHDRAWN: '🔙'
            }[record.status] || '❓';

            console.log(`\n${index + 1}. ${statusIcon} ${empName} (${empDept})`);
            console.log(`   類型: ${leaveTypeName}`);
            console.log(`   時間: ${startDate} ~ ${endDate}`);
            console.log(`   時數: ${record.hours || 0} 小時`);
            console.log(`   狀態: ${record.status}`);
            if (record.reason) {
                console.log(`   原因: ${record.reason}`);
            }
            if (record.approved_at) {
                console.log(`   核准時間: ${new Date(record.approved_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}`);
            }
        });

        console.log('\n' + '='.repeat(120));
        console.log('查詢完成！');

    } catch (error) {
        console.error('發生未預期的錯誤:', error);
    }
}

// 執行查詢
queryOvertimeRecords();

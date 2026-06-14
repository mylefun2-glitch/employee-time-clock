import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import { requestService } from '../services/requestService';
import { RequestStatus } from '../types';

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
    console.log('=== 開始驗證差勤與公務車狀態同步功能 ===');

    // 動態獲取第一個可用的員工、公務車和請假類型，以防特定資料缺失
    const { data: emps } = await supabase.from('employees').select('id, name').eq('is_active', true).limit(1);
    const { data: cars } = await supabase.from('cars').select('id, plate_number').limit(1);
    const { data: leaveTypes } = await supabase.from('leave_types').select('id, code, name').limit(1);

    if (!emps || emps.length === 0 || !cars || cars.length === 0 || !leaveTypes || leaveTypes.length === 0) {
        console.error('測試基礎資料缺失！');
        return;
    }

    const emp = emps[0];
    const car = cars[0];
    const leaveType = leaveTypes[0];
    const testEmployeeId = emp.id;
    const testCarId = car.id;
    const testLeaveTypeId = leaveType.id;
    const testApproverId = '80ce2560-b8b5-4fa2-b5de-0e4399eec0e2'; // 林懇

    console.log(`測試員工: ${emp.name} (ID: ${testEmployeeId})`);
    console.log(`測試公務車: ${car.plate_number} (ID: ${testCarId})`);
    console.log(`測試差勤類型: ${leaveType.name} (ID: ${testLeaveTypeId})`);

    const createdLeaveRequestIds: string[] = [];

    try {
        // --- 測試場景 A: 差勤被拒絕時，公務車同步被拒絕 ---
        console.log('\n--- 測試場景 A: 差勤被拒絕 ---');
        const reqA = {
            employee_id: testEmployeeId,
            type: 'LEAVE' as any,
            leave_type_id: testLeaveTypeId,
            start_date: '2026-06-15T09:00:00+08:00',
            end_date: '2026-06-15T12:00:00+08:00',
            reason: '車輛同步測試 A',
            hours: 3,
            car_id: testCarId
        };

        const resA = await requestService.createRequest(reqA);
        if (!resA.success || !resA.data) {
            throw new Error(`建立申請 A 失敗: ${resA.error}`);
        }
        const leaveReqIdA = resA.data.id;
        createdLeaveRequestIds.push(leaveReqIdA);
        console.log(`成功建立差勤申請 A, ID: ${leaveReqIdA}`);

        // 驗證車輛申請已在 PENDING
        const { data: carReqPreA } = await supabase.from('car_usage_requests')
            .select('*')
            .eq('employee_id', testEmployeeId)
            .eq('car_id', testCarId)
            .eq('start_time', reqA.start_date)
            .eq('end_time', reqA.end_date)
            .single();
        
        console.log(`車輛借用申請 A 建立成功，初始狀態: ${carReqPreA?.status}`);

        // 審核拒絕該請假
        console.log('正在審核拒絕差勤申請 A...');
        const updateResA = await requestService.updateRequestStatus(leaveReqIdA, RequestStatus.REJECTED, testApproverId);
        if (!updateResA.success) {
            throw new Error(`審核拒絕差勤 A 失敗: ${updateResA.error}`);
        }

        // 驗證車輛借用是否已同步變更為 REJECTED
        const { data: carReqPostA } = await supabase.from('car_usage_requests')
            .select('*')
            .eq('employee_id', testEmployeeId)
            .eq('car_id', testCarId)
            .eq('start_time', reqA.start_date)
            .eq('end_time', reqA.end_date)
            .single();

        console.log(`【驗證結果】公務車申請 A 的最新狀態: ${carReqPostA?.status}`);
        console.log(`【驗證結果】公務車申請 A 的審核備註: "${carReqPostA?.review_comment}"`);

        if (carReqPostA?.status === 'REJECTED') {
            console.log('✅ 測試場景 A 通過！');
        } else {
            console.error('❌ 測試場景 A 失敗！狀態未正確同步。');
        }


        // --- 測試場景 B: 差勤被撤回時，公務車同步被拒絕 ---
        console.log('\n--- 測試場景 B: 差勤被撤回 ---');
        const reqB = {
            employee_id: testEmployeeId,
            type: 'LEAVE' as any,
            leave_type_id: testLeaveTypeId,
            start_date: '2026-06-16T09:00:00+08:00',
            end_date: '2026-06-16T12:00:00+08:00',
            reason: '車輛同步測試 B',
            hours: 3,
            car_id: testCarId
        };

        const resB = await requestService.createRequest(reqB);
        if (!resB.success || !resB.data) {
            throw new Error(`建立申請 B 失敗: ${resB.error}`);
        }
        const leaveReqIdB = resB.data.id;
        createdLeaveRequestIds.push(leaveReqIdB);
        console.log(`成功建立差勤申請 B, ID: ${leaveReqIdB}`);

        // 先核准差勤申請 B
        console.log('正在核准差勤申請 B...');
        await requestService.updateRequestStatus(leaveReqIdB, RequestStatus.APPROVED, testApproverId);

        // 員工撤回差勤申請 B (進入撤回待審)
        console.log('員工發起撤回差勤申請 B...');
        const withdrawRes = await requestService.withdrawRequest(leaveReqIdB, testEmployeeId);
        if (!withdrawRes.success) {
            throw new Error(`發起撤回失敗: ${withdrawRes.error}`);
        }

        // 主管核准撤回 (將狀態更新為 WITHDRAWN)
        console.log('主管核准撤回差勤申請 B...');
        const updateResB = await requestService.updateRequestStatus(leaveReqIdB, RequestStatus.APPROVED, testApproverId);
        if (!updateResB.success) {
            throw new Error(`主管核准撤回失敗: ${updateResB.error}`);
        }

        // 驗證車輛借用是否已同步變更為 REJECTED
        const { data: carReqPostB } = await supabase.from('car_usage_requests')
            .select('*')
            .eq('employee_id', testEmployeeId)
            .eq('car_id', testCarId)
            .eq('start_time', reqB.start_date)
            .eq('end_time', reqB.end_date)
            .single();

        console.log(`【驗證結果】公務車申請 B 的最新狀態: ${carReqPostB?.status}`);
        console.log(`【驗證結果】公務車申請 B 的審核備註: "${carReqPostB?.review_comment}"`);

        if (carReqPostB?.status === 'REJECTED') {
            console.log('✅ 測試場景 B 通過！');
        } else {
            console.error('❌ 測試場景 B 失敗！狀態未正確同步。');
        }

    } finally {
        // 清理測試資料，保持資料庫乾淨
        console.log('\n--- 正在清理測試資料 ---');
        if (createdLeaveRequestIds.length > 0) {
            // 1. 刪除關聯的 car_usage_requests
            const { error: carErr } = await supabase.from('car_usage_requests')
                .delete()
                .eq('employee_id', testEmployeeId)
                .eq('car_id', testCarId)
                .in('purpose', ['車輛同步測試 A', '車輛同步測試 B', '差勤併同借車']);
            
            if (carErr) console.error('清理 car_usage_requests 失敗:', carErr);

            // 2. 刪除 leave_requests
            const { error: leaveErr } = await supabase.from('leave_requests')
                .delete()
                .in('id', createdLeaveRequestIds);
            
            if (leaveErr) console.error('清理 leave_requests 失敗:', leaveErr);

            console.log('🧹 測試資料清理完成，資料庫已恢復乾淨狀態。');
        }
    }
}

run().catch(console.error);

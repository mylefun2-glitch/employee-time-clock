import { supabase } from '../lib/supabase';
import { Employee, CheckType, EmployeeSchedule } from '../types';

export interface DashboardStats {
    totalEmployees: number;
    activeEmployees: number;
    todayAttendance: number;
}

export const getDashboardStats = async (): Promise<DashboardStats> => {
    try {
        // Total Employees
        const { count: totalEmployees, error: err1 } = await supabase
            .from('employees')
            .select('*', { count: 'exact', head: true });

        if (err1) throw err1;

        // Active Employees
        const { count: activeEmployees, error: err2 } = await supabase
            .from('employees')
            .select('*', { count: 'exact', head: true })
            .eq('is_active', true);

        if (err2) throw err2;

        // Today's Attendance
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { count: todayAttendance, error: err3 } = await supabase
            .from('attendance_logs')
            .select('*', { count: 'exact', head: true })
            .gte('timestamp', today.toISOString());

        if (err3) throw err3;

        return {
            totalEmployees: totalEmployees || 0,
            activeEmployees: activeEmployees || 0,
            todayAttendance: todayAttendance || 0
        };
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        return { totalEmployees: 0, activeEmployees: 0, todayAttendance: 0 };
    }
};

export const getRecentActivity = async () => {
    try {
        const { data, error } = await supabase
            .from('attendance_logs')
            .select(`
                *,
                employees (name, department)
            `)
            .order('timestamp', { ascending: false })
            .limit(30);

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error fetching recent activity:', error);
        return [];
    }
}

export const createEmployee = async (data: Partial<Employee>) => {
    try {
        const { data: createdData, error } = await supabase
            .from('employees')
            .upsert([{
                ...data,
                is_active: true
            }], {
                onConflict: 'pin',
                ignoreDuplicates: false
            })
            .select()
            .single();

        if (error) throw error;
        return { success: true, data: createdData };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
};

export const updateEmployee = async (id: string, updates: Partial<Employee>) => {
    try {
        const { error } = await supabase
            .from('employees')
            .update(updates)
            .eq('id', id);

        if (error) throw error;
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
};

/**
 * 獲取員工班表紀錄
 */
export const getEmployeeSchedules = async (employeeId: string): Promise<EmployeeSchedule[]> => {
    try {
        const { data, error } = await supabase
            .from('employee_schedules')
            .select('*')
            .eq('employee_id', employeeId)
            .order('effective_date', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching employee schedules:', error);
        return [];
    }
};

export const addEmployeeSchedule = async (data: Partial<EmployeeSchedule>) => {
    try {
        const { error } = await supabase
            .from('employee_schedules')
            .upsert([data]);

        if (error) throw error;

        // 同步更新員工主表的「當前」最新設定
        if (data.employee_id) {
            const { data: latestSchedule, error: fetchError } = await supabase
                .from('employee_schedules')
                .select('*')
                .eq('employee_id', data.employee_id)
                .order('effective_date', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (fetchError) throw fetchError;

            const updates = latestSchedule ? {
                work_start_time: latestSchedule.work_start_time,
                work_end_time: latestSchedule.work_end_time,
                break_start_time: latestSchedule.break_start_time,
                break_end_time: latestSchedule.break_end_time,
                break2_start_time: latestSchedule.break2_start_time,
                break2_end_time: latestSchedule.break2_end_time,
                break3_start_time: latestSchedule.break3_start_time,
                break3_end_time: latestSchedule.break3_end_time,
                rest_days: latestSchedule.rest_days,
                salary_type: latestSchedule.salary_type,
                standard_daily_hours: latestSchedule.standard_daily_hours,
                base_salary: latestSchedule.base_salary,
                hourly_rate: latestSchedule.hourly_rate,
                allowance_manager: latestSchedule.allowance_manager,
                allowance_license: latestSchedule.allowance_license,
                other_allowance: latestSchedule.other_allowance
            } : {
                work_start_time: '08:00',
                work_end_time: '17:00',
                break_start_time: '12:00',
                break_end_time: '13:00',
                break2_start_time: null,
                break2_end_time: null,
                break3_start_time: null,
                break3_end_time: null,
                rest_days: [0, 6],
                salary_type: 'MONTHLY',
                standard_daily_hours: 8.0,
                base_salary: 0,
                hourly_rate: 0,
                allowance_manager: 0,
                allowance_license: 0,
                other_allowance: 0
            };

            const { error: updateError } = await supabase
                .from('employees')
                .update(updates)
                .eq('id', data.employee_id);

            if (updateError) throw updateError;
        }

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
};

/**
 * 刪除員工班表紀錄，並同步更新主表設定
 */
export const deleteEmployeeSchedule = async (id: string, employeeId: string) => {
    try {
        // 1. 刪除班表歷史紀錄
        const { error: deleteError } = await supabase
            .from('employee_schedules')
            .delete()
            .eq('id', id);

        if (deleteError) throw deleteError;

        // 2. 找出剩餘的最新的有效紀錄
        const { data: latestSchedule, error: fetchError } = await supabase
            .from('employee_schedules')
            .select('*')
            .eq('employee_id', employeeId)
            .order('effective_date', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (fetchError) throw fetchError;

        // 3. 同步回員工主表 (若無紀錄則恢復預設)
        const updates = latestSchedule ? {
            work_start_time: latestSchedule.work_start_time,
            work_end_time: latestSchedule.work_end_time,
            break_start_time: latestSchedule.break_start_time,
            break_end_time: latestSchedule.break_end_time,
            break2_start_time: latestSchedule.break2_start_time,
            break2_end_time: latestSchedule.break2_end_time,
            break3_start_time: latestSchedule.break3_start_time,
            break3_end_time: latestSchedule.break3_end_time,
            rest_days: latestSchedule.rest_days,
            salary_type: latestSchedule.salary_type,
            standard_daily_hours: latestSchedule.standard_daily_hours,
            base_salary: latestSchedule.base_salary,
            hourly_rate: latestSchedule.hourly_rate,
            allowance_manager: latestSchedule.allowance_manager,
            allowance_license: latestSchedule.allowance_license,
            other_allowance: latestSchedule.other_allowance
        } : {
            work_start_time: '08:00',
            work_end_time: '17:00',
            break_start_time: '12:00',
            break_end_time: '13:00',
            break2_start_time: null,
            break2_end_time: null,
            break3_start_time: null,
            break3_end_time: null,
            rest_days: [0, 6],
            salary_type: 'MONTHLY',
            standard_daily_hours: 8.0,
            base_salary: 0,
            hourly_rate: 0,
            allowance_manager: 0,
            allowance_license: 0,
            other_allowance: 0
        };

        const { error: updateError } = await supabase
            .from('employees')
            .update(updates)
            .eq('id', employeeId);

        if (updateError) throw updateError;

        return { success: true };
    } catch (error: any) {
        console.error('Error deleting employee schedule:', error);
        return { success: false, error: error.message };
    }
};


export const deleteEmployee = async (id: string) => {
    try {
        // 使用軟刪除：將 is_active 設為 false，而非真正刪除記錄
        // 這樣可以保留歷史打卡記錄，避免外鍵約束問題
        const { error } = await supabase
            .from('employees')
            .update({ is_active: false })
            .eq('id', id);

        if (error) throw error;
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
};


export const deleteAttendanceLog = async (id: string) => {
    try {
        const { error } = await supabase
            .from('attendance_logs')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return { success: true };
    } catch (error: any) {
        console.error('Error deleting attendance log:', error);
        return { success: false, error: error.message };
    }
};

export const deleteAttendanceLogs = async (ids: string[]) => {
    try {
        const { error } = await supabase
            .from('attendance_logs')
            .delete()
            .in('id', ids);

        if (error) throw error;
        return { success: true };
    } catch (error: any) {
        console.error('Error bulk deleting attendance logs:', error);
        return { success: false, error: error.message };
    }
};

// 補登申請管理（直屬主管審核）
export const getMakeupRequests = async (status?: string, managerId?: string) => {
    try {
        console.log('[getMakeupRequests] Called with:', { status, managerId });

        /**
         * 修正顯示逾期未審核的問題：
         * 1. 優先抓取「待審核」狀態的申請
         * 2. 增加歷史紀錄的抓取上限
         */

        // 基礎查詢 (包含員工與主管資訊以便後續可能的 RLS 或手動過濾)
        const baseQuery = supabase
            .from('makeup_attendance_requests')
            .select(`
                *,
                employee:employees(name, department, pin, manager_id)
            `);

        let pendingData: any[] = [];
        let historyData: any[] = [];

        // 1. 如果是查詢「全部」或「待審核」，優先抓取待審核
        if (!status || status === 'ALL' || status === 'PENDING') {
            let pendingQuery = supabase
                .from('makeup_attendance_requests')
                .select(`
                    *,
                    employee:employees(name, department, pin, manager_id)
                `)
                .eq('status', 'PENDING')
                .order('created_at', { ascending: false });

            const { data, error } = await pendingQuery;
            if (error) throw error;
            pendingData = data || [];
        }

        // 2. 抓取其餘狀態的紀錄 (或當 status 不是 PENDING 時的特定狀態紀錄)
        if (!status || status === 'ALL' || status !== 'PENDING') {
            let historyQuery = supabase
                .from('makeup_attendance_requests')
                .select(`
                    *,
                    employee:employees(name, department, pin, manager_id)
                `)
                .neq('status', 'PENDING')
                .order('created_at', { ascending: false })
                .limit(5000);

            if (status && status !== 'ALL') {
                historyQuery = historyQuery.eq('status', status);
            }

            const { data, error } = await historyQuery;
            if (error) throw error;
            historyData = data || [];
        }

        let allData = status === 'PENDING' ? pendingData :
            status && status !== 'ALL' ? historyData :
                [...pendingData, ...historyData];

        // 如果指定了主管 ID，進行過濾
        if (managerId) {
            allData = allData.filter((req: any) => req.employee?.manager_id === managerId);
        }

        return allData;
    } catch (error) {
        console.error('Error fetching makeup requests:', error);
        return [];
    }
};

export const approveMakeupRequest = async (id: string, reviewerId: string, comment?: string) => {
    try {
        // 獲取申請資料
        const { data: request, error: fetchError } = await supabase
            .from('makeup_attendance_requests')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;

        // 建立打卡記錄
        const timestamp = new Date(request.request_date);
        const [hours, minutes] = request.request_time.split(':');
        timestamp.setHours(parseInt(hours), parseInt(minutes), 0, 0);

        const { error: insertError } = await supabase
            .from('attendance_logs')
            .insert([{
                employee_id: request.employee_id,
                check_type: request.check_type,
                timestamp: timestamp.toISOString(),
                is_makeup: true
            }]);

        if (insertError) throw insertError;

        // 更新申請狀態
        const { error: updateError } = await supabase
            .from('makeup_attendance_requests')
            .update({
                status: 'APPROVED',
                reviewer_id: reviewerId,
                reviewed_at: new Date().toISOString(),
                review_comment: comment
            })
            .eq('id', id);

        if (updateError) throw updateError;

        return { success: true };
    } catch (error: any) {
        console.error('Error approving makeup request:', error);
        return { success: false, error: error.message };
    }
};

export const rejectMakeupRequest = async (id: string, reviewerId: string, comment?: string) => {
    try {
        const { error } = await supabase
            .from('makeup_attendance_requests')
            .update({
                status: 'REJECTED',
                reviewer_id: reviewerId,
                reviewed_at: new Date().toISOString(),
                review_comment: comment
            })
            .eq('id', id);

        if (error) throw error;
        return { success: true };
    } catch (error: any) {
        console.error('Error rejecting makeup request:', error);
        return { success: false, error: error.message };
    }
};

/**
 * 批量核准補登申請
 */
export const batchApproveMakeupRequests = async (
    requestIds: string[],
    reviewerId: string,
    comment?: string
): Promise<{
    success: boolean;
    total: number;
    succeeded: number;
    failed: number;
    errors: string[];
}> => {
    try {
        if (!requestIds || requestIds.length === 0) {
            return {
                success: false,
                total: 0,
                succeeded: 0,
                failed: 0,
                errors: ['沒有提供任何補登申請 ID']
            };
        }

        // 使用 Promise.allSettled 並行處理所有請求
        const results = await Promise.allSettled(
            requestIds.map(id => approveMakeupRequest(id, reviewerId, comment))
        );

        // 統計結果
        const succeeded = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
        const failed = results.length - succeeded;
        const errors: string[] = [];

        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                errors.push(`申請 ${requestIds[index].slice(0, 8)}: ${result.reason}`);
            } else if (!result.value.success) {
                errors.push(`申請 ${requestIds[index].slice(0, 8)}: ${result.value.error || '未知錯誤'}`);
            }
        });

        return {
            success: failed === 0,
            total: requestIds.length,
            succeeded,
            failed,
            errors
        };
    } catch (err: any) {
        console.error('Unexpected error in batch approve:', err);
        return {
            success: false,
            total: requestIds.length,
            succeeded: 0,
            failed: requestIds.length,
            errors: ['批量操作發生系統錯誤']
        };
    }
};

/**
 * 批量拒絕補登申請
 */
export const batchRejectMakeupRequests = async (
    requestIds: string[],
    reviewerId: string,
    comment: string
): Promise<{
    success: boolean;
    total: number;
    succeeded: number;
    failed: number;
    errors: string[];
}> => {
    try {
        if (!requestIds || requestIds.length === 0) {
            return {
                success: false,
                total: 0,
                succeeded: 0,
                failed: 0,
                errors: ['沒有提供任何補登申請 ID']
            };
        }

        if (!comment || !comment.trim()) {
            return {
                success: false,
                total: requestIds.length,
                succeeded: 0,
                failed: requestIds.length,
                errors: ['批量拒絕必須提供拒絕原因']
            };
        }

        // 使用 Promise.allSettled 並行處理所有請求
        const results = await Promise.allSettled(
            requestIds.map(id => rejectMakeupRequest(id, reviewerId, comment))
        );

        // 統計結果
        const succeeded = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
        const failed = results.length - succeeded;
        const errors: string[] = [];

        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                errors.push(`申請 ${requestIds[index].slice(0, 8)}: ${result.reason}`);
            } else if (!result.value.success) {
                errors.push(`申請 ${requestIds[index].slice(0, 8)}: ${result.value.error || '未知錯誤'}`);
            }
        });

        return {
            success: failed === 0,
            total: requestIds.length,
            succeeded,
            failed,
            errors
        };
    } catch (err: any) {
        console.error('Unexpected error in batch reject:', err);
        return {
            success: false,
            total: requestIds.length,
            succeeded: 0,
            failed: requestIds.length,
            errors: ['批量操作發生系統錯誤']
        };
    }
};

/**
 * 管理者直接新增打卡紀錄(用於補登漏卡)
 */
export const createAttendanceLog = async (
    employeeId: string,
    checkType: CheckType,
    timestamp: string,
    note?: string
): Promise<{ success: boolean; error?: string }> => {
    try {
        const { error } = await supabase
            .from('attendance_logs')
            .insert([{
                employee_id: employeeId,
                check_type: checkType,
                timestamp: timestamp,
                is_makeup: true,
                note: note || null
            }]);

        if (error) throw error;
        return { success: true };
    } catch (error: any) {
        console.error('Error creating attendance log:', error);
        return { success: false, error: error.message };
    }
};

/**
 * 管理者更新打卡紀錄
 */
export const updateAttendanceLog = async (
    id: string,
    checkType: CheckType,
    timestamp: string,
    note?: string
): Promise<{ success: boolean; error?: string }> => {
    try {
        const { error } = await supabase
            .from('attendance_logs')
            .update({
                check_type: checkType,
                timestamp: timestamp,
                is_makeup: true, // 管理者修正後標記為補登/修正
                note: note || null
            })
            .eq('id', id);

        if (error) throw error;
        return { success: true };
    } catch (error: any) {
        console.error('Error updating attendance log:', error);
        return { success: false, error: error.message };
    }
};

/**
 * 批量匯入打卡紀錄
 */
export const importAttendanceLogs = async (logs: any[]): Promise<{ success: boolean; succeeded: number; skipped: number; failed: number; errors: any[] }> => {
    try {
        // 1. 獲取所有員工以便查找
        const { data: employees, error: empError } = await supabase
            .from('employees')
            .select('id, name, pin')
            .eq('is_active', true);

        if (empError) throw empError;

        const results = {
            success: true,
            succeeded: 0,
            skipped: 0,
            failed: 0,
            errors: [] as any[]
        };

        const insertData: any[] = [];
        const processedInThisBatch = new Set<string>();

        // 2. 獲取可能受影響的員工的所有打卡記錄，用於檢查重複
        const employeeIds = Array.from(new Set(
            logs.map(log => employees?.find(e => e.pin === log.pin || e.name === log.name)?.id)
                .filter(id => !!id)
        )) as string[];

        let existingLogs: any[] = [];
        if (employeeIds.length > 0) {
            const { data, error: exError } = await supabase
                .from('attendance_logs')
                .select('employee_id, check_type, timestamp')
                .in('employee_id', employeeIds)
                .limit(10000);

            if (exError) throw exError;
            existingLogs = data || [];
        }

        for (let i = 0; i < logs.length; i++) {
            const log = logs[i];
            const lineNum = i + 2;

            const employee = employees?.find(e => e.pin === log.pin || e.name === log.name);
            if (!employee) {
                results.failed++;
                results.errors.push({ line: lineNum, name: log.name || log.pin || '未知', error: `找不到員工 (PIN/姓名: ${log.pin || log.name})` });
                continue;
            }

            // 解析日期時間
            let timestamp: Date;
            if (log.date && log.time) {
                // 如果 CSV 拆分了日期和時間
                timestamp = new Date(`${log.date.replace(/-/g, '/')} ${log.time}`);
            } else {
                timestamp = new Date((log.timestamp || '').replace(/-/g, '/'));
            }

            if (isNaN(timestamp.getTime())) {
                results.failed++;
                results.errors.push({ line: lineNum, name: employee.name, error: `日期時間格式錯誤: ${log.timestamp || (log.date + ' ' + log.time)}` });
                continue;
            }

            const isoTimestamp = timestamp.toISOString();
            const checkType = (log.check_type === 'IN' || log.check_type === 'OUT') ? log.check_type : (log.check_type?.toUpperCase().includes('上') ? 'IN' : 'OUT');

            const batchKey = `${employee.id}_${checkType}_${isoTimestamp}`;

            if (processedInThisBatch.has(batchKey)) {
                results.skipped++;
                continue;
            }

            // 檢查重複
            const isDuplicate = existingLogs.some(el =>
                el.employee_id === employee.id &&
                el.check_type === checkType &&
                new Date(el.timestamp).toISOString() === isoTimestamp
            );

            if (isDuplicate) {
                results.skipped++;
                processedInThisBatch.add(batchKey);
                continue;
            }

            insertData.push({
                employee_id: employee.id,
                check_type: checkType,
                timestamp: isoTimestamp,
                is_makeup: true,
                note: log.note || '批次匯入'
            });

            processedInThisBatch.add(batchKey);
        }

        if (insertData.length > 0) {
            const { error } = await supabase.from('attendance_logs').insert(insertData);
            if (error) {
                console.error('Error bulk inserting attendance logs:', error);
                return { success: false, succeeded: 0, skipped: 0, failed: logs.length, errors: [{ line: 0, name: '系統', error: error.message }] };
            }
            results.succeeded = insertData.length;
        }

        return results;
    } catch (err: any) {
        console.error('Unexpected error in importAttendanceLogs:', err);
        return { success: false, succeeded: 0, skipped: 0, failed: logs.length, errors: [{ line: 0, name: '系統', error: err.message || '系統錯誤' }] };
    }
};

/**
 * 批量匯入員工班表與薪資異動歷史紀錄
 */
export const importBulkEmployeeSchedules = async (
    logs: any[]
): Promise<{ success: boolean; succeeded: number; failed: number; errors: any[] }> => {
    try {
        // 1. 獲取所有現有員工 PIN 碼與 ID 的對照表
        const { data: employees, error: empError } = await supabase
            .from('employees')
            .select('id, name, pin')
            .eq('is_active', true);

        if (empError) throw empError;

        const results = {
            success: true,
            succeeded: 0,
            failed: 0,
            errors: [] as any[]
        };

        const insertData: any[] = [];
        const affectedEmployeeIds = new Set<string>();
        const processedInThisBatch = new Set<string>();

        for (let i = 0; i < logs.length; i++) {
            const log = logs[i];
            const lineNum = i + 2;

            const employee = employees?.find(e => e.pin === log.pin || e.name === log.name);
            if (!employee) {
                results.failed++;
                results.errors.push({
                    line: lineNum,
                    name: log.name || log.pin || '未知',
                    error: `找不到員工 (PIN/姓名: ${log.pin || log.name})`
                });
                continue;
            }

            // 驗證生效日期
            if (!log.effective_date) {
                results.failed++;
                results.errors.push({
                    line: lineNum,
                    name: employee.name,
                    error: `生效日期為必填`
                });
                continue;
            }

            // 檢查同一員工在同一個生效日期是否重複，避免 Postgres ON CONFLICT 錯誤
            const batchKey = `${employee.id}_${log.effective_date}`;
            if (processedInThisBatch.has(batchKey)) {
                results.failed++;
                results.errors.push({
                    line: lineNum,
                    name: employee.name,
                    error: `生效日期 ${log.effective_date} 在此檔案中重複`
                });
                continue;
            }
            processedInThisBatch.add(batchKey);

            // 解析休息日，如果是字串，支援分號、斜線、空格或逗號分隔，避免 CSV 被逗號切分的問題
            let restDaysArray = [0, 6];
            if (log.rest_days !== undefined && log.rest_days !== null && log.rest_days !== '') {
                if (typeof log.rest_days === 'string') {
                    restDaysArray = log.rest_days.split(/[;|\/\s,]+/).map(s => parseInt(s.trim())).filter(n => !isNaN(n));
                } else if (Array.isArray(log.rest_days)) {
                    restDaysArray = log.rest_days;
                }
            }

            insertData.push({
                employee_id: employee.id,
                effective_date: log.effective_date,
                work_start_time: log.work_start_time || '08:00',
                work_end_time: log.work_end_time || '17:00',
                break_start_time: log.break_start_time || '12:00',
                break_end_time: log.break_end_time || '13:00',
                break2_start_time: log.break2_start_time || null,
                break2_end_time: log.break2_end_time || null,
                break3_start_time: log.break3_start_time || null,
                break3_end_time: log.break3_end_time || null,
                salary_type: log.salary_type || 'MONTHLY',
                standard_daily_hours: log.standard_daily_hours ? parseFloat(log.standard_daily_hours) : null,
                base_salary: log.base_salary ? parseFloat(log.base_salary) : 0,
                hourly_rate: log.hourly_rate ? parseFloat(log.hourly_rate) : 0,
                allowance_manager: log.allowance_manager ? parseFloat(log.allowance_manager) : 0,
                allowance_license: log.allowance_license ? parseFloat(log.allowance_license) : 0,
                other_allowance: log.other_allowance ? parseFloat(log.other_allowance) : 0,
                rest_days: restDaysArray,
                note: log.note || '批次匯入'
            });

            affectedEmployeeIds.add(employee.id);
        }

        if (insertData.length > 0) {
            // 批次寫入/覆寫
            const { error: upsertError } = await supabase
                .from('employee_schedules')
                .upsert(insertData, { onConflict: 'employee_id,effective_date' });

            if (upsertError) {
                console.error('Error bulk inserting employee schedules:', upsertError);
                return {
                    success: false,
                    succeeded: 0,
                    failed: logs.length,
                    errors: [{ line: 0, name: '系統', error: upsertError.message }]
                };
            }
            results.succeeded = insertData.length;

            // 同步受影響員工的最新設定回 employees 主表
            for (const employeeId of affectedEmployeeIds) {
                const { data: latestSchedule, error: fetchError } = await supabase
                    .from('employee_schedules')
                    .select('*')
                    .eq('employee_id', employeeId)
                    .order('effective_date', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (fetchError) {
                    console.error(`Error fetching latest schedule for employee ${employeeId}:`, fetchError);
                    continue;
                }

                if (latestSchedule) {
                    const updates = {
                        work_start_time: latestSchedule.work_start_time,
                        work_end_time: latestSchedule.work_end_time,
                        break_start_time: latestSchedule.break_start_time,
                        break_end_time: latestSchedule.break_end_time,
                        break2_start_time: latestSchedule.break2_start_time,
                        break2_end_time: latestSchedule.break2_end_time,
                        break3_start_time: latestSchedule.break3_start_time,
                        break3_end_time: latestSchedule.break3_end_time,
                        rest_days: latestSchedule.rest_days,
                        salary_type: latestSchedule.salary_type,
                        standard_daily_hours: latestSchedule.standard_daily_hours,
                        base_salary: latestSchedule.base_salary,
                        hourly_rate: latestSchedule.hourly_rate,
                        allowance_manager: latestSchedule.allowance_manager,
                        allowance_license: latestSchedule.allowance_license,
                        other_allowance: latestSchedule.other_allowance
                    };

                    const { error: updateError } = await supabase
                        .from('employees')
                        .update(updates)
                        .eq('id', employeeId);

                    if (updateError) {
                        console.error(`Error updating employee ${employeeId} main info:`, updateError);
                    }
                }
            }
        }

        return results;
    } catch (err: any) {
        console.error('Unexpected error in importBulkEmployeeSchedules:', err);
        return {
            success: false,
            succeeded: 0,
            failed: logs.length,
            errors: [{ line: 0, name: '系統', error: err.message || '系統錯誤' }]
        };
    }
};

// ============================================================
// 薪制人員班表相關
// ============================================================

export interface MonthlySalarySchedule {
    id: string;
    employee_id: string;
    service_date: string;   // 'yyyy-MM-dd'
    shift_type: string;     // 班別
    case_name?: string;     // 個案
    service_mins: number;   // 服務時間（分鐘）
    note?: string;
    created_at?: string;
    updated_at?: string;
}

/**
 * 查詢指定員工某月份的薪制班表
 */
export const getMonthlySalarySchedules = async (
    employeeId: string,
    startDate: string,
    endDate: string
): Promise<MonthlySalarySchedule[]> => {
    const { data, error } = await supabase
        .from('monthly_salary_schedules')
        .select('*')
        .eq('employee_id', employeeId)
        .gte('service_date', startDate)
        .lte('service_date', endDate)
        .order('service_date', { ascending: true });

    if (error) {
        console.error('Error fetching monthly salary schedules:', error);
        return [];
    }
    return data || [];
};

/**
 * 批量匯入薪制人員班表（CSV 解析後傳入）
 * 每行欄位：姓名, 服務日期, 班別, 個案, 服務時間(分鐘), 備註
 */
export const importMonthlySalarySchedules = async (
    rows: Array<{
        name: string;
        service_date: string;
        shift_type: string;
        case_name: string;
        service_mins_str: string;
        note: string;
    }>
): Promise<{ success: boolean; succeeded: number; skipped: number; failed: number; errors: Array<{ line: number; name: string; error: string }> }> => {
    const results = {
        success: true,
        succeeded: 0,
        skipped: 0,
        failed: 0,
        errors: [] as Array<{ line: number; name: string; error: string }>
    };

    try {
        // 1. 取得所有員工（依姓名查找）
        const { data: employees, error: empError } = await supabase
            .from('employees')
            .select('id, name')
            .eq('is_active', true);

        if (empError) throw empError;

        const VALID_SHIFT_TYPES = ['增-轉場', '正常日班', '休息日班', '國定假日'];

        const insertData: Omit<MonthlySalarySchedule, 'id' | 'created_at' | 'updated_at'>[] = [];
        const processedKeys = new Set<string>();

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const lineNum = i + 2; // 第 1 行是標題

            // 比對員工姓名
            const employee = employees?.find(e => e.name === row.name.trim());
            if (!employee) {
                results.failed++;
                results.errors.push({ line: lineNum, name: row.name || '（空）', error: `找不到員工：「${row.name}」` });
                continue;
            }

            // 驗證日期格式 yyyy-MM-dd
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(row.service_date.trim())) {
                results.failed++;
                results.errors.push({ line: lineNum, name: row.name, error: `服務日期格式錯誤（需為 yyyy-MM-dd）：「${row.service_date}」` });
                continue;
            }

            // 驗證班別
            const shiftType = row.shift_type.trim();
            if (!VALID_SHIFT_TYPES.includes(shiftType)) {
                results.failed++;
                results.errors.push({ line: lineNum, name: row.name, error: `班別不正確：「${shiftType}」，有效值：${VALID_SHIFT_TYPES.join('、')}` });
                continue;
            }

            // 驗證服務時間（整數分鐘）
            const serviceMins = parseInt(row.service_mins_str.trim(), 10);
            if (isNaN(serviceMins) || serviceMins < 0) {
                results.failed++;
                results.errors.push({ line: lineNum, name: row.name, error: `服務時間格式錯誤（需為正整數分鐘）：「${row.service_mins_str}」` });
                continue;
            }

            const caseName = row.case_name.trim();

            insertData.push({
                employee_id: employee.id,
                service_date: row.service_date.trim(),
                shift_type: shiftType,
                case_name: caseName, // 使用 caseName（空字串或有值均可，配合資料庫的 NOT NULL DEFAULT ''）
                service_mins: serviceMins,
                note: row.note.trim() || undefined
            });
        }

        if (insertData.length > 0) {
            // 2. 收集需要刪除的 員工 + 日期 組合（以實現覆蓋更新，避免同天重複記錄或個案重複問題）
            // 格式：Map<employee_id, Set<service_date>>
            const employeeDatesMap = new Map<string, Set<string>>();
            for (const item of insertData) {
                if (!employeeDatesMap.has(item.employee_id)) {
                    employeeDatesMap.set(item.employee_id, new Set());
                }
                employeeDatesMap.get(item.employee_id)!.add(item.service_date);
            }

            // 3. 依員工刪除該些服務日期的舊資料
            for (const [employeeId, datesSet] of employeeDatesMap.entries()) {
                const datesArray = Array.from(datesSet);
                const { error: deleteError } = await supabase
                    .from('monthly_salary_schedules')
                    .delete()
                    .eq('employee_id', employeeId)
                    .in('service_date', datesArray);

                if (deleteError) {
                    console.error(`Error deleting existing schedules for employee ${employeeId}:`, deleteError);
                    return {
                        success: false,
                        succeeded: 0,
                        skipped: 0,
                        failed: rows.length,
                        errors: [{ line: 0, name: '系統', error: `刪除舊資料失敗：${deleteError.message}` }]
                    };
                }
            }

            // 4. 插入所有新資料（無 UNIQUE 限制，可完整匯入同天多筆或相同個案）
            const { error: insertError } = await supabase
                .from('monthly_salary_schedules')
                .insert(insertData);

            if (insertError) {
                console.error('Error inserting monthly salary schedules:', insertError);
                return {
                    success: false,
                    succeeded: 0,
                    skipped: 0,
                    failed: rows.length,
                    errors: [{ line: 0, name: '系統', error: insertError.message }]
                };
            }
            results.succeeded = insertData.length;
        }

        return results;
    } catch (err: any) {
        console.error('Unexpected error in importMonthlySalarySchedules:', err);
        return {
            success: false,
            succeeded: 0,
            skipped: 0,
            failed: rows.length,
            errors: [{ line: 0, name: '系統', error: err.message || '系統錯誤' }]
        };
    }
};


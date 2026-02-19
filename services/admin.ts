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
            .insert([{
                ...data,
                is_active: true
            }])
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

/**
 * 新增/更新員工班表設定
 */
export const addEmployeeSchedule = async (data: Partial<EmployeeSchedule>) => {
    try {
        const { error } = await supabase
            .from('employee_schedules')
            .upsert([data]);

        if (error) throw error;

        // 同步更新員工主表的「當前」設定（可選，為了向後相容）
        if (data.employee_id) {
            await supabase
                .from('employees')
                .update({
                    work_start_time: data.work_start_time,
                    work_end_time: data.work_end_time,
                    break_start_time: data.break_start_time,
                    break_end_time: data.break_end_time,
                    break2_start_time: data.break2_start_time,
                    break2_end_time: data.break2_end_time,
                    break3_start_time: data.break3_start_time,
                    break3_end_time: data.break3_end_time,
                    rest_days: data.rest_days,
                    salary_type: data.salary_type,
                    standard_daily_hours: data.standard_daily_hours
                })
                .eq('id', data.employee_id);
        }

        return { success: true };
    } catch (error: any) {
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

        let query = supabase
            .from('makeup_attendance_requests')
            .select(`
                *,
                employee:employees(name, department, pin, manager_id)
            `)
            .order('created_at', { ascending: false });

        if (status && status !== 'ALL') {
            query = query.eq('status', status);
        }

        const { data, error } = await query;

        if (error) {
            console.error('[getMakeupRequests] Supabase error:', error);
            throw error;
        }

        console.log('[getMakeupRequests] Raw data from Supabase:', {
            count: data?.length || 0,
            data: data
        });

        // 如果指定了主管 ID，只返回該主管的直屬下屬的申請
        if (managerId) {
            const filtered = (data || []).filter((req: any) => {
                const match = req.employee?.manager_id === managerId;
                console.log('[getMakeupRequests] Filtering:', {
                    requestId: req.id,
                    employeeName: req.employee?.name,
                    employeeManagerId: req.employee?.manager_id,
                    targetManagerId: managerId,
                    match: match
                });
                return match;
            });

            console.log('[getMakeupRequests] Filtered results:', {
                count: filtered.length,
                data: filtered
            });

            return filtered;
        }

        return data;
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
                timestamp = new Date(`${log.date} ${log.time}`);
            } else {
                timestamp = new Date(log.timestamp);
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

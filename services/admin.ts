import { supabase } from '../lib/supabase';
import { Employee, CheckType } from '../types';

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
        const { error } = await supabase
            .from('employees')
            .insert([{
                ...data,
                is_active: true
            }]);

        if (error) throw error;
        return { success: true };
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

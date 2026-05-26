/**
 * 主管審核服務
 * 提供主管相關的查詢功能
 */

import { supabase } from '../lib/supabase';

export interface PendingApproval {
    count: number;
    requests: any[];
}

/**
 * 獲取當前登入使用者對應的員工資料
 */
export const getCurrentUserEmployee = async (userEmail: string) => {
    try {
        // 假設員工的 email 與登入帳號相同，或使用其他關聯方式
        const { data, error } = await supabase
            .from('employees')
            .select('*')
            .eq('email', userEmail)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Error fetching current user employee:', error);
            return null;
        }

        return data;
    } catch (err) {
        console.error('Unexpected error:', err);
        return null;
    }
};

/**
 * 獲取主管的待審核請假申請
 */
export const getPendingApprovalsForSupervisor = async (supervisorEmployeeId: string): Promise<PendingApproval> => {
    try {
        // 查詢所有下屬的待審核請假申請 (包含 PENDING 與 WITHDRAW_PENDING)
        const { data, error } = await supabase
            .from('leave_requests')
            .select(`
                *,
                employee:employees!leave_requests_employee_id_fkey (
                    id,
                    name,
                    department,
                    manager_id
                ),
                leave_type:leave_types(*),
                deputy:employees!leave_requests_deputy_id_fkey(id, name, department)
            `)
            .in('status', ['PENDING', 'WITHDRAW_PENDING'])
            .eq('employee.manager_id', supervisorEmployeeId); // 這裡使用嵌套查詢過濾，若 RLS 已處理則可更簡單

        if (error) {
            console.error('Error fetching pending approvals:', error);
            return { count: 0, requests: [] };
        }

        // 由於 supabase-js 對於外鍵過濾的支持度，如果上述 .eq('employee.manager_id', ...) 失敗，
        // 我們維持手動篩選但改進效能，或者確認 join 語法。
        // 在目前的 schema 中，我們可以先查詢下屬 ID 清單，或者直接在 SQL 中解決。
        // 考慮到效能與正確性，我們改用更穩健的篩選方式：

        const { data: subordinates } = await supabase
            .from('employees')
            .select('id')
            .eq('manager_id', supervisorEmployeeId);

        const subIds = (subordinates || []).map(s => s.id);

        if (subIds.length === 0) return { count: 0, requests: [] };

        const { data: requests, error: reqError } = await supabase
            .from('leave_requests')
            .select(`
                *,
                employee:employees!leave_requests_employee_id_fkey (
                    id,
                    name,
                    department,
                    manager_id
                ),
                leave_type:leave_types(*),
                deputy:employees!leave_requests_deputy_id_fkey(id, name, department)
            `)
            .in('status', ['PENDING', 'WITHDRAW_PENDING'])
            .in('employee_id', subIds);

        if (reqError) {
            console.error('Error fetching pending approvals:', reqError);
            return { count: 0, requests: [] };
        }

        return {
            count: (requests || []).length,
            requests: requests || []
        };
    } catch (err) {
        console.error('Unexpected error fetching pending approvals:', err);
        return { count: 0, requests: [] };
    }
};

/**
 * 獲取主管的所有下屬請假申請(包含所有狀態)
 */
// 獲取所有下屬的申請（主管視角）
export const getAllSubordinateRequests = async (managerId: string): Promise<any[]> => {
    try {
        console.log('[supervisorService] getAllSubordinateRequests called for manager:', managerId);

        // 1. 先獲取所有下屬的 ID
        const { data: subordinates, error: subError } = await supabase
            .from('employees')
            .select('id')
            .eq('manager_id', managerId);

        if (subError) throw subError;

        if (!subordinates || subordinates.length === 0) {
            console.log('[supervisorService] No subordinates found');
            return [];
        }

        const subordinateIds = subordinates.map(s => s.id);

        /**
         * 修正顯示逾期未審核的問題：
         * 為了確保「待審核」的申請不論多舊都能被看見，我們分開查詢：
         * 1. 優先抓取所有「待審核」狀態的申請（不設嚴格限制或設較大限制，並按時間正序/倒序排列）
         * 2. 抓取「已審核」的歷史紀錄（設限制並按時間倒序排列）
         */

        // 1. 抓取待審核申請 (PENDING, WITHDRAW_PENDING)
        const { data: pendingRequests, error: pendingError } = await supabase
            .from('leave_requests')
            .select(`
                *,
                employee:employees!leave_requests_employee_id_fkey (id, name, department, pin, manager_id),
                leave_type:leave_types (*)
            `)
            .in('employee_id', subordinateIds)
            .in('status', ['PENDING', 'WITHDRAW_PENDING'])
            .order('created_at', { ascending: false });

        if (pendingError) throw pendingError;

        // 2. 抓取已審核的歷史紀錄 (最多 5000 筆)
        const { data: historyRequests, error: historyError } = await supabase
            .from('leave_requests')
            .select(`
                *,
                employee:employees!leave_requests_employee_id_fkey (id, name, department, pin, manager_id),
                leave_type:leave_types (*)
            `)
            .in('employee_id', subordinateIds)
            .in('status', ['APPROVED', 'REJECTED', 'WITHDRAWN'])
            .order('created_at', { ascending: false })
            .limit(5000);

        if (historyError) throw historyError;

        // 合併結果：待審核在前，歷史紀錄在後
        const allRequests = [...(pendingRequests || []), ...(historyRequests || [])];

        console.log('[supervisorService] Total requests fetched:', allRequests.length);
        return allRequests;
    } catch (error) {
        console.error('[supervisorService] Error in getAllSubordinateRequests:', error);
        return [];
    }
};

/**
 * 獲取所有待審核統計（按部門分組）
 */
export const getPendingApprovalsByDepartment = async (supervisorEmployeeId: string) => {
    try {
        const { requests } = await getPendingApprovalsForSupervisor(supervisorEmployeeId);

        // 按部門分組統計
        const byDepartment: { [key: string]: number } = {};
        requests.forEach((req: any) => {
            const dept = req.employee?.department || '未分配';
            byDepartment[dept] = (byDepartment[dept] || 0) + 1;
        });

        return byDepartment;
    } catch (err) {
        console.error('Error grouping by department:', err);
        return {};
    }
};

/**
 * 獲取主管的直屬下屬
 */
export const getSubordinates = async (supervisorEmployeeId: string) => {
    try {
        const { data, error } = await supabase
            .from('employees')
            .select('id, name, department, pin')
            .eq('manager_id', supervisorEmployeeId)
            .eq('is_active', true)
            .order('name');

        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error('Error fetching subordinates:', err);
        return [];
    }
};

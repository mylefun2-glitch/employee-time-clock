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
export const getAllSubordinateRequests = async (supervisorEmployeeId: string): Promise<any[]> => {
    try {
        // 1. 先獲取下屬 ID 清單以進行精確查詢，避免 1000 筆上限導致的遺漏
        const { data: subordinates } = await supabase
            .from('employees')
            .select('id')
            .eq('manager_id', supervisorEmployeeId);

        const subIds = (subordinates || []).map(s => s.id);

        if (subIds.length === 0) return [];

        // 2. 查詢這些下屬的所有請假申請
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
            .in('employee_id', subIds)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching all subordinate requests:', error);
            return [];
        }

        return data || [];
    } catch (err) {
        console.error('Unexpected error fetching all subordinate requests:', err);
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

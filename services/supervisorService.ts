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
        // 查詢所有下屬的待審核請假申請
        const { data, error } = await supabase
            .from('leave_requests')
            .select(`
                *,
                employee:employees (
                    id,
                    name,
                    department,
                    manager_id
                ),
                leave_type:leave_types(*)
            `)
            .eq('status', 'PENDING');

        if (error) {
            console.error('Error fetching pending approvals:', error);
            return { count: 0, requests: [] };
        }

        // 篩選出下屬的請假申請
        const subordinateRequests = (data || []).filter(
            (request: any) => request.employee?.manager_id === supervisorEmployeeId
        );

        return {
            count: subordinateRequests.length,
            requests: subordinateRequests
        };
    } catch (err) {
        console.error('Unexpected error fetching pending approvals:', err);
        return { count: 0, requests: [] };
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

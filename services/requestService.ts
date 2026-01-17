import { supabase } from '../lib/supabase';
import { LeaveRequest, RequestStatus } from '../types';

export const requestService = {
    async createRequest(request: Omit<LeaveRequest, 'id' | 'created_at' | 'status'>): Promise<{ success: boolean; data?: any; error?: string }> {
        try {
            const { data, error } = await supabase
                .from('leave_requests')
                .insert([
                    {
                        ...request,
                        status: RequestStatus.PENDING
                    }
                ])
                .select()
                .single();

            if (error) {
                console.error('Error creating request:', error);
                return { success: false, error: error.message };
            }

            return { success: true, data };
        } catch (err: any) {
            console.error('Unexpected error creating request:', err);
            return { success: false, error: 'Network or system error' };
        }
    },

    async getEmployeeRequests(employeeId: string): Promise<LeaveRequest[]> {
        try {
            const { data, error } = await supabase
                .from('leave_requests')
                .select(`
                    *,
                    leave_type:leave_types(*)
                `)
                .eq('employee_id', employeeId)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching requests:', error);
                return [];
            }

            return data || [];
        } catch (err) {
            console.error('Unexpected error fetching requests:', err);
            return [];
        }
    },

    /**
     * 取得所有請假申請（管理員用）
     */
    async getAllRequests(): Promise<LeaveRequest[]> {
        try {
            const { data, error } = await supabase
                .from('leave_requests')
                .select(`
                    *,
                    leave_type:leave_types(*),
                    employee:employees(name, department)
                `)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching all requests:', error);
                return [];
            }

            // 將 employee.name 映射到 employee_name
            return (data || []).map((req: any) => ({
                ...req,
                employee_name: req.employee?.name
            }));
        } catch (err) {
            console.error('Unexpected error fetching all requests:', err);
            return [];
        }
    },

    /**
     * 更新請假申請狀態（核准/拒絕）
     */
    async updateRequestStatus(
        requestId: string,
        status: RequestStatus,
        approverId?: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            const updates: any = {
                status,
                approved_at: new Date().toISOString()
            };

            if (approverId) {
                updates.approver_id = approverId;
            }

            const { error } = await supabase
                .from('leave_requests')
                .update(updates)
                .eq('id', requestId);

            if (error) {
                console.error('Error updating request status:', error);
                return { success: false, error: error.message };
            }

            return { success: true };
        } catch (err: any) {
            console.error('Unexpected error updating request status:', err);
            return { success: false, error: 'Network or system error' };
        }
    }
};

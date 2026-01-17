import { supabase } from '../lib/supabase';
import { LeaveType } from '../types';

export const leaveTypeService = {
    /**
     * 取得所有差勤類型（包含停用的）
     */
    async getAllLeaveTypes(): Promise<LeaveType[]> {
        try {
            const { data, error } = await supabase
                .from('leave_types')
                .select('*')
                .order('sort_order', { ascending: true });

            if (error) {
                console.error('Error fetching leave types:', error);
                return [];
            }

            return data || [];
        } catch (err) {
            console.error('Unexpected error fetching leave types:', err);
            return [];
        }
    },

    /**
     * 取得啟用的差勤類型
     */
    async getActiveLeaveTypes(): Promise<LeaveType[]> {
        try {
            const { data, error } = await supabase
                .from('leave_types')
                .select('*')
                .eq('is_active', true)
                .order('sort_order', { ascending: true });

            if (error) {
                console.error('Error fetching active leave types:', error);
                return [];
            }

            return data || [];
        } catch (err) {
            console.error('Unexpected error fetching active leave types:', err);
            return [];
        }
    },

    /**
     * 建立新差勤類型
     */
    async createLeaveType(leaveType: Omit<LeaveType, 'id' | 'created_at'>): Promise<{ success: boolean; data?: LeaveType; error?: string }> {
        try {
            const { data, error } = await supabase
                .from('leave_types')
                .insert([leaveType])
                .select()
                .single();

            if (error) {
                console.error('Error creating leave type:', error);
                return { success: false, error: error.message };
            }

            return { success: true, data };
        } catch (err: any) {
            console.error('Unexpected error creating leave type:', err);
            return { success: false, error: 'Network or system error' };
        }
    },

    /**
     * 更新差勤類型
     */
    async updateLeaveType(id: string, updates: Partial<LeaveType>): Promise<{ success: boolean; data?: LeaveType; error?: string }> {
        try {
            const { data, error } = await supabase
                .from('leave_types')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) {
                console.error('Error updating leave type:', error);
                return { success: false, error: error.message };
            }

            return { success: true, data };
        } catch (err: any) {
            console.error('Unexpected error updating leave type:', err);
            return { success: false, error: 'Network or system error' };
        }
    },

    /**
     * 刪除差勤類型
     */
    async deleteLeaveType(id: string): Promise<{ success: boolean; error?: string }> {
        try {
            const { error } = await supabase
                .from('leave_types')
                .delete()
                .eq('id', id);

            if (error) {
                console.error('Error deleting leave type:', error);
                return { success: false, error: error.message };
            }

            return { success: true };
        } catch (err: any) {
            console.error('Unexpected error deleting leave type:', err);
            return { success: false, error: 'Network or system error' };
        }
    },

    /**
     * 啟用/停用差勤類型
     */
    async toggleLeaveType(id: string, isActive: boolean): Promise<{ success: boolean; error?: string }> {
        return this.updateLeaveType(id, { is_active: isActive });
    }
};

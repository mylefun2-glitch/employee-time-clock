/**
 * 公司資訊服務
 * 管理公司基本資訊
 */

import { supabase } from '../lib/supabase';

export interface CompanyInfo {
    id: string;
    company_name: string;
    tax_id?: string;
    phone?: string;
    contact_person?: string;
    email?: string;
    address?: string;
    default_location_id?: string;
    logo_url?: string;
    description?: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

/**
 * 獲取公司資訊
 */
export const getCompanyInfo = async (): Promise<CompanyInfo | null> => {
    try {
        const { data, error } = await supabase
            .from('company_info')
            .select('*')
            .eq('is_active', true)
            .single();

        if (error) {
            // 如果沒有資料，回傳 null 而不是錯誤
            if (error.code === 'PGRST116') {
                return null;
            }
            console.error('Error fetching company info:', error);
            return null;
        }

        return data;
    } catch (err) {
        console.error('Unexpected error fetching company info:', err);
        return null;
    }
};

/**
 * 更新公司資訊
 */
export const updateCompanyInfo = async (
    id: string,
    updates: Partial<Omit<CompanyInfo, 'id' | 'created_at' | 'updated_at'>>
): Promise<{ success: boolean; error?: string }> => {
    try {
        const { error } = await supabase
            .from('company_info')
            .update(updates)
            .eq('id', id);

        if (error) {
            console.error('Error updating company info:', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (err: any) {
        console.error('Unexpected error updating company info:', err);
        return { success: false, error: 'Network or system error' };
    }
};

/**
 * 建立公司資訊
 */
export const createCompanyInfo = async (
    info: Omit<CompanyInfo, 'id' | 'created_at' | 'updated_at' | 'is_active'>
): Promise<{ success: boolean; data?: CompanyInfo; error?: string }> => {
    try {
        const { data, error } = await supabase
            .from('company_info')
            .insert([{ ...info, is_active: true }])
            .select()
            .single();

        if (error) {
            console.error('Error creating company info:', error);
            return { success: false, error: error.message };
        }

        return { success: true, data };
    } catch (err: any) {
        console.error('Unexpected error creating company info:', err);
        return { success: false, error: 'Network or system error' };
    }
};

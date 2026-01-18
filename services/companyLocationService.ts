/**
 * 公司地點服務
 * 管理多個辦公室/分店位置
 */

import { supabase } from '../lib/supabase';

export interface CompanyLocation {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    radius_meters: number;
    is_active: boolean;
    description?: string;
}

/**
 * 獲取所有啟用的公司地點
 */
export const getActiveLocations = async (): Promise<CompanyLocation[]> => {
    try {
        const { data, error } = await supabase
            .from('company_locations')
            .select('*')
            .eq('is_active', true)
            .order('name');

        if (error) {
            console.error('Error fetching company locations:', error);
            return [];
        }

        return data || [];
    } catch (err) {
        console.error('Unexpected error fetching locations:', err);
        return [];
    }
};

/**
 * 獲取所有公司地點（包含停用的）
 */
export const getAllLocations = async (): Promise<CompanyLocation[]> => {
    try {
        const { data, error } = await supabase
            .from('company_locations')
            .select('*')
            .order('name');

        if (error) {
            console.error('Error fetching all locations:', error);
            return [];
        }

        return data || [];
    } catch (err) {
        console.error('Unexpected error fetching all locations:', err);
        return [];
    }
};

/**
 * 新增公司地點
 */
export const createLocation = async (
    location: Omit<CompanyLocation, 'id'>
): Promise<{ success: boolean; data?: CompanyLocation; error?: string }> => {
    try {
        const { data, error } = await supabase
            .from('company_locations')
            .insert([location])
            .select()
            .single();

        if (error) {
            console.error('Error creating location:', error);
            return { success: false, error: error.message };
        }

        return { success: true, data };
    } catch (err: any) {
        console.error('Unexpected error creating location:', err);
        return { success: false, error: 'Network or system error' };
    }
};

/**
 * 更新公司地點
 */
export const updateLocation = async (
    id: string,
    updates: Partial<Omit<CompanyLocation, 'id'>>
): Promise<{ success: boolean; error?: string }> => {
    try {
        const { error } = await supabase
            .from('company_locations')
            .update(updates)
            .eq('id', id);

        if (error) {
            console.error('Error updating location:', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (err: any) {
        console.error('Unexpected error updating location:', err);
        return { success: false, error: 'Network or system error' };
    }
};

/**
 * 刪除公司地點
 */
export const deleteLocation = async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
        const { error } = await supabase
            .from('company_locations')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting location:', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (err: any) {
        console.error('Unexpected error deleting location:', err);
        return { success: false, error: 'Network or system error' };
    }
};

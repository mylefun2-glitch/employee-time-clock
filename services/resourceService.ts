import { supabase } from '../lib/supabase';
import { Resource, ResourceRequest } from '../types';

// --- 資源檔案管理 ---

export const getResources = async (onlyActive = true): Promise<Resource[]> => {
    let query = supabase.from('resources').select('*').order('type').order('name');
    if (onlyActive) {
        query = query.eq('is_active', true);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
};

export const upsertResource = async (resource: Partial<Resource> & { name: string; type: string }): Promise<Resource> => {
    const { data, error } = await supabase.from('resources').upsert(resource).select().single();
    if (error) throw error;
    return data;
};

// --- 借用申請管理 ---

export const getResourceRequests = async (params?: {
    employee_id?: string;
    department?: string;
    status?: string;
}): Promise<ResourceRequest[]> => {
    let query = supabase.from('resource_requests').select(`
        *,
        employee:employees!resource_requests_employee_id_fkey(id, name, department),
        resource:resources(id, name, type, location)
    `).order('created_at', { ascending: false });

    if (params?.department) {
        // 如果有提供部門，則查詢該部門所有同仁的紀錄
        const { data: deptEmployees } = await supabase
            .from('employees')
            .select('id')
            .eq('department', params.department);
        
        const deptIds = deptEmployees?.map(e => e.id) || [];
        if (deptIds.length > 0) {
            query = query.in('employee_id', deptIds);
        } else if (params.employee_id) {
            query = query.eq('employee_id', params.employee_id);
        }
    } else if (params?.employee_id) {
        query = query.eq('employee_id', params.employee_id);
    }
    if (params?.status && params.status !== 'ALL') {
        query = query.eq('status', params.status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
};

export const createResourceRequest = async (request: {
    employee_id: string;
    resource_id: string;
    quantity: number;
    start_time: string;
    end_time: string;
    purpose: string;
}): Promise<ResourceRequest> => {
    const { data, error } = await supabase.from('resource_requests').insert(request).select().single();
    if (error) throw error;
    return data;
};

export const updateResourceRequest = async (
    requestId: string,
    updateData: {
        resource_id?: string;
        quantity?: number;
        start_time?: string;
        end_time?: string;
        purpose?: string;
    }
): Promise<ResourceRequest> => {
    const { data, error } = await supabase
        .from('resource_requests')
        .update(updateData)
        .eq('id', requestId)
        .select()
        .single();
    if (error) throw error;
    return data;
};

export const updateResourceRequestStatus = async (
    requestId: string,
    approverId: string,
    status: 'APPROVED' | 'REJECTED',
    comment?: string
): Promise<ResourceRequest> => {
    const { data, error } = await supabase.from('resource_requests').update({
        status,
        approver_id: approverId,
        approved_at: new Date().toISOString(),
        review_comment: comment ?? null
    }).eq('id', requestId).select().single();
    if (error) throw error;
    return data;
};

export const withdrawResourceRequest = async (requestId: string): Promise<void> => {
    const { error } = await supabase.from('resource_requests').update({ status: 'WITHDRAWN' }).eq('id', requestId);
    if (error) throw error;
};

import { supabase } from '../lib/supabase';

// --- 車輛檔案管理 ---

export const getCars = async (onlyActive = true) => {
    let query = supabase.from('cars').select('*').order('plate_number');
    if (onlyActive) {
        query = query.eq('is_active', true);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data;
};

export const upsertCar = async (car: { id?: string; plate_number: string; model: string; status: string; last_mileage?: number; is_active?: boolean }) => {
    const { data, error } = await supabase.from('cars').upsert(car).select().single();
    if (error) throw error;
    return data;
};

// --- 公務車申請管理 ---

export const submitCarRequest = async (request: {
    employee_id: string;
    car_id: string;
    start_time: string;
    end_time: string;
    purpose: string;
}) => {
    const { data, error } = await supabase.from('car_usage_requests').insert(request).select().single();
    if (error) throw error;
    return data;
};

export const getCarRequests = async (params?: { employee_id?: string; status?: string }) => {
    let query = supabase.from('car_usage_requests').select(`
        *,
        employee:employees(name, department),
        car:cars(plate_number, model)
    `).order('created_at', { ascending: false });

    if (params?.employee_id) {
        query = query.eq('employee_id', params.employee_id);
    }
    if (params?.status && params.status !== 'ALL') {
        query = query.eq('status', params.status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
};

export const reviewCarRequest = async (requestId: string, approverId: string, status: 'APPROVED' | 'REJECTED', comment?: string) => {
    // 獲取申請細節以取得相關車輛
    const { data: request, error: fetchError } = await supabase
        .from('car_usage_requests')
        .select('car_id')
        .eq('id', requestId)
        .single();

    if (fetchError) throw fetchError;

    // 更新申請狀態
    const { data, error } = await supabase.from('car_usage_requests').update({
        status,
        approver_id: approverId,
        approved_at: new Date().toISOString(),
        review_comment: comment
    }).eq('id', requestId).select().single();

    if (error) throw error;

    // 如果核准，則將該車輛狀態同步更新為 IN_USE (簡單邏輯，暫時先這麼做)
    // 實際上應根據 start_time 判斷，但為了 demo 直覺先這樣寫
    if (status === 'APPROVED' && request.car_id) {
        await supabase.from('cars').update({ status: 'IN_USE' }).eq('id', request.car_id);
    }

    return data;
};

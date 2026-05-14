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

export const checkCarAvailability = async (carId: string, startTime: string, endTime: string, excludeRequestId?: string) => {
    // 檢查 car_usage_requests
    let curQuery = supabase
        .from('car_usage_requests')
        .select('id, start_time, end_time')
        .eq('car_id', carId)
        .in('status', ['PENDING', 'APPROVED'])
        .lt('start_time', endTime)
        .gt('end_time', startTime);

    if (excludeRequestId) {
        curQuery = curQuery.neq('id', excludeRequestId);
    }
    
    // 檢查 leave_requests
    let lrQuery = supabase
        .from('leave_requests')
        .select('id, start_date, end_date')
        .eq('car_id', carId)
        .in('status', ['PENDING', 'APPROVED', 'CHAIRMAN_APPROVED'])
        .lt('start_date', endTime)
        .gt('end_date', startTime);

    if (excludeRequestId) {
        lrQuery = lrQuery.neq('id', excludeRequestId);
    }

    const [curResult, lrResult] = await Promise.all([curQuery, lrQuery]);

    if (curResult.error) throw curResult.error;
    if (lrResult.error) throw lrResult.error;

    return (curResult.data && curResult.data.length > 0) || (lrResult.data && lrResult.data.length > 0);
};

export const getBusyCarIds = async (startTime: string, endTime: string, excludeRequestId?: string) => {
    // 檢查 car_usage_requests
    let curQuery = supabase
        .from('car_usage_requests')
        .select('car_id')
        .in('status', ['PENDING', 'APPROVED'])
        .lt('start_time', endTime)
        .gt('end_time', startTime);

    if (excludeRequestId) {
        curQuery = curQuery.neq('id', excludeRequestId);
    }
    
    // 檢查 leave_requests
    let lrQuery = supabase
        .from('leave_requests')
        .select('car_id')
        .in('status', ['PENDING', 'APPROVED', 'CHAIRMAN_APPROVED'])
        .lt('start_date', endTime)
        .gt('end_date', startTime);

    if (excludeRequestId) {
        lrQuery = lrQuery.neq('id', excludeRequestId);
    }

    const [curResult, lrResult] = await Promise.all([curQuery, lrQuery]);

    if (curResult.error) throw curResult.error;
    if (lrResult.error) throw lrResult.error;

    const busyIds = new Set<string>();
    
    curResult.data?.forEach(item => {
        if (item.car_id) busyIds.add(item.car_id);
    });
    
    lrResult.data?.forEach(item => {
        if (item.car_id) busyIds.add(item.car_id);
    });

    return Array.from(busyIds);
};

export const getCarUsageHistory = async (carId: string, targetDate?: string) => {
    // 取得 car_usage_requests 的紀錄
    let curQuery = supabase.from('car_usage_requests').select(`
        *,
        employee:employees(name, department)
    `).eq('car_id', carId).in('status', ['PENDING', 'APPROVED']).order('start_time', { ascending: false });

    // 取得 leave_requests 的紀錄
    let lrQuery = supabase.from('leave_requests').select(`
        *,
        employee:employees!leave_requests_employee_id_fkey(name, department)
    `).eq('car_id', carId).in('status', ['PENDING', 'APPROVED', 'CHAIRMAN_APPROVED']).order('start_date', { ascending: false });

    if (targetDate) {
        // targetDate is like 'YYYY-MM-DD'
        const startDate = `${targetDate}T00:00:00+08:00`;
        const endDate = `${targetDate}T23:59:59+08:00`;
        curQuery = curQuery.lte('start_time', endDate).gte('end_time', startDate);
        lrQuery = lrQuery.lte('start_date', endDate).gte('end_date', startDate);
    }

    const [curResult, lrResult] = await Promise.all([curQuery, lrQuery]);

    if (curResult.error) throw curResult.error;
    if (lrResult.error) throw lrResult.error;

    const formattedCur = (curResult.data || []).map(item => ({
        id: item.id,
        employee_name: item.employee?.name || '未知',
        department: item.employee?.department || '',
        start_time: item.start_time,
        end_time: item.end_time,
        purpose: item.purpose,
        status: item.status,
        type: 'car_request'
    }));

    const formattedLr = (lrResult.data || []).map(item => ({
        id: item.id,
        employee_name: item.employee?.name || '未知',
        department: item.employee?.department || '',
        start_time: item.start_date,
        end_time: item.end_date,
        purpose: item.reason,
        status: item.status,
        type: 'leave_request'
    }));

    // 合併並按時間排序
    return [...formattedCur, ...formattedLr].sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
};

export const getCarUsageForCalendar = async () => {
    // 取得所有公務車以便手動關聯 (解決 Supabase 可能沒有 foreign key 的問題)
    const { data: carsData } = await supabase.from('cars').select('*');
    const carsMap = new Map((carsData || []).map(c => [c.id, c]));

    // 取得 car_usage_requests 的紀錄
    const curQuery = supabase.from('car_usage_requests').select(`
        *,
        employee:employees(id, name, department),
        car:cars(id, plate_number, model)
    `).in('status', ['PENDING', 'APPROVED', 'WITHDRAW_PENDING']);

    // 取得 leave_requests 的紀錄
    const lrQuery = supabase.from('leave_requests').select(`
        *,
        employee:employees!leave_requests_employee_id_fkey(id, name, department)
    `).not('car_id', 'is', null).in('status', ['PENDING', 'APPROVED', 'WITHDRAW_PENDING', 'CHAIRMAN_APPROVED']);

    const [curResult, lrResult] = await Promise.all([curQuery, lrQuery]);

    if (curResult.error) throw curResult.error;
    if (lrResult.error) throw lrResult.error;

    const formattedCur = (curResult.data || []).map(item => ({
        id: item.id,
        created_at: item.created_at,
        employee_id: item.employee_id,
        resource_id: item.car_id,
        quantity: 1,
        start_time: item.start_time,
        end_time: item.end_time,
        purpose: item.purpose,
        status: item.status,
        employee: item.employee,
        resource: { id: item.car?.id, name: item.car?.plate_number, type: 'CAR' }
    }));

    const formattedLr = (lrResult.data || []).map(item => {
        const mappedCar = carsMap.get(item.car_id);
        return {
            id: item.id,
            created_at: item.created_at,
            employee_id: item.employee_id,
            resource_id: item.car_id,
            quantity: 1,
            start_time: item.start_date,
            end_time: item.end_date,
            purpose: item.reason || '公務車借用',
            status: item.status === 'CHAIRMAN_APPROVED' ? 'APPROVED' : item.status, // CHAIRMAN_APPROVED mapping
            employee: item.employee,
            resource: { id: mappedCar?.id || item.car_id, name: mappedCar?.plate_number || '未知名稱', type: 'CAR' }
        };
    });

    // 去重邏輯：如果同一個員工、同一輛車、在同一時間段有重覆紀錄，則進行合併
    // 優先保留來自 car_usage_requests 的紀錄，因為它代表了公務車管理員的審核狀態
    const combined = [...formattedCur, ...formattedLr];
    const uniqueMap = new Map();

    combined.forEach(item => {
        // 建立唯一鍵值：員工ID + 車輛ID + 開始時間 + 結束時間
        const key = `${item.employee_id}_${item.resource_id}_${item.start_time}_${item.end_time}`;
        
        if (!uniqueMap.has(key)) {
            uniqueMap.set(key, item);
        } else {
            // 如果已經存在，檢查是否需要替換
            // 如果現有的是來自 leave_requests (id 可能與 car_usage_requests 不同)
            // 而新的是來自 car_usage_requests (formattedCur 先排在前面，所以通常已經是正確的)
            // 為了保險起見，我們可以在此明確邏輯：優先保留 formattedCur 的來源
            // 但因為我們是 [...formattedCur, ...formattedLr] 且 uniqueMap.has(key) 就 skip，
            // 所以自然會保留先出現的 formattedCur。
        }
    });

    return Array.from(uniqueMap.values()).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
};

import { countWorkdays } from '../lib/leaveUtils';

export const submitCarRequest = async (request: {
    employee_id: string;
    car_id: string;
    start_time: string;
    end_time: string;
    purpose: string;
}) => {
    try {
        const status = 'PENDING';
        const approvedAt = null;
        // 統一由林懇 (80ce2560-b8b5-4fa2-b5de-0e4399eec0e2) 來做審核
        const approverId = '80ce2560-b8b5-4fa2-b5de-0e4399eec0e2';

        const { data, error } = await supabase.from('car_usage_requests').insert({
            ...request,
            status,
            approved_at: approvedAt,
            approver_id: approverId
        }).select().single();

        if (error) throw error;

        return data;
    } catch (error: any) {
        throw error;
    }
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

    // 如果核准，更新車輛狀態
    if (status === 'APPROVED' && request?.car_id) {
        await supabase.from('cars').update({ status: 'IN_USE' }).eq('id', request.car_id);
    }

    return data;
};

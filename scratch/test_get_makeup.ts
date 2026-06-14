import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf8');
const env: Record<string, string> = {};
envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    const key = parts[0];
    const value = parts.slice(1).join('=');
    if (key && value) {
        env[key.trim()] = value.trim();
    }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

// 複製 getMakeupRequests 的實作來跑，看看會不會報錯
export const getMakeupRequestsTest = async (status?: string, managerId?: string) => {
    try {
        console.log('[getMakeupRequestsTest] Called with:', { status, managerId });

        const baseQuery = supabase
            .from('makeup_attendance_requests')
            .select(`
                *,
                employee:employees(name, department, pin, manager_id)
            `);

        let pendingData: any[] = [];
        let historyData: any[] = [];

        if (!status || status === 'ALL' || status === 'PENDING') {
            let pendingQuery = supabase
                .from('makeup_attendance_requests')
                .select(`
                    *,
                    employee:employees(name, department, pin, manager_id)
                `)
                .eq('status', 'PENDING')
                .order('created_at', { ascending: false });

            const { data, error } = await pendingQuery;
            if (error) {
                console.error('Pending Query Error:', error);
                throw error;
            }
            pendingData = data || [];
        }

        if (!status || status === 'ALL' || status !== 'PENDING') {
            let historyQuery = supabase
                .from('makeup_attendance_requests')
                .select(`
                    *,
                    employee:employees(name, department, pin, manager_id)
                `)
                .neq('status', 'PENDING')
                .order('created_at', { ascending: false })
                .limit(5000);

            if (status && status !== 'ALL') {
                historyQuery = historyQuery.eq('status', status);
            }

            const { data, error } = await historyQuery;
            if (error) {
                console.error('History Query Error:', error);
                throw error;
            }
            historyData = data || [];
        }

        let allData = status === 'PENDING' ? pendingData :
            status && status !== 'ALL' ? historyData :
                [...pendingData, ...historyData];

        console.log('Fetched data length before filter:', allData.length);
        if (allData.length > 0) {
            console.log('Sample item employee:', allData[0].employee);
        }

        if (managerId) {
            allData = allData.filter((req: any) => req.employee?.manager_id === managerId);
        }

        return allData;
    } catch (error) {
        console.error('Error fetching makeup requests:', error);
        return [];
    }
};

async function runTest() {
    const managerId = '153bf58a-bba6-4ba2-bd81-77f52299b0ad'; // 林文明
    const data = await getMakeupRequestsTest('PENDING', managerId);
    console.log('Result length:', data.length);
    if (data.length > 0) {
        console.log('First request ID:', data[0].id);
    }
}

runTest();

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

async function testGetAllRequests() {
    try {
        console.log('--- Testing requestService.getAllRequests() ---');
        
        // 這是 getAllRequests 的程式碼
        const { data, error } = await supabase
            .from('leave_requests')
            .select(`
                *,
                leave_type:leave_types(*),
                employee:employees!leave_requests_employee_id_fkey(name, department),
                deputy:employees!leave_requests_deputy_id_fkey(id, name, department)
            `)
            .or('is_modified.is.null,is_modified.eq.false')
            .order('created_at', { ascending: false })
            .limit(5000);

        if (error) {
            console.error('Error fetching all requests:', error);
            return;
        }

        console.log('Successfully fetched rows:', data?.length);
        if (data && data.length > 0) {
            const pending = data.filter(r => r.status === 'PENDING' || r.status === 'WITHDRAW_PENDING');
            console.log('Pending in results:', pending.length);
        }
    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

testGetAllRequests();

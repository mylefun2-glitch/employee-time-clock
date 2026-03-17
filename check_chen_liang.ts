import { createClient } from '@supabase/supabase-js';

const VITE_SUPABASE_URL = "https://dqnaeesdovovmblsyuma.supabase.co";
const VITE_SUPABASE_ANON_KEY = "sb_publishable_d0sbSqQRwllVCV7ydQNU7Q_VPQAs1tj";
const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

async function run() {
    // get Chen Liang's ID
    const { data: emps } = await supabase.from('employees').select('id, name').eq('name', '陳諒');
    if (!emps || emps.length === 0) {
        console.log("No Chen Liang found");
        return;
    }
    const empId = emps[0].id;
    console.log("Chen Liang ID:", empId);

    // get ALC, ANNUAL types
    const { data: types } = await supabase.from('leave_types').select('*');
    console.log("Leave Types:", types);

    // get leave requests matching ANNUAL or ALC
    const { data: reqs } = await supabase.from('leave_requests')
        .select('*')
        .eq('employee_id', empId)
        .eq('status', 'APPROVED');
    console.log("Leave Requests for Chen Liang:", reqs);

    // get adjustments
    const { data: adjs } = await supabase.from('leave_balance_adjustments')
        .select('*')
        .eq('employee_id', empId);
    console.log("Leave Adjustments for Chen Liang:", adjs);
}

run();

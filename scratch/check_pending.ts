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

async function checkPending() {
    console.log('--- Checking Pending Requests ---');
    
    // 1. Leave requests
    const { data: leave } = await supabase
        .from('leave_requests')
        .select('id, employee_id, status, employees:employees!leave_requests_employee_id_fkey(name, manager_id)')
        .in('status', ['PENDING', 'WITHDRAW_PENDING']);
    console.log('\nLeave Requests PENDING:', leave?.length);
    leave?.forEach(r => {
        console.log(`- ID: ${r.id}, Employee: ${(r.employees as any)?.name}, ManagerID: ${(r.employees as any)?.manager_id}, Status: ${r.status}`);
    });

    // 2. Makeup requests
    const { data: makeup } = await supabase
        .from('makeup_attendance_requests')
        .select('id, employee_id, status, employees:employees!employee_id(name, manager_id)')
        .eq('status', 'PENDING');
    console.log('\nMakeup Requests PENDING:', makeup?.length);
    makeup?.forEach(r => {
        console.log(`- ID: ${r.id}, Employee: ${(r.employees as any)?.name}, ManagerID: ${(r.employees as any)?.manager_id}, Status: ${r.status}`);
    });

    // 3. Shift requests
    const { data: shift } = await supabase
        .from('shift_requests')
        .select('id, employee_id, status, employees:employees!employee_id(name, manager_id)')
        .eq('status', 'PENDING');
    console.log('\nShift Requests PENDING:', shift?.length);
    shift?.forEach(r => {
        console.log(`- ID: ${r.id}, Employee: ${(r.employees as any)?.name}, ManagerID: ${(r.employees as any)?.manager_id}, Status: ${r.status}`);
    });

    // 4. Car requests
    const { data: car } = await supabase
        .from('car_usage_requests')
        .select('id, employee_id, status, employees:employees!employee_id(name, manager_id)')
        .in('status', ['PENDING', 'WITHDRAW_PENDING']);
    console.log('\nCar Requests PENDING:', car?.length);
    car?.forEach(r => {
        console.log(`- ID: ${r.id}, Employee: ${(r.employees as any)?.name}, ManagerID: ${(r.employees as any)?.manager_id}, Status: ${r.status}`);
    });

    // 5. Resource requests
    const { data: resource } = await supabase
        .from('resource_requests')
        .select('id, employee_id, status, employees:employees!employee_id(name, manager_id)')
        .eq('status', 'PENDING');
    console.log('\nResource Requests PENDING:', resource?.length);
    resource?.forEach(r => {
        console.log(`- ID: ${r.id}, Employee: ${(r.employees as any)?.name}, ManagerID: ${(r.employees as any)?.manager_id}, Status: ${r.status}`);
    });

    // 6. Employees list
    const { data: managers } = await supabase
        .from('employees')
        .select('id, name, is_supervisor, is_chairman, manager_id');
    console.log('\nAll Employees:');
    managers?.forEach(m => {
        console.log(`- ID: ${m.id}, Name: ${m.name}, Supervisor: ${m.is_supervisor}, Chairman: ${m.is_chairman}, ManagerID: ${m.manager_id}`);
    });
}

checkPending();

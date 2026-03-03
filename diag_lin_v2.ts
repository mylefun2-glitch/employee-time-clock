import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function diag() {
    const empId = '9c5c2330-09fb-4410-be2c-d37b733fbb55';

    console.log('Querying leave_types for code "ANNUAL"...');
    const { data: types } = await supabase.from('leave_types').select('id').eq('code', 'ANNUAL');
    const annualId = types?.[0]?.id;
    console.log('ANNUAL ID:', annualId);

    console.log('\nRunning exact filters from SQL...');
    // WHERE employee_id = target_employee_id 
    // AND status = 'APPROVED' 
    // AND (is_modified IS FALSE OR is_modified IS NULL)
    // AND type = 'LEAVE' 
    // AND leave_type_id IN (...)

    // We'll perform a broad query and then filter manually to see where it breaks.
    const { data: allReqs } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('employee_id', empId);

    console.log(`Total records for employee: ${allReqs?.length || 0}`);

    const s1 = allReqs?.filter(r => r.status === 'APPROVED');
    console.log(`- After status = 'APPROVED': ${s1?.length || 0}`);

    const s2 = s1?.filter(r => r.is_modified === false || r.is_modified === null);
    console.log(`- After (is_modified IS FALSE OR NULL): ${s2?.length || 0}`);

    const s3 = s2?.filter(r => r.type === 'LEAVE');
    console.log(`- After type = 'LEAVE': ${s3?.length || 0}`);

    const s4 = s3?.filter(r => r.leave_type_id === annualId);
    console.log(`- After leave_type_id = ANNUAL: ${s4?.length || 0}`);

    const totalHours = s4?.reduce((sum, r) => sum + (r.hours || 0), 0) || 0;
    console.log(`\nFinal Total Hours: ${totalHours}`);
}

diag();

import { createClient } from '@supabase/supabase-js';

const VITE_SUPABASE_URL = "https://dqnaeesdovovmblsyuma.supabase.co";
const VITE_SUPABASE_ANON_KEY = "sb_publishable_d0sbSqQRwllVCV7ydQNU7Q_VPQAs1tj";

const supabase = createClient(
    VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY
);

async function diagnose() {
    const employeeId = '9c5c2330-09fb-4410-be2c-d37b733fbb55';

    // 1. Get all ANNUAL leave type IDs
    const { data: leaveTypes } = await supabase
        .from('leave_types')
        .select('*')
        .eq('code', 'ANNUAL');

    const annualIds = leaveTypes.map(t => t.id);
    console.log('ANNUAL Type IDs:', annualIds);

    // 2. Query all APPROVED, non-modified ANNUAL leave requests
    let allRequests = [];
    let page = 0;
    const pageSize = 1000;

    while (true) {
        const { data, error } = await supabase
            .from('leave_requests')
            .select('id, start_date, hours, status, is_modified, reason')
            .eq('employee_id', employeeId)
            .eq('status', 'APPROVED')
            .eq('type', 'LEAVE')
            .in('leave_type_id', annualIds)
            .or('is_modified.eq.false,is_modified.is.null')
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
            console.error('Error fetching data:', error);
            break;
        }

        if (data.length === 0) break;

        allRequests = allRequests.concat(data);
        page++;
        if (data.length < pageSize) break;
    }

    console.log('Total APPROVED non-modified records FOUND:', allRequests.length);

    const totalSum = allRequests.reduce((sum, r) => sum + (parseFloat(r.hours) || 0), 0);
    console.log('Calculated Total Sum of Hours:', totalSum);

    // 3. Group by Year
    const byYear = allRequests.reduce((acc, r) => {
        const year = new Date(r.start_date).getFullYear();
        acc[year] = (acc[year] || 0) + (parseFloat(r.hours) || 0);
        return acc;
    }, {});

    console.log('Sum by Year:', byYear);

    // 4. Reason analysis for 2020-2021
    const suspiciousYears = [2020, 2021];
    suspiciousYears.forEach(year => {
        const yearRecs = allRequests.filter(r => new Date(r.start_date).getFullYear() === year);
        const reasons = yearRecs.reduce((acc, r) => {
            const res = r.reason || '(empty)';
            acc[res] = (acc[res] || 0) + 1;
            return acc;
        }, {});
        console.log(`--- Reasons in ${year} ---`);
        console.log(JSON.stringify(reasons, null, 2));
    });

    console.log('--- Detailed Records for 2020 ---');
    const rec2020 = allRequests.filter(r => new Date(r.start_date).getFullYear() === 2020);
    rec2020.sort((a, b) => a.start_date.localeCompare(b.start_date));
    console.log(JSON.stringify(rec2020, null, 2));

    console.log('--- Detailed Records for 2021 ---');
    const rec2021 = allRequests.filter(r => new Date(r.start_date).getFullYear() === 2021);
    rec2021.sort((a, b) => a.start_date.localeCompare(b.start_date));
    console.log(JSON.stringify(rec2021, null, 2));
}

diagnose();

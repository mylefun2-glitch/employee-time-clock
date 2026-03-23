import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://dqnaeesdovovmblsyuma.supabase.co', 'sb_publishable_d0sbSqQRwllVCV7ydQNU7Q_VPQAs1tj');

async function check() {
    const { data: carsData } = await supabase.from('cars').select('*');
    const carsMap = new Map((carsData || []).map(c => [c.id, c]));

    const lrQuery = supabase.from('leave_requests').select(`
        *,
        employee:employees!leave_requests_employee_id_fkey(id, name, department)
    `).not('car_id', 'is', null).in('status', ['PENDING', 'APPROVED', 'WITHDRAW_PENDING', 'CHAIRMAN_APPROVED']);

    const [lrResult] = await Promise.all([lrQuery]);

    if (lrResult.error) {
       console.log('Error:', lrResult.error);
       return;
    }

    const formattedLr = (lrResult.data || []).map(item => {
        const mappedCar = carsMap.get(item.car_id);
        return {
            id: item.id,
            start_time: item.start_date,
            car_id: item.car_id,
            mapped_car_name: mappedCar?.plate_number || '未知名稱'
        };
    });
    
    console.log(JSON.stringify(formattedLr.slice(0, 3), null, 2));
}

check();

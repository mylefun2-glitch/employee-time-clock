import { createClient } from '@supabase/supabase-js';
import { format } from 'date-fns';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- Inlined Logic Start ---

const HOLIDAYS_DATA = [
    { date: '2025-01-01', name: '元旦' },
    { date: '2025-01-27', name: '春節前一日' },
    { date: '2025-01-28', name: '除夕' },
    { date: '2025-01-29', name: '春節初一' },
    { date: '2025-01-30', name: '春節初二' },
    { date: '2025-01-31', name: '春節初三' },
    { date: '2025-02-01', name: '春節初四' },
    { date: '2025-02-02', name: '春節初五' },
    { date: '2025-02-28', name: '和平紀念日' },
    { date: '2025-04-03', name: '兒童節補假' },
    { date: '2025-04-04', name: '兒童節/節氣清明' },
    { date: '2025-05-01', name: '勞動節' },
    { date: '2025-05-30', name: '端午節前一日' },
    { date: '2025-05-31', name: '端午節' },
    { date: '2025-10-06', name: '中秋節' },
    { date: '2025-10-10', name: '國慶日' },
    { date: '2025-12-25', name: '行憲紀念日' },
    { date: '2026-01-01', name: '元旦' },
    { date: '2026-02-16', name: '春節前一日(補假)' },
    { date: '2026-02-17', name: '除夕' },
    { date: '2026-02-18', name: '春節初一' },
    { date: '2026-02-19', name: '春節初二' },
    { date: '2026-02-20', name: '春節初三' },
    { date: '2026-02-21', name: '春節初四' },
    { date: '2026-02-22', name: '春節初五' },
    { date: '2026-02-27', name: '和平紀念日補假' },
    { date: '2026-02-28', name: '和平紀念日' },
    { date: '2026-04-03', name: '兒童節補假' },
    { date: '2026-04-04', name: '兒童節' },
    { date: '2026-04-05', name: '清明節' },
    { date: '2026-04-06', name: '清明節補假' },
    { date: '2026-05-01', name: '勞動節' },
    { date: '2026-06-19', name: '端午節' },
    { date: '2026-09-25', name: '中秋節' },
    { date: '2026-09-28', name: '孔子誕辰紀念日(教師節)' },
    { date: '2026-10-09', name: '國慶日補假' },
    { date: '2026-10-10', name: '國慶日' },
    { date: '2026-12-25', name: '行憲紀念日' },
];
const HOLIDAY_MAP = new Map(HOLIDAYS_DATA.map(h => [h.date, h.name]));
const isNationalHoliday = (date: Date) => HOLIDAY_MAP.get(format(date, 'yyyy-MM-dd'));

const calculateHours = (
    startDate: Date,
    endDate: Date,
    employee: any,
    historicalSchedules: any[],
    manualBreak: number = 0,
    isMakeupWorkday: boolean = false
) => {
    if (endDate <= startDate) return 0;

    let totalMinutes = 0;

    const getEffectiveSchedule = (date: Date) => {
        if (historicalSchedules && historicalSchedules.length > 0) {
            const dateStr = format(date, 'yyyy-MM-dd');
            const schedule = historicalSchedules
                .filter(s => s.effective_date <= dateStr)
                .sort((a, b) => b.effective_date.localeCompare(a.effective_date))[0];
            if (schedule) return schedule;
        }
        return {
            work_start_time: employee.work_start_time || '08:00',
            work_end_time: employee.work_end_time || '17:00',
            break_start_time: employee.break_start_time || '12:00',
            break_end_time: employee.break_end_time || '13:00',
            rest_days: employee.rest_days || [0, 6]
        };
    };

    let currentDayHead = new Date(startDate);
    currentDayHead.setHours(0, 0, 0, 0);
    const endDayHead = new Date(endDate);
    endDayHead.setHours(0, 0, 0, 0);

    while (currentDayHead <= endDayHead) {
        const schedule = getEffectiveSchedule(currentDayHead);
        const holidayName = isNationalHoliday(currentDayHead);
        const dayOfWeek = currentDayHead.getDay();
        const isRestDay = schedule.rest_days.includes(dayOfWeek);

        if (!(holidayName || (isRestDay && !isMakeupWorkday))) {
            const [workStartH, workStartM] = schedule.work_start_time.split(':').map(Number);
            const [workEndH, workEndM] = schedule.work_end_time.split(':').map(Number);

            const mergedBreaks = [];
            if (schedule.break_start_time && schedule.break_end_time) {
                const [sh, sm] = schedule.break_start_time.split(':').map(Number);
                const [eh, em] = schedule.break_end_time.split(':').map(Number);
                mergedBreaks.push({ startMinutes: sh * 60 + sm, endMinutes: eh * 60 + em });
            }

            const dayWorkStart = new Date(currentDayHead);
            dayWorkStart.setHours(workStartH, workStartM, 0, 0);
            const dayWorkEnd = new Date(currentDayHead);
            dayWorkEnd.setHours(workEndH, workEndM, 0, 0);

            const actualStart = new Date(Math.max(startDate.getTime(), dayWorkStart.getTime()));
            const actualEnd = new Date(Math.min(endDate.getTime(), dayWorkEnd.getTime()));

            if (actualStart < actualEnd) {
                let dayRawMinutes = Math.floor((actualEnd.getTime() - actualStart.getTime()) / (1000 * 60));
                let dayBreakMinutes = 0;

                mergedBreaks.forEach(b => {
                    const bStartDate = new Date(currentDayHead);
                    bStartDate.setHours(Math.floor(b.startMinutes / 60), b.startMinutes % 60, 0, 0);
                    const bEndDate = new Date(currentDayHead);
                    bEndDate.setHours(Math.floor(b.endMinutes / 60), b.endMinutes % 60, 0, 0);
                    const overlapStart = new Date(Math.max(actualStart.getTime(), bStartDate.getTime()));
                    const overlapEnd = new Date(Math.min(actualEnd.getTime(), bEndDate.getTime()));
                    if (overlapStart < overlapEnd) {
                        dayBreakMinutes += Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60));
                    }
                });

                totalMinutes += Math.max(0, dayRawMinutes - dayBreakMinutes);
            }
        }
        currentDayHead.setDate(currentDayHead.getDate() + 1);
    }

    return parseFloat((Math.max(0, (totalMinutes / 60) - manualBreak)).toFixed(1));
};

// --- Inlined Logic End ---

async function fix() {
    console.log('Fetching Lin Li-xin...');
    const { data: emp, error: empError } = await supabase.from('employees').select('*').eq('name', '林立心').single();
    if (empError || !emp) {
        console.error('Employee not found or error:', empError || 'None');
        return;
    }


    console.log('Fetching historical schedules...');
    const { data: schedules } = await supabase.from('employee_schedules').select('*').eq('employee_id', emp.id).order('effective_date', { ascending: false });

    console.log('Fetching ANNUAL leave requests...');
    const { data: types } = await supabase.from('leave_types').select('id').eq('code', 'ANNUAL');
    const annualId = types?.[0]?.id;

    const { data: reqs } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('employee_id', emp.id)
        .eq('leave_type_id', annualId)
        .eq('status', 'APPROVED');

    if (!reqs) { console.log('No records found.'); return; }

    console.log(`Checking ${reqs.length} records...`);

    for (const r of reqs) {
        const start = new Date(r.start_date);
        const end = new Date(r.end_date);
        const correctHours = calculateHours(start, end, emp, schedules || [], r.manual_break_hours || 0, r.is_makeup_workday || false);

        if (Math.abs(Number(r.hours) - correctHours) > 0.01) {
            console.log(`Fixing ${r.start_date.split('T')[0]}: ${r.hours}h -> ${correctHours}h`);
            await supabase.from('leave_requests').update({ hours: correctHours }).eq('id', r.id);
        }
    }
    console.log('Fix complete.');
}

fix();

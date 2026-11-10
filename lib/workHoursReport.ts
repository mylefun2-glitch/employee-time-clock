import { monthBounds, readAllPages, taiwanDate } from './hrReport';

// Read-only source boundary. Never project personnel secrets or use payroll credits.
type RecordRow = Record<string, any>;
export interface WorkHoursSources {
    employees: RecordRow[]; logs: RecordRow[]; leaves: RecordRow[]; types: RecordRow[];
    schedules: RecordRow[]; overrides: RecordRow[]; duties: RecordRow[];
    holidays: RecordRow[]; companyHolidays: RecordRow[]; services: RecordRow[];
}
export interface WorkHoursOptions {
    month: string; asOf: string;
    filters: { department: string[]; position: string[]; gender: string[] };
}
export interface WorkHoursDay {
    date: string; punches: string[]; punchTypes?: string[]; normalHours: number | null; overtimeHours: number | null;
    totalHours: number | null; knownOvertimeHours?: number; serviceHours: number; issues: string[]; source: string;
}
const timeFields = 'work_start_time,work_end_time,break_start_time,break_end_time,break2_start_time,break2_end_time,break3_start_time,break3_end_time';
export async function readWorkHoursSources(client: any, month: string): Promise<WorkHoursSources> {
    const { start, end } = monthBounds(month);
    const first = start.slice(0, 10), next = end.slice(0, 10);
    const read = (table: string, fields: string, filter = (q: any) => q) => readAllPages(() => filter(client.from(table).select(fields)));
    // This table deliberately has no id. Its composite primary key is the stable order.
    const readDuties = async () => {
        const result: RecordRow[] = [];
        for (let offset = 0; ; offset += 500) {
            const response = await client.from('employee_lunch_duties').select('employee_id,duty_date,enabled')
                .gte('duty_date', first).lt('duty_date', next)
                .order('employee_id', { ascending: true }).order('duty_date', { ascending: true }).range(offset, offset + 499);
            if (response.error || !Array.isArray(response.data)) throw new Error('來源讀取失敗: employee_lunch_duties');
            result.push(...response.data);
            if (response.data.length < 500) return result;
        }
    };
    const [employees, logs, leaves, types, schedules, overrides, duties, holidays, companyHolidays, services] = await Promise.all([
        read('employees', `id,name,department,position,gender,is_active,is_chairman,join_date,schedule_effective_date,${timeFields},rest_days,salary_type,standard_daily_hours`),
        read('attendance_logs', 'id,employee_id,check_type,timestamp,is_makeup', q => q.gte('timestamp', start).lt('timestamp', end)),
        read('leave_requests', 'id,employee_id,type,leave_type_id,start_date,end_date,hours,status,is_modified,modified_by_request_id,original_request_id,manual_break_hours,is_makeup_workday,is_makeup_holiday', q => q.eq('status', 'APPROVED').lt('start_date', end).gte('end_date', start)),
        read('leave_types', 'id,name,code'),
        read('employee_schedules', `id,employee_id,effective_date,${timeFields},rest_days,salary_type,standard_daily_hours`, q => q.lt('effective_date', next)),
        read('employee_day_overrides', 'id,employee_id,override_date,day_type,work_start_time,work_end_time,break_start_time,break_end_time,request_id', q => q.gte('override_date', first).lt('override_date', next)),
        readDuties(),
        read('holidays', 'id,date,name,type', q => q.gte('date', first).lt('date', next)),
        read('company_holidays', 'id,holiday_date,name,is_active', q => q.gte('holiday_date', first).lt('holiday_date', next)),
        read('monthly_salary_schedules', 'id,employee_id,service_date,shift_type,service_mins', q => q.gte('service_date', first).lt('service_date', next))
    ]);
    return { employees, logs, leaves, types, schedules, overrides, duties, holidays, companyHolidays, services };
}

type Interval = [number, number];
const rounded = (n: number) => Math.round(n * 1e8) / 1e8;
const stamp = (value: any): number => {
    if (typeof value !== 'string') return NaN;
    // Database timestamps without a timezone are business-local, not host-local.
    const text = /^\d{4}-\d\d-\d\d$/.test(value) ? value + 'T00:00:00+08:00'
        : /(?:Z|[+-]\d\d(?::?\d\d)?)$/i.test(value) ? value : value.replace(' ', 'T') + '+08:00';
    return Date.parse(text);
};
const dateOf = (value: any) => Number.isFinite(stamp(value)) ? taiwanDate(new Date(stamp(value))) : '';
const nextDate = (date: string) => taiwanDate(new Date(stamp(date) + 86400000));
const clock = (value: any): number => {
    if (typeof value !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value)) return NaN;
    const [h, m, s = 0] = value.split(':').map(Number); return h * 60 + m + s / 60;
};
const effective = (r: RecordRow) => r.status === 'APPROVED' && r.is_modified !== true && !r.modified_by_request_id;
const finiteHours = (v: any) => (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) && Number.isFinite(Number(v)) && Number(v) >= 0;
function union(intervals: Interval[]): Interval[] {
    const result: Interval[] = [];
    for (const [a, b] of intervals.filter(([a, b]) => Number.isFinite(a) && b > a).sort((x, y) => x[0] - y[0])) {
        const last = result[result.length - 1];
        if (last && a <= last[1]) last[1] = Math.max(last[1], b); else result.push([a, b]);
    }
    return result;
}
function subtract(intervals: Interval[], cuts: Interval[]): Interval[] {
    let result = intervals;
    for (const [a, b] of union(cuts)) result = result.flatMap(([x, y]) => b <= x || a >= y ? [[x, y] as Interval] : [[x, Math.min(a, y)], [Math.max(b, x), y]].filter(([s, e]) => e > s) as Interval[]);
    return result;
}
const duration = (intervals: Interval[]) => intervals.reduce((sum, [a, b]) => sum + b - a, 0);
const overlaps = (r: RecordRow, date: string) => {
    const a = stamp(r.start_date), b = stamp(r.end_date);
    return a === b ? dateOf(r.start_date) === date : a < stamp(nextDate(date)) && b > stamp(date);
};
const workCodes = new Set(['OB', 'HV', 'MTG', 'AA', 'IS', 'SI', 'INT', 'BUSINESS_TRIP']);
const workRequest = (r: RecordRow, code: string | undefined) => r.type === 'BUSINESS_TRIP' || r.type === 'WORK' || r.type === 'SHIFT' || r.is_makeup_workday === true || workCodes.has(code ?? '');
const excludedCodes = new Set(['CO', 'ALC']);

export function buildWorkHoursReport(sources: WorkHoursSources, options: WorkHoursOptions) {
    const { month, asOf, filters } = options;
    const { start, end } = monthBounds(month);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf) || dateOf(asOf) !== asOf) throw new Error('基準日格式錯誤');
    for (const key of ['employees', 'logs', 'leaves', 'types', 'schedules', 'overrides', 'duties', 'holidays', 'companyHolidays', 'services'] as const) {
        if (!Array.isArray(sources[key])) throw new Error(`缺少來源: ${key}`);
    }
    const first = start.slice(0, 10), next = end.slice(0, 10);
    const inScope = (d: string) => !!d && d >= first && d < next && d <= asOf;
    const code = (r: RecordRow) => sources.types.find(t => t.id === r.leave_type_id)?.code;
    // An unplaceable punch must not silently disappear or produce a complete report.
    if (sources.logs.some(r => !Number.isFinite(stamp(r.timestamp)))) throw new Error('invalid-punch-timestamp');
    const requests = sources.leaves.filter(effective).filter(r => {
        const a = stamp(r.start_date), b = stamp(r.end_date);
        // Only stored OT explicitly permits a zero-duration evidence record.
        return Number.isFinite(a) && Number.isFinite(b) && (b > a || (b === a && code(r) === 'OT'));
    });
    const rows = sources.employees.filter(e => e.is_chairman !== true).filter(e => {
        const match = (key: 'department' | 'position' | 'gender', value: string) => !filters[key]?.length || filters[key].includes('ALL') || filters[key].includes(value);
        return match('department', e.department ?? '') && match('position', e.position ?? '') && match('gender', ['MALE', 'FEMALE'].includes(e.gender) ? e.gender : 'OTHER');
    }).map(e => {
        const logs = sources.logs.filter(r => r.employee_id === e.id && inScope(dateOf(r.timestamp)));
        const leaves = requests.filter(r => r.employee_id === e.id);
        const services = sources.services.filter(r => r.employee_id === e.id && inScope(r.service_date));
        const dates = new Set<string>([...logs.map(r => dateOf(r.timestamp)), ...services.map(r => r.service_date)]);
        // Expand only actual approved evidence intervals, never fill calendar absences.
        for (const r of leaves) {
            const startTime = stamp(r.start_date), endTime = stamp(r.end_date);
            const a = dateOf(r.start_date), b = taiwanDate(new Date(endTime > startTime ? endTime - 1 : endTime));
            for (let d = a < first ? first : a; d <= b && d < next && d <= asOf; d = nextDate(d)) dates.add(d);
        }
        const days: WorkHoursDay[] = [...dates].sort().map(date => {
            const issues: string[] = [];
            const dayLogs = logs.filter(r => dateOf(r.timestamp) === date).sort((a, b) => stamp(a.timestamp) - stamp(b.timestamp));
            const dayLeaves = leaves.filter(r => overlaps(r, date));
            const ot = dayLeaves.filter(r => code(r) === 'OT');
            const dayServices = services.filter(r => r.service_date === date);
            const serviceHours = rounded(dayServices.reduce((sum, r) => sum + (finiteHours(r.service_mins) ? Number(r.service_mins) / 60 : 0), 0));
            if (dayServices.some(r => !finiteHours(r.service_mins))) issues.push('invalid-service-minutes');
            const history = sources.schedules.filter(r => r.employee_id === e.id && r.effective_date <= date).sort((a, b) => b.effective_date.localeCompare(a.effective_date));
            let base: RecordRow | null = history[0] || (e.schedule_effective_date && e.schedule_effective_date <= date ? e : null);
            if (history.length > 1 && history[0].effective_date === history[1].effective_date) { base = null; issues.push('ambiguous-schedule'); }
            const overrides = sources.overrides.filter(r => r.employee_id === e.id && r.override_date === date);
            const override = overrides.length === 1 ? overrides[0] : null;
            if (overrides.length > 1) issues.push('ambiguous-override');
            const forceWork = override && ['WORKDAY', 'CUSTOM', 'CUSTOM_HOURS'].includes(override.day_type);
            const weekday = new Date(stamp(date) + 8 * 3600000).getUTCDay();
            const holiday = sources.holidays.some(r => r.date === date) || sources.companyHolidays.some(r => r.holiday_date === date && r.is_active === true);
            const rest = override?.day_type === 'REST_DAY' || (!forceWork && (holiday || (Array.isArray(base?.rest_days) && base.rest_days.includes(weekday))));
            let window: Interval | null = null, breaks: Interval[] = [];
            const origin = stamp(date);
            const at = (v: any) => origin + clock(v) * 60000;
            if (base) {
                const config = { ...base };
                if (override) for (const key of ['work_start_time', 'work_end_time', 'break_start_time', 'break_end_time']) if (override[key] != null) config[key] = override[key];
                const a = at(config.work_start_time), b = at(config.work_end_time);
                if (Number.isFinite(a) && Number.isFinite(b) && b > a) window = [a, b];
                for (const prefix of ['break', 'break2', 'break3']) {
                    const av = config[`${prefix}_start_time`], bv = config[`${prefix}_end_time`];
                    if (av == null && bv == null) continue;
                    const a = at(av), b = at(bv);
                    if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) issues.push('invalid-break');
                    else if (b > a) breaks.push([a, b]);
                }
                if (!overrides.length && !rest && e.department === '心安居' && clock(config.work_start_time) === 480 && clock(config.work_end_time) === 1020 && sources.duties.some(r => r.employee_id === e.id && r.duty_date === date && r.enabled === true)) {
                    window = [at('08:00'), at('16:00')]; breaks = [[at('12:00'), at('12:30')], [at('16:00'), at('16:30')], ...breaks.filter(([a]) => a !== at('12:00'))];
                }
            }
            let overtimeHours: number | null = 0;
            const otIntervals: Interval[] = [];
            for (const r of ot) {
                const a = stamp(r.start_date), b = stamp(r.end_date);
                if (!finiteHours(r.hours)) { overtimeHours = null; issues.push('missing-ot-hours'); }
                if (dateOf(r.start_date) !== date || dateOf(r.end_date) !== date || !Number.isFinite(a) || !Number.isFinite(b) || b < a) { overtimeHours = null; issues.push('unallocatable-ot'); }
                if (Number.isFinite(a) && Number.isFinite(b) && b >= a) otIntervals.push([a, b]);
            }
            const sortedOT = [...otIntervals].sort((a, b) => a[0] - b[0]);
            if (sortedOT.some(([a], i) => i > 0 && a < Math.max(...sortedOT.slice(0, i).map(r => r[1])))) { overtimeHours = null; issues.push('overlapping-ot'); }
            if (overtimeHours !== null) overtimeHours = rounded(ot.reduce((sum, r) => sum + Number(r.hours), 0));
            // Retain independently known records even when another OT record is missing hours.
            // Any interval participating in an overlap or crossing dates is unallocatable.
            let knownOvertimeHours = 0;
            for (const r of ot) {
                const a = stamp(r.start_date), b = stamp(r.end_date);
                if (finiteHours(r.hours) && dateOf(r.start_date) === date && dateOf(r.end_date) === date && b >= a &&
                    !ot.some(other => other !== r && stamp(other.start_date) < b && stamp(other.end_date) > a)) knownOvertimeHours += Number(r.hours);
            }
            const sessions: Interval[] = [];
            const validPairs = dayLogs.length > 0 && dayLogs.length % 2 === 0 && dayLogs.every((r, i) => r.check_type === (i % 2 ? 'OUT' : 'IN') && (i === 0 || stamp(r.timestamp) > stamp(dayLogs[i - 1].timestamp)));
            if (validPairs) for (let i = 0; i < dayLogs.length; i += 2) sessions.push([stamp(dayLogs[i].timestamp), stamp(dayLogs[i + 1].timestamp)]);
            let normalHours: number | null = null;
            if (dayLogs.length && !validPairs) issues.push('invalid-punch-sequence');
            const nonwork = dayLeaves.filter(r => r.type === 'LEAVE' && code(r) !== 'OT' && !excludedCodes.has(code(r)) && !workRequest(r, code(r)));
            const leaveIntervals: Interval[] = nonwork.map(r => [stamp(r.start_date), stamp(r.end_date)]);
            if (nonwork.some(r => !code(r))) issues.push('unknown-leave-type');
            if (rest) normalHours = 0;
            else if (!base || !window) issues.push('unknown-effective-schedule');
            else if (validPairs) {
                const clipped = sessions.map(([a, b]) => [Math.max(a, window![0]), Math.min(b, window![1])] as Interval).filter(([a, b]) => b > a);
                normalHours = rounded(duration(subtract(clipped, [...breaks, ...leaveIntervals, ...otIntervals])) / 3600000);
            } else if (!dayLogs.length && nonwork.length && duration(subtract([window], [...breaks, ...leaveIntervals])) === 0) normalHours = 0;
            else if (!dayLogs.length) issues.push('no-punch-evidence');
            if (validPairs && (rest || window)) {
                // Breaks outside the duty window (16:00–16:30) are not unapproved OT.
                const allowed: Interval[] = [...(rest ? [] : window ? [window] : []), ...breaks, ...otIntervals];
                if (duration(subtract(sessions, allowed)) > 0) {
                    issues.push('班外打卡不自動認列加班');
                    if (rest) { overtimeHours = null; issues.push('unapproved-restday-work'); }
                }
            }
            if (!dayLogs.length && dayLeaves.some(r => workRequest(r, code(r)))) { normalHours = null; issues.push('work-request-not-actual-evidence'); }
            if (dayServices.length) { normalHours = null; issues.push(dayLogs.length ? 'service-punch-ambiguity' : 'service-not-actual-evidence'); }
            if (dayLogs.length && !validPairs || issues.some(i => ['invalid-break', 'unknown-leave-type', 'ambiguous-override', 'ambiguous-schedule'].includes(i))) normalHours = null;
            const totalHours = normalHours === null || overtimeHours === null ? null : rounded(normalHours + overtimeHours);
            return { date, punches: dayLogs.map(r => r.timestamp), punchTypes: dayLogs.map(r => r.check_type), normalHours, overtimeHours, knownOvertimeHours: rounded(knownOvertimeHours), totalHours, serviceHours, issues: [...new Set(issues)], source: [dayLogs.length ? 'punches' : '', dayLeaves.length ? 'approved-requests' : '', dayServices.length ? 'service-reference' : '', override ? 'override' : history[0] ? 'schedule-history' : base ? 'employee-effective-default' : ''].filter(Boolean).join('+') };
        });
        const knownNormalHours = rounded(days.reduce((sum, d) => sum + (d.normalHours ?? 0), 0));
        const knownOvertimeHours = rounded(days.reduce((sum, d) => sum + (d.knownOvertimeHours ?? 0), 0));
        const pendingDays = days.filter(d => d.normalHours === null || d.overtimeHours === null || d.issues.some(i => i !== '班外打卡不自動認列加班')).length;
        const employee = { id: e.id, name: e.name, department: e.department, position: e.position, gender: e.gender, is_active: e.is_active };
        return { employee, normalHours: days.length && days.every(d => d.normalHours !== null) ? knownNormalHours : null,
            overtimeHours: days.length && days.every(d => d.overtimeHours !== null) ? knownOvertimeHours : null,
            totalHours: days.length && days.every(d => d.totalHours !== null) ? rounded(knownNormalHours + knownOvertimeHours) : null,
            knownNormalHours, knownOvertimeHours, knownTotalHours: rounded(knownNormalHours + knownOvertimeHours),
            serviceHours: rounded(days.reduce((s, d) => s + d.serviceHours, 0)), pendingDays,
            status: !days.length ? 'no-data' : pendingDays ? 'pending' : 'complete', days };
    }).filter(r => r.employee.is_active === true || r.days.length > 0);
    return { rows, summary: {
        normalHours: rounded(rows.reduce((s, r) => s + r.knownNormalHours, 0)),
        overtimeHours: rounded(rows.reduce((s, r) => s + r.knownOvertimeHours, 0)),
        totalHours: rounded(rows.reduce((s, r) => s + r.knownTotalHours, 0)),
        pendingPeople: rows.filter(r => r.status === 'pending').length, noDataPeople: rows.filter(r => r.status === 'no-data').length
    }, month, asOf, notes: ['Asia/Taipei；僅有來源證據日期，不推定缺勤。', '摘要為已知小時小計；null 表示未知，不是零。', '正常工時為實際成對打卡交集；核准 OT 僅使用儲存時數，無薪資或彈性抵免。', '服務排班時數僅供參考，不加入實際工時。'] };
}

// Run: node --test tests/anomalyDetectionService.test.mjs
// Executes the actual TS service and built-in holiday data; only Supabase is mocked.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

let tables = {};
let calls = [];
let failure;
let delay;
const timestampColumns = new Set(['timestamp', 'start_date', 'end_date']);
function comparable(column, value) {
    return timestampColumns.has(column) ? Date.parse(value) : value;
}
class Query {
    constructor(table) { this.table = table; this.filters = []; this.orders = []; }
    select(columns) { this.columns = columns; return this; }
    eq(column, value) { this.filters.push(['eq', column, value]); return this; }
    gte(column, value) { this.filters.push(['gte', column, value]); return this; }
    lte(column, value) { this.filters.push(['lte', column, value]); return this; }
    lt(column, value) { this.filters.push(['lt', column, value]); return this; }
    order(column, options = {}) { this.orders.push([column, options.ascending !== false]); return this; }
    range(from, to) { this.bounds = [from, to]; return this; }
    async execute() {
        const call = { table: this.table, filters: structuredClone(this.filters), orders: this.orders,
            columns: this.columns, bounds: this.bounds && [...this.bounds] };
        calls.push(call);
        if (delay) await delay(call);
        if (failure?.(call) === 'null-data') return { data: null, error: null };
        if (failure?.(call)) return { data: null, error: new Error(`mock failure: ${this.table}`) };
        let rows = (tables[this.table] || []).filter(row => this.filters.every(([op, column, value]) => {
            const a = comparable(column, row[column]);
            const b = comparable(column, value);
            return op === 'eq' ? a === b : op === 'gte' ? a >= b : op === 'lte' ? a <= b : a < b;
        }));
        rows = [...rows].sort((a, b) => {
            for (const [column, ascending] of this.orders) {
                const x = comparable(column, a[column]); const y = comparable(column, b[column]);
                if (x < y) return ascending ? -1 : 1;
                if (x > y) return ascending ? 1 : -1;
            }
            return 0;
        });
        if (this.bounds) rows = rows.slice(this.bounds[0], this.bounds[1] + 1);
        // Respect select projection so required salary/override fields cannot be hidden by the mock.
        if (this.columns !== '*') rows = rows.map(row => Object.fromEntries(
            this.columns.split(',').map(s => s.trim()).map(key => [key, row[key]])));
        return { data: structuredClone(rows), error: null };
    }
    then(resolve, reject) { return this.execute().then(resolve, reject); }
}
globalThis.__anomalyTestSupabase = { from: table => new Query(table) };
const bundle = await build({
    absWorkingDir: fileURLToPath(new URL('..', import.meta.url)),
    entryPoints: ['services/anomalyDetectionService.ts'], bundle: true, write: false,
    platform: 'node', format: 'esm', plugins: [{ name: 'mock-supabase', setup(builder) {
        builder.onResolve({ filter: /supabase$/ }, () => ({ path: 'supabase', namespace: 'mock' }));
        builder.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({
            contents: 'export const supabase = globalThis.__anomalyTestSupabase;', loader: 'js'
        }));
    }}]
});
const { anomalyDetectionService: service, taipeiPunch } = await import(
    `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
// lib/holidays.ts has an existing eager, unscoped cache warmup at import time.
// Let it finish. All assertions below inspect only detectAnomalies' own awaited reads.
await new Promise(resolve => setImmediate(resolve));
const day = '2026-10-07';
const holiday = '2026-10-09';
const employee = { id: 'e1', name: 'Test Employee', department: 'Test', is_active: true,
    work_start_time: '08:00', work_end_time: '17:00', rest_days: [0, 6], salary_type: 'MONTHLY' };
function reset(extra = {}) {
    tables = { employees: [employee], ...extra }; calls = []; failure = undefined; delay = undefined;
}
function punches(start, end, date = day, id = 'e1') {
    return [[start, 'IN'], [end, 'OUT']].filter(([time]) => time).map(([time, check_type], i) => ({
        id: `log-${id}-${i}`, employee_id: id, check_type,
        timestamp: new Date(`${date}T${time.length === 5 ? `${time}:00` : time}+08:00`).toISOString()
    }));
}
const detect = (date = day, id = 'e1') => service.detectAnomalies(date, date, false, id);
const types = result => result.map(a => a.type);
const override = (day_type, extra = {}, date = day) => ({ id: 'override', employee_id: 'e1',
    override_date: date, day_type, ...extra });
const schedule = (salary_type, extra = {}) => ({ id: 'schedule', employee_id: 'e1',
    effective_date: '2026-01-01', salary_type, work_start_time: '08:00', work_end_time: '17:00',
    rest_days: [0, 6], ...extra });

test('built-in Oct 9 holiday excuses MONTHLY even when both DB holiday sources are empty', async () => {
    reset(); assert.deepEqual(await detect(holiday), []);
});
test('historical MONTHLY wins over current HOURLY, using the latest effective schedule', async () => {
    reset({ employees: [{ ...employee, salary_type: 'HOURLY' }], employee_schedules: [
        schedule('HOURLY', { id: 'old', effective_date: '2025-01-01' }), schedule('MONTHLY'),
        schedule('HOURLY', { id: 'future', effective_date: '2026-11-01' })
    ] }); assert.deepEqual(await detect(holiday), []);
});
test('historical HOURLY and current HOURLY fallback are excluded', async () => {
    for (const extra of [{ employee_schedules: [schedule('HOURLY')] },
        { employees: [{ ...employee, salary_type: 'HOURLY' }] }]) {
        reset(extra); assert.deepEqual(await detect(holiday), []);
    }
});
test('missing historical salary falls back to employee; unknown salary is excluded', async () => {
    reset({ employee_schedules: [schedule(null)] }); assert.deepEqual(await detect(holiday), []);
    reset({ employees: [{ ...employee, salary_type: null }] });
    assert.deepEqual(await detect(holiday), []);
});
test('ordinary workday absence is not excused', async () => {
    reset(); assert.deepEqual(types(await detect()), ['ABSENT']);
});
test('hourly ordinary workday is excluded even with explicit WORKDAY and anomalous punches', async () => {
    reset({ employees: [{ ...employee, salary_type: 'HOURLY' }],
        employee_day_overrides: [override('WORKDAY')], attendance_logs: punches('10:00', '15:00') });
    assert.deepEqual(await detect(), []);
});
test('mixed staff includes monthly only in admin and employee-scoped results', async () => {
    reset({ employees: [employee, { ...employee, id: 'e2', salary_type: 'HOURLY' }] });
    const result = await service.detectAnomalies(day, day, false);
    assert.deepEqual(result.map(a => a.employeeId), ['e1']);
    assert.deepEqual(await detect(day, 'e2'), []);
});
test('salary transition uses the effective historical type on each date', async () => {
    reset({ employees: [{ ...employee, salary_type: 'HOURLY' }], employee_schedules: [
        schedule('MONTHLY'), schedule('HOURLY', { id: 'transition', effective_date: '2026-10-08' })
    ] });
    const result = await service.detectAnomalies('2026-10-07', '2026-10-08', false);
    assert.deepEqual(result.map(a => a.date), ['2026-10-07']);
});
test('awaited DB-only holiday works without waiting for global cache', async () => {
    reset({ holidays: [{ id: 'db-holiday', date: day }] });
    let loaded = false;
    delay = async call => { if (call.table === 'holidays') {
        await new Promise(resolve => setImmediate(resolve)); loaded = true;
    }};
    assert.deepEqual(await detect(), []); assert.equal(loaded, true);
});
test('active company shutdown excuses attendance for both salaries, inactive dates do not', async () => {
    reset({ company_holidays: [{ id: 'company', holiday_date: day, is_active: true }] });
    assert.deepEqual(await detect(), []);
    reset({ company_holidays: [{ id: 'company', holiday_date: day, is_active: false }] });
    assert.deepEqual(types(await detect()), ['ABSENT']);
    reset({ employees: [{ ...employee, salary_type: 'HOURLY' }],
        company_holidays: [{ id: 'company', holiday_date: day, is_active: true }] });
    assert.deepEqual(await detect(), []);
    tables.employee_day_overrides = [override('WORKDAY')];
    assert.deepEqual(await detect(), []);
});
test('typhoon shutdown excuses both salaries but explicit WORKDAY still requires attendance', async () => {
    for (const salary_type of ['MONTHLY', 'HOURLY']) {
        reset({ employees: [{ ...employee, salary_type }],
            holidays: [{ id: 'typhoon', date: day, type: 'typhoon' }] });
        assert.deepEqual(await detect(), []);
        tables.employee_day_overrides = [override('WORKDAY')];
        assert.deepEqual(types(await detect()), salary_type === 'MONTHLY' ? ['ABSENT'] : []);
    }
});
test('hourly staff excluded regardless of national/custom holiday', async () => {
    for (const type of ['national_holiday', 'custom']) {
        reset({ employees: [{ ...employee, salary_type: 'HOURLY' }],
            holidays: [{ id: 'holiday', date: day, type }] });
        assert.deepEqual(await detect(), []);
    }
});
test('WORKDAY overrides holiday/weekend, REST_DAY overrides scheduled work and custom times', async () => {
    for (const date of [holiday, '2026-10-10']) {
        reset({ employee_day_overrides: [override('WORKDAY', {}, date)] });
        assert.deepEqual(types(await detect(date)), ['ABSENT']);
    }
    reset({ employee_day_overrides: [override('REST_DAY', { work_start_time: '09:00' })] });
    assert.deepEqual(await detect(), []);
});
test('CUSTOM_HOURS uses approved override baseline, not default or historical hours', async () => {
    reset({ attendance_logs: punches('10:20', '19:20'), employee_schedules: [schedule('MONTHLY')],
        employee_day_overrides: [override('CUSTOM_HOURS', { work_start_time: '10:00', work_end_time: '19:00' })] });
    assert.deepEqual(await detect(), []);
    tables.attendance_logs = punches('10:20', '19:19');
    const result = await detect(); assert.deepEqual(types(result), ['EARLY_LEAVE']);
    assert.equal(result[0].expectedTime, '19:20');
});
for (const [start, end, expected] of [
    ['08:00', '17:00', []], ['07:50', '17:00', []],
    ['08:01', '17:01', []], ['08:29:59', '17:29:59', []],
    ['08:30', '17:30', []], ['08:30:01', '18:00', ['LATE']],
    ['08:31', '18:00', ['LATE']], ['08:20', '17:00', ['EARLY_LEAVE']],
    ['08:20', '16:59', ['EARLY_LEAVE']], ['08:30', '17:29:59', ['EARLY_LEAVE']],
    ['08:00', '16:59', ['EARLY_LEAVE']], ['08:31', '16:59', ['LATE', 'EARLY_LEAVE']]
]) test(`flex boundary ${start}–${end}: ${expected.join('+') || 'compliant'}`, async () => {
    reset({ attendance_logs: punches(start, end) });
    const before = structuredClone(tables.attendance_logs);
    const result = await detect(); assert.deepEqual(types(result), expected);
    assert.deepEqual(tables.attendance_logs, before, 'raw punches are not modified');
    if (start === '08:20' && end === '17:00') {
        assert.equal(result[0].expectedTime, '17:20');
        assert.match(result[0].description, /出勤不足/);
        const [summary] = service.groupByEmployee(result);
        assert.equal(summary.lateCount, 0); assert.equal(summary.earlyLeaveCount, 1);
    }
});
test('missing OUT within flex does not invent LATE; beyond flex LATE remains', async () => {
    reset({ attendance_logs: punches('08:20', null) });
    assert.deepEqual(types(await detect()), ['MISSING_CHECK']);
    tables.attendance_logs = punches('08:31', null);
    assert.deepEqual(types(await detect()), ['MISSING_CHECK', 'LATE']);
});
test('missing IN stays missing; approved makeup suppresses only its matching missing punch', async () => {
    reset({ attendance_logs: punches(null, '17:00') });
    assert.deepEqual(types(await detect()), ['MISSING_CHECK']);
    reset({ attendance_logs: punches('08:20', null), makeup_attendance_requests: [
        { id: 'makeup', employee_id: 'e1', request_date: day, check_type: 'OUT', status: 'APPROVED' }
    ] }); assert.deepEqual(await detect(), []);
});
test('approved partial leave retains existing day suppression; pending leave does not excuse', async () => {
    const leave = { id: 'leave', employee_id: 'e1', start_date: `${day}T09:00:00+08:00`,
        end_date: `${day}T10:00:00+08:00`, status: 'APPROVED' };
    reset({ attendance_logs: punches('08:20', '16:00'), leave_requests: [leave] });
    assert.deepEqual(await detect(), []);
    tables.leave_requests[0].status = 'PENDING';
    assert.deepEqual(types(await detect()), ['EARLY_LEAVE']);
});
test('employee-scoped reads, bounded holiday sources, Taiwan half-open punch interval', async () => {
    reset({ employees: [employee, { ...employee, id: 'e2' }],
        attendance_logs: punches('08:00', '17:00', day, 'e2') });
    const result = await detect(); assert.deepEqual(result.map(a => a.employeeId), ['e1']);
    for (const table of ['employees', 'attendance_logs', 'employee_schedules', 'employee_day_overrides',
        'leave_requests', 'makeup_attendance_requests']) {
        const reads = calls.filter(c => c.table === table); assert.ok(reads.length);
        assert.ok(reads.every(c => c.filters.some(f => f[0] === 'eq' &&
            f[1] === (table === 'employees' ? 'id' : 'employee_id') && f[2] === 'e1')));
        assert.ok(reads.every(c => c.bounds), `${table} uses pagination`);
    }
    for (const [table, column] of [['holidays', 'date'], ['company_holidays', 'holiday_date']]) {
        for (const c of calls.filter(c => c.table === table)) {
            assert.ok(c.filters.some(f => f[0] === 'gte' && f[1] === column && f[2] === day));
            assert.ok(c.filters.some(f => f[0] === 'lte' && f[1] === column && f[2] === day));
            assert.ok(c.bounds);
        }
    }
    const log = calls.find(c => c.table === 'attendance_logs');
    assert.ok(log.filters.some(f => f[0] === 'gte' && f[2] === `${day}T00:00:00+08:00`));
    assert.ok(log.filters.some(f => f[0] === 'lt' && f[2] === '2026-10-08T00:00:00+08:00'));
    assert.equal(taipeiPunch('2026-10-06T16:05:00Z').date, day);
});
test('Taiwan midnight punches belong to the local day, not the UTC date', async () => {
    reset({ employees: [{ ...employee, work_start_time: '00:00', work_end_time: '01:00' }],
        attendance_logs: punches('00:20', '01:20') });
    assert.deepEqual(await detect(), []);
});
test('all holiday pages are loaded, including a holiday after the 500-row cap', async () => {
    reset({ holidays: Array.from({ length: 500 }, (_, i) => ({ id: `a${i}`, date: '2026-10-06' }))
        .concat({ id: 'z', date: day }) });
    assert.deepEqual(await service.detectAnomalies('2026-10-06', day, false, 'e1')
        .then(result => result.filter(a => a.date === day)), []);
    assert.deepEqual(calls.filter(c => c.table === 'holidays').map(c => c.bounds), [[0, 499], [500, 999]]);
});
test('company holidays and approved makeups beyond the first page are not omitted', async () => {
    reset({ company_holidays: Array.from({ length: 501 }, (_, i) => ({ id: `c${i}`,
        holiday_date: day, is_active: true })) });
    assert.deepEqual(await detect(), []);
    assert.ok(calls.some(c => c.table === 'company_holidays' && c.bounds[0] === 500));
    reset({ makeup_attendance_requests: Array.from({ length: 500 }, (_, i) => ({ id: `a${i}`,
        employee_id: 'e1', request_date: day, check_type: 'IN', status: 'APPROVED' }))
        .concat({ id: 'z', employee_id: 'e1', request_date: day, check_type: 'OUT', status: 'APPROVED' }) });
    assert.deepEqual(await detect(), []);
});
for (const table of ['employees', 'attendance_logs', 'employee_schedules', 'employee_day_overrides',
    'leave_requests', 'makeup_attendance_requests', 'holidays', 'company_holidays']) {
    test(`${table} read error rejects instead of returning false clean results`, async () => {
        reset(); failure = call => call.table === table;
        const original = console.error; console.error = () => {};
        try { await assert.rejects(detect(holiday), new RegExp(`mock failure: ${table}`)); }
        finally { console.error = original; }
    });
}
test('unexpected null data fails closed rather than claiming no anomalies', async () => {
    reset(); failure = call => call.table === 'employees' ? 'null-data' : false;
    const original = console.error; console.error = () => {};
    try { await assert.rejects(detect(), /未回傳有效列表/); }
    finally { console.error = original; }
});
test('later holiday page error fails closed even though a default holiday is available', async () => {
    reset({ holidays: Array.from({ length: 500 }, (_, i) => ({ id: `h${i}`, date: holiday })) });
    failure = call => call.table === 'holidays' && call.bounds?.[0] === 500;
    const original = console.error; console.error = () => {};
    try { await assert.rejects(detect(holiday), /mock failure: holidays/); }
    finally { console.error = original; }
});

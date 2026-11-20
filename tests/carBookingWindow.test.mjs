import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const transpile = source => ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const load = (path, imports = {}) => {
    const exports = {};
    new Function('exports', 'require', transpile(read(path)))(exports, name => {
        assert.ok(name in imports, `unexpected import: ${name}`);
        return imports[name];
    });
    return exports;
};
const calendar = load('lib/carBookingCalendar.ts');
const pure = load('lib/carBookingWindow.ts', { './carBookingCalendar': calendar });
const { getCarBookingOpening, getCarBookingWindowError, CAR_BOOKING_WINDOW_HINT } = pure;
const at = value => new Date(value);

test('weekdays, Mondays and weekend usage skip weekends', () => {
    for (const [usage, opening] of [
        ['2026-11-24', '2026-11-23'], ['2026-11-23', '2026-11-20'],
        ['2026-11-21', '2026-11-20'], ['2026-11-22', '2026-11-20']
    ]) assert.equal(getCarBookingOpening(usage, []).toISOString(), `${opening}T00:00:00.000Z`);
});

test('DB holidays, consecutive holidays and year rollover are skipped without a fixed lookback', () => {
    assert.equal(getCarBookingOpening('2026-11-23', ['2026-11-20']).toISOString(), '2026-11-19T00:00:00.000Z');
    assert.equal(getCarBookingOpening('2027-01-04', ['2027-01-01', '2026-12-31']).toISOString(), '2026-12-30T00:00:00.000Z');
    const holidays = [];
    for (let day = at('2026-03-01T00:00:00Z'); day < at('2026-05-01T00:00:00Z'); day.setUTCDate(day.getUTCDate() + 1)) {
        holidays.push(day.toISOString().slice(0, 10));
    }
    assert.equal(getCarBookingOpening('2026-05-04', holidays).toISOString(), '2026-02-26T00:00:00.000Z');
    assert.equal(getCarBookingOpening('2024-03-01', [], { '2024': [] }).toISOString(), '2024-02-29T00:00:00.000Z');
});

test('07:59 is closed, exactly 08:00 is open; later/past usage stays allowed', () => {
    const closed = getCarBookingWindowError('2026-11-23', [], at('2026-11-20T07:59:59.999+08:00'));
    assert.match(closed, /前一個工作日 08:00/);
    assert.match(closed, /週末及假日/);
    assert.match(closed, /2026-11-20 08:00/);
    assert.equal(getCarBookingWindowError('2026-11-23', [], at('2026-11-20T08:00:00+08:00')), null);
    assert.equal(getCarBookingWindowError('2026-11-23', [], at('2026-11-25T08:00:00+08:00')), null);
    assert.match(CAR_BOOKING_WINDOW_HINT, /前一個工作日 08:00.*週末及假日/);
});

test('strict civil dates and invalid clocks fail rather than normalizing', () => {
    for (const invalid of ['', '2026-02-29', '2026-04-31', '2026-13-01', '2026-00-10', '2026-11-00', '2026-1-01', '0000-01-01', '2026-11-23T00:00:00Z', ' 2026-11-23']) {
        assert.throws(() => getCarBookingOpening(invalid, []), /日期/);
    }
    assert.throws(() => getCarBookingOpening('0001-01-01', [], { '0001': [] }), /日期/);
    assert.throws(() => getCarBookingOpening('2026-11-23', ['2026-02-30']), /日期/);
    assert.throws(() => getCarBookingWindowError('2026-11-23', [], new Date(NaN)), /時間/);
});

const service = getHolidays => load('services/carBookingWindowService.ts', {
    '../lib/holidays': { getHolidays }, '../lib/carBookingWindow': pure
}).validateCarBookingWindow;

test('live DB custom/typhoon closures overlay the official baseline, not the old cache', async () => {
    let calls = 0;
    const validate = service(async () => {
        calls++;
        return [{ date: '2026-11-20', type: 'custom' }, { date: '2026-11-19', type: 'typhoon' }];
    });
    assert.equal(await validate('2026-11-23', at('2026-11-18T08:00:00+08:00')), null);
    assert.match(await validate('2026-11-23', at('2026-11-18T07:59:00+08:00')), /2026-11-18 08:00/);
    assert.equal(calls, 2);
    // An empty successful DB must still retain official national holidays.
    assert.equal(await service(async () => [])('2026-12-28', at('2026-12-24T08:00:00+08:00')), null);
    assert.match(await service(async () => [])('2026-12-28', at('2026-12-24T07:59:00+08:00')), /2026-12-24 08:00/);
});

test('official spring holidays and cross-year baseline are correct with an empty DB', () => {
    assert.equal(getCarBookingOpening('2026-02-23', []).toISOString(), '2026-02-13T00:00:00.000Z');
    assert.equal(getCarBookingOpening('2026-02-16', []).toISOString(), '2026-02-13T00:00:00.000Z');
    assert.equal(getCarBookingOpening('2026-04-07', []).toISOString(), '2026-04-02T00:00:00.000Z');
    assert.equal(getCarBookingOpening('2027-01-04', []).toISOString(), '2026-12-31T00:00:00.000Z');
});

test('official working weekends are supported, but live closure wins (no personal override)', () => {
    // Synthetic future-calendar fixture: explicitly mark this Saturday as working.
    const calendars = { ...calendar.BOOKING_CALENDAR_CLOSED_DATES,
        '2026': calendar.BOOKING_CALENDAR_CLOSED_DATES['2026'].filter(date => date !== '2026-11-21') };
    assert.equal(getCarBookingOpening('2026-11-23', [], calendars).toISOString(), '2026-11-21T00:00:00.000Z');
    assert.equal(getCarBookingOpening('2026-11-23', ['2026-11-21'], calendars).toISOString(), '2026-11-20T00:00:00.000Z');
});

test('unsupported usage year or previous-day year fails clearly, never assumes weekdays', async () => {
    for (const usage of ['2025-12-31', '2028-01-03', '2026-01-01', '2026-01-02']) {
        assert.throws(() => getCarBookingOpening(usage, []), /年度工作日曆尚未設定/);
        assert.match(await service(async () => [])(usage), /年度工作日曆尚未設定/);
        assert.match(await service(async () => { throw new Error('offline'); })(usage), /年度工作日曆尚未設定/);
    }
});

test('DB rejection returns an explicit retry message, never allows submission', async () => {
    for (const failure of [new Error('offline'), { message: 'permission denied' }]) {
        const result = await service(async () => { throw failure; })('2026-11-23');
        assert.match(result, /無法.*假日.*重試/);
        assert.match(result, /前一個工作日 08:00/);
    }
});

// Exercise the actual production submit closures, not a copied guard or source regex.
const extractInitializer = (path, name) => {
    const source = ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let found;
    const visit = node => {
        if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) found = node.initializer.getText(source);
        ts.forEachChild(node, visit);
    };
    visit(source);
    assert.ok(found, `${path}: ${name} exists`);
    return found;
};
const forms = ['LeaveRequestForm', 'ModificationRequestForm', 'CarRequestForm'];
const harness = (form, options = {}) => {
    const events = { errors: [], alerts: [], busy: [], submits: [], success: 0, loading: [], calendar: [] };
    const env = {
        needCar: true, selectedCarId: 'car-1', startDate: '2026-11-23', endDate: '2026-11-23',
        startTime: '09:00', endTime: '18:00', modificationReason: 'change', reason: 'visit',
        selectedTypeId: 'leave-1', leaveTypes: [{ id: 'leave-1', code: 'LEAVE' }], selectedDeputyId: 'deputy-1',
        employeeId: 'employee-1', originalRequest: { id: 'original-1', type: 'LEAVE', leave_type_id: 'leave-1' },
        formData: { car_id: 'car-1', start_date: '2026-11-23', end_date: '2026-11-23', start_time: '09:00', end_time: '18:00', purpose: 'visit' },
        requiresChairmanApproval: false, totalDays: 1, isManualHours: false, totalHours: 8,
        manualBreakHours: '0', isMakeupWorkday: false, isMakeupHoliday: false, selectedFile: null,
        setError: value => events.errors.push(value), alert: value => events.alerts.push(value),
        setUploadProgress: () => {},
        setSubmitting: value => events.loading.push(value), setIsSubmitting: value => events.loading.push(value),
        onSuccess: () => events.success++, window: { confirm: () => true },
        validateCarBookingWindow: async date => {
            events.calendar.push(date);
            return service(options.getHolidays || (async () => []))(date, options.now || at('2026-11-20T07:59:00+08:00'));
        },
        checkCarAvailability: async (...args) => { events.busy.push(args); return options.busy || false; },
        submitCarRequest: async payload => { events.submits.push(payload); },
        requestService: {
            createRequest: async payload => { events.submits.push(payload); return { success: true }; },
            createModificationRequest: async (...args) => { events.submits.push(args); return { success: true, data: { id: 'new-1' } }; }
        },
        ...options.env
    };
    const source = extractInitializer(`components/${form}.tsx`, 'handleSubmit');
    const handler = new Function(...Object.keys(env), `${transpile(`const handler = ${source};`)}; return handler;`)(...Object.values(env));
    return { events, run: () => handler({ preventDefault() {} }) };
};

for (const form of forms) {
    test(`${form}: closed opening blocks before conflict checks and writes`, async () => {
        const { events, run } = harness(form);
        await run();
        assert.deepEqual(events.calendar, ['2026-11-23']);
        assert.match([...events.errors, ...events.alerts].filter(Boolean).join(), /前一個工作日 08:00/);
        assert.equal(events.busy.length, 0);
        assert.equal(events.submits.length, 0);
        assert.equal(events.success, 0);
    });
    test(`${form}: calendar failure blocks and surfaces retry text`, async () => {
        const { events, run } = harness(form, { getHolidays: async () => { throw new Error('offline'); } });
        await run();
        assert.match([...events.errors, ...events.alerts].filter(Boolean).join(), /無法.*假日.*重試/);
        assert.equal(events.submits.length, 0);
        assert.equal(events.busy.length, 0);
    });
    test(`${form}: unknown year blocks with the explicit calendar setup message`, async () => {
        const { events, run } = harness(form, { env: {
            startDate: '2028-01-03', endDate: '2028-01-03',
            formData: { car_id: 'car-1', start_date: '2028-01-03', end_date: '2028-01-03', start_time: '09:00', end_time: '18:00', purpose: 'visit' }
        } });
        await run();
        assert.match([...events.errors, ...events.alerts].filter(Boolean).join(), /年度工作日曆尚未設定/);
        assert.equal(events.submits.length, 0);
        assert.equal(events.busy.length, 0);
    });
    test(`${form}: exactly 08:00 continues existing conflict and submit flow`, async () => {
        const { events, run } = harness(form, { now: at('2026-11-20T08:00:00+08:00') });
        await run();
        assert.equal(events.busy.length, 1);
        assert.equal(events.submits.length, 1);
        assert.equal(events.success, 1);
        if (form === 'ModificationRequestForm') assert.equal(events.busy[0][3], 'original-1');
    });
    test(`${form}: conflict still blocks after opening`, async () => {
        const { events, run } = harness(form, { now: at('2026-11-20T08:00:00+08:00'), busy: true });
        await run();
        assert.equal(events.busy.length, 1);
        assert.equal(events.submits.length, 0);
        assert.equal(events.success, 0);
    });
    test(`${form}: hint is the shared weekend/holiday copy`, () => {
        const source = read(`components/${form}.tsx`);
        assert.match(source, /\{CAR_BOOKING_WINDOW_HINT\}/);
        assert.doesNotMatch(source, /前一日.*08:00|earliestAllowed/);
    });
}

for (const form of forms.slice(0, 2)) {
    test(`${form}: personal makeup flags never override the institution opening window`, async () => {
        const { events, run } = harness(form, { env: { isMakeupWorkday: true, isMakeupHoliday: true } });
        await run();
        assert.match(events.errors.filter(Boolean).join(), /前一個工作日 08:00/);
        assert.equal(events.submits.length, 0);
    });
    for (const selection of [{ needCar: false }, { selectedCarId: '' }]) {
        test(`${form}: existing no-car/unselected-car bypass stays intact (${JSON.stringify(selection)})`, async () => {
            const { events, run } = harness(form, { env: selection, getHolidays: async () => { throw new Error('must not fetch'); } });
            await run();
            assert.equal(events.calendar.length, 0);
            assert.equal(events.busy.length, 0);
            assert.equal(events.submits.length, 1);
            assert.equal(events.success, 1);
        });
    }
}

test('getHolidays paginates all live rows and retains the year filter', async () => {
    const calls = [];
    const rows = Array.from({ length: 1001 }, (_, i) => ({ id: String(i), date: '2026-11-20' }));
    const supabase = { from(table) {
        assert.equal(table, 'holidays');
        const query = {
            select() { return this; }, order() { return this; },
            gte(...args) { calls.push(['gte', ...args]); return this; },
            lte(...args) { calls.push(['lte', ...args]); return this; },
            async range(from, to) { calls.push(['range', from, to]); return { data: rows.slice(from, to + 1), error: null }; }
        };
        return query;
    } };
    const source = extractInitializer('lib/holidays.ts', 'getHolidays');
    const getHolidays = new Function('supabase', `${transpile(`const fn = ${source};`)}; return fn;`)(supabase);
    assert.equal((await getHolidays(2026)).length, 1001);
    assert.deepEqual(calls.filter(c => c[0] === 'range'), [['range', 0, 999], ['range', 1000, 1999]]);
    assert.equal(calls.filter(c => c[0] === 'gte').length, 2);
    assert.equal(calls.filter(c => c[0] === 'lte').length, 2);
    supabase.from = () => ({ select() { return this; }, order() { return this; },
        range: async from => from === 0 ? { data: rows.slice(0, 1000), error: null } : { data: null, error: new Error('failed page') } });
    await assert.rejects(getHolidays(), /failed page/);
});

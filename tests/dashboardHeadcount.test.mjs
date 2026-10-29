// Run: node --test tests/dashboardHeadcount.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const bundle = await build({
    absWorkingDir: fileURLToPath(new URL('..', import.meta.url)),
    entryPoints: ['services/dashboardHeadcount.ts'],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm'
});
const { calculateDashboardHeadcount } = await import(
    `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

test('counts current staff and this-month departures without the chairman', () => {
    const records = [
        { id: 'active-1', is_active: true, is_chairman: false, insurance_end_date: null },
        { id: 'active-2', is_active: true, is_chairman: null, insurance_end_date: null },
        { id: 'chair-active', is_active: true, is_chairman: true, insurance_end_date: null },
        { id: 'resigned-this-month', is_active: false, is_chairman: false, insurance_end_date: '2026-10-15' },
        { id: 'resigned-earlier', is_active: false, is_chairman: false, insurance_end_date: '2026-09-30' },
        { id: 'resigned-future', is_active: false, is_chairman: false, insurance_end_date: '2026-10-30' },
        { id: 'inactive-no-date', is_active: false, is_chairman: false, insurance_end_date: null },
        { id: 'chair-resigned', is_active: false, is_chairman: true, insurance_end_date: '2026-10-20' }
    ];

    assert.deepEqual(calculateDashboardHeadcount(records, new Date('2026-10-29T03:00:00Z')), {
        activeEmployees: 2,
        monthlyResignedEmployees: 1,
        headcountMonth: '2026-10'
    });
});

test('uses the Taiwan calendar month at UTC month boundaries', () => {
    const records = [
        { id: 'oct-31', is_active: false, is_chairman: false, insurance_end_date: '2026-10-31' },
        { id: 'nov-01', is_active: false, is_chairman: false, insurance_end_date: '2026-11-01' }
    ];

    assert.deepEqual(calculateDashboardHeadcount(records, new Date('2026-10-31T16:30:00Z')), {
        activeEmployees: 0,
        monthlyResignedEmployees: 1,
        headcountMonth: '2026-11'
    });
});

test('includes the first Taiwan day of the month and ignores a future departure date', () => {
    const records = [
        { id: 'oct-01', is_active: false, is_chairman: false, insurance_end_date: '2026-10-01' },
        { id: 'oct-02-future', is_active: false, is_chairman: false, insurance_end_date: '2026-10-02' }
    ];

    assert.deepEqual(calculateDashboardHeadcount(records, new Date('2026-09-30T16:30:00Z')), {
        activeEmployees: 0,
        monthlyResignedEmployees: 1,
        headcountMonth: '2026-10'
    });
});

import assert from 'node:assert/strict';
import { allocateAnnualByDate, taipeiDate } from '../lib/annualLeaveAllocation.ts';
import { createClient } from '@supabase/supabase-js';
const rec = (day, hours, code = 'ANNUAL') => ({ start_date: day, end_date: day, hours, leave_type_code: code, leave_type_name: code, start_time: '', end_time: '', description: '', record_type: 'request' });
const periods = [
    { label: '第一期', start_date: '2020-01-01', end_date: '2021-01-01', entitlement: 8, used: 0, cashout: 0, remaining: 8 },
    { label: '第二期', start_date: '2021-01-01', end_date: '2022-01-01', entitlement: 8, used: 0, cashout: 0, remaining: 8 },
    { label: '第三期', start_date: '2022-01-01', end_date: '2023-01-01', entitlement: 8, used: 0, cashout: 0, remaining: 8 },
];
const test = allocateAnnualByDate(periods, [rec('2019-12-31', 2), rec('2020-03-01', 5), rec('2021-01-01', 5), rec('2021-05-01', 8), rec('2022-01-01', 2, 'ALC'), rec('2023-01-01', 3), rec('2027-01-01', 1)], '2023-01-01');
assert.equal(test.buckets.get('第一期').reduce((s, r) => s + r.hours, 0), 8);
assert.equal(test.buckets.get('第二期').reduce((s, r) => s + r.hours, 0), 8);
assert.equal(test.buckets.get('第三期').reduce((s, r) => s + r.hours, 0), 5);
assert.equal(test.unallocated.reduce((s, r) => s + r.hours, 0), 4);
assert.equal(test.future.reduce((s, r) => s + r.hours, 0), 1);
assert.equal(taipeiDate('2019-05-20T16:00:00+00:00'), '2019-05-21');

// Read-only regression against 林延達's actual approved requests and balance.
const url = process.env.VITE_SUPABASE_URL, key = process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error('Missing read-only test credentials');
const s = createClient(url, key);
const emp = await s.from('employees').select('id').eq('name', '林延達').single();
if (emp.error) throw emp.error;
const id = emp.data.id;
const [balance, types, requests, adjustments] = await Promise.all([
    s.rpc('get_employee_leave_balances', { target_employee_id: id }),
    s.from('leave_types').select('id,code'),
    s.from('leave_requests').select('leave_type_id,start_date,end_date,hours').eq('employee_id', id).eq('status', 'APPROVED').or('is_modified.eq.false,is_modified.is.null').order('start_date'),
    s.from('leave_balance_adjustments').select('leave_type_code,adjustment_type,amount_hours,created_at').eq('employee_id', id),
]);
for (const response of [balance, types, requests, adjustments]) if (response.error) throw response.error;
const codes = new Map(types.data.map(t => [t.id, t.code]));
const original = requests.data.filter(r => ['ANNUAL', 'ALC'].includes(codes.get(r.leave_type_id))).map(r => rec(r.start_date, Math.abs(r.hours), codes.get(r.leave_type_id)));
const cashouts = adjustments.data.filter(r => r.leave_type_code === 'ANNUAL' && r.adjustment_type === 'CASHOUT').map(r => rec(r.created_at, Math.abs(r.amount_hours), 'ALC'));
const result = allocateAnnualByDate(balance.data.annual.periods, [...original, ...cashouts], '2026-10-06');
for (const period of result.periods) {
    const rows = result.buckets.get(period.label);
    assert.equal(Math.round(rows.filter(r => r.leave_type_code === 'ANNUAL').reduce((s, r) => s + r.hours, 0) * 100) / 100, period.used);
    assert.equal(Math.round(rows.filter(r => r.leave_type_code === 'ALC').reduce((s, r) => s + r.hours, 0) * 100) / 100, period.cashout);
    const ordered = [...result.periods].sort((a,b) => a.start_date.localeCompare(b.start_date));
    const following = ordered[ordered.findIndex(p => p.label === period.label) + 1];
    const expiry = following?.end_date || `${Number(period.end_date.slice(0,4)) + 1}${period.end_date.slice(4)}`;
    for (const row of rows) assert(taipeiDate(row.start_date) >= period.start_date && taipeiDate(row.start_date) < expiry, `${period.label} includes unavailable date ${row.start_date}`);
}
assert(!result.buckets.get('滿 5 年').some(r => taipeiDate(r.start_date).startsWith('2019')));
assert(!result.buckets.get('滿 3 年').some(r => taipeiDate(r.start_date) >= '2023-05-21'));
const input = [...original, ...cashouts].reduce((s, r) => s + r.hours, 0);
const assigned = result.periods.reduce((s, p) => s + p.used + p.cashout, 0);
const residual = result.unallocated.reduce((s, r) => s + r.hours, 0) + result.future.reduce((s, r) => s + r.hours, 0);
assert(Math.abs(input - assigned - residual) < 0.001, 'Records must not disappear');
console.log(JSON.stringify({ synthetic: 'pass', real: 'pass', inputHours: input, assignedHours: assigned, unallocatedHours: residual, fiveYear2019: false, threeYear2024: false, periodUsage: result.periods.map(p => [p.label, p.used, p.cashout]) }));

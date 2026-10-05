import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { dutyPayrollHours, hasApprovedLeaveOnDate } from '../src/services/lunchDutyPayroll.js';
import { calculatePayroll } from '../src/services/payrollCalculator.js';

const base = { enabled: true, clockIn: '08:00', clockOut: '16:00' };
test('duty credits a completed day without inventing overtime', () => {
  for (const clockOut of ['16:00', '16:30']) {
    assert.deepEqual(dutyPayrollHours({ ...base, clockOut }), {
      actualHours: 7.5, creditedRegularHours: 8, overtimeHours: 0,
    });
  }
  assert.deepEqual(dutyPayrollHours({ ...base, clockIn: '08:20', clockOut: '16:50' }), {
    actualHours: 7.5, creditedRegularHours: 8, overtimeHours: 0,
  });
  assert.deepEqual(dutyPayrollHours({ ...base, clockIn: '08:30', clockOut: '17:00' }), {
    actualHours: 7.5, creditedRegularHours: 8, overtimeHours: 0,
  });
  assert.deepEqual(dutyPayrollHours({ ...base, clockOut: '17:30' }), {
    actualHours: 8.5, creditedRegularHours: 8, overtimeHours: 0.5,
  });
});
test('no credit for unmarked, partial, missing punch, absent or leave', () => {
  for (const changed of [
    { enabled: false }, { clockIn: '08:01' }, { clockOut: '15:59' },
    { clockIn: '08:20', clockOut: '16:00' }, { clockIn: '08:31', clockOut: '16:31' },
    { clockIn: null }, { clockOut: null }, { status: 'absent' },
    { hasApprovedLeave: true },
  ]) assert.equal(dutyPayrollHours({ ...base, ...changed }), null);
  assert.equal(hasApprovedLeaveOnDate([
    { employeeId: 1, status: 'approved', startDate: '2026-10-05', endDate: '2026-10-05' },
  ], 1, '2026-10-05'), true);
});

// Exercise the real sync module with in-memory Prisma/Supabase adapters, without
// loading credentials or touching a database. This catches wiring regressions.
const syncPath = resolve(fileURLToPath(new URL('../src/services/supabaseSync.js', import.meta.url)));
const helperURL = pathToFileURL(resolve(fileURLToPath(new URL('../src/services/lunchDutyPayroll.js', import.meta.url)))).href;
let source = await readFile(syncPath, 'utf8');
source = source.replace("import { supabase } from './supabase.js';", 'const { supabase } = globalThis.__dutyPayrollMock;')
  .replace("import { PrismaClient } from '@prisma/client';", 'const PrismaClient = globalThis.__dutyPayrollMock.PrismaClient;')
  .replace("from './lunchDutyPayroll.js'", `from '${helperURL}'`);
const state = { duty: [], leaves: [], logs: [], attendance: [], failDuty: false, failLogs: false };
const fixtureEmployee = { id: 1, employeeNo: 'TEST', email: 'test@example.org' };
const tables = {
  employees: [{ id: 'uuid-1', username: 'test@example.org', name: 'Test', break_start_time: '12:00', break_end_time: '13:00' }],
};
const prisma = {
  employee: { findMany: async () => [fixtureEmployee] },
  attendanceRecord: { deleteMany: async () => { state.attendance = []; }, createMany: async ({ data }) => { state.attendance.push(...data); } },
  leaveRecord: { deleteMany: async () => {}, createMany: async () => {} },
};
function query(table) {
  let pageStart = 0;
  let pageEnd = 999;
  const q = {
    select: () => q, eq: () => q, gte: () => q, lte: () => q, lt: () => q, or: () => q, order: () => q,
    range: (start, end) => { pageStart = start; pageEnd = end; return q; },
    then(resolveResult, reject) {
      const data = table === 'employees' ? tables.employees :
        table === 'employee_lunch_duties' ? state.duty :
        table === 'leave_requests' ? state.leaves : state.logs;
      const error = table === 'employee_lunch_duties' && state.failDuty ? new Error('duty unavailable') :
        table === 'attendance_logs' && state.failLogs ? new Error('logs unavailable') : null;
      return Promise.resolve({ data: data.slice(pageStart, pageEnd + 1), error })
        .then(resolveResult, reject);
    },
  };
  return q;
}
globalThis.__dutyPayrollMock = { supabase: { from: query }, PrismaClient: class { constructor() { return prisma; } } };
const { syncAttendanceAndLeaves } = await import(`data:text/javascript,${encodeURIComponent(source)}`);
const punch = (time, type) => ({ employee_id: 'uuid-1', timestamp: `2026-10-05T${time}:00+08:00`, check_type: type });
const run = async (out, duty = true, leaves = []) => {
  state.duty = duty ? [{ employee_id: 'uuid-1', duty_date: '2026-10-05' }] : [];
  state.leaves = leaves;
  state.logs = [punch('08:00', 'IN'), punch(out, 'OUT')];
  await syncAttendanceAndLeaves(2026, 10, true);
  return state.attendance[0];
};
test('sync preserves punches and distinguishes actual from credited hours', async () => {
  for (const out of ['16:00', '16:30']) {
    const row = await run(out);
    assert.equal(row.clockOut, out);
    assert.equal(row.regularHours, 8);
    assert.equal(row.overtimeHours, 0);
    assert.match(row.notes, /實際工時 7\.5000.*計薪正常工時 8/);
  }
  const late = await run('17:30');
  assert.equal(late.overtimeHours, 0.5);
  const ordinary = await run('16:00', false);
  assert.equal(ordinary.regularHours, 7);
  assert.equal(ordinary.notes, null);
});
test('credited duty hours feed the real hourly payroll calculator without a pay cut', async () => {
  const employee = { salaryType: 'hourly', baseSalary: 200, hireDate: '2026-01-01', standardDailyHours: 8 };
  const ordinary = calculatePayroll(employee, { year: 2026, month: 10, regularHours: 8, workDays: 1 });
  for (const out of ['16:00', '16:30']) {
    const row = await run(out);
    const duty = calculatePayroll(employee, { year: 2026, month: 10, regularHours: row.regularHours, overtimeHours: row.overtimeHours, workDays: 1 });
    assert.equal(duty.grossPay, ordinary.grossPay);
    assert.equal(duty.netPay, ordinary.netPay);
    assert.equal(duty.overtimePay, 0);
  }
});
test('sync reads beyond the first Supabase attendance page before replacing local rows', async () => {
  state.duty = [{ employee_id: 'uuid-1', duty_date: '2026-10-05' }];
  state.leaves = [];
  state.logs = [...Array.from({ length: 1000 }, () => punch('08:00', 'IN')), punch('16:30', 'OUT')];
  await syncAttendanceAndLeaves(2026, 10, true);
  assert.equal(state.attendance.length, 1);
  assert.equal(state.attendance[0].clockOut, '16:30');
  assert.equal(state.attendance[0].regularHours, 8);
});
test('sync does not credit approved leave and fails closed on missing duty data', async () => {
  const row = await run('16:00', true, [{ employee_id: 'uuid-1', start_date: '2026-10-05T00:00:00+08:00', end_date: '2026-10-05T23:59:00+08:00', hours: 8, status: 'approved' }]);
  assert.equal(row.regularHours, 7);
  assert.equal(row.notes, null);
  state.failDuty = true;
  const before = [...state.attendance];
  await assert.rejects(syncAttendanceAndLeaves(2026, 10, true), /duty unavailable/);
  assert.deepEqual(state.attendance, before);
  state.failDuty = false;
  state.failLogs = true;
  await assert.rejects(syncAttendanceAndLeaves(2026, 10, true), /logs unavailable/);
  assert.deepEqual(state.attendance, before);
  state.failLogs = false;
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const { outputFiles } = await build({
  entryPoints: [new URL('../lib/leaveUtils.ts', import.meta.url).pathname],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  define: { 'import.meta.env': '{"VITE_SUPABASE_URL":"https://example.supabase.co","VITE_SUPABASE_ANON_KEY":"dummy"}' }
});
const { calculateLeaveHoursDetailed } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].contents).toString('base64')}`);
const day = '2026-10-06';
const schedule = {
  effective_date: '2026-10-01',
  work_start_time: '07:30', work_end_time: '16:30',
  break_start_time: '11:30', break_end_time: '13:00',
  rest_days: [0, 6], salary_type: 'MONTHLY', standard_daily_hours: 8
};
const hours = (from, to, settings = schedule, manualBreak = 0) =>
  calculateLeaveHoursDetailed(new Date(`${day}T${from}:00+08:00`),
    new Date(`${day}T${to}:00+08:00`), settings, false, true, [settings], manualBreak);

test('whole-day leave uses agreed schedule hours without erasing raw/break detail', () => {
  const full = hours('07:30', '16:30');
  assert.equal(full.rawHours, 9);
  assert.equal(full.breakHours, 1.5);
  assert.equal(full.finalHours, 8);
  assert.equal(hours('07:30', '16:30', schedule, 1).finalHours, 7);
});

test('partial, late, and early intervals never receive whole-day credit', () => {
  assert.equal(hours('07:45', '16:30').totalHours, 7.25);
  assert.equal(hours('07:30', '16:00').totalHours, 7);
  assert.equal(hours('07:30', '11:30').totalHours, 4);
});

test('normal and over-net schedules use their agreed whole-day hours', () => {
  const normal = { ...schedule, work_start_time: '08:00', work_end_time: '17:00', break_start_time: '12:00', break_end_time: '13:00' };
  assert.equal(hours('08:00', '17:00', normal).finalHours, 8);
  const long = { ...schedule, work_start_time: '06:30' };
  assert.equal(hours('06:30', '16:30', long).finalHours, 8);
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';

// Exercise the real calculation blocks of both calendars, including final-hour
// normalization. Do not reimplement the flex algorithm in the test harness.
process.env.TZ = 'Asia/Taipei';
const files = ['components/AttendanceCalendar.tsx', 'pages/admin/AttendanceCalendarPage.tsx'];
const at = time => new Date(`2026-09-01T${time}+08:00`);
const cases = [
  { name: 'on time', in: '08:30:00', out: '16:00:00', offset: 0, hours: 6.5 },
  { name: '20-minute flex made up at departure', in: '08:50:00', out: '16:20:00', offset: 20, hours: 6.5 },
  { name: '20-minute flex NOT made up', in: '08:50:00', out: '16:00:00', offset: 20, hours: 6.17 },
  { name: 'exact 30-minute boundary', in: '09:00:00', out: '16:30:00', offset: 30, hours: 6.5 },
  { name: 'one second beyond boundary', in: '09:00:01', out: '16:30:00', offset: 30, hours: 6.5 },
  { name: 'late beyond boundary is not forgiven', in: '09:10:00', out: '16:30:00', offset: 30, hours: 6.33 },
  { name: 'departure target caps at 16:30', in: '09:10:00', out: '16:50:00', offset: 30, effectiveOut: '16:30:00', hours: 6.33 },
  { name: '2026-09-01 reproduction', in: '09:06:38.681', out: '16:12:54.757', offset: 30, hours: 6.1 },
  { name: '2026-09-07 reproduction', in: '09:10:39.326', out: '15:49:57.671', offset: 30, hours: 5.66 },
  { name: 'early departure cannot be filled to full day', in: '08:30:00', out: '15:50:00', offset: 0, hours: 6.33 },
  { name: 'existing early-arrival alignment unchanged', in: '08:20:00', out: '16:00:00', effectiveIn: '08:30:00', offset: 0, hours: 6.5 },
  { name: 'approved morning private leave unchanged', in: '10:00:00', out: '16:00:00', offset: 0, hours: 5, privateLeave: true },
  { name: 'approved official work covers morning', in: '10:00:00', out: '16:00:00', effectiveIn: '08:30:00', offset: 0, hours: 6.5, official: true },
];
let passed = 0;
for (const file of files) {
  const source = process.argv.includes('--baseline')
    ? execFileSync('git', ['show', `backup/attendance-flex-before-fix-20261002:${file}`], { encoding: 'utf8' })
    : readFileSync(file, 'utf8');
  const flexStart = source.indexOf('let flexOffsetMs = 0;');
  const flexEnd = source.indexOf('// 3. 結合算出的 flexOffsetMs', flexStart);
  const mergeStart = source.indexOf('const merge = (ivs:', flexEnd);
  const calcEnd = source.indexOf('data[dateKey] =', mergeStart);
  assert(flexStart >= 0 && flexEnd > flexStart && mergeStart > flexEnd && calcEnd > mergeStart);
  const calculate = new Function('input', ts.transpileModule(`
    const { day, targetEmployee, schedule, dayLogs, rawDayLeaves, workIntervals,
      nonWorkIntervals, totalNonWorkLeaveHours, schedIn, schedOut } = input;
    const CheckType = { IN: 'IN', OUT: 'OUT' };
    const parseISO = (value: string) => new Date(value);
    const getDayTime = (value: string, base: Date) => {
      if (!value) return null;
      const [h, m] = value.split(':').map(Number);
      const result = new Date(base); result.setHours(h, m, 0, 0); return result;
    };
    let hours = 0, dayHours = 0;
    ${source.slice(flexStart, flexEnd)}
    if (effectiveIn && effectiveOut) workIntervals.push({ start: effectiveIn, end: effectiveOut });
    ${source.slice(mergeStart, calcEnd)}
    return { hours: ${file.startsWith('components/') ? 'dayHours' : 'hours'}, effectiveIn, effectiveOut, flexOffsetMs };
  `, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText);
  for (const c of cases) {
    const schedule = { work_start_time: '08:30', work_end_time: '16:00', break_start_time: '12:00', break_end_time: '13:00', break2_start_time: '', break2_end_time: '', break3_start_time: '', break3_end_time: '' };
    const leave = { start_date: at('08:30:00').toISOString(), end_date: at('10:00:00').toISOString(), status: 'APPROVED' };
    const result = calculate({ day: at('00:00:00'), targetEmployee: schedule, schedule,
      dayLogs: [{ check_type: 'IN', timestamp: at(c.in).toISOString() }, { check_type: 'OUT', timestamp: at(c.out).toISOString() }],
      rawDayLeaves: c.privateLeave || c.official ? [leave] : [],
      workIntervals: c.official ? [{ start: at('08:30:00'), end: at('10:00:00') }] : [],
      nonWorkIntervals: c.privateLeave ? [{ start: at('08:30:00'), end: at('10:00:00') }] : [],
      totalNonWorkLeaveHours: c.privateLeave ? 1.5 : 0, schedIn: at('08:30:00'), schedOut: at('16:00:00') });
    assert.equal(result.flexOffsetMs / 60000, c.offset, `${file}: ${c.name}: offset`);
    assert.equal(result.effectiveIn.getTime(), at(c.effectiveIn || c.in).getTime(), `${file}: ${c.name}: actual start`);
    assert.equal(result.effectiveOut.getTime(), at(c.effectiveOut || c.out).getTime(), `${file}: ${c.name}: effective end`);
    assert.equal(result.hours, c.hours, `${file}: ${c.name}: final net hours`);
    passed++;
    console.log(`PASS ${file}: ${c.name} => ${result.hours}h`);
  }
}
console.log(`All ${passed} calendar regression cases passed.`);

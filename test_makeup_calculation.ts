
import { calculateLeaveHoursDetailed } from './lib/leaveUtils.ts';

const mockEmployee = {
    work_start_time: '08:00',
    work_end_time: '17:00',
    break_start_time: '12:00',
    break_end_time: '13:00',
    rest_days: [0, 6], // Sunday, Saturday
    standard_daily_hours: 8
};

// 2026-02-14 is a Saturday
const satStart = new Date('2026-02-14T08:00:00');
const satEnd = new Date('2026-02-14T17:00:00');

console.log('Testing Saturday (Saturday is a rest day)...');

const resultNormal = calculateLeaveHoursDetailed(satStart, satEnd, mockEmployee as any, false, true, [], 0, false);
console.log('Normal (isMakeupWorkday=false):', resultNormal.finalHours, 'hours (Expected: 0)');

const resultMakeup = calculateLeaveHoursDetailed(satStart, satEnd, mockEmployee as any, false, true, [], 0, true);
console.log('Makeup (isMakeupWorkday=true):', resultMakeup.finalHours, 'hours (Expected: 8)');

if (resultNormal.finalHours === 0 && resultMakeup.finalHours === 8) {
    console.log('Verification SUCCESS!');
} else {
    console.log('Verification FAILED!');
    process.exit(1);
}

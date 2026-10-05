// Payroll-only policy: the marked 心安居 shift is 08:00–16:30, with rest
// 12:00–12:30 and 16:00–16:30. OUT at 16:00 or 16:30 earns the same pay.
// Keep the actual hours separate from credited regular hours; never change punches.
const toMins = time => {
  const match = /^(\d{2}):(\d{2})$/.exec(time || '');
  return match ? Number(match[1]) * 60 + Number(match[2]) : NaN;
};

export function dutyPayrollHours({ enabled, clockIn, clockOut, hasApprovedLeave = false, status = 'present' }) {
  if (!enabled || hasApprovedLeave || status !== 'present' || !clockIn || !clockOut) return null;
  const start = toMins(clockIn);
  const end = toMins(clockOut);
  // Only the complete scheduled day qualifies. No partial-day credit and no
  // reinterpretation of other shifts (or missing punches) as a duty day.
  // Align with the calendars' 30-minute flexible-start window. Someone who
  // arrives late must work correspondingly later; this is not a blanket credit.
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > 510 ||
      end < 960 + Math.max(0, start - 480)) return null;
  const overlap = (from, until) => Math.max(0, Math.min(end, until) - Math.max(start, from));
  const actualMinutes = Math.max(0, end - start - overlap(720, 750) - overlap(960, 990));
  const actualHours = actualMinutes / 60;
  if (actualHours < 7.5) return null;
  return {
    actualHours,
    creditedRegularHours: 8,
    overtimeHours: Math.max(0, actualHours - 8),
  };
}

// Inclusive local calendar-date overlap, not UTC timestamp arithmetic.
export function hasApprovedLeaveOnDate(leaves, employeeId, date) {
  return leaves.some(leave => leave.employeeId === employeeId &&
    leave.status === 'approved' && leave.startDate <= date && leave.endDate >= date);
}

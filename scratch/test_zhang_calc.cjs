const { calculatePayroll } = require('./payroll/server/src/services/payrollCalculator.js');

const employee = {
  id: 'f9ff0685-8199-4373-8b7d-8a08596a0385',
  name: '張秀卿',
  salaryType: 'hourly',
  baseSalary: 210,
  allowanceAA: 0,
  allowanceLicense: 1000,
  otherAllowance: 0,
  bonus: 0,
  standardDailyHours: 8
};

const attendance = {
  year: 2026,
  month: 5,
  workDays: 26,
  leaveDays: 0,
  absentDays: 0,
  regularHours: 139.42,
  overtimeHours: 28.17,
  overtimeHours134: 10.33,
  overtimeHours167: 11.25,
  overtimeHours200: 6.58,
  overtimeHours267: 0
};

// I will just mock it to see the base calculation first, but to be sure, I need to fetch her actual DB record.

const { calculatePayroll } = require('./src/services/payrollCalculator.js');
const emp = {
  salaryType: 'hourly',
  baseSalary: 210,
  allowanceAA: 2535,
  bonus: 287,
  // we just need it to calculate overtimePay, but let's test it
};
// wait, we don't have all details. Let's just grep the calculation logic!

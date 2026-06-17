import { calculatePayroll } from './src/services/payrollCalculator.js';

const employee = {
  salaryType: 'monthly',
  baseSalary: 33000,
  healthInsuranceGrade: -1,
  laborInsuranceGrade: 0,
  laborPensionGrade: 0,
};

const attendance = {
  workDays: 22,
  leaveDays: 0,
  absentDays: 0,
  leaveDeduction: 11000,
  supplementaryHealthInsurance: undefined, // to simulate resetSettings
};

const settings = {
  minimum_wage_monthly: 29500,
  labor_insurance_rate: 0.12,
  labor_insurance_employee_share: 0.20,
  labor_insurance_employer_share: 0.70,
  health_insurance_rate: 0.0517,
  health_insurance_employee_share: 0.30,
  health_insurance_employer_share: 0.60,
  health_insurance_avg_dependents: 0.58,
  labor_pension_employer_rate: 0.06
};

const result = calculatePayroll(employee, attendance, settings);
console.log('Gross Pay:', result.grossPay);
console.log('Leave Deduction:', result.leaveDeduction);
console.log('Net Pay:', result.netPay);
console.log('Supplementary NHI:', result.supplementaryHealthInsurance);

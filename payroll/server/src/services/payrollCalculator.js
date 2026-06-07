/**
 * Payroll Calculator Service
 * Calculates gross pay, overtime pay, insurance, pension, tax, and net pay.
 */
import { calculateAllInsurance } from './insuranceCalculator.js';
import { calculateTax } from './taxCalculator.js';

/**
 * Calculate payroll for an employee.
 * 
 * @param {object} employee - Employee DB model
 * @param {object} attendance - Summary of attendance
 *   - workDays: number of days worked (default 22)
 *   - leaveDays: number of days on paid/unpaid leave
 *   - absentDays: number of absent days (unpaid)
 *   - overtimeHours: total overtime hours
 *   - overtimeHours134: overtime hours at 1.34x rate
 *   - overtimeHours167: overtime hours at 1.67x rate
 *   - regularHours: regular hours worked (mandatory for hourly employee)
 * @param {object} settings - Key-value pair of settings
 * @returns {object} Payroll record data
 */
export function calculatePayroll(employee, attendance = {}, settings = {}) {
  const workDays = parseFloat(attendance.workDays) || 0;
  const leaveDays = parseFloat(attendance.leaveDays) || 0;
  const absentDays = parseFloat(attendance.absentDays) || 0;
  const overtimeHours = parseFloat(attendance.overtimeHours) || 0;
  const overtimeHours134 = parseFloat(attendance.overtimeHours134) || 0;
  const overtimeHours167 = parseFloat(attendance.overtimeHours167) || 0;
  const overtimeHours200 = parseFloat(attendance.overtimeHours200) || 0;
  const overtimeHours267 = parseFloat(attendance.overtimeHours267) || 0;
  const regularHours = parseFloat(attendance.regularHours) || 0;
  
  const bonus = parseFloat(attendance.bonus) || 0;
  const retroPay = parseFloat(attendance.retroPay) || 0;
  const otherDeductions = parseFloat(attendance.otherDeductions) || 0;
  const leaveDeduction = parseFloat(attendance.leaveDeduction) || 0;

  // Build overridden employee settings for insurance/deduction purposes
  const empOverride = {
    ...employee,
    supplementaryHealthInsurance: attendance.supplementaryHealthInsurance !== undefined ? parseFloat(attendance.supplementaryHealthInsurance) : (employee.supplementaryHealthInsurance || 0),
    prevInsuranceDifference: attendance.prevInsuranceDifference !== undefined ? parseFloat(attendance.prevInsuranceDifference) : (employee.prevInsuranceDifference || 0),
    healthDisabilityExemption: attendance.healthDisabilityExemption !== undefined ? parseFloat(attendance.healthDisabilityExemption) : (employee.healthDisabilityExemption || 0),
    healthGovSubsidy: attendance.healthGovSubsidy !== undefined ? parseFloat(attendance.healthGovSubsidy) : (employee.healthGovSubsidy || 0),
  };

  // 1. Calculate Base and Regular Pay
  let baseSalary = employee.baseSalary; // monthly base salary OR hourly rate
  let regularPay = 0;
  let hourlyRate = 0;
  let averageHourlyRate = 0;

  const allowanceAA = employee.allowanceAA || 0;
  const allowanceLicense = employee.allowanceLicense || 0;
  const allowanceManager = employee.allowanceManager || 0;
  const otherAllowanceExempt = employee.mealAllowance || 0; // Stored in mealAllowance column, not included in average hourly wage
  const otherAllowance = employee.otherAllowance || 0; // Original other allowance, included in average hourly wage

  if (employee.salaryType === 'hourly') {
    hourlyRate = baseSalary; // 約定時薪
    regularPay = Math.round(regularHours * hourlyRate); // 正常薪資

    // Calculate Average Hourly Rate for Overtime calculations
    if (regularHours > 0) {
      // 正常工時(四捨五入到2位)
      const regHoursRounded = parseFloat(regularHours.toFixed(2));
      // 正常薪資(使用2位工時計算以符合備註)
      const normalWageForAverage = Math.round(regHoursRounded * hourlyRate);
      averageHourlyRate = (normalWageForAverage + allowanceAA + allowanceLicense + otherAllowance + bonus) / regularHours;
      averageHourlyRate = parseFloat(averageHourlyRate.toFixed(2));
    } else {
      averageHourlyRate = hourlyRate;
    }
  } else {
    // Monthly salary
    regularPay = baseSalary;
    
    // Standard hourly rate in Taiwan: (Monthly Salary + allowances) / 240
    const fixedMonthly = baseSalary + allowanceAA + allowanceLicense + allowanceManager + otherAllowance;
    hourlyRate = fixedMonthly / 240;
    averageHourlyRate = hourlyRate;
    
    // Deductions for absent days (Taiwan: baseSalary / 30 per absent day)
    if (absentDays > 0) {
      regularPay = Math.max(0, regularPay - (baseSalary / 30) * absentDays);
    }
  }

  // 1b. Calculate Leave Pay Supplement for Hourly Employees
  let leavePaySupplement = parseFloat(attendance.leavePaySupplement) || 0;
  if (employee.salaryType === 'hourly' && (attendance.leaveHoursHalf !== undefined || attendance.leaveHoursPaid !== undefined)) {
    const leaveHoursHalf = parseFloat(attendance.leaveHoursHalf) || 0;
    const leaveHoursPaid = parseFloat(attendance.leaveHoursPaid) || 0;
    leavePaySupplement = Math.round((leaveHoursHalf * 0.5 + leaveHoursPaid * 1.0) * averageHourlyRate);
  } else if (employee.salaryType !== 'hourly') {
    leavePaySupplement = 0;
  }

  // 2. Calculate Overtime Pay
  const otBase = employee.salaryType === 'hourly' ? averageHourlyRate : hourlyRate;
  const overtimePay134 = Math.round(overtimeHours134 * otBase * 1.334);
  const overtimePay167 = Math.round(overtimeHours167 * otBase * 1.667);
  const overtimePay200 = Math.round(overtimeHours200 * otBase * 2.00);
  const overtimePay267 = Math.round(overtimeHours267 * otBase * 2.667);
  
  let finalOvertimePay = overtimePay134 + overtimePay167 + overtimePay200 + overtimePay267;

  // 3. Gross Pay (應發薪資)
  let grossPay = 0;
  if (employee.salaryType === 'hourly') {
    grossPay = Math.round(regularPay + finalOvertimePay + allowanceAA + allowanceLicense + bonus + otherAllowance + otherAllowanceExempt + retroPay + leavePaySupplement);
  } else {
    grossPay = Math.round(regularPay + finalOvertimePay + allowanceAA + allowanceLicense + allowanceManager + otherAllowance + otherAllowanceExempt + bonus + retroPay);
  }

  // 4. Calculate Insurance and Pension (Deductions)
  const insuranceResult = calculateAllInsurance(empOverride, settings);

  const laborInsuranceEmployee = insuranceResult.laborInsurance.employeePremium;
  const healthInsuranceEmployee = insuranceResult.healthInsurance.employeePremium;
  const laborPensionEmployee = insuranceResult.laborPension.employeeContribution; // Employee voluntary pension

  const laborInsuranceEmployer = insuranceResult.laborInsurance.employerPremium;
  const healthInsuranceEmployer = insuranceResult.healthInsurance.employerPremium;
  const laborPensionEmployer = insuranceResult.laborPension.employerContribution; // Employer mandatory 6%
  const laborOccupationalEmployer = insuranceResult.laborOccupationalEmployer;

  // 5. Calculate Income Tax Withholding
  const taxResult = calculateTax({
    grossSalary: grossPay,
    laborInsuranceEmployee,
    healthInsuranceEmployee,
    voluntaryPension: laborPensionEmployee,
    mealAllowance: 0,
    dependents: employee.dependents || 0,
  });

  const incomeTax = taxResult.withholdingTax;

  const supplementaryHealthInsurance = empOverride.supplementaryHealthInsurance;
  const prevInsuranceDifference = empOverride.prevInsuranceDifference;

  // 6. Total Deductions (應扣項目)
  const totalDeductions = Math.round(
    laborInsuranceEmployee + healthInsuranceEmployee + laborPensionEmployee + incomeTax + otherDeductions + leaveDeduction + supplementaryHealthInsurance + prevInsuranceDifference
  );

  // 7. Net Pay (實發薪資)
  const netPay = Math.max(0, grossPay - totalDeductions);

  // 8. Employer Cost (雇主負擔)
  const totalEmployerCost = Math.round(
    laborInsuranceEmployer + healthInsuranceEmployer + laborPensionEmployer + laborOccupationalEmployer
  );

  return {
    baseSalary: employee.salaryType === 'hourly' ? 0 : baseSalary,
    overtimePay: finalOvertimePay,
    mealAllowance: otherAllowanceExempt,
    transportAllowance: 0, // Transport allowance removed
    allowanceAA,
    allowanceLicense,
    allowanceManager,
    otherAllowance,
    bonus,
    retroPay,
    leaveDeduction,
    leavePaySupplement,
    supplementaryHealthInsurance,
    prevInsuranceDifference,
    healthDisabilityExemption: empOverride.healthDisabilityExemption,
    healthGovSubsidy: empOverride.healthGovSubsidy,
    grossPay,
    
    // Attendance stats
    workDays,
    leaveDays,
    absentDays,
    overtimeHours,
    overtimeHours134,
    overtimeHours167,
    overtimeHours200,
    overtimeHours267,
    regularHours,
    
    // Employee Deductions
    laborInsuranceEmployee,
    healthInsuranceEmployee,
    laborPensionEmployee,
    incomeTax,
    otherDeductions,
    totalDeductions,
    
    // Employer Costs
    laborInsuranceEmployer,
    healthInsuranceEmployer,
    laborPensionEmployer,
    laborOccupationalEmployer,
    totalEmployerCost,
    
    // Insured grades history to store in PayrollRecord
    laborInsuranceGrade: insuranceResult.laborInsuranceGrade,
    healthInsuranceGrade: insuranceResult.healthInsuranceGrade,
    laborPensionGrade: insuranceResult.laborPensionGrade,
    laborOccupationalGrade: insuranceResult.laborOccupationalGrade,

    // Net Pay
    netPay,
  };
}

export default {
  calculatePayroll,
};

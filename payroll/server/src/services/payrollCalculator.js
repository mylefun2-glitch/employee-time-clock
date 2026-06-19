/**
 * Payroll Calculator Service
 * Calculates gross pay, overtime pay, insurance, pension, tax, and net pay.
 */
import { calculateAllInsurance } from './insuranceCalculator.js';
import { calculateTax } from './taxCalculator.js';

/**
 * Calculate labor insurance days for a given payroll year and month based on hire date and resignation date.
 */
export function calculateLaborInsuranceDays(year, month, hireDateStr, resignDateStr) {
  const y = parseInt(year);
  const m = parseInt(month);
  if (isNaN(y) || isNaN(m)) return 30;
  
  const lastDay = new Date(y, m, 0).getDate();
  
  const monthStart = new Date(Date.UTC(y, m - 1, 1));
  const monthEnd = new Date(Date.UTC(y, m - 1, lastDay));
  
  let joinDay = 1;
  if (hireDateStr) {
    const hireDate = new Date(hireDateStr);
    if (!isNaN(hireDate.getTime())) {
      const hY = hireDate.getFullYear();
      const hM = hireDate.getMonth() + 1;
      const hD = hireDate.getDate();
      if (hY === y && hM === m) {
        joinDay = hD;
      } else if (hireDate > monthEnd) {
        return 0; // Not hired yet in this month
      }
    }
  }
  
  let resignDay = 30;
  if (resignDateStr) {
    const resignDate = new Date(resignDateStr);
    if (!isNaN(resignDate.getTime())) {
      const rY = resignDate.getFullYear();
      const rM = resignDate.getMonth() + 1;
      const rD = resignDate.getDate();
      if (rY === y && rM === m) {
        if (rD === lastDay) {
          resignDay = 30;
        } else {
          resignDay = rD;
        }
      } else if (resignDate < monthStart) {
        return 0; // Already resigned
      }
    }
  }
  
  if (joinDay === 1 && resignDay === 30) {
    return 30;
  }
  
  if (resignDay === 30) {
    return Math.max(1, 30 - joinDay + 1);
  }
  
  return Math.max(1, resignDay - joinDay + 1);
}

/**
 * Calculate pro-rata salary factor (based on 30 days Civil Law month) for partial month.
 */
export function calculateProRataSalaryFactor(year, month, hireDateStr, resignDateStr) {
  const y = parseInt(year);
  const m = parseInt(month);
  if (isNaN(y) || isNaN(m)) return { factor: 1.0, isProRata: false, calendarDays: 30 };
  
  const lastDay = new Date(y, m, 0).getDate();
  
  const monthStart = new Date(Date.UTC(y, m - 1, 1));
  const monthEnd = new Date(Date.UTC(y, m - 1, lastDay));
  
  let startDay = 1;
  if (hireDateStr) {
    const hireDate = new Date(hireDateStr);
    if (!isNaN(hireDate.getTime())) {
      const hY = hireDate.getFullYear();
      const hM = hireDate.getMonth() + 1;
      const hD = hireDate.getDate();
      if (hY === y && hM === m) {
        startDay = hD;
      } else if (hireDate > monthEnd) {
        return { factor: 0.0, isProRata: true, calendarDays: 0 };
      }
    }
  }
  
  let endDay = lastDay;
  if (resignDateStr) {
    const resignDate = new Date(resignDateStr);
    if (!isNaN(resignDate.getTime())) {
      const rY = resignDate.getFullYear();
      const rM = resignDate.getMonth() + 1;
      const rD = resignDate.getDate();
      if (rY === y && rM === m) {
        endDay = rD;
      } else if (resignDate < monthStart) {
        return { factor: 0.0, isProRata: true, calendarDays: 0 };
      }
    }
  }
  
  if (startDay === 1 && endDay === lastDay) {
    return { factor: 1.0, isProRata: false, calendarDays: lastDay };
  }
  
  const calendarDays = endDay - startDay + 1;
  return {
    factor: calendarDays / 30,
    isProRata: true,
    calendarDays
  };
}

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
    dependents: attendance.dependents !== undefined ? parseInt(attendance.dependents) : (employee.dependents || 0),
    supplementaryHealthInsurance: attendance.supplementaryHealthInsurance !== undefined ? parseFloat(attendance.supplementaryHealthInsurance) : (employee.supplementaryHealthInsurance || 0),
    prevInsuranceDifference: attendance.prevInsuranceDifference !== undefined ? parseFloat(attendance.prevInsuranceDifference) : (employee.prevInsuranceDifference || 0),
    healthDisabilityExemption: attendance.healthDisabilityExemption !== undefined ? parseFloat(attendance.healthDisabilityExemption) : (employee.healthDisabilityExemption || 0),
    laborDisabilityExemption: attendance.laborDisabilityExemption !== undefined ? parseFloat(attendance.laborDisabilityExemption) : (employee.laborDisabilityExemption || 0),
    healthGovSubsidy: attendance.healthGovSubsidy !== undefined ? parseFloat(attendance.healthGovSubsidy) : (employee.healthGovSubsidy || 0),
  };

  // 1. Calculate Base and Regular Pay
  const year = attendance.year;
  const month = attendance.month;
  
  let laborInsuranceDays = 30;
  let proRataInfo = { factor: 1.0, isProRata: false, calendarDays: 30 };
  let isMidMonthResigned = false;
  
  if (year && month) {
    laborInsuranceDays = calculateLaborInsuranceDays(year, month, employee.hireDate, employee.resignDate);
    proRataInfo = calculateProRataSalaryFactor(year, month, employee.hireDate, employee.resignDate);
    
    if (employee.resignDate) {
      const resignDate = new Date(employee.resignDate);
      if (!isNaN(resignDate.getTime())) {
        const rY = resignDate.getFullYear();
        const rM = resignDate.getMonth() + 1;
        const rD = resignDate.getDate();
        if (rY === year && rM === month) {
          const lastDay = new Date(year, month, 0).getDate();
          if (rD < lastDay) {
            isMidMonthResigned = true;
          }
        }
      }
    }
  }

  let baseSalary = employee.baseSalary; // monthly base salary OR hourly rate
  let regularPay = 0;
  let hourlyRate = 0;
  let averageHourlyRate = 0;
 
  let allowanceAA = employee.allowanceAA || 0;
  let allowanceLicense = employee.allowanceLicense || 0;
  let allowanceManager = employee.allowanceManager || 0;
  let otherAllowanceExempt = employee.mealAllowance || 0; // Stored in mealAllowance column, not included in average hourly wage
  let otherAllowance = employee.otherAllowance || 0; // Original other allowance, included in average hourly wage
  
  let autoNotes = "";

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
    if (proRataInfo.isProRata) {
      const f = proRataInfo.factor;
      regularPay = Math.ceil(baseSalary * f);
      allowanceAA = Math.ceil(allowanceAA * f);
      allowanceLicense = Math.ceil(allowanceLicense * f);
      allowanceManager = Math.ceil(allowanceManager * f);
      otherAllowance = Math.ceil(otherAllowance * f);
      otherAllowanceExempt = Math.ceil(otherAllowanceExempt * f);
      
      autoNotes = `本月因到/離職不足月，依民法以 30 日計算，在職天數為 ${proRataInfo.calendarDays} 日。底薪與固定加給/津貼按比例 ${proRataInfo.calendarDays}/30 折算並採無條件進位。`;
    } else {
      regularPay = baseSalary;
    }
    
    // Standard hourly rate in Taiwan: (Monthly Salary + allowances) / (30 * standardHours)
    // Note: Standard hourly rate for leave/overtime is always calculated based on original CONTRACTED monthly fixed salary.
    const standardHours = employee.standardDailyHours || employee.standard_daily_hours || 8;
    const fixedMonthly = employee.baseSalary + (employee.allowanceAA || 0) + (employee.allowanceLicense || 0) + (employee.allowanceManager || 0) + (employee.otherAllowance || 0);
    hourlyRate = fixedMonthly / (30 * standardHours);
    averageHourlyRate = hourlyRate;
    
    // Deductions for absent days (Taiwan: baseSalary / 30 per absent day)
    if (absentDays > 0) {
      regularPay = Math.max(0, regularPay - (baseSalary / 30) * absentDays);
    }
  }

  // 1b. Calculate Leave Pay Supplement for Hourly Employees
  // As per user request, leave pay supplement for hourly employees is already included in other allowances,
  // so we set it directly to 0.
  let leavePaySupplement = 0;

  // 2. Calculate Overtime Pay
  const otBase = employee.salaryType === 'hourly' ? averageHourlyRate : hourlyRate;
  
  const roundedOt134 = Math.round(overtimeHours134 * 100) / 100;
  const roundedOt167 = Math.round(overtimeHours167 * 100) / 100;
  const roundedOt267 = Math.round(overtimeHours267 * 100) / 100;
  const roundedOt200 = Math.round(overtimeHours200 * 100) / 100;

  const otMultiplier200 = employee.salaryType === 'monthly' ? 1.00 : 2.00;

  let finalOvertimePay = Math.round(
    otBase * (
      roundedOt134 * 1.334 +
      roundedOt167 * 1.667 +
      roundedOt267 * 2.667 +
      roundedOt200 * otMultiplier200
    )
  );

  // 3. Gross Pay (應發薪資)
  let grossPay = 0;
  if (employee.salaryType === 'hourly') {
    grossPay = Math.round(regularPay + finalOvertimePay + allowanceAA + allowanceLicense + bonus + otherAllowance + otherAllowanceExempt + retroPay + leavePaySupplement);
  } else {
    grossPay = Math.round(regularPay + finalOvertimePay + allowanceAA + allowanceLicense + allowanceManager + otherAllowance + otherAllowanceExempt + bonus + retroPay);
  }

  // 4. Calculate Insurance and Pension (Deductions)
  const insuranceResult = calculateAllInsurance(empOverride, settings, laborInsuranceDays, isMidMonthResigned);

  const laborInsuranceEmployee = insuranceResult.laborInsurance.employeePremium;
  const healthInsuranceEmployee = insuranceResult.healthInsurance.employeePremium;
  const laborPensionEmployee = insuranceResult.laborPension.employeeContribution; // Employee voluntary pension

  const laborInsuranceEmployer = insuranceResult.laborInsurance.employerPremium;
  const healthInsuranceEmployer = insuranceResult.healthInsurance.employerPremium;
  const laborPensionEmployer = insuranceResult.laborPension.employerContribution; // Employer mandatory 6%
  const laborOccupationalEmployer = insuranceResult.laborOccupationalEmployer;

  // 5. Calculate Income Tax Withholding (Disabled per company policy - annual declaration only)
  const incomeTax = 0;

  let supplementaryHealthInsurance = 0;
  if (attendance.supplementaryHealthInsurance !== undefined) {
    supplementaryHealthInsurance = parseFloat(attendance.supplementaryHealthInsurance) || 0;
  } else {
    const isNotHealthInsuredAtCompany = (employee.healthInsuranceGrade === -1) || isMidMonthResigned;
    if (isNotHealthInsuredAtCompany) {
      const minWage = parseFloat(settings.minimum_wage_monthly) || 29500;
      const netGrossForNhi = grossPay - leaveDeduction;
      if (netGrossForNhi >= minWage) {
        supplementaryHealthInsurance = Math.round(netGrossForNhi * 0.0211);
      }
    }
  }
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
    baseSalary: employee.salaryType === 'hourly' ? employee.baseSalary : (proRataInfo.isProRata ? regularPay : baseSalary),
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
    notes: autoNotes || "",
    supplementaryHealthInsurance,
    prevInsuranceDifference,
    healthDisabilityExemption: empOverride.healthDisabilityExemption,
    laborDisabilityExemption: empOverride.laborDisabilityExemption,
    healthGovSubsidy: empOverride.healthGovSubsidy,
    dependents: empOverride.dependents,
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

/**
 * Insurance Calculator Service
 * Handles Taiwan labor insurance, health insurance, and labor pension calculations.
 * Based on 2025 Taiwan rates and grade tables.
 */

// Labor insurance insured salary grade table (勞保投保薪資分級表) 2025
const LABOR_INSURANCE_GRADES = [
  { grade: 1, min: 0, max: 27470, insuredSalary: 27470 },
  { grade: 2, min: 27471, max: 28800, insuredSalary: 28800 },
  { grade: 3, min: 28801, max: 30300, insuredSalary: 30300 },
  { grade: 4, min: 30301, max: 31800, insuredSalary: 31800 },
  { grade: 5, min: 31801, max: 33300, insuredSalary: 33300 },
  { grade: 6, min: 33301, max: 34800, insuredSalary: 34800 },
  { grade: 7, min: 34801, max: 36300, insuredSalary: 36300 },
  { grade: 8, min: 36301, max: 38200, insuredSalary: 38200 },
  { grade: 9, min: 38201, max: 40100, insuredSalary: 40100 },
  { grade: 10, min: 40101, max: 42000, insuredSalary: 42000 },
  { grade: 11, min: 42001, max: 43900, insuredSalary: 43900 },
  { grade: 12, min: 43901, max: 45800, insuredSalary: 45800 },
  { grade: 13, min: 45801, max: 48200, insuredSalary: 48200 },
  { grade: 14, min: 48201, max: 50600, insuredSalary: 50600 },
  { grade: 15, min: 50601, max: 53000, insuredSalary: 53000 },
  { grade: 16, min: 53001, max: 55400, insuredSalary: 55400 },
  { grade: 17, min: 55401, max: 57800, insuredSalary: 57800 },
  { grade: 18, min: 57801, max: 60800, insuredSalary: 60800 },
  // Grade 19+: capped at 45,800 for labor insurance
  { grade: 19, min: 60801, max: 999999, insuredSalary: 45800 },
];

// Health insurance insured salary grade table (健保投保薪資分級表) 2025
const HEALTH_INSURANCE_GRADES = [
  { grade: 1, min: 0, max: 27470, insuredSalary: 27470 },
  { grade: 2, min: 27471, max: 28800, insuredSalary: 28800 },
  { grade: 3, min: 28801, max: 30300, insuredSalary: 30300 },
  { grade: 4, min: 30301, max: 31800, insuredSalary: 31800 },
  { grade: 5, min: 31801, max: 33300, insuredSalary: 33300 },
  { grade: 6, min: 33301, max: 34800, insuredSalary: 34800 },
  { grade: 7, min: 34801, max: 36300, insuredSalary: 36300 },
  { grade: 8, min: 36301, max: 38200, insuredSalary: 38200 },
  { grade: 9, min: 38201, max: 40100, insuredSalary: 40100 },
  { grade: 10, min: 40101, max: 42000, insuredSalary: 42000 },
  { grade: 11, min: 42001, max: 43900, insuredSalary: 43900 },
  { grade: 12, min: 43901, max: 45800, insuredSalary: 45800 },
  { grade: 13, min: 45801, max: 48200, insuredSalary: 48200 },
  { grade: 14, min: 48201, max: 50600, insuredSalary: 50600 },
  { grade: 15, min: 50601, max: 53000, insuredSalary: 53000 },
  { grade: 16, min: 53001, max: 55400, insuredSalary: 55400 },
  { grade: 17, min: 55401, max: 57800, insuredSalary: 57800 },
  { grade: 18, min: 57801, max: 60800, insuredSalary: 60800 },
  { grade: 19, min: 60801, max: 63800, insuredSalary: 63800 },
  { grade: 20, min: 63801, max: 66800, insuredSalary: 66800 },
  { grade: 21, min: 66801, max: 69800, insuredSalary: 69800 },
  { grade: 22, min: 69801, max: 72800, insuredSalary: 72800 },
  { grade: 23, min: 72801, max: 76500, insuredSalary: 76500 },
  { grade: 24, min: 76501, max: 80200, insuredSalary: 80200 },
  { grade: 25, min: 80201, max: 83900, insuredSalary: 83900 },
  { grade: 26, min: 83901, max: 87600, insuredSalary: 87600 },
  { grade: 27, min: 87601, max: 92100, insuredSalary: 92100 },
  { grade: 28, min: 92101, max: 96600, insuredSalary: 96600 },
  { grade: 29, min: 96601, max: 101100, insuredSalary: 101100 },
  { grade: 30, min: 101101, max: 105600, insuredSalary: 105600 },
  { grade: 31, min: 105601, max: 110100, insuredSalary: 110100 },
  { grade: 32, min: 110101, max: 115500, insuredSalary: 115500 },
  { grade: 33, min: 115501, max: 120900, insuredSalary: 120900 },
  { grade: 34, min: 120901, max: 126300, insuredSalary: 126300 },
  { grade: 35, min: 126301, max: 131700, insuredSalary: 131700 },
  { grade: 36, min: 131701, max: 137100, insuredSalary: 137100 },
  { grade: 37, min: 137101, max: 142500, insuredSalary: 142500 },
  { grade: 38, min: 142501, max: 147900, insuredSalary: 147900 },
  { grade: 39, min: 147901, max: 150000, insuredSalary: 150000 },
  { grade: 40, min: 150001, max: 156400, insuredSalary: 156400 },
  { grade: 41, min: 156401, max: 162800, insuredSalary: 162800 },
  { grade: 42, min: 162801, max: 169200, insuredSalary: 169200 },
  { grade: 43, min: 169201, max: 175600, insuredSalary: 175600 },
  { grade: 44, min: 175601, max: 182000, insuredSalary: 182000 },
  { grade: 45, min: 182001, max: 189500, insuredSalary: 189500 },
  { grade: 46, min: 189501, max: 999999, insuredSalary: 219500 },
];

// Default rates (2025 Taiwan)
const DEFAULT_RATES = {
  // Labor Insurance: 12% total (普通事故 11% + 就業保險 1%)
  laborInsuranceRate: 0.12,
  laborInsuranceEmployeeShare: 0.20,  // Employee pays 20%
  laborInsuranceEmployerShare: 0.70,  // Employer pays 70%
  
  // Health Insurance: 5.17%
  healthInsuranceRate: 0.0517,
  healthInsuranceEmployeeShare: 0.30,  // Employee pays 30%
  healthInsuranceEmployerShare: 0.60,  // Employer pays 60%
  healthInsuranceAvgDependents: 0.61,  // Average dependents ratio
  
  // Labor Pension
  laborPensionEmployerRate: 0.06,  // Employer mandatory 6%
};

/**
 * Look up the insured salary grade for labor insurance.
 * @param {number} salary - The actual salary or the overridden grade salary
 * @returns {number} The insured salary for the matching grade
 */
export function lookupLaborInsuranceGrade(salary) {
  if (salary <= 0) return LABOR_INSURANCE_GRADES[0].insuredSalary;
  
  for (const grade of LABOR_INSURANCE_GRADES) {
    if (salary >= grade.min && salary <= grade.max) {
      return grade.insuredSalary;
    }
  }
  // If salary exceeds all grades, return the max cap
  return LABOR_INSURANCE_GRADES[LABOR_INSURANCE_GRADES.length - 1].insuredSalary;
}

/**
 * Look up the insured salary grade for health insurance.
 * @param {number} salary - The actual salary or the overridden grade salary
 * @returns {number} The insured salary for the matching grade
 */
export function lookupHealthInsuranceGrade(salary) {
  if (salary <= 0) return HEALTH_INSURANCE_GRADES[0].insuredSalary;
  
  for (const grade of HEALTH_INSURANCE_GRADES) {
    if (salary >= grade.min && salary <= grade.max) {
      return grade.insuredSalary;
    }
  }
  return HEALTH_INSURANCE_GRADES[HEALTH_INSURANCE_GRADES.length - 1].insuredSalary;
}

/**
 * Calculate labor insurance premiums.
 * Formula: insuredSalary × rate × share
 * 
 * @param {number} insuredSalary - The insured salary grade (投保薪資)
 * @param {object} rates - Override rates (optional)
 * @returns {object} { employeePremium, employerPremium, insuredSalary }
 */
export function calculateLaborInsurance(insuredSalary, rates = {}, days = 30) {
  const r = { ...DEFAULT_RATES, ...rates };
  
  // Employee pays: insuredSalary × 12% × 20% = insuredSalary × 2.4%
  const employeePremium = Math.round(insuredSalary * r.laborInsuranceRate * r.laborInsuranceEmployeeShare * days / 30);
  
  // Employer pays: insuredSalary × 12% × 70% = insuredSalary × 8.4%
  const employerPremium = Math.round(insuredSalary * r.laborInsuranceRate * r.laborInsuranceEmployerShare * days / 30);
  
  return {
    insuredSalary,
    employeePremium,
    employerPremium,
    rate: r.laborInsuranceRate,
    employeeShare: r.laborInsuranceEmployeeShare,
    employerShare: r.laborInsuranceEmployerShare,
  };
}

/**
 * Calculate health insurance premiums.
 * Employee: insuredSalary × rate × 30% × (1 + dependents)
 * Employer: insuredSalary × rate × 60% × (1 + avg dependents ratio)
 * 
 * @param {number} insuredSalary - The insured salary grade (投保薪資)
 * @param {number} dependents - Number of dependents (扶養人數) for the employee
 * @param {object} rates - Override rates (optional)
 * @returns {object} { employeePremium, employerPremium, insuredSalary }
 */
export function calculateHealthInsurance(insuredSalary, dependents = 0, rates = {}) {
  const r = { ...DEFAULT_RATES, ...rates };
  
  // Employee pays: insuredSalary × 5.17% × 30% × (1 + dependents)
  // Note: dependents here means number of dependents the employee is insuring
  const employeePremium = Math.round(
    insuredSalary * r.healthInsuranceRate * r.healthInsuranceEmployeeShare * (1 + dependents)
  );
  
  // Employer pays: insuredSalary × 5.17% × 60% × (1 + avg dependents ratio)
  const employerPremium = Math.round(
    insuredSalary * r.healthInsuranceRate * r.healthInsuranceEmployerShare * (1 + r.healthInsuranceAvgDependents)
  );
  
  return {
    insuredSalary,
    dependents,
    employeePremium,
    employerPremium,
    rate: r.healthInsuranceRate,
    employeeShare: r.healthInsuranceEmployeeShare,
    employerShare: r.healthInsuranceEmployerShare,
  };
}

/**
 * Calculate labor pension contributions.
 * Employer: pensionGrade × 6% (mandatory)
 * Employee: pensionGrade × voluntaryRate% (optional, 0-6%)
 * 
 * @param {number} pensionGrade - The pension contribution salary grade (提繳工資)
 * @param {number} voluntaryRate - Employee voluntary contribution rate (0-6%)
 * @param {object} rates - Override rates (optional)
 * @returns {object} { employeeContribution, employerContribution, pensionGrade }
 */
export function calculateLaborPension(pensionGrade, voluntaryRate = 0, rates = {}, days = 30) {
  const r = { ...DEFAULT_RATES, ...rates };
  
  // Employer mandatory: pensionGrade × 6%
  const employerContribution = Math.round(pensionGrade * r.laborPensionEmployerRate * days / 30);
  
  // Employee voluntary: pensionGrade × voluntaryRate%
  const clampedRate = Math.min(0.06, Math.max(0, voluntaryRate / 100));
  const employeeContribution = Math.round(pensionGrade * clampedRate * days / 30);
  
  return {
    pensionGrade,
    voluntaryRate: clampedRate * 100,
    employeeContribution,
    employerContribution,
    employerRate: r.laborPensionEmployerRate,
  };
}

/**
 * Calculate all insurance premiums for an employee.
 * Uses the employee's preset grade values, or looks them up if not set.
 * 
 * @param {object} employee - Employee record with insurance grade fields
 * @param {object} settings - System settings for rate overrides (optional)
 * @returns {object} Combined insurance calculation results
 */
export function calculateAllInsurance(employee, settings = {}, days = 30, isMidMonthResigned = false) {
  // Determine insured salaries - use employee's preset or look up from salary
  // Hourly employees do not use baseSalary for totalMonthly calculation because baseSalary is hourly rate.
  const totalMonthly = (employee.salaryType === 'hourly' ? 0 : employee.baseSalary) +
                       (employee.mealAllowance || 0) + 
                       (employee.allowanceAA || 0) +
                       (employee.allowanceLicense || 0) +
                       (employee.allowanceManager || 0) +
                       (employee.otherAllowance || 0);
  
  const laborInsuredSalary = employee.laborInsuranceGrade === -1
    ? 0
    : (employee.laborInsuranceGrade > 0 
        ? employee.laborInsuranceGrade 
        : lookupLaborInsuranceGrade(totalMonthly));
    
  const healthInsuredSalary = employee.healthInsuranceGrade === -1
    ? 0
    : (employee.healthInsuranceGrade > 0 
        ? employee.healthInsuranceGrade 
        : lookupHealthInsuranceGrade(totalMonthly));
    
  const pensionGrade = employee.laborPensionGrade === -1
    ? 0
    : (employee.laborPensionGrade > 0 
        ? employee.laborPensionGrade 
        : totalMonthly);

  const occupationalGrade = employee.laborOccupationalGrade === -1
    ? 0
    : (employee.laborOccupationalGrade > 0
        ? employee.laborOccupationalGrade
        : (employee.laborPensionGrade > 0 ? employee.laborPensionGrade : totalMonthly));

  // Build rates from settings
  const rates = {};
  if (settings.labor_insurance_rate) rates.laborInsuranceRate = parseFloat(settings.labor_insurance_rate);
  if (settings.labor_insurance_employee_share) rates.laborInsuranceEmployeeShare = parseFloat(settings.labor_insurance_employee_share);
  if (settings.labor_insurance_employer_share) rates.laborInsuranceEmployerShare = parseFloat(settings.labor_insurance_employer_share);
  if (settings.health_insurance_rate) rates.healthInsuranceRate = parseFloat(settings.health_insurance_rate);
  if (settings.health_insurance_employee_share) rates.healthInsuranceEmployeeShare = parseFloat(settings.health_insurance_employee_share);
  if (settings.health_insurance_employer_share) rates.healthInsuranceEmployerShare = parseFloat(settings.health_insurance_employer_share);
  if (settings.health_insurance_avg_dependents) rates.healthInsuranceAvgDependents = parseFloat(settings.health_insurance_avg_dependents);
  if (settings.labor_pension_employer_rate) rates.laborPensionEmployerRate = parseFloat(settings.labor_pension_employer_rate);

  const laborInsurance = calculateLaborInsurance(laborInsuredSalary, rates, days);
  const healthInsurance = calculateHealthInsurance(healthInsuredSalary, employee.dependents || 0, rates);

  // Apply disability exemption and government subsidy to employee premium
  const exemption = parseFloat(employee.healthDisabilityExemption) || 0;
  const subsidy = parseFloat(employee.healthGovSubsidy) || 0;
  healthInsurance.basePremium = healthInsurance.employeePremium; // Save original
  healthInsurance.employeePremium = Math.max(0, Math.round(healthInsurance.employeePremium * (1 - exemption)) - subsidy);

  if (isMidMonthResigned) {
    healthInsurance.employeePremium = 0;
    healthInsurance.employerPremium = 0;
  }

  const laborPension = calculateLaborPension(pensionGrade, employee.voluntaryPensionRate || 0, rates, days);

  // Calculate Occupational Accident Insurance (職保) - completely paid by employer
  const occupationalRate = parseFloat(settings.labor_occupational_rate || 0.0015);
  const laborOccupationalEmployer = Math.round(occupationalGrade * occupationalRate * days / 30);

  return {
    laborInsurance,
    healthInsurance,
    laborPension,
    laborOccupationalEmployer,
    laborInsuranceGrade: laborInsuredSalary,
    healthInsuranceGrade: healthInsuredSalary,
    laborPensionGrade: pensionGrade,
    laborOccupationalGrade: occupationalGrade,
    totalEmployeeDeductions: laborInsurance.employeePremium + healthInsurance.employeePremium + laborPension.employeeContribution,
    totalEmployerCosts: laborInsurance.employerPremium + healthInsurance.employerPremium + laborPension.employerContribution + laborOccupationalEmployer,
  };
}

export default {
  lookupLaborInsuranceGrade,
  lookupHealthInsuranceGrade,
  calculateLaborInsurance,
  calculateHealthInsurance,
  calculateLaborPension,
  calculateAllInsurance,
  LABOR_INSURANCE_GRADES,
  HEALTH_INSURANCE_GRADES,
  DEFAULT_RATES,
};

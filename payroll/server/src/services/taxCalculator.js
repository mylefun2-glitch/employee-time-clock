/**
 * Tax Calculator Service
 * Handles Taiwan income tax withholding calculations.
 * Based on 2025 Taiwan tax withholding tables (薪資所得扣繳稅額表).
 * 
 * The withholding is based on the "monthly salary withholding tax table"
 * published by the Ministry of Finance.
 */

// Monthly salary income tax withholding table (薪資所得扣繳稅額表)
// Simplified version for common salary ranges.
// Format: { min, max, taxAmount for 0 dependents, then per additional dependent reduces tax }
// This is the fixed withholding amount approach (非固定薪資 uses 5% flat).
// For fixed monthly salary (固定薪資), use the lookup table.
// Based on 2025 withholding table.
const MONTHLY_WITHHOLDING_TABLE = [
  // { salaryMin, salaryMax, dep0, dep1, dep2, dep3, dep4, dep5 }
  // Under 27,470: tax-free for all
  { min: 0,      max: 27470,   dep: [0, 0, 0, 0, 0, 0] },
  { min: 27471,  max: 30000,   dep: [0, 0, 0, 0, 0, 0] },
  { min: 30001,  max: 32000,   dep: [0, 0, 0, 0, 0, 0] },
  { min: 32001,  max: 34000,   dep: [0, 0, 0, 0, 0, 0] },
  { min: 34001,  max: 36000,   dep: [0, 0, 0, 0, 0, 0] },
  { min: 36001,  max: 38000,   dep: [0, 0, 0, 0, 0, 0] },
  { min: 38001,  max: 40000,   dep: [160, 0, 0, 0, 0, 0] },
  { min: 40001,  max: 42500,   dep: [440, 0, 0, 0, 0, 0] },
  { min: 42501,  max: 45000,   dep: [720, 0, 0, 0, 0, 0] },
  { min: 45001,  max: 47500,   dep: [1010, 200, 0, 0, 0, 0] },
  { min: 47501,  max: 50000,   dep: [1290, 480, 0, 0, 0, 0] },
  { min: 50001,  max: 52500,   dep: [1580, 770, 0, 0, 0, 0] },
  { min: 52501,  max: 55000,   dep: [1860, 1050, 240, 0, 0, 0] },
  { min: 55001,  max: 57500,   dep: [2150, 1340, 530, 0, 0, 0] },
  { min: 57501,  max: 60000,   dep: [2430, 1620, 810, 0, 0, 0] },
  { min: 60001,  max: 62500,   dep: [2720, 1910, 1100, 290, 0, 0] },
  { min: 62501,  max: 65000,   dep: [3000, 2190, 1380, 570, 0, 0] },
  { min: 65001,  max: 67500,   dep: [3290, 2480, 1670, 860, 50, 0] },
  { min: 67501,  max: 70000,   dep: [3570, 2760, 1950, 1140, 330, 0] },
  { min: 70001,  max: 72500,   dep: [3860, 3050, 2240, 1430, 620, 0] },
  { min: 72501,  max: 75000,   dep: [4140, 3330, 2520, 1710, 900, 90] },
  { min: 75001,  max: 77500,   dep: [4430, 3620, 2810, 2000, 1190, 380] },
  { min: 77501,  max: 80000,   dep: [4720, 3910, 3100, 2290, 1480, 670] },
  { min: 80001,  max: 82500,   dep: [5010, 4200, 3390, 2580, 1770, 960] },
  { min: 82501,  max: 85000,   dep: [5300, 4490, 3680, 2870, 2060, 1250] },
  { min: 85001,  max: 87500,   dep: [5590, 4780, 3970, 3160, 2350, 1540] },
  { min: 87501,  max: 90000,   dep: [5880, 5070, 4260, 3450, 2640, 1830] },
  { min: 90001,  max: 92500,   dep: [6170, 5360, 4550, 3740, 2930, 2120] },
  { min: 92501,  max: 95000,   dep: [6460, 5650, 4840, 4030, 3220, 2410] },
  { min: 95001,  max: 97500,   dep: [6750, 5940, 5130, 4320, 3510, 2700] },
  { min: 97501,  max: 100000,  dep: [7040, 6230, 5420, 4610, 3800, 2990] },
  { min: 100001, max: 105000,  dep: [7620, 6810, 6000, 5190, 4380, 3570] },
  { min: 105001, max: 110000,  dep: [8500, 7690, 6880, 6070, 5260, 4450] },
  { min: 110001, max: 115000,  dep: [9380, 8570, 7760, 6950, 6140, 5330] },
  { min: 115001, max: 120000,  dep: [10260, 9450, 8640, 7830, 7020, 6210] },
  { min: 120001, max: 130000,  dep: [11700, 10890, 10080, 9270, 8460, 7650] },
  { min: 130001, max: 140000,  dep: [13700, 12890, 12080, 11270, 10460, 9650] },
  { min: 140001, max: 150000,  dep: [15700, 14890, 14080, 13270, 12460, 11650] },
  { min: 150001, max: 160000,  dep: [17700, 16890, 16080, 15270, 14460, 13650] },
  { min: 160001, max: 170000,  dep: [19700, 18890, 18080, 17270, 16460, 15650] },
  { min: 170001, max: 180000,  dep: [22440, 21630, 20820, 20010, 19200, 18390] },
  { min: 180001, max: 190000,  dep: [25440, 24630, 23820, 23010, 22200, 21390] },
  { min: 190001, max: 200000,  dep: [28440, 27630, 26820, 26010, 25200, 24390] },
  { min: 200001, max: 999999,  dep: [31440, 30630, 29820, 29010, 28200, 27390] },
];

/**
 * Calculate monthly income tax withholding.
 * Uses the fixed salary withholding table approach.
 * 
 * @param {number} taxableIncome - Monthly taxable income (課稅所得)
 *   = gross salary - employee labor insurance - employee health insurance 
 *     - employee voluntary pension - tax-free meal allowance
 * @param {number} dependents - Number of dependents (扶養人數)
 * @returns {number} Monthly withholding tax amount (預扣稅額)
 */
export function calculateMonthlyWithholding(taxableIncome, dependents = 0) {
  if (taxableIncome <= 0) return 0;
  
  // Clamp dependents to table range (0-5, beyond 5 use 5's value)
  const depIdx = Math.min(dependents, 5);
  
  // Look up in the withholding table
  for (const bracket of MONTHLY_WITHHOLDING_TABLE) {
    if (taxableIncome >= bracket.min && taxableIncome <= bracket.max) {
      return bracket.dep[depIdx] || 0;
    }
  }
  
  // For salaries above the table, apply a percentage-based calculation
  // Above the highest bracket: use 20% marginal rate minus deductions
  const highestBracket = MONTHLY_WITHHOLDING_TABLE[MONTHLY_WITHHOLDING_TABLE.length - 1];
  const baseTax = highestBracket.dep[depIdx] || 0;
  const excess = taxableIncome - highestBracket.min;
  return baseTax + Math.round(excess * 0.20);
}

/**
 * Calculate the taxable income from gross salary.
 * Taxable income = gross salary - insurance deductions - tax-free items
 * 
 * @param {number} grossSalary - Total gross salary before deductions
 * @param {number} laborInsuranceEmployee - Employee's labor insurance premium
 * @param {number} healthInsuranceEmployee - Employee's health insurance premium
 * @param {number} voluntaryPension - Employee's voluntary pension contribution
 * @param {number} mealAllowance - Meal allowance (tax-free up to 2,400/month)
 * @param {number} taxFreeMealMax - Maximum tax-free meal allowance (default 2400)
 * @returns {number} Monthly taxable income
 */
export function calculateTaxableIncome(
  grossSalary,
  laborInsuranceEmployee = 0,
  healthInsuranceEmployee = 0,
  voluntaryPension = 0,
  mealAllowance = 0,
  taxFreeMealMax = 2400
) {
  // Tax-free meal allowance (capped at the max)
  const taxFreeMeal = Math.min(mealAllowance, taxFreeMealMax);
  
  // Taxable income = gross - insurance premiums - voluntary pension - tax-free meal
  const taxable = grossSalary - laborInsuranceEmployee - healthInsuranceEmployee - voluntaryPension - taxFreeMeal;
  
  return Math.max(0, Math.round(taxable));
}

/**
 * Convenience function: calculate tax from employee data.
 * @param {object} params
 * @param {number} params.grossSalary - Total gross salary
 * @param {number} params.laborInsuranceEmployee - Employee labor insurance
 * @param {number} params.healthInsuranceEmployee - Employee health insurance  
 * @param {number} params.voluntaryPension - Employee voluntary pension
 * @param {number} params.mealAllowance - Meal allowance
 * @param {number} params.dependents - Number of dependents
 * @returns {object} { taxableIncome, withholdingTax }
 */
export function calculateTax({
  grossSalary,
  laborInsuranceEmployee = 0,
  healthInsuranceEmployee = 0,
  voluntaryPension = 0,
  mealAllowance = 0,
  dependents = 0,
}) {
  const taxableIncome = calculateTaxableIncome(
    grossSalary,
    laborInsuranceEmployee,
    healthInsuranceEmployee,
    voluntaryPension,
    mealAllowance
  );
  
  const withholdingTax = calculateMonthlyWithholding(taxableIncome, dependents);
  
  return {
    taxableIncome,
    withholdingTax,
    dependents,
  };
}

export default {
  calculateMonthlyWithholding,
  calculateTaxableIncome,
  calculateTax,
  MONTHLY_WITHHOLDING_TABLE,
};

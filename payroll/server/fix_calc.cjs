const { PrismaClient } = require('@prisma/client');
const { calculatePayroll } = require('./src/services/payrollCalculator.js');
const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.payrollRecord.findUnique({
    where: { id: 900 },
    include: { employee: true }
  });
  
  const empOverride = {
    ...existing.employee,
    baseSalary: existing.baseSalary,
    allowanceAA: existing.allowanceAA,
    allowanceLicense: existing.allowanceLicense,
    allowanceManager: existing.allowanceManager,
    otherAllowance: existing.otherAllowance,
    mealAllowance: existing.mealAllowance,
    laborInsuranceGrade: existing.laborInsuranceGrade,
    laborOccupationalGrade: existing.laborOccupationalGrade,
    healthInsuranceGrade: existing.healthInsuranceGrade,
    laborPensionGrade: existing.laborPensionGrade,
    dependents: existing.employee.dependents,
    healthGovSubsidy: existing.healthGovSubsidy,
    leavePaySupplement: existing.leavePaySupplement,
  };
  
  const attendanceSummary = {
    workDays: existing.workDays,
    leaveDays: existing.leaveDays,
    absentDays: existing.absentDays,
    regularHours: existing.regularHours,
    overtimeHours134: existing.overtimeHours134,
    overtimeHours167: existing.overtimeHours167,
    overtimeHours200: existing.overtimeHours200,
    overtimeHours267: existing.overtimeHours267,
    overtimeHours: existing.overtimeHours,
    bonus: existing.bonus,
    retroPay: existing.retroPay,
    otherDeductions: existing.otherDeductions,
    leaveDeduction: existing.leaveDeduction,
    leavePaySupplement: existing.leavePaySupplement,
  };
  
  // Use empty settings for now
  const payDetails = calculatePayroll(empOverride, attendanceSummary, {});
  
  await prisma.payrollRecord.update({
    where: { id: 900 },
    data: payDetails
  });
  console.log("Recalculated and saved successfully!");
}
main().catch(console.error).finally(() => prisma.$disconnect());

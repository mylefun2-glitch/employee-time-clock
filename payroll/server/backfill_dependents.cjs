const { PrismaClient } = require('@prisma/client');
const { calculatePayroll } = require('./src/services/payrollCalculator.js');
const prisma = new PrismaClient();

async function main() {
  const rawSettings = await prisma.systemSetting.findMany();
  const settings = {};
  rawSettings.forEach(s => { settings[s.key] = s.value; });

  const records = await prisma.payrollRecord.findMany({
    include: { employee: true }
  });

  console.log(`Checking ${records.length} payroll records...`);
  
  let draftCount = 0;
  let lockedCount = 0;

  for (const record of records) {
    if (record.dependents !== record.employee.dependents) {
      console.log(`Fixing mismatched dependents for ${record.employee.name} (ID: ${record.employee.id}) for ${record.year}/${record.month}: Record has ${record.dependents}, Employee setting has ${record.employee.dependents}. Status: ${record.status}`);
      
      if (record.status === 'DRAFT') {
        // Construct empOverride
        const empOverride = {
          ...record.employee,
          baseSalary: record.baseSalary,
          allowanceAA: record.allowanceAA,
          allowanceLicense: record.allowanceLicense,
          allowanceManager: record.allowanceManager,
          otherAllowance: record.otherAllowance,
          mealAllowance: record.mealAllowance,
          laborInsuranceGrade: record.laborInsuranceGrade,
          laborOccupationalGrade: record.laborOccupationalGrade,
          healthInsuranceGrade: record.healthInsuranceGrade,
          laborPensionGrade: record.laborPensionGrade,
          dependents: record.employee.dependents,
          healthGovSubsidy: record.healthGovSubsidy,
          leavePaySupplement: record.leavePaySupplement,
        };

        // Construct attendanceSummary
        const attendanceSummary = {
          workDays: record.workDays,
          leaveDays: record.leaveDays,
          absentDays: record.absentDays,
          regularHours: record.regularHours,
          overtimeHours134: record.overtimeHours134,
          overtimeHours167: record.overtimeHours167,
          overtimeHours200: record.overtimeHours200,
          overtimeHours267: record.overtimeHours267,
          overtimeHours: record.overtimeHours,
          bonus: record.bonus,
          retroPay: record.retroPay,
          otherDeductions: record.otherDeductions,
          leaveDeduction: record.leaveDeduction,
          leavePaySupplement: record.leavePaySupplement,
        };

        // Recalculate
        const payDetails = calculatePayroll(empOverride, attendanceSummary, settings);

        // Update the record with full recalculated details
        await prisma.payrollRecord.update({
          where: { id: record.id },
          data: {
            ...payDetails,
            calculatedAt: new Date().toISOString()
          }
        });
        draftCount++;
      } else {
        // For LOCKED/APPROVED records, only update the dependents field
        await prisma.payrollRecord.update({
          where: { id: record.id },
          data: {
            dependents: record.employee.dependents
          }
        });
        lockedCount++;
      }
    }
  }

  console.log(`Backfill completed! Updated ${draftCount} DRAFT records (with recalculation) and ${lockedCount} LOCKED/APPROVED records (only dependents count updated).`);
}

main().catch(console.error).finally(() => prisma.$disconnect());

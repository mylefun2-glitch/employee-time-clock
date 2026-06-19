const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const emp = await prisma.employee.findFirst({
    where: { name: '陳姵錡' }
  });
  if (!emp) {
    console.log("Employee '陳姵錡' not found");
    return;
  }
  console.log("Employee Basic Settings:");
  console.log({
    id: emp.id,
    name: emp.name,
    dependents: emp.dependents,
    voluntaryPensionRate: emp.voluntaryPensionRate
  });

  const pr = await prisma.payrollRecord.findFirst({
    where: {
      employeeId: emp.id,
      year: 2026,
      month: 4
    }
  });

  if (pr) {
    console.log("Payroll Record for April 2026:");
    console.log({
      id: pr.id,
      year: pr.year,
      month: pr.month,
      dependents: pr.dependents,
      healthInsuranceEmployee: pr.healthInsuranceEmployee
    });
  } else {
    console.log("No payroll record found for April 2026.");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const emp = await prisma.employee.findFirst({
    where: { name: '林淑禎' }
  });
  if (!emp) {
    console.log("Employee not found");
    return;
  }
  console.log("Employee:", emp.name, "ID:", emp.id, "SalaryType:", emp.salaryType, "BaseSalary:", emp.baseSalary);
  
  const payrolls = await prisma.payrollRecord.findMany({
    where: { employeeId: emp.id },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
    take: 2
  });
  
  if (payrolls.length === 0) {
    console.log("No payroll records found");
    return;
  }
  
  console.log("Latest Payrolls:");
  payrolls.forEach(p => console.log(JSON.stringify(p, null, 2)));
}

main().catch(console.error).finally(() => prisma.$disconnect());

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const cmy = await prisma.employee.findFirst({ where: { name: { contains: "陳美玉" } } });
  const ljy = await prisma.employee.findFirst({ where: { name: { contains: "林家燕" } } });

  if (cmy) {
    console.log("\n=== PayrollRecord for 陳美玉 in May 2026 ===");
    const pr = await prisma.payrollRecord.findUnique({
      where: {
        employeeId_year_month: { employeeId: cmy.id, year: 2026, month: 5 }
      }
    });
    console.log(JSON.stringify(pr, null, 2));
  }

  if (ljy) {
    console.log("\n=== PayrollRecord for 林家燕 in May 2026 ===");
    const pr = await prisma.payrollRecord.findUnique({
      where: {
        employeeId_year_month: { employeeId: ljy.id, year: 2026, month: 5 }
      }
    });
    console.log(JSON.stringify(pr, null, 2));
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});

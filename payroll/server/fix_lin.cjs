const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.payrollRecord.update({
    where: { id: 900 },
    data: { regularHours: 140.07, workDays: 24, leavePaySupplement: 921 }
  });
  console.log("Restored 140.07 regularHours and 24 workDays for Lin Qingyu.");
}
main().catch(console.error).finally(() => prisma.$disconnect());

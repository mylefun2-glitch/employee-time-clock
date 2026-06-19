const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const pr = await prisma.payrollRecord.findFirst({
    where: {
      employee: { name: { contains: '黃筱柔' } },
      year: 2026,
      month: 5
    }
  });
  console.log(JSON.stringify(pr, null, 2));
}

check();

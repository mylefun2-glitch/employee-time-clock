const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const emp = await prisma.employee.findFirst({
    where: { name: '黃筱柔' }
  });
  console.log(emp);
}

check().finally(() => prisma.$disconnect());

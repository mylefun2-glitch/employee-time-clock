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
  console.log("Employee:", emp.name, "employeeNo:", emp.employeeNo);
}

main().catch(console.error).finally(() => prisma.$disconnect());

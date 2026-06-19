const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const emp = await prisma.employee.findFirst({
    where: { name: { contains: '張秀卿' } }
  });

  const leaves = await prisma.leaveRecord.findMany({
    where: {
      employeeId: emp.id,
      status: 'approved',
      startDate: { lte: '2026-05-31' },
      endDate: { gte: '2026-05-01' }
    }
  });
  console.log('Leaves:', JSON.stringify(leaves, null, 2));
}

check();

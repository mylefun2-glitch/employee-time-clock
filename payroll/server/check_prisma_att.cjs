const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const emp = await prisma.employee.findFirst({
    where: {
      name: {
        contains: '張秀卿'
      }
    }
  });

  if (!emp) return console.log('Employee not found in Prisma');

  const att = await prisma.attendanceRecord.findMany({
    where: {
      employeeId: emp.id,
      date: {
        gte: '2026-05-01',
        lte: '2026-05-31'
      }
    }
  });
  console.log(`Found ${att.length} attendance records in Prisma`);
  if (att.length > 0) {
    let reg = 0;
    att.forEach(a => { reg += a.regularHours; });
    console.log('Total regularHours in Prisma:', reg);
  }
}

check();

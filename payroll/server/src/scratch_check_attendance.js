import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const ljy = await prisma.employee.findFirst({ where: { name: { contains: "林家燕" } } });

  if (ljy) {
    console.log(`\n=== SQLite AttendanceRecords for 林家燕 (ID: ${ljy.id}) ===`);
    const records = await prisma.attendanceRecord.findMany({
      where: {
        employeeId: ljy.id,
        date: { startsWith: "2026-05" }
      },
      orderBy: { date: 'asc' }
    });
    records.forEach(r => {
      console.log(`Date: ${r.date}, IN: ${r.clockIn}, OUT: ${r.clockOut}, RegHours: ${r.regularHours}, OTHours: ${r.overtimeHours}, Status: ${r.status}`);
    });
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});

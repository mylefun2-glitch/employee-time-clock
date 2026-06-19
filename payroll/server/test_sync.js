import { syncAttendanceAndLeaves } from './src/services/supabaseSync.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const emp = await prisma.employee.findFirst({
    where: { name: '林淑禎' }
  });
  if (!emp) {
    console.log("Employee not found");
    return;
  }
  console.log("Syncing attendance for Lin Shu-zhen (ID:", emp.id, ")");
  
  // Year: 2026, Month: 5, force: true, targetEmployeeId: emp.id
  await syncAttendanceAndLeaves(2026, 5, true, emp.id);
  
  const att = await prisma.attendanceRecord.findMany({
    where: { employeeId: emp.id, date: { startsWith: '2026-05' } }
  });
  console.log("Attendance records after sync:");
  console.log(att);
}

main().catch(console.error).finally(() => prisma.$disconnect());

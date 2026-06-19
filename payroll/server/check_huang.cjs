const { createClient } = require('@supabase/supabase-js');
const { PrismaClient } = require('@prisma/client');

const VITE_SUPABASE_URL = "https://dqnaeesdovovmblsyuma.supabase.co";
const VITE_SUPABASE_ANON_KEY = "sb_publishable_d0sbSqQRwllVCV7ydQNU7Q_VPQAs1tj";
const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);
const prisma = new PrismaClient();

async function check() {
  const name = '黃筱柔';

  // 1. Check Supabase
  const { data: sbEmp } = await supabase.from('employees').select('*').like('name', `%${name}%`).single();
  console.log('Supabase Employee:', sbEmp ? { id: sbEmp.id, name: sbEmp.name, salary_type: sbEmp.salary_type, username: sbEmp.username } : 'Not found');

  if (sbEmp) {
    const { data: scheds } = await supabase.from('monthly_salary_schedules')
      .select('service_date, service_mins, shift_type')
      .eq('employee_id', sbEmp.id)
      .gte('service_date', '2026-05-01')
      .lte('service_date', '2026-05-31');
    console.log(`Supabase monthly_salary_schedules count for May 2026: ${scheds?.length}`);
  }

  // 2. Check Prisma
  const prEmp = await prisma.employee.findFirst({
    where: { name: { contains: name } }
  });
  console.log('Prisma Employee:', prEmp ? { id: prEmp.id, name: prEmp.name, salaryType: prEmp.salaryType, employeeNo: prEmp.employeeNo } : 'Not found');

  if (prEmp) {
    const att = await prisma.attendanceRecord.findMany({
      where: {
        employeeId: prEmp.id,
        date: { gte: '2026-05-01', lte: '2026-05-31' }
      }
    });
    console.log(`Prisma attendanceRecords count for May 2026: ${att.length}`);

    const pr = await prisma.payrollRecord.findFirst({
      where: {
        employeeId: prEmp.id,
        year: 2026,
        month: 5
      }
    });
    console.log('PayrollRecord in Prisma for May 2026:', pr ? { 
      status: pr.status, 
      regularHours: pr.regularHours, 
      overtimeHours: pr.overtimeHours,
      workDays: pr.workDays,
      grossPay: pr.grossPay
    } : 'Not calculated yet');
  }
}

check().catch(console.error).finally(() => prisma.$disconnect());

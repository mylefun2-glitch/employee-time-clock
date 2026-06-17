import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres.dqnaeesdovovmblsyuma:Linlifeng0714@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?schema=payroll'
    }
  }
});

async function run() {
  const result = await prisma.payrollRecord.findFirst({
    where: {
      employee: { name: '林延達' },
      year: 2026,
      month: 5
    },
    orderBy: { id: 'desc' },
    include: { employee: true }
  });
  console.log(JSON.stringify(result, null, 2));
  await prisma.$disconnect();
}

run().catch(console.error);

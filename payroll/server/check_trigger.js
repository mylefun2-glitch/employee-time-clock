import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres.dqnaeesdovovmblsyuma:Linlifeng0714@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?schema=payroll'
    }
  }
});

async function run() {
  const result = await prisma.$queryRaw`
    SELECT event_object_table, trigger_name, event_manipulation, action_statement
    FROM information_schema.triggers
    WHERE event_object_table = 'PayrollRecord';
  `;
  console.log(JSON.stringify(result, null, 2));
  await prisma.$disconnect();
}

run().catch(console.error);

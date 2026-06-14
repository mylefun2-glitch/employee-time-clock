import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
dotenv.config();

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key';

async function main() {
  const token = jwt.sign({ id: 1, username: 'admin', role: 'admin' }, JWT_SECRET);

  // 1. Update Lin Yawen's June 2026 record with manual adjustments
  await prisma.payrollRecord.update({
    where: { id: 16 },
    data: {
      bonus: 5500,
      allowanceAA: 2200,
      notes: '測試API手動備註'
    }
  });

  console.log('June 2026 payroll record updated.');

  // 2. Call local server calculate endpoint
  const response = await fetch('http://localhost:3005/api/payroll/calculate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      year: '2026',
      month: '6',
      employeeIds: [18]
    })
  });

  const resJson = await response.json();
  console.log('API Response:', resJson);

  // 3. Query record to see if adjustments are preserved
  const updatedRecord = await prisma.payrollRecord.findUnique({
    where: { id: 16 }
  });

  console.log('Record after calculation:', {
    bonus: updatedRecord.bonus,
    allowanceAA: updatedRecord.allowanceAA,
    notes: updatedRecord.notes
  });

  // Restore June record back to 0
  await prisma.payrollRecord.update({
    where: { id: 16 },
    data: {
      bonus: 0,
      allowanceAA: 0,
      notes: null
    }
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

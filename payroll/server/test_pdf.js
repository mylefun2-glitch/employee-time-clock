import { PrismaClient } from '@prisma/client';
import { generatePayrollPDF } from './src/services/pdfGenerator.js';
import fs from 'fs';

const prisma = new PrismaClient();

async function run() {
  try {
    const record = await prisma.payrollRecord.findUnique({
      where: { id: 66 },
      include: { employee: true }
    });
    
    if (!record) {
      console.log('Record 66 not found');
      return;
    }

    const rawSettings = await prisma.systemSetting.findMany();
    const settings = {};
    rawSettings.forEach(s => { settings[s.key] = s.value; });

    const startDate = `${record.year}-${String(record.month).padStart(2, '0')}-01`;
    const lastDay = new Date(record.year, record.month, 0).getDate();
    const endDate = `${record.year}-${String(record.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const leaves = await prisma.leaveRecord.findMany({
      where: {
        employeeId: record.employeeId,
        startDate: { lte: endDate },
        endDate: { gte: startDate }
      }
    });

    console.log('Generating PDF for', record.employee.name);
    const pdfBuffer = await generatePayrollPDF(record, record.employee, settings, leaves);
    
    fs.writeFileSync('test_output.pdf', pdfBuffer);
    console.log('PDF successfully generated and saved to test_output.pdf');
  } catch (error) {
    console.error('Error generating PDF:', error);
  } finally {
    await prisma.$disconnect();
  }
}

run();

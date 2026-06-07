import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

/**
 * Find a Chinese font on Mac or other systems.
 */
function getChineseFont() {
  const macFonts = [
    '/System/Library/Fonts/PingFang.ttc',
    '/System/Library/Fonts/STHeiti Light.ttc',
    '/System/Library/Fonts/STHeiti Medium.ttc',
    '/System/Library/Fonts/Supplemental/Songti.ttc',
    '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
  ];

  for (const fontPath of macFonts) {
    if (fs.existsSync(fontPath)) {
      return fontPath;
    }
  }
  return null;
}

/**
 * Format number to currency format (rounded integer).
 */
function formatAmount(amount) {
  if (amount === undefined || amount === null || isNaN(amount)) return '0';
  return Math.round(amount).toString();
}

/**
 * Draw a single payroll slip onto a PDFkit document instance.
 */
export function drawPayrollSlip(doc, payrollRecord, employee, settings = {}) {
  const fontPath = getChineseFont();
  if (fontPath) {
    if (fontPath.endsWith('.ttc')) {
      doc.registerFont('Chinese', fontPath, 'PingFangTC-Regular');
    } else {
      doc.registerFont('Chinese', fontPath);
    }
    doc.font('Chinese');
  } else {
    doc.font('Helvetica');
  }

  // Title & Header
  const orgName = settings.org_name || '社團法人宜蘭縣社區照顧促進會';
  doc.fontSize(16).text(`${orgName} 薪資條`, { align: 'center', bold: true });
  doc.moveDown(0.5);

  // Period and Employee Details
  doc.fontSize(10);
  const rocYear = payrollRecord.year - 1911;
  const periodStr = `${rocYear}年${String(payrollRecord.month).padStart(2, '0')}月`;
  
  const startY = doc.y;
  doc.text(`薪資年月：${periodStr}`, 50, startY);
  doc.text(`員工姓名：${employee.name}    身分證字號：${employee.idNumber || '未登錄'}    單位：${employee.department}`, 50, startY + 16);
  doc.moveDown(1.5);

  // Hourly hours header
  if (employee.salaryType === 'hourly') {
    const totalHours = (payrollRecord.regularHours + payrollRecord.overtimeHours).toFixed(4);
    const normalHours = payrollRecord.regularHours.toFixed(4);
    
    doc.rect(40, doc.y, 515, 20).strokeColor('#e2e5ec').lineWidth(1).stroke();
    doc.text(`工時 ${totalHours} = 正常工時 ${parseFloat(normalHours)} + 加班時數 ${payrollRecord.overtimeHours.toFixed(4)}`, 50, doc.y + 5);
    doc.moveDown(1.5);
  }

  const tableTop = doc.y;
  const tableHeight = 220;
  doc.rect(40, tableTop, 515, tableHeight).strokeColor('#000000').lineWidth(1.5).stroke();
  
  // Headers line
  doc.moveTo(40, tableTop + 25).lineTo(555, tableTop + 25).stroke();
  
  // Column Dividers
  doc.moveTo(220, tableTop).lineTo(220, tableTop + tableHeight).stroke();
  doc.moveTo(385, tableTop).lineTo(385, tableTop + tableHeight).stroke();

  // Headers text
  doc.fontSize(10);
  doc.text('應發項目', 40, tableTop + 8, { align: 'center', width: 180 });
  doc.text('加班', 220, tableTop + 8, { align: 'center', width: 165 });
  doc.text('應扣項目', 385, tableTop + 8, { align: 'center', width: 170 });

  // Left Column: Earnings
  const earnings = [];
  if (employee.salaryType === 'hourly') {
    const hourlyRate = payrollRecord.baseSalary > 0 ? payrollRecord.baseSalary : employee.baseSalary;
    const regPay = Math.round(payrollRecord.regularHours * hourlyRate);
    earnings.push({ label: '平日時數', desc: `${payrollRecord.regularHours.toFixed(4)} H x`, amt: `${hourlyRate}` });
    earnings.push({ label: '底薪', desc: '', amt: regPay > 0 ? formatAmount(regPay) : '' });
    earnings.push({ label: 'AA加給', desc: '', amt: payrollRecord.allowanceAA > 0 ? formatAmount(payrollRecord.allowanceAA) : '' });
    earnings.push({ label: '證照加給', desc: '', amt: payrollRecord.allowanceLicense > 0 ? formatAmount(payrollRecord.allowanceLicense) : '' });
    earnings.push({ label: '請假補貼薪資', desc: '', amt: payrollRecord.leavePaySupplement > 0 ? formatAmount(payrollRecord.leavePaySupplement) : '' });
    earnings.push({ label: '獎金', desc: '', amt: payrollRecord.bonus > 0 ? formatAmount(payrollRecord.bonus) : '' });
    earnings.push({ label: '其他津貼', desc: '', amt: payrollRecord.otherAllowance > 0 ? formatAmount(payrollRecord.otherAllowance) : '' });
    earnings.push({ label: '其他津貼(免計)', desc: '', amt: payrollRecord.mealAllowance > 0 ? formatAmount(payrollRecord.mealAllowance) : '' });
    earnings.push({ label: '補發薪資', desc: '', amt: payrollRecord.retroPay > 0 ? formatAmount(payrollRecord.retroPay) : '' });
  } else {
    earnings.push({ label: '本薪', desc: '', amt: formatAmount(payrollRecord.baseSalary) });
    earnings.push({ label: 'AA加給', desc: '', amt: payrollRecord.allowanceAA > 0 ? formatAmount(payrollRecord.allowanceAA) : '' });
    earnings.push({ label: '專業證照', desc: '', amt: payrollRecord.allowanceLicense > 0 ? formatAmount(payrollRecord.allowanceLicense) : '' });
    earnings.push({ label: '主管加給', desc: '', amt: payrollRecord.allowanceManager > 0 ? formatAmount(payrollRecord.allowanceManager) : '' });
    earnings.push({ label: '獎金', desc: '', amt: payrollRecord.bonus > 0 ? formatAmount(payrollRecord.bonus) : '' });
    earnings.push({ label: '其他津貼', desc: '', amt: payrollRecord.otherAllowance > 0 ? formatAmount(payrollRecord.otherAllowance) : '' });
    earnings.push({ label: '其他津貼(免計)', desc: '', amt: payrollRecord.mealAllowance > 0 ? formatAmount(payrollRecord.mealAllowance) : '' });
    earnings.push({ label: '補發薪資', desc: '', amt: payrollRecord.retroPay > 0 ? formatAmount(payrollRecord.retroPay) : '' });
  }

  // Middle Column: Overtime
  let averageHourlyRate = 0;
  if (employee.salaryType === 'hourly' && payrollRecord.regularHours > 0) {
    const regHoursRounded = parseFloat(payrollRecord.regularHours.toFixed(2));
    const hourlyRate = payrollRecord.baseSalary > 0 ? payrollRecord.baseSalary : employee.baseSalary;
    const normalWageForAverage = Math.round(regHoursRounded * hourlyRate);
    averageHourlyRate = ((normalWageForAverage + payrollRecord.allowanceAA + payrollRecord.allowanceLicense + payrollRecord.otherAllowance + payrollRecord.bonus) / payrollRecord.regularHours);
    averageHourlyRate = parseFloat(averageHourlyRate.toFixed(2));
  } else if (employee.salaryType === 'monthly') {
    const fixedMonthly = payrollRecord.baseSalary + payrollRecord.allowanceAA + payrollRecord.allowanceLicense + payrollRecord.allowanceManager + payrollRecord.otherAllowance;
    averageHourlyRate = parseFloat((fixedMonthly / 240).toFixed(2));
  }

  const otList = [
    { label: '平均時薪', value: averageHourlyRate > 0 ? averageHourlyRate.toString() : '0' },
    { label: '加班倍率', value: '時數' },
    { label: '1.334', value: payrollRecord.overtimeHours134 > 0 ? payrollRecord.overtimeHours134.toFixed(4) : '0' },
    { label: '1.667', value: payrollRecord.overtimeHours167 > 0 ? payrollRecord.overtimeHours167.toFixed(4) : '0' },
    { label: '2.000', value: payrollRecord.overtimeHours200 > 0 ? payrollRecord.overtimeHours200.toFixed(4) : '0' },
    { label: '2.667', value: payrollRecord.overtimeHours267 > 0 ? payrollRecord.overtimeHours267.toFixed(4) : '0' },
    { label: '加班費', value: formatAmount(payrollRecord.overtimePay) }
  ];

  // Right Column: Deductions
  const deductions = [
    { label: '代扣勞保', amt: formatAmount(payrollRecord.laborInsuranceEmployee) },
    { label: '代扣健保', amt: formatAmount(payrollRecord.healthInsuranceEmployee) },
    { label: '自提勞退', amt: formatAmount(payrollRecord.laborPensionEmployee) },
    { label: '所得稅預扣', amt: payrollRecord.incomeTax > 0 ? formatAmount(payrollRecord.incomeTax) : '' },
    { label: '請假扣薪', amt: payrollRecord.leaveDeduction > 0 ? formatAmount(payrollRecord.leaveDeduction) : '' },
    { label: '二代健保自付', amt: payrollRecord.supplementaryHealthInsurance > 0 ? formatAmount(payrollRecord.supplementaryHealthInsurance) : '' },
    { label: '前期保險差額', amt: payrollRecord.prevInsuranceDifference !== 0 ? formatAmount(payrollRecord.prevInsuranceDifference) : '' },
    { label: '其他應扣', amt: payrollRecord.otherDeductions > 0 ? formatAmount(payrollRecord.otherDeductions) : '' }
  ];

  // Print Rows
  let yOffset = tableTop + 35;
  
  // Print Earnings
  earnings.forEach(item => {
    doc.fillColor('#000000').text(item.label, 45, yOffset);
    if (item.desc) {
      doc.text(item.desc, 110, yOffset, { align: 'right', width: 55 });
      doc.text(item.amt, 170, yOffset, { align: 'right', width: 45 });
    } else {
      doc.text(item.amt, 150, yOffset, { align: 'right', width: 65 });
    }
    yOffset += 16;
  });

  // Print Overtime
  yOffset = tableTop + 35;
  otList.forEach(item => {
    doc.fillColor('#000000').text(item.label, 225, yOffset);
    doc.text(item.value, 320, yOffset, { align: 'right', width: 60 });
    yOffset += 16;
  });

  // Print Deductions
  yOffset = tableTop + 35;
  deductions.forEach(item => {
    doc.fillColor('#000000').text(item.label, 390, yOffset);
    doc.fillColor('#ef4444').text(item.amt, 500, yOffset, { align: 'right', width: 50 });
    yOffset += 16;
  });
  doc.fillColor('#000000'); // Reset color to black

  // Totals and Net Pay section at bottom of table
  const bottomTableY = tableTop + tableHeight - 25;
  doc.moveTo(40, bottomTableY).lineTo(555, bottomTableY).stroke();
  
  doc.text(`應領薪資：${formatAmount(payrollRecord.grossPay)}`, 45, bottomTableY + 8);
  doc.text('應扣小計：', 390, bottomTableY + 8);
  doc.fillColor('#ef4444').text(formatAmount(payrollRecord.totalDeductions), 445, bottomTableY + 8);
  doc.fillColor('#000000'); // Reset color to black
  doc.moveDown(2.5);

  // Net Salary banner
  const bannerTop = doc.y;
  doc.rect(40, bannerTop, 515, 25).fill('#f2f2f2');
  doc.fillColor('#000000').fontSize(11).text(`實領薪資：${formatAmount(payrollRecord.netPay)}`, 50, bannerTop + 7, { bold: true });
  doc.fontSize(10);
  doc.moveDown(1.5);

  // Notes
  const notesTop = doc.y;
  doc.text('備註：', 50, notesTop);
  let notesY = notesTop + 14;

  if (employee.salaryType === 'hourly') {
    const hourlyRate = payrollRecord.baseSalary > 0 ? payrollRecord.baseSalary : employee.baseSalary;
    const regHoursRounded = parseFloat(payrollRecord.regularHours.toFixed(2));
    const normalWage = Math.round(regHoursRounded * hourlyRate);
    
    doc.text(`● 平均時薪 ${averageHourlyRate} = ( 正常薪資 ${normalWage} + AA加給 ${formatAmount(payrollRecord.allowanceAA)} + 證照加給 ${formatAmount(payrollRecord.allowanceLicense)} + 其他津貼 ${formatAmount(payrollRecord.otherAllowance)} + 績效接案 ${formatAmount(payrollRecord.bonus)} ) / 正常工時 ${regHoursRounded} 小時`, 50, notesY);
    notesY += 14;
    
    if (payrollRecord.mealAllowance > 0) {
      doc.text(`● 其他津貼 (不列入平均時薪)：${formatAmount(payrollRecord.mealAllowance)}`, 50, notesY);
      notesY += 14;
    }
  } else {
    if (payrollRecord.bonus > 0) {
      doc.text(`● 獎金：${formatAmount(payrollRecord.bonus)} <績效獎金>`, 50, notesY);
      notesY += 14;
    }
    if (payrollRecord.leaveDeduction > 0) {
      const hours = payrollRecord.leaveDays * 8;
      doc.text(`● 請假：${formatAmount(payrollRecord.leaveDeduction)} 元 <${formatAmount(payrollRecord.baseSalary + payrollRecord.allowanceAA + payrollRecord.allowanceLicense + payrollRecord.allowanceManager + payrollRecord.otherAllowance)}/30/8 X (請假${hours}H)>`, 50, notesY);
      notesY += 14;
    }
  }

  // Grades
  doc.text(`● 本月投保級距：`, 50, notesY);
  notesY += 14;
  doc.text(`勞保：${formatAmount(payrollRecord.laborInsuranceGrade)} 、 職保：${formatAmount(payrollRecord.laborOccupationalGrade)} 、 勞退：${formatAmount(payrollRecord.laborPensionGrade)} 、 健保：${formatAmount(payrollRecord.healthInsuranceGrade)}`, 60, notesY);
  notesY += 14;

  // Employer Costs
  doc.text(`● 本月雇主負擔：`, 50, notesY);
  notesY += 14;
  doc.text(`勞保：${formatAmount(payrollRecord.laborInsuranceEmployer)} 、 職保：${formatAmount(payrollRecord.laborOccupationalEmployer)} 、 勞退：${formatAmount(payrollRecord.laborPensionEmployer)} 、 健保：${formatAmount(payrollRecord.healthInsuranceEmployer)}`, 60, notesY);
  notesY += 25;

  // Signature line
  doc.text('製表人: _________________', 50, notesY);
  doc.text('主管核准: _________________', 220, notesY);
  doc.text('員工簽收: _________________', 390, notesY);
}

/**
 * Generate PDF for a payroll record.
 */
export function generatePayrollPDF(payrollRecord, employee, settings = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks = [];
      
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', err => reject(err));

      drawPayrollSlip(doc, payrollRecord, employee, settings);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

export default {
  drawPayrollSlip,
  generatePayrollPDF,
};

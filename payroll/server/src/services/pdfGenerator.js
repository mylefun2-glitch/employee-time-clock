import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import https from 'https';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BUNDLED_FONT_PATH = path.join(__dirname, '../assets/fonts/NotoSansTC-Regular.ttf');

const FONT_TEMP_PATH = path.join(os.tmpdir(), 'NotoSansTC-Regular.ttf');
const FONT_URL = 'https://fonts.gstatic.com/s/notosanstc/v39/-nFuOG829Oofr2wohFbTp9ifNAn722rq0MXz76Cy_Co.ttf';

/**
 * Downloads Noto Sans TC font from Google CDN if it does not already exist locally.
 */
export function ensureFontDownloaded() {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(FONT_TEMP_PATH)) {
      return resolve(FONT_TEMP_PATH);
    }
    console.log(`[Font] Downloading Chinese font to ${FONT_TEMP_PATH}...`);
    const file = fs.createWriteStream(FONT_TEMP_PATH);
    https.get(FONT_URL, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download font: status code ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close(() => {
          console.log('[Font] Chinese font downloaded successfully.');
          resolve(FONT_TEMP_PATH);
        });
      });
    }).on('error', (err) => {
      fs.unlink(FONT_TEMP_PATH, () => {});
      reject(err);
    });
  });
}

/**
 * Robustly apply a Chinese font for the PDF document with multiple fallbacks.
 */
function applyChineseFont(doc) {
  const fontsToTry = [
    // Bundled font (highest priority)
    { path: BUNDLED_FONT_PATH },
    // macOS
    { path: '/System/Library/Fonts/Supplemental/Songti.ttc', postscript: 'STSong' },
    { path: '/System/Library/Fonts/PingFang.ttc', postscript: 'PingFangTC-Regular' },
    { path: '/System/Library/Fonts/STHeiti Light.ttc', postscript: 'STHeiti-Light' },
    { path: '/System/Library/Fonts/STHeiti Medium.ttc', postscript: 'STHeiti-Medium' },
    { path: '/System/Library/Fonts/Supplemental/Arial Unicode.ttf' },
    { path: '/Library/Fonts/Arial Unicode.ttf' },
    // Linux
    { path: '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc', postscript: 'WenQuanYiMicroHei' },
    { path: '/usr/share/fonts/truetype/wqy/wqy-microhei.ttf' },
    { path: '/usr/share/fonts/wqy-microhei/wqy-microhei.ttc', postscript: 'WenQuanYiMicroHei' },
    { path: '/usr/share/fonts/wqy-microhei/wqy-microhei.ttf' },
    { path: '/usr/share/fonts/truetype/droid/DroidSansFallback.ttf' },
    // Windows
    { path: 'C:\\Windows\\Fonts\\msjh.ttc', postscript: 'MicrosoftJhengHeiRegular' },
    { path: 'C:\\Windows\\Fonts\\msjh.ttf' },
    // Temp downloaded font (Render/Linux fallback)
    { path: FONT_TEMP_PATH }
  ];

  for (const font of fontsToTry) {
    if (fs.existsSync(font.path)) {
      try {
        if (font.postscript) {
          doc.registerFont('Chinese', font.path, font.postscript);
        } else {
          doc.registerFont('Chinese', font.path);
        }
        doc.font('Chinese');
        return true;
      } catch (err) {
        // Fallback to next font
      }
    }
  }

  // Fallback to standard Helvetica if no Chinese font can be loaded
  doc.font('Helvetica');
  return false;
}

/**
 * Format number to currency format (rounded integer).
 */
function formatAmount(amount) {
  if (amount === undefined || amount === null || isNaN(amount)) return '0';
  return Math.round(parseFloat(parseFloat(amount).toFixed(4))).toString();
}

/**
 * Draw a single payroll slip onto a PDFkit document instance.
 */
export function drawPayrollSlip(doc, payrollRecord, employee, settings = {}, leaves = []) {
  applyChineseFont(doc);

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
    const regHoursRounded = parseFloat(payrollRecord.regularHours.toFixed(4));
    const hourlyRate = payrollRecord.baseSalary > 0 ? payrollRecord.baseSalary : employee.baseSalary;
    const normalWageForAverage = Math.round(regHoursRounded * hourlyRate);
    averageHourlyRate = ((normalWageForAverage + payrollRecord.allowanceAA + payrollRecord.allowanceLicense + payrollRecord.otherAllowance + payrollRecord.bonus) / payrollRecord.regularHours);
    averageHourlyRate = parseFloat(averageHourlyRate.toFixed(2));
  } else if (employee.salaryType === 'monthly') {
    const fixedMonthly = payrollRecord.baseSalary + payrollRecord.allowanceAA + payrollRecord.allowanceLicense + payrollRecord.allowanceManager + payrollRecord.otherAllowance;
    // Include performance bonus (績效獎金) in average hourly rate
    averageHourlyRate = parseFloat(((fixedMonthly + payrollRecord.bonus) / (30 * (employee.standardDailyHours || 8))).toFixed(2));
  }

  const otList = [
    { label: '平均時薪', value: averageHourlyRate > 0 ? averageHourlyRate.toString() : '0' },
    { label: '加班倍率', value: '時數' },
    { label: '1.334', value: payrollRecord.overtimeHours134 > 0 ? payrollRecord.overtimeHours134.toFixed(4) : '0' },
    { label: '1.667', value: payrollRecord.overtimeHours167 > 0 ? payrollRecord.overtimeHours167.toFixed(4) : '0' },
    { label: employee.salaryType === 'monthly' ? '加發1.000' : '2.000', value: payrollRecord.overtimeHours200 > 0 ? payrollRecord.overtimeHours200.toFixed(4) : '0' },
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
    const regHoursRounded = parseFloat(payrollRecord.regularHours.toFixed(4));
    const normalWage = Math.round(regHoursRounded * hourlyRate);
    
    doc.text(`● 平均時薪 ${averageHourlyRate} = ( 正常薪資 ${normalWage} + AA加給 ${formatAmount(payrollRecord.allowanceAA)} + 證照加給 ${formatAmount(payrollRecord.allowanceLicense)} + 其他津貼 ${formatAmount(payrollRecord.otherAllowance)} + 績效接案 ${formatAmount(payrollRecord.bonus)} ) / 正常工時 ${regHoursRounded} 小時`, 50, notesY);
    notesY += 14;
    
    if (payrollRecord.mealAllowance > 0) {
      doc.text(`● 其他津貼 (不列入平均時薪)：${formatAmount(payrollRecord.mealAllowance)}`, 50, notesY);
      notesY += 14;
    }
  } else {
    // 1. Leave Deduction Formula (請假扣薪計算公式)
    const baseVal = payrollRecord.baseSalary;
    const bonusVal = payrollRecord.bonus || 0;
    const fixedAdd = (payrollRecord.allowanceAA || 0) + (payrollRecord.allowanceLicense || 0) + (payrollRecord.allowanceManager || 0) + (payrollRecord.otherAllowance || 0) + bonusVal;

    let leaveRules = [];
    try {
      if (settings.leave_deduction_rules) {
        leaveRules = JSON.parse(settings.leave_deduction_rules);
      }
    } catch (err) {
      // ignore
    }
    const getLeaveRate = (leaveType) => {
      const typeStr = (leaveType || '').trim().toLowerCase();
      const rule = leaveRules.find(r => {
        const ruleType = (r.leaveType || '').trim().toLowerCase();
        const ruleLabel = (r.label || '').trim().toLowerCase();
        return typeStr === ruleType || typeStr === ruleLabel || typeStr.includes(ruleType) || ruleType.includes(typeStr);
      });
      return rule ? parseFloat(rule.rate) : 1.0;
    };

    const normalLeaves = leaves.filter(l => {
      const type = (l.leaveType || '').toLowerCase();
      const isOt = type === 'co' || type === 'alc' || type.includes('折算') || type.includes('折現') || type === 'ot' || type === '加班';
      const isOfficial = type.includes('公出') || type.includes('家訪') || type.includes('出差') || type.includes('會議') || type.includes('訓練') || type.includes('培訓') || type === 'ob' || type.includes('挪移') || type.includes('派案') || type.includes('個督');
      if (isOt || isOfficial) return false;
      return getLeaveRate(l.leaveType) > 0.0;
    });

    if (payrollRecord.leaveDeduction > 0 && normalLeaves.length > 0) {
      const standardHours = employee.standardDailyHours || 8;
      const totalWeightedHours = normalLeaves.reduce((sum, l) => sum + (l.days * 8 * getLeaveRate(l.leaveType)), 0);
      const formulaText = `● 請假扣薪計算公式：round( 平均時薪 ${averageHourlyRate} × Sum(時數 × 扣薪比例) )`;
      doc.text(formulaText, 50, notesY);
      notesY += 14;

      const detailParts = normalLeaves.map(l => `${l.leaveType} ${l.days * 8}H × ${Math.round(getLeaveRate(l.leaveType) * 100)}%`);
      doc.text(`  計算方式：round( ${averageHourlyRate} × (${detailParts.join(' + ')}) )`, 50, notesY);
      notesY += 14;
      doc.text(`  = round( ${averageHourlyRate} × ${totalWeightedHours}H ) = -${formatAmount(payrollRecord.leaveDeduction)} 元`, 50, notesY);
      notesY += 14;
    } else if (payrollRecord.leaveDeduction > 0) {
      const hours = payrollRecord.leaveDays * 8;
      doc.text(`  實際請假扣薪：${formatAmount(payrollRecord.leaveDeduction)} 元 (請假時數 ${hours}H)`, 50, notesY);
      notesY += 14;
    }

    if (payrollRecord.overtimePay > 0) {
      const otMultiplier200 = employee.salaryType === 'monthly' ? 1.00 : 2.00;
      const ot134Str = payrollRecord.overtimeHours134 > 0 ? `${payrollRecord.overtimeHours134}H × 1.334` : '';
      const ot167Str = payrollRecord.overtimeHours167 > 0 ? `${payrollRecord.overtimeHours167}H × 1.667` : '';
      const ot267Str = payrollRecord.overtimeHours267 > 0 ? `${payrollRecord.overtimeHours267}H × 2.667` : '';
      const ot200Str = payrollRecord.overtimeHours200 > 0 ? `${payrollRecord.overtimeHours200}H × ${otMultiplier200.toFixed(3)}` : '';
      
      const terms = [ot134Str, ot167Str, ot200Str, ot267Str].filter(t => t);
      
      const sumWeightedHours = (
        (payrollRecord.overtimeHours134 || 0) * 1.334 + 
        (payrollRecord.overtimeHours167 || 0) * 1.667 + 
        (payrollRecord.overtimeHours267 || 0) * 2.667 + 
        (payrollRecord.overtimeHours200 || 0) * otMultiplier200
      ).toFixed(3);

      if (terms.length > 0) {
        const formulaText = `● 加班費計算公式：round( 平均時薪 ${averageHourlyRate} × Sum(時數 × 倍率) )`;
        doc.text(formulaText, 50, notesY);
        notesY += 14;

        doc.text(`  計算方式：round( ${averageHourlyRate} × (${terms.join(' + ')}) )`, 50, notesY);
        notesY += 14;
        
        doc.text(`  = round( ${averageHourlyRate} × ${sumWeightedHours}H ) = ${formatAmount(payrollRecord.overtimePay)} 元`, 50, notesY);
        notesY += 14;
      }
    }
  }

  // 2. Custom notes explaining adjustments (allowance reasons, other deductions, bonus reasons, retro pay reasons)
  if (payrollRecord.notes) {
    const customNotesText = `● 調整及備註說明：${payrollRecord.notes}`;
    doc.text(customNotesText, 50, notesY, { width: 500 });
    const textHeight = doc.heightOfString(customNotesText, { width: 500 });
    notesY += textHeight + 6;
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
export function generatePayrollPDF(payrollRecord, employee, settings = {}, leaves = []) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks = [];
      
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', err => reject(err));

      drawPayrollSlip(doc, payrollRecord, employee, settings, leaves);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

export default {
  drawPayrollSlip,
  generatePayrollPDF,
  ensureFontDownloaded,
};

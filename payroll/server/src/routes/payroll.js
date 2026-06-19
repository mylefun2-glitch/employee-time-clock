import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireFields, validateId, validateYearMonth } from '../middleware/validate.js';
import { calculatePayroll } from '../services/payrollCalculator.js';
import { generatePayrollPDF, drawPayrollSlip } from '../services/pdfGenerator.js';
import { syncAttendanceAndLeaves, syncEmployees } from '../services/supabaseSync.js';
import { lookupLaborInsuranceGrade, lookupHealthInsuranceGrade } from '../services/insuranceCalculator.js';
import { supabase } from '../services/supabase.js';

const HOLIDAYS_2025_2026 = new Set([
  // 2025
  '2025-01-01', '2025-01-27', '2025-01-28', '2025-01-29', '2025-01-30', '2025-01-31', '2025-02-01', '2025-02-02', '2025-02-28', '2025-04-03', '2025-04-04', '2025-05-01', '2025-05-30', '2025-05-31', '2025-10-06', '2025-10-10', '2025-12-25',
  // 2026
  '2026-01-01', '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19', '2026-02-20', '2026-02-21', '2026-02-22', '2026-02-27', '2026-02-28', '2026-04-03', '2026-04-04', '2026-04-05', '2026-04-06', '2026-05-01', '2026-06-19', '2026-09-25', '2026-09-28', '2026-10-09', '2026-10-10', '2026-12-25'
]);

function isHoliday(dateStr) {
  return HOLIDAYS_2025_2026.has(dateStr);
}

// Helper to recalculate leave deductions based on updated wages/allowances
async function getRecalculatedLeaveDeduction(prisma, employeeId, year, month, baseSalary, allowanceAA, allowanceLicense, allowanceManager, otherAllowance, bonus, salaryType, settings) {
  if (salaryType !== 'monthly') {
    return 0;
  }

  const monthStr = String(month).padStart(2, '0');
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const lastDay = new Date(nextYear, nextMonth - 1, 0).getDate();
  const lastDayStr = String(lastDay).padStart(2, '0');

  // Fetch approved leaves
  const leaves = await prisma.leaveRecord.findMany({
    where: {
      employeeId: employeeId,
      status: 'approved',
      startDate: { lte: `${year}-${monthStr}-${lastDayStr}` },
      endDate: { gte: `${year}-${monthStr}-01` }
    }
  });

  if (leaves.length === 0) {
    return 0;
  }

  // Parse leave rules from settings
  let leaveRules = [];
  try {
    if (settings.leave_deduction_rules) {
      leaveRules = JSON.parse(settings.leave_deduction_rules);
    }
  } catch (err) {
    console.error('Failed to parse leave deduction rules:', err);
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

  const hourlyLeaveRate = (baseSalary + allowanceAA + allowanceLicense + allowanceManager + otherAllowance + bonus) / 240;
  let totalWeightedHours = 0;

  leaves.forEach(l => {
    const type = (l.leaveType || '').toLowerCase();
    const isOfficial = type === 'co' || type === 'alc' || type.includes('折算') || type.includes('折現') || type === 'ot' || type === '加班' || type.includes('公出') || type.includes('家訪') || type.includes('出差') || type.includes('會議') || type.includes('訓練') || type.includes('培訓') || type.includes('挪移') || type.includes('派案') || type.includes('個督');
    if (!isOfficial) {
      const hours = l.days * 8;
      const rate = getLeaveRate(l.leaveType);
      totalWeightedHours += hours * rate;
    }
  });

  return Math.round(hourlyLeaveRate * totalWeightedHours);
}

// Helper to fetch versioned standard daily hours from Supabase employee_schedules or employees
async function getStandardHoursForEmployee(employeeName, year, month) {
  try {
    const y = parseInt(year);
    const m = parseInt(month);
    const monthStr = String(m).padStart(2, '0');
    const nextMonth = m === 12 ? 1 : m + 1;
    const nextYear = m === 12 ? y + 1 : y;
    const lastDay = new Date(nextYear, nextMonth - 1, 0).getDate();
    const endDate = `${y}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

    const { data: sbEmp } = await supabase
      .from('employees')
      .select('id, standard_daily_hours')
      .eq('name', employeeName)
      .single();
    
    if (sbEmp) {
      const { data: sbSched } = await supabase
        .from('employee_schedules')
        .select('standard_daily_hours')
        .eq('employee_id', sbEmp.id)
        .lte('effective_date', endDate)
        .order('effective_date', { ascending: false })
        .limit(1);
      if (sbSched && sbSched.length > 0 && sbSched[0].standard_daily_hours !== null) {
        return parseFloat(sbSched[0].standard_daily_hours) || 8;
      }
      return parseFloat(sbEmp.standard_daily_hours) || 8;
    }
  } catch (err) {
    console.error('Failed to get standard hours for', employeeName, err);
  }
  return 8;
}

// Helper to compute fresh attendance summary for a given employee and month
async function getFreshAttendanceSummary(prisma, employee, year, month, overrides = {}, settings, standardHoursOverride = null) {
  const y = parseInt(year);
  const m = parseInt(month);
  const monthStr = String(m).padStart(2, '0');
  const nextMonth = m === 12 ? 1 : m + 1;
  const nextYear = m === 12 ? y + 1 : y;
  const lastDay = new Date(nextYear, nextMonth - 1, 0).getDate();
  const lastDayStr = String(lastDay).padStart(2, '0');

  let standardHours = standardHoursOverride;
  if (!standardHours) {
    standardHours = await getStandardHoursForEmployee(employee.name, y, m);
  }

  // Fetch attendance records from local DB
  const attendanceRecords = await prisma.attendanceRecord.findMany({
    where: {
      employeeId: employee.id,
      date: {
        gte: `${y}-${monthStr}-01`,
        lte: `${y}-${monthStr}-${lastDayStr}`
      }
    }
  });

  // Fetch approved leaves from local DB
  const leaves = await prisma.leaveRecord.findMany({
    where: {
      employeeId: employee.id,
      status: 'approved',
      startDate: { lte: `${y}-${monthStr}-${lastDayStr}` },
      endDate: { gte: `${y}-${monthStr}-01` }
    }
  });

  // Parse leave rules from settings
  let leaveRules = [];
  try {
    if (settings.leave_deduction_rules) {
      leaveRules = JSON.parse(settings.leave_deduction_rules);
    }
  } catch (err) {
    console.error('Failed to parse leave deduction rules:', err);
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

  const getLeaveDeductionType = (leaveType) => {
    const typeStr = (leaveType || '').trim().toLowerCase();
    const rule = leaveRules.find(r => {
      const ruleType = (r.leaveType || '').trim().toLowerCase();
      const ruleLabel = (r.label || '').trim().toLowerCase();
      return typeStr === ruleType || typeStr === ruleLabel || typeStr.includes(ruleType) || ruleType.includes(typeStr);
    });
    return rule ? rule.deductionType : 'full';
  };

  // Split leaves into normal leaves and overtime conversion leaves
  const normalLeaves = [];
  const otLeaves = [];
  leaves.forEach(l => {
    const type = (l.leaveType || '').toLowerCase();
    if (type.includes('特休') && (type.includes('折現') || type.includes('折算') || type.includes('不休假'))) {
      // Skip special leave cashout as requested
    } else if (type === 'co' || type === 'alc' || type.includes('折算') || type.includes('折現')) {
      otLeaves.push(l);
    } else if (type === 'ot' || type === '加班') {
      // Skip
    } else if (
      type.includes('公出') ||
      type.includes('家訪') ||
      type.includes('出差') ||
      type.includes('會議') ||
      type.includes('訓練') ||
      type.includes('培訓') ||
      type.includes('挪移') ||
      type.includes('派案') ||
      type.includes('個督') ||
      type === 'ob'
    ) {
      // Skip official
    } else {
      normalLeaves.push(l);
    }
  });

  let leaveDays = 0;
  normalLeaves.forEach(l => {
    if (getLeaveRate(l.leaveType) > 0.0) {
      leaveDays += l.days;
    }
  });

  // Calculate workDays and regularHours
  let workDays = 0;
  let regularHours = 0;
  let absentDays = 0;

  if (employee.salaryType === 'hourly') {
    if (attendanceRecords.length > 0) {
      attendanceRecords.forEach(att => {
        regularHours += att.regularHours;
        if (att.status === 'present' || att.clockIn || att.clockOut) {
          workDays++;
        } else if (att.status === 'absent') {
          absentDays++;
        }
      });
    } else {
      try {
        // Use email (more reliable than name) to find the Supabase UUID
        const sbQuery = supabase.from('employees').select('id');
        if (employee.email) {
          sbQuery.eq('username', employee.email);
        } else {
          sbQuery.eq('name', employee.name);
        }
        const { data: sbEmp } = await sbQuery.limit(1);
        if (sbEmp && sbEmp.length > 0) {
          const { data: scheds } = await supabase
            .from('monthly_salary_schedules')
            .select('service_date, service_mins, shift_type')
            .eq('employee_id', sbEmp[0].id)
            .gte('service_date', `${y}-${monthStr}-01`)
            .lte('service_date', `${y}-${monthStr}-${lastDayStr}`);
          
          if (scheds && scheds.length > 0) {
            const dailyData = {};
            scheds.forEach(s => {
              if (s.service_mins > 0) {
                if (!dailyData[s.service_date]) {
                  dailyData[s.service_date] = { mins: 0, types: new Set() };
                }
                dailyData[s.service_date].mins += s.service_mins;
                if (s.shift_type) dailyData[s.service_date].types.add(s.shift_type);
              }
            });
            
            for (const date of Object.keys(dailyData)) {
              workDays++;
              const hrs = dailyData[date].mins / 60;
              const types = Array.from(dailyData[date].types);
              const isNatHoliday = types.some(t => t.includes('國假') || t.includes('國定假日'));
              const isRoutineDayOff = types.some(t => t.includes('例假日'));
              const isRestDay = types.some(t => t.includes('休息日'));
              
              if (isNatHoliday || isRoutineDayOff) {
                overtimeHours += hrs;
                overtimeHours200 += hrs;
              } else if (isRestDay) {
                overtimeHours += hrs;
                overtimeHours134 += Math.min(2, hrs);
                overtimeHours167 += Math.min(6, Math.max(0, hrs - 2));
                overtimeHours267 += Math.max(0, hrs - 8);
              } else {
                if (hrs > 8) {
                  regularHours += 8;
                  const dailyOt = hrs - 8;
                  overtimeHours += dailyOt;
                  overtimeHours134 += Math.min(2, dailyOt);
                  overtimeHours167 += Math.min(6, Math.max(0, dailyOt - 2));
                  overtimeHours267 += Math.max(0, dailyOt - 8);
                } else {
                  regularHours += hrs;
                }
              }
            }
            
            regularHours = parseFloat(regularHours.toFixed(2));
            overtimeHours = parseFloat(overtimeHours.toFixed(2));
            overtimeHours134 = parseFloat(overtimeHours134.toFixed(2));
            overtimeHours167 = parseFloat(overtimeHours167.toFixed(2));
            overtimeHours200 = parseFloat(overtimeHours200.toFixed(2));
            overtimeHours267 = parseFloat(overtimeHours267.toFixed(2));
          } else {
            workDays = 0; regularHours = 0;
          }
        } else {
          workDays = 0; regularHours = 0;
        }
      } catch (err) {
        console.error('Error fetching fallback schedules:', err);
        workDays = 0; regularHours = 0;
      }
    }
  } else {
    const daysInMonth = new Date(y, m, 0).getDate();
    let weekdays = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const day = new Date(y, m - 1, d).getDay();
      if (day !== 0 && day !== 6) weekdays++;
    }
    workDays = weekdays;
    regularHours = weekdays * standardHours;
    
    attendanceRecords.forEach(att => {
      if (att.status === 'absent') {
        absentDays++;
      }
    });
  }

  // Calculate Overtime Hours
  let overtimeHours = 0;
  let overtimeHours134 = 0;
  let overtimeHours167 = 0;
  let overtimeHours200 = 0;
  let overtimeHours267 = 0;

  otLeaves.forEach(l => {
    const otHrs = parseFloat((l.days * 8).toFixed(2));
    const isNatHoliday = isHoliday(l.startDate) || isHoliday(l.endDate) || (l.reason && (l.reason.includes('國假') || l.reason.includes('國定假日')));
    
    let dayOfWeek = new Date(l.endDate).getDay(); 
    if (!isNatHoliday && new Date(l.startDate).getDay() === 6) {
      dayOfWeek = 6;
    } else if (!isNatHoliday && new Date(l.startDate).getDay() === 0) {
      dayOfWeek = 0;
    }

    if (isNatHoliday) {
      if (employee.salaryType === 'monthly') {
        const actualHrs = Math.max(standardHours, otHrs);
        overtimeHours += actualHrs;
        overtimeHours200 += standardHours;
        if (actualHrs > standardHours) {
          overtimeHours134 += (actualHrs - standardHours);
        }
      } else {
        overtimeHours += otHrs;
        overtimeHours200 += otHrs;
      }
    } else if (dayOfWeek === 0) {
      overtimeHours += otHrs;
      overtimeHours200 += otHrs;
    } else if (dayOfWeek === 6) {
      overtimeHours += otHrs;
      const ot134 = Math.min(2, otHrs);
      const ot167 = Math.min(6, Math.max(0, otHrs - 2));
      const ot267 = Math.max(0, otHrs - standardHours);
      overtimeHours134 += ot134;
      overtimeHours167 += ot167;
      overtimeHours267 += ot267;
    } else {
      overtimeHours += otHrs;
      const ot134 = Math.min(2, otHrs);
      const ot167 = Math.max(0, otHrs - 2);
      overtimeHours134 += ot134;
      overtimeHours167 += ot167;
    }
  });

  overtimeHours = parseFloat(overtimeHours.toFixed(2));
  overtimeHours134 = parseFloat(overtimeHours134.toFixed(2));
  overtimeHours167 = parseFloat(overtimeHours167.toFixed(2));
  overtimeHours200 = parseFloat(overtimeHours200.toFixed(2));
  overtimeHours267 = parseFloat(overtimeHours267.toFixed(2));

  // Hourly supplement hours
  let leaveHoursHalf = 0;
  let leaveHoursPaid = 0;
  if (employee.salaryType !== 'monthly') {
    normalLeaves.forEach(l => {
      const hours = l.days * 8;
      const dedType = getLeaveDeductionType(l.leaveType);
      if (dedType === 'half') {
        leaveHoursHalf += hours;
      } else if (dedType === 'none') {
        leaveHoursPaid += hours;
      }
    });
  }

  // Leave deduction calculation (Sum weighted hours first, then round)
  let leaveDeduction = 0;
  if (employee.salaryType === 'monthly') {
    const baseSalary = overrides.baseSalary !== undefined ? overrides.baseSalary : employee.baseSalary;
    const allowanceAA = overrides.allowanceAA !== undefined ? overrides.allowanceAA : (employee.allowanceAA || 0);
    const allowanceLicense = overrides.allowanceLicense !== undefined ? overrides.allowanceLicense : (employee.allowanceLicense || 0);
    const allowanceManager = overrides.allowanceManager !== undefined ? overrides.allowanceManager : (employee.allowanceManager || 0);
    const otherAllowance = overrides.otherAllowance !== undefined ? overrides.otherAllowance : (employee.otherAllowance || 0);
    const bonus = overrides.bonus !== undefined ? overrides.bonus : 0;

    const hourlyLeaveRate = (baseSalary + allowanceAA + allowanceLicense + allowanceManager + otherAllowance + bonus) / (30 * standardHours);
    let totalWeightedHours = 0;
    normalLeaves.forEach(l => {
      const hours = l.days * 8;
      const rate = getLeaveRate(l.leaveType);
      totalWeightedHours += hours * rate;
    });
    leaveDeduction = Math.round(hourlyLeaveRate * totalWeightedHours);
  }

  return {
    workDays,
    leaveDays,
    absentDays,
    regularHours,
    overtimeHours,
    overtimeHours134,
    overtimeHours167,
    overtimeHours200,
    overtimeHours267,
    leaveHoursHalf,
    leaveHoursPaid,
    leaveDeduction
  };
}

// Helper to fetch active schedules from Supabase for a given month and build mappings
async function fetchActiveSchedulesForMonth(y, m) {
  try {
    const monthStr = String(m).padStart(2, '0');
    const nextMonth = m === 12 ? 1 : m + 1;
    const nextYear = m === 12 ? y + 1 : y;
    const lastDay = new Date(nextYear, nextMonth - 1, 0).getDate();
    const endDate = `${y}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

    // 1. Fetch all employees from Supabase to build UUID mapping
    const { data: sbEmployees, error: sbEmpError } = await supabase
      .from('employees')
      .select('id, username');
    if (sbEmpError) throw sbEmpError;

    const uuidToEmpNo = {};
    sbEmployees.forEach(sbEmp => {
      let employeeNo = '';
      if (sbEmp.username && sbEmp.username.includes('@')) {
        employeeNo = sbEmp.username.split('@')[0].toUpperCase();
      } else {
        employeeNo = `EMP-${sbEmp.id.substring(0, 4).toUpperCase()}`;
      }
      uuidToEmpNo[sbEmp.id] = employeeNo;
    });

    // 2. Fetch schedules from Supabase effective on or before endDate
    // Order by effective_date DESC so that the first record we find is the most recent
    const { data: sbSchedules, error: schedError } = await supabase
      .from('employee_schedules')
      .select('*')
      .lte('effective_date', endDate)
      .order('effective_date', { ascending: false });
    if (schedError) throw schedError;

    const activeSchedules = {};
    sbSchedules.forEach(sched => {
      const empNo = uuidToEmpNo[sched.employee_id];
      if (empNo && !activeSchedules[empNo]) {
        activeSchedules[empNo] = {
          salaryType: (sched.salary_type || 'MONTHLY').toLowerCase(),
          baseSalary: (sched.salary_type || 'MONTHLY').toUpperCase() === 'HOURLY'
            ? (parseFloat(sched.hourly_rate) || 0)
            : (parseFloat(sched.base_salary) || 0),
          allowanceManager: parseFloat(sched.allowance_manager) || 0,
          allowanceLicense: parseFloat(sched.allowance_license) || 0,
          otherAllowance: parseFloat(sched.other_allowance) || 0,
          standardDailyHours: parseFloat(sched.standard_daily_hours) || 8
        };
      }
    });

    return activeSchedules;
  } catch (err) {
    console.error('Error fetching active schedules from Supabase:', err);
    return {};
  }
}
import PDFDocument from 'pdfkit';

// Helper to calculate rolling average of M-4 to M-2 wages in memory
function getRollingInsuranceGrades(emp, pastRecords) {
  let avgWage = 0;
  if (pastRecords && pastRecords.length > 0) {
    const sumWages = pastRecords.reduce((sum, r) => sum + (r.grossPay - r.mealAllowance), 0);
    avgWage = sumWages / pastRecords.length;
  } else {
    // Fallback to current settings (exclude mealAllowance)
    avgWage = (emp.salaryType === 'hourly' ? 0 : emp.baseSalary) +
              (emp.allowanceAA || 0) +
              (emp.allowanceLicense || 0) +
              (emp.allowanceManager || 0) +
              (emp.otherAllowance || 0);
  }

  const laborGrade = emp.laborInsuranceGrade === -1
    ? -1
    : (emp.laborInsuranceGrade > 0
        ? emp.laborInsuranceGrade
        : lookupLaborInsuranceGrade(avgWage));

  const healthGrade = emp.healthInsuranceGrade === -1
    ? -1
    : (emp.healthInsuranceGrade > 0
        ? emp.healthInsuranceGrade
        : lookupHealthInsuranceGrade(avgWage));

  const pensionGrade = emp.laborPensionGrade === -1
    ? -1
    : (emp.laborPensionGrade > 0
        ? emp.laborPensionGrade
        : lookupHealthInsuranceGrade(avgWage));

  const occupationalGrade = emp.laborOccupationalGrade === -1
    ? -1
    : (emp.laborOccupationalGrade > 0
        ? emp.laborOccupationalGrade
        : lookupLaborInsuranceGrade(avgWage));

  return {
    laborInsuranceGrade: laborGrade,
    healthInsuranceGrade: healthGrade,
    laborPensionGrade: pensionGrade,
    laborOccupationalGrade: occupationalGrade
  };
}

// Helper to run database promises in small chunks to avoid database connection pool exhaustion
async function runInBatches(tasks, batchSize = 5) {
  const results = [];
  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(taskFn => taskFn()));
    results.push(...batchResults);
  }
  return results;
}

const router = Router();
router.use(authenticate);

/**
 * GET /api/payroll
 * List payroll records with filters.
 */
router.get('/', validateYearMonth, async (req, res) => {
  try {
    const { year, month } = req.yearMonth;
    const { status, department } = req.query;

    const where = { year, month };
    if (status) where.status = status;
    if (department) {
      where.employee = { department };
    }

    const records = await req.prisma.payrollRecord.findMany({
      where,
      include: {
        employee: {
          select: { id: true, employeeNo: true, name: true, department: true, position: true, salaryType: true }
        }
      },
      orderBy: [
        { employee: { department: 'asc' } },
        { employee: { name: 'asc' } }
      ]
    });

    res.json({ data: records, total: records.length });
  } catch (error) {
    console.error('List payroll error:', error);
    res.status(500).json({ error: '取得薪資紀錄失敗' });
  }
});

/**
 * POST /api/payroll/calculate
 * Calculate payroll for all active employees for a given period.
 */
router.post('/calculate', requireFields('year', 'month'), async (req, res) => {
  try {
    const { year, month, employeeIds, settings: customSettings, skipSync } = req.body;
    const y = parseInt(year);
    const m = parseInt(month);

    console.log(`[Calc] Starting optimized calculation for ${y}-${m}... (skipSync: ${skipSync})`);

    if (!skipSync) {
      // Sync employees from Supabase first to ensure statuses are updated
      console.log('[Calc] Syncing employees...');
      await syncEmployees(true).catch(err => console.error("Sync employees failed:", err));
      console.log('[Calc] Employees synced.');

      // Sync attendance logs and approved leaves from Supabase first
      console.log('[Calc] Syncing attendance and leaves...');
      const singleEmpId = (employeeIds && Array.isArray(employeeIds) && employeeIds.length === 1) ? employeeIds[0] : null;
      await syncAttendanceAndLeaves(y, m, false, singleEmpId).catch(err => console.error("Sync attendance/leaves failed:", err));
      console.log('[Calc] Attendance and leaves synced.');
    } else {
      console.log('[Calc] skipSync is true. Skipping Supabase sync for employees, attendance, and leaves.');
    }

    // Fetch active schedules for this month from Supabase to override salary structures
    console.log('[Calc] Fetching active schedules for month...');
    const activeSchedules = await fetchActiveSchedulesForMonth(y, m);
    console.log('[Calc] Active schedules fetched. Count keys:', Object.keys(activeSchedules).length);

    // Fetch all employees' standard_daily_hours from Supabase for fallback
    console.log('[Calc] Fetching employees standard daily hours from Supabase...');
    const { data: sbEmps } = await supabase.from('employees').select('name, standard_daily_hours');
    const empHoursMap = {};
    if (sbEmps) {
      sbEmps.forEach(e => {
        empHoursMap[e.name] = parseFloat(e.standard_daily_hours) || 8;
      });
    }

    // Get settings
    console.log('[Calc] Querying system settings...');
    const rawSettings = await req.prisma.systemSetting.findMany();
    const settings = {};
    rawSettings.forEach(s => { settings[s.key] = s.value; });
    console.log('[Calc] System settings loaded.');

    // Override with custom calculation settings if provided
    if (customSettings && typeof customSettings === 'object') {
      Object.assign(settings, customSettings);
    }

    const monthStr = String(m).padStart(2, '0');
    const nextMonth = m === 12 ? 1 : m + 1;
    const nextYear = m === 12 ? y + 1 : y;
    const lastDay = new Date(nextYear, nextMonth - 1, 0).getDate();
    const lastDayStr = String(lastDay).padStart(2, '0');
    const monthStartStr = `${y}-${monthStr}-01`;
    const monthEndStr = `${y}-${monthStr}-${lastDayStr}`;

    // Fetch monthly salary schedules to get shift types (班別) for hourly employees
    console.log('[Calc] Fetching monthly salary schedules...');
    const { data: sbEmpsAll } = await supabase.from('employees').select('id, username');
    const uuidToEmpNoAll = {};
    if (sbEmpsAll) {
      sbEmpsAll.forEach(sbEmp => {
        let employeeNo = '';
        if (sbEmp.username && sbEmp.username.includes('@')) {
          employeeNo = sbEmp.username.split('@')[0].toUpperCase();
        } else {
          employeeNo = `EMP-${sbEmp.id.substring(0, 4).toUpperCase()}`;
        }
        uuidToEmpNoAll[sbEmp.id] = employeeNo;
      });
    }

    // Supabase has a default 1000 row limit. Use pagination to fetch all rows for the month.
    let monthlySchedulesData = [];
    let hasMore = true;
    let fromIndex = 0;
    const step = 1000;
    
    while (hasMore) {
      const { data, error } = await supabase
        .from('monthly_salary_schedules')
        .select('employee_id, service_date, shift_type, service_mins')
        .gte('service_date', monthStartStr)
        .lte('service_date', monthEndStr)
        .order('employee_id')
        .order('service_date')
        .range(fromIndex, fromIndex + step - 1);
        
      if (error || !data || data.length === 0) {
        hasMore = false;
      } else {
        monthlySchedulesData = monthlySchedulesData.concat(data);
        if (data.length < step) hasMore = false;
        fromIndex += step;
      }
    }

    const shiftTypeMap = {};
    const scheduledHoursMap = {};
    if (monthlySchedulesData) {
      const empDailyData = {};
      monthlySchedulesData.forEach(sched => {
        const empNo = uuidToEmpNoAll[sched.employee_id];
        if (empNo) {
          if (sched.shift_type) {
            const key = `${empNo}_${sched.service_date}`;
            if (!shiftTypeMap[key]) shiftTypeMap[key] = new Set();
            shiftTypeMap[key].add(sched.shift_type);
          }
          if (sched.service_mins > 0) {
            if (!empDailyData[empNo]) empDailyData[empNo] = {};
            if (!empDailyData[empNo][sched.service_date]) {
              empDailyData[empNo][sched.service_date] = { mins: 0, types: new Set() };
            }
            empDailyData[empNo][sched.service_date].mins += sched.service_mins;
            if (sched.shift_type) empDailyData[empNo][sched.service_date].types.add(sched.shift_type);
          }
        }
      });
      
      // Calculate categorized hours per employee
      for (const empNo of Object.keys(empDailyData)) {
        scheduledHoursMap[empNo] = {
          regularHours: 0, overtimeHours: 0, overtimeHours134: 0,
          overtimeHours167: 0, overtimeHours200: 0, overtimeHours267: 0, workDays: 0
        };
        const dailyData = empDailyData[empNo];
        for (const date of Object.keys(dailyData)) {
          scheduledHoursMap[empNo].workDays++;
          const hrs = dailyData[date].mins / 60;
          const types = Array.from(dailyData[date].types);
          const isNatHoliday = types.some(t => t.includes('國假') || t.includes('國定假日'));
          const isRoutineDayOff = types.some(t => t.includes('例假日'));
          const isRestDay = types.some(t => t.includes('休息日'));
          
          if (isNatHoliday || isRoutineDayOff) {
            scheduledHoursMap[empNo].overtimeHours += hrs;
            scheduledHoursMap[empNo].overtimeHours200 += hrs;
          } else if (isRestDay) {
            scheduledHoursMap[empNo].overtimeHours += hrs;
            scheduledHoursMap[empNo].overtimeHours134 += Math.min(2, hrs);
            scheduledHoursMap[empNo].overtimeHours167 += Math.min(6, Math.max(0, hrs - 2));
            scheduledHoursMap[empNo].overtimeHours267 += Math.max(0, hrs - 8);
          } else {
            if (hrs > 8) {
              scheduledHoursMap[empNo].regularHours += 8;
              const dailyOt = hrs - 8;
              scheduledHoursMap[empNo].overtimeHours += dailyOt;
              scheduledHoursMap[empNo].overtimeHours134 += Math.min(2, dailyOt);
              scheduledHoursMap[empNo].overtimeHours167 += Math.min(6, Math.max(0, dailyOt - 2));
              scheduledHoursMap[empNo].overtimeHours267 += Math.max(0, dailyOt - 8);
            } else {
              scheduledHoursMap[empNo].regularHours += hrs;
            }
          }
        }
        
        // Round all numbers to 2 decimal places
        for (const key of Object.keys(scheduledHoursMap[empNo])) {
          if (key !== 'workDays') {
            scheduledHoursMap[empNo][key] = parseFloat(scheduledHoursMap[empNo][key].toFixed(2));
          }
        }
      }
    }

    // Build employee query
    const empWhere = {
      hireDate: { lte: monthEndStr },
      OR: [
        { isActive: true },
        {
          isActive: false,
          resignDate: { gte: monthStartStr }
        }
      ]
    };
    if (employeeIds && Array.isArray(employeeIds) && employeeIds.length > 0) {
      empWhere.id = { in: employeeIds.map(id => parseInt(id)) };
    }

    // Clean up draft records of ineligible employees for this month
    console.log('[Calc] Cleaning up draft records for ineligible employees...');
    const ineligibleRecords = await req.prisma.payrollRecord.findMany({
      where: {
        year: y,
        month: m,
        status: 'DRAFT',
        OR: [
          { employee: { hireDate: { gt: monthEndStr } } },
          { employee: { resignDate: { lt: monthStartStr } } },
          {
            employee: {
              isActive: false,
              OR: [
                { resignDate: null },
                { resignDate: { lt: monthStartStr } }
              ]
            }
          }
        ]
      },
      select: { id: true }
    });
    
    if (ineligibleRecords.length > 0) {
      await req.prisma.payrollRecord.deleteMany({
        where: {
          id: { in: ineligibleRecords.map(r => r.id) }
        }
      });
      console.log(`[Calc] Cleaned up ${ineligibleRecords.length} ineligible draft payroll records.`);
    }

    console.log('[Calc] Fetching employees from DB...');
    const employees = await req.prisma.employee.findMany({ where: empWhere });
    console.log(`[Calc] Found ${employees.length} active employees to process.`);
    if (employees.length === 0) {
      return res.status(404).json({ error: '找不到適用的員工資料' });
    }

    // 1. Batch fetch past 3 months payroll records for rolling grades
    console.log('[Calc] Batch fetching historical records...');
    const pastMonths = [];
    for (let offset of [4, 3, 2]) {
      let curM = m - offset;
      let curY = y;
      while (curM <= 0) {
        curM += 12;
        curY -= 1;
      }
      pastMonths.push({ year: curY, month: curM });
    }
    const allPastRecords = await req.prisma.payrollRecord.findMany({
      where: {
        OR: pastMonths.map(pm => ({ year: pm.year, month: pm.month }))
      }
    });
    const pastRecordsMap = {};
    allPastRecords.forEach(r => {
      if (!pastRecordsMap[r.employeeId]) pastRecordsMap[r.employeeId] = [];
      pastRecordsMap[r.employeeId].push(r);
    });

    // 1b. Batch fetch current month's existing payroll records to preserve manual adjustments/notes/grades
    const existingRecordsForMonth = await req.prisma.payrollRecord.findMany({
      where: { year: y, month: m }
    });
    const existingRecordsMap = {};
    existingRecordsForMonth.forEach(r => {
      existingRecordsMap[r.employeeId] = r;
    });

    // 2. Batch fetch attendance and leave records for the calculation month
    console.log('[Calc] Batch fetching attendance and leaves...');
    const allAttendanceRecords = await req.prisma.attendanceRecord.findMany({
      where: {
        date: {
          gte: `${y}-${monthStr}-01`,
          lte: `${y}-${monthStr}-${lastDayStr}`
        }
      }
    });
    const allLeaves = await req.prisma.leaveRecord.findMany({
      where: {
        status: 'approved',
        startDate: { lte: `${y}-${monthStr}-${lastDayStr}` },
        endDate: { gte: `${y}-${monthStr}-01` }
      }
    });

    const attendanceMap = {};
    allAttendanceRecords.forEach(r => {
      if (!attendanceMap[r.employeeId]) attendanceMap[r.employeeId] = [];
      attendanceMap[r.employeeId].push(r);
    });

    const leavesMap = {};
    allLeaves.forEach(l => {
      if (!leavesMap[l.employeeId]) leavesMap[l.employeeId] = [];
      leavesMap[l.employeeId].push(l);
    });

    // Parse leave deduction rules from settings
    let leaveRules = [];
    try {
      if (settings.leave_deduction_rules) {
        leaveRules = JSON.parse(settings.leave_deduction_rules);
      }
    } catch (err) {
      console.error('Failed to parse leave deduction rules:', err);
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

    const getLeaveDeductionType = (leaveType) => {
      const typeStr = (leaveType || '').trim().toLowerCase();
      const rule = leaveRules.find(r => {
        const ruleType = (r.leaveType || '').trim().toLowerCase();
        const ruleLabel = (r.label || '').trim().toLowerCase();
        return typeStr === ruleType || typeStr === ruleLabel || typeStr.includes(ruleType) || ruleType.includes(typeStr);
      });
      return rule ? rule.deductionType : 'full';
    };

    const queueEmployeeUpdate = [];
    const queueUpsert = [];

    // Loop through employees and perform calculations in memory
    for (const emp of employees) {
      const existingRecord = existingRecordsMap[emp.id];
      if (existingRecord && existingRecord.status !== 'DRAFT') {
        continue;
      }

      let currentEmp = emp;
      const activeSched = activeSchedules[emp.employeeNo];
      let standardHours = 8;
      if (activeSched && activeSched.standardDailyHours !== undefined) {
        standardHours = activeSched.standardDailyHours;
      } else {
        standardHours = empHoursMap[emp.name] || 8;
      }
      currentEmp.standardDailyHours = standardHours;

      if (activeSched) {
        currentEmp = {
          ...emp,
          salaryType: activeSched.salaryType,
          baseSalary: activeSched.baseSalary,
          allowanceManager: activeSched.allowanceManager,
          allowanceLicense: activeSched.allowanceLicense,
          otherAllowance: activeSched.otherAllowance
        };
      }

      if (existingRecord) {
        if (!req.body.resetSettings) {
          currentEmp = {
            ...currentEmp,
            // Preserve manual override grades from the existing payroll record if present
            laborInsuranceGrade: existingRecord.laborInsuranceGrade !== 0 ? existingRecord.laborInsuranceGrade : currentEmp.laborInsuranceGrade,
            healthInsuranceGrade: existingRecord.healthInsuranceGrade !== 0 ? existingRecord.healthInsuranceGrade : currentEmp.healthInsuranceGrade,
            laborPensionGrade: existingRecord.laborPensionGrade !== 0 ? existingRecord.laborPensionGrade : currentEmp.laborPensionGrade,
            laborOccupationalGrade: existingRecord.laborOccupationalGrade !== 0 ? existingRecord.laborOccupationalGrade : currentEmp.laborOccupationalGrade,
            baseSalary: existingRecord.baseSalary > 0 ? existingRecord.baseSalary : currentEmp.baseSalary,
          };
        }

        currentEmp = {
          ...currentEmp,
          // Always preserve allowances from existing payroll record because they are often imported/manually adjusted per month
          allowanceAA: existingRecord.allowanceAA,
          allowanceLicense: existingRecord.allowanceLicense,
          allowanceManager: existingRecord.allowanceManager,
          otherAllowance: existingRecord.otherAllowance,
          mealAllowance: existingRecord.mealAllowance,
        };
      }

      // Check rolling grades and update only if they changed
      const pastRecs = pastRecordsMap[emp.id] || [];
      const grades = getRollingInsuranceGrades(currentEmp, pastRecs);
      
      const hasGradeChanged = 
        grades.laborInsuranceGrade !== emp.laborInsuranceGrade ||
        grades.healthInsuranceGrade !== emp.healthInsuranceGrade ||
        grades.laborPensionGrade !== emp.laborPensionGrade ||
        grades.laborOccupationalGrade !== emp.laborOccupationalGrade;

      if (hasGradeChanged) {
        queueEmployeeUpdate.push({
          id: emp.id,
          grades
        });
      }
      
      currentEmp = {
        ...currentEmp,
        ...grades
      };

      // Fetch attendance & leaves from memory map
      const attendanceRecords = attendanceMap[emp.id] || [];
      const leaves = leavesMap[emp.id] || [];

      // Split leaves into normal leaves and overtime conversion leaves, excluding official business (work)
      const normalLeaves = [];
      const otLeaves = [];
      leaves.forEach(l => {
        const type = (l.leaveType || '').toLowerCase();
        if (type.includes('特休') && (type.includes('折現') || type.includes('折算') || type.includes('不休假'))) {
          // Skip special leave cashout as requested
        } else if (type === 'co' || type === 'alc' || type.includes('折算') || type.includes('折現')) {
          otLeaves.push(l);
        } else if (type === 'ot' || type === '加班') {
          // Skip: overtime to be compensated as compensatory leave (補休), not cash payout
        } else if (
          type.includes('公出') ||
          type.includes('家訪') ||
          type.includes('出差') ||
          type.includes('會議') ||
          type.includes('訓練') ||
          type.includes('培訓') ||
          type.includes('挪移') ||
          type.includes('派案') ||
          type.includes('個督') ||
          type === 'ob'
        ) {
          // Skip official business
        } else {
          normalLeaves.push(l);
        }
      });

      // Calculate attendance statistics
      let regularHours = 0;
      let overtimeHours = 0;
      let overtimeHours134 = 0;
      let overtimeHours167 = 0;
      let overtimeHours200 = 0;
      let overtimeHours267 = 0;
      let workDays = 0;
      let absentDays = 0;
      let leaveDays = 0;
      let leaveDeduction = 0;
      let leaveHoursHalf = 0;
      let leaveHoursPaid = 0;

      normalLeaves.forEach(l => {
        if (getLeaveRate(l.leaveType) > 0.0) {
          leaveDays += l.days;
        }
      });

      // Daily rate for leave deduction (monthly employee)
      const currentBonus = existingRecord ? (existingRecord.bonus || 0) : 0;
      const hourlyLeaveRate = (currentEmp.baseSalary + (currentEmp.allowanceAA || 0) + (currentEmp.allowanceLicense || 0) + (currentEmp.allowanceManager || 0) + (currentEmp.otherAllowance || 0) + currentBonus) / (30 * standardHours);

      // Calculate leave deductions (for monthly) and supplement hours (for hourly)
      if (currentEmp.salaryType === 'monthly') {
        let totalWeightedHours = 0;
        normalLeaves.forEach(l => {
          const hours = l.days * 8;
          const rate = getLeaveRate(l.leaveType);
          totalWeightedHours += hours * rate;
        });
        leaveDeduction = Math.round(hourlyLeaveRate * totalWeightedHours);
      } else {
        // Hourly: sum hours for supplement
        normalLeaves.forEach(l => {
          const hours = l.days * 8;
          const dedType = getLeaveDeductionType(l.leaveType);
          if (dedType === 'half') {
            leaveHoursHalf += hours;
          } else if (dedType === 'none') {
            leaveHoursPaid += hours;
          }
        });
      }

      // Calculate Overtime Hours from OT conversion leaves
      otLeaves.forEach(l => {
        const otHrs = parseFloat((l.days * 8).toFixed(2));

        // Determine day type
        const isNatHoliday = isHoliday(l.startDate) || isHoliday(l.endDate) || (l.reason && (l.reason.includes('國假') || l.reason.includes('國定假日')));
        
        let dayOfWeek = new Date(l.endDate).getDay(); 
        if (!isNatHoliday && new Date(l.startDate).getDay() === 6) {
          dayOfWeek = 6;
        } else if (!isNatHoliday && new Date(l.startDate).getDay() === 0) {
          dayOfWeek = 0;
        }

        if (isNatHoliday) {
          // National Holiday overtime pay logic:
          if (currentEmp.salaryType === 'monthly') {
            const actualHrs = Math.max(standardHours, otHrs);
            overtimeHours += actualHrs;
            overtimeHours200 += standardHours; // Paid at 1.0x additional
            if (actualHrs > standardHours) {
              overtimeHours134 += (actualHrs - standardHours); // Paid at 1.334x for hours beyond standardHours
            }
          } else {
            // Hourly employees: paid at 2.0x
            overtimeHours += otHrs;
            overtimeHours200 += otHrs;
          }
        } else if (dayOfWeek === 0) {
          // Sunday
          overtimeHours += otHrs;
          overtimeHours200 += otHrs;
        } else if (dayOfWeek === 6) {
          // Saturday rest day extended overtime:
          overtimeHours += otHrs;
          const ot134 = Math.min(2, otHrs);
          const ot167 = Math.min(6, Math.max(0, otHrs - 2));
          const ot267 = Math.max(0, otHrs - standardHours);
          overtimeHours134 += ot134;
          overtimeHours167 += ot167;
          overtimeHours267 += ot267;
        } else {
          // Weekday overtime:
          overtimeHours += otHrs;
          const ot134 = Math.min(2, otHrs);
          const ot167 = Math.max(0, otHrs - 2);
          overtimeHours134 += ot134;
          overtimeHours167 += ot167;
        }
      });

      // Round overtime fields to 2 decimal places
      overtimeHours = parseFloat(overtimeHours.toFixed(2));
      overtimeHours134 = parseFloat(overtimeHours134.toFixed(2));
      overtimeHours167 = parseFloat(overtimeHours167.toFixed(2));
      overtimeHours200 = parseFloat(overtimeHours200.toFixed(2));
      overtimeHours267 = parseFloat(overtimeHours267.toFixed(2));

      // Calculate workDays and regularHours from attendance records
      if (currentEmp.salaryType === 'hourly') {
        if (attendanceRecords.length > 0) {
          attendanceRecords.forEach(att => {
            const isNatHoliday = isHoliday(att.date);
            const dailyReg = att.regularHours || 0;
            const dailyOt = att.overtimeHours || 0;
            const totalDaily = dailyReg + dailyOt;

            const dateObj = new Date(att.date);
            const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 6 = Saturday

            // Determine if the day is a Routine Day Off (例假日) or Rest Day (休息日) based on shift schedules
            const shiftKey = `${currentEmp.employeeNo}_${att.date}`;
            const shiftTypes = shiftTypeMap[shiftKey] || new Set();
            const hasRoutineDayOffShift = Array.from(shiftTypes).some(t => t.includes('例假日'));
            const hasRestDayShift = Array.from(shiftTypes).some(t => t.includes('休息日'));

            // Fallback to dayOfWeek if no specific shift type is mapped
            const isRoutineDayOff = shiftTypes.size > 0 ? hasRoutineDayOffShift : (dayOfWeek === 0);
            const isRestDay = shiftTypes.size > 0 ? hasRestDayShift : (dayOfWeek === 6);

            if (isNatHoliday) {
              // National holiday: 2x rate for all hours
              overtimeHours += totalDaily;
              overtimeHours200 += totalDaily;
            } else if (isRoutineDayOff) {
              // 例假日 (Routine Day Off): 2x pay for all hours
              overtimeHours += totalDaily;
              overtimeHours200 += totalDaily;
            } else if (isRestDay) {
              // Saturday (休息日): Rest day formula (all hours are overtime)
              overtimeHours += totalDaily;
              const otHrs = totalDaily;
              const ot134 = Math.min(2, otHrs);
              const ot167 = Math.min(6, Math.max(0, otHrs - 2));
              const ot267 = Math.max(0, otHrs - 8);
              overtimeHours134 += ot134;
              overtimeHours167 += ot167;
              overtimeHours267 += ot267;
            } else {
              // Normal weekday
              regularHours += dailyReg;
              if (dailyOt > 0) {
                overtimeHours += dailyOt;
                const ot134 = Math.min(2, dailyOt);
                const ot167 = Math.min(6, Math.max(0, dailyOt - 2));
                const ot267 = Math.max(0, dailyOt - 8);
                overtimeHours134 += ot134;
                overtimeHours167 += ot167;
                overtimeHours267 += ot267;
              }
            }

            if (att.status === 'present' || att.clockIn || att.clockOut) {
              workDays++;
            } else if (att.status === 'absent') {
              absentDays++;
            }
          });
        } else {
          const schedData = scheduledHoursMap[currentEmp.employeeNo];
          if (schedData && (schedData.regularHours > 0 || schedData.overtimeHours > 0)) {
            workDays = schedData.workDays;
            regularHours = schedData.regularHours;
            overtimeHours += schedData.overtimeHours;
            overtimeHours134 += schedData.overtimeHours134;
            overtimeHours167 += schedData.overtimeHours167;
            overtimeHours200 += schedData.overtimeHours200;
            overtimeHours267 += schedData.overtimeHours267;
          } else {
            workDays = 0;
            regularHours = 0;
          }
        }
      } else {
        // Monthly employees: count standard weekdays in the month
        const daysInMonth = new Date(y, m, 0).getDate();
        let weekdays = 0;
        for (let d = 1; d <= daysInMonth; d++) {
          const day = new Date(y, m - 1, d).getDay();
          if (day !== 0 && day !== 6) weekdays++;
        }
        workDays = weekdays;
        regularHours = weekdays * standardHours;
        
        // Count absent days if any (status is absent)
        attendanceRecords.forEach(att => {
          if (att.status === 'absent') {
            absentDays++;
          }
        });
      }

      const attendanceSummary = {
        year: y,
        month: m,
        workDays,
        leaveDays,
        absentDays,
        overtimeHours,
        overtimeHours134,
        overtimeHours167,
        overtimeHours200,
        overtimeHours267,
        regularHours,
        leaveDeduction: leaveDeduction,
        leaveHoursHalf,
        leaveHoursPaid,
        
        // Pass existing adjustments to calculatePayroll
        bonus: existingRecord ? existingRecord.bonus : 0,
        retroPay: existingRecord ? existingRecord.retroPay : 0,
        otherDeductions: existingRecord ? existingRecord.otherDeductions : 0,
        supplementaryHealthInsurance: (existingRecord && existingRecord.supplementaryHealthInsurance !== 0) ? existingRecord.supplementaryHealthInsurance : undefined,
        prevInsuranceDifference: (existingRecord && existingRecord.prevInsuranceDifference !== 0) ? existingRecord.prevInsuranceDifference : undefined,
        healthDisabilityExemption: (existingRecord && existingRecord.healthDisabilityExemption !== 0) ? existingRecord.healthDisabilityExemption : undefined,
        laborDisabilityExemption: (existingRecord && existingRecord.laborDisabilityExemption !== 0) ? existingRecord.laborDisabilityExemption : undefined,
        healthGovSubsidy: (existingRecord && existingRecord.healthGovSubsidy !== 0) ? existingRecord.healthGovSubsidy : undefined,
        leavePaySupplement: (existingRecord && existingRecord.leavePaySupplement !== 0) ? existingRecord.leavePaySupplement : undefined,
      };

      const payDetails = calculatePayroll(currentEmp, attendanceSummary, settings);
      
      // Queue the upsert operation for parallel run
      queueUpsert.push({
        employeeId: emp.id,
        payDetails
      });
    }

    // Batch update employee insurance grades in DB
    console.log(`[Calc] Batch updating ${queueEmployeeUpdate.length} employee insurance grades...`);
    const updateTasks = queueEmployeeUpdate.map(item => () => {
      return req.prisma.employee.update({
        where: { id: item.id },
        data: item.grades
      });
    });
    await runInBatches(updateTasks, 5);
    console.log('[Calc] Employee insurance grades updated.');

    // Batch upsert payroll records in DB
    console.log(`[Calc] Batch upserting ${queueUpsert.length} payroll records...`);
    const upsertTasks = queueUpsert.map(item => () => {
      const existingRecord = existingRecordsMap[item.employeeId];
      return req.prisma.payrollRecord.upsert({
        where: {
          employeeId_year_month: { employeeId: item.employeeId, year: y, month: m }
        },
        update: {
          ...item.payDetails,
          notes: (existingRecord && existingRecord.notes && !existingRecord.notes.startsWith('本月因到/離職不足月') && !req.body.resetSettings)
            ? existingRecord.notes
            : item.payDetails.notes,
          status: 'DRAFT',
          calculatedAt: new Date().toISOString()
        },
        create: {
          employeeId: item.employeeId,
          year: y,
          month: m,
          ...item.payDetails,
          status: 'DRAFT',
          calculatedAt: new Date().toISOString()
        },
        include: {
          employee: {
            select: { id: true, employeeNo: true, name: true, department: true, position: true }
          }
        }
      });
    });
    const results = await runInBatches(upsertTasks, 5);

    console.log('[Calc] Payroll calculation completed successfully.');
    res.json({
      message: `成功計算 ${results.length} 位員工的薪資`,
      data: results
    });
  } catch (error) {
    console.error('Calculate payroll error:', error);
    res.status(500).json({ error: '薪資計算失敗' });
  }
});

/**
 * GET /api/payroll/:id
 * Get single payroll record.
 */
router.get('/:id', validateId(), async (req, res) => {
  try {
    const record = await req.prisma.payrollRecord.findUnique({
      where: { id: req.params.id },
      include: {
        employee: true
      }
    });

    if (!record) {
      return res.status(404).json({ error: '找不到該筆薪資紀錄' });
    }

    const startDate = `${record.year}-${String(record.month).padStart(2, '0')}-01`;
    const lastDay = new Date(record.year, record.month, 0).getDate();
    const endDate = `${record.year}-${String(record.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const leaves = await req.prisma.leaveRecord.findMany({
      where: {
        employeeId: record.employeeId,
        status: 'approved',
        startDate: { lte: endDate },
        endDate: { gte: startDate }
      }
    });

    // Get settings to parse leave rates
    const rawSettings = await req.prisma.systemSetting.findMany();
    const settings = {};
    rawSettings.forEach(s => { settings[s.key] = s.value; });

    let leaveRules = [];
    try {
      if (settings.leave_deduction_rules) {
        leaveRules = JSON.parse(settings.leave_deduction_rules);
      }
    } catch (err) {
      console.error('Failed to parse leave deduction rules:', err);
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

    const enrichedLeaves = leaves.map(l => ({
      ...l,
      rate: getLeaveRate(l.leaveType)
    }));

    res.json({ data: { ...record, leaves: enrichedLeaves } });
  } catch (error) {
    console.error('Get payroll record error:', error);
    res.status(500).json({ error: '取得薪資明細失敗' });
  }
});

router.put('/:id', validateId(), async (req, res) => {
  try {
    const existing = await req.prisma.payrollRecord.findUnique({
      where: { id: req.params.id },
      include: { employee: true }
    });
    if (!existing) {
      return res.status(404).json({ error: '找不到該筆薪資紀錄' });
    }

    if (existing.status !== 'DRAFT') {
      return res.status(400).json({ error: '僅能調整草稿狀態的薪資紀錄' });
    }

    // Get settings
    const rawSettings = await req.prisma.systemSetting.findMany();
    const settings = {};
    rawSettings.forEach(s => { settings[s.key] = s.value; });

    // Prepare overridden employee settings
    const empOverride = {
      ...existing.employee,
      baseSalary: req.body.baseSalary !== undefined ? parseFloat(req.body.baseSalary) : existing.baseSalary,
      allowanceAA: req.body.allowanceAA !== undefined ? parseFloat(req.body.allowanceAA) : existing.allowanceAA,
      allowanceLicense: req.body.allowanceLicense !== undefined ? parseFloat(req.body.allowanceLicense) : existing.allowanceLicense,
      allowanceManager: req.body.allowanceManager !== undefined ? parseFloat(req.body.allowanceManager) : existing.allowanceManager,
      otherAllowance: req.body.otherAllowance !== undefined ? parseFloat(req.body.otherAllowance) : existing.otherAllowance,
      mealAllowance: req.body.mealAllowance !== undefined ? parseFloat(req.body.mealAllowance) : existing.mealAllowance,
      laborInsuranceGrade: req.body.laborInsuranceGrade !== undefined ? parseFloat(req.body.laborInsuranceGrade) : existing.laborInsuranceGrade,
      laborOccupationalGrade: req.body.laborOccupationalGrade !== undefined ? parseFloat(req.body.laborOccupationalGrade) : existing.laborOccupationalGrade,
      healthInsuranceGrade: req.body.healthInsuranceGrade !== undefined ? parseFloat(req.body.healthInsuranceGrade) : existing.healthInsuranceGrade,
      laborPensionGrade: req.body.laborPensionGrade !== undefined ? parseFloat(req.body.laborPensionGrade) : existing.laborPensionGrade,
      dependents: req.body.dependents !== undefined ? parseInt(req.body.dependents) : existing.employee.dependents,
      voluntaryPensionRate: req.body.voluntaryPensionRate !== undefined ? parseFloat(req.body.voluntaryPensionRate) : existing.employee.voluntaryPensionRate,
      supplementaryHealthInsurance: req.body.supplementaryHealthInsurance !== undefined ? parseFloat(req.body.supplementaryHealthInsurance) : existing.supplementaryHealthInsurance,
      prevInsuranceDifference: req.body.prevInsuranceDifference !== undefined ? parseFloat(req.body.prevInsuranceDifference) : existing.prevInsuranceDifference,
      healthDisabilityExemption: req.body.healthDisabilityExemption !== undefined ? parseFloat(req.body.healthDisabilityExemption) : existing.healthDisabilityExemption,
      laborDisabilityExemption: req.body.laborDisabilityExemption !== undefined ? parseFloat(req.body.laborDisabilityExemption) : existing.laborDisabilityExemption,
      healthGovSubsidy: req.body.healthGovSubsidy !== undefined ? parseFloat(req.body.healthGovSubsidy) : existing.healthGovSubsidy,
      leavePaySupplement: req.body.leavePaySupplement !== undefined ? parseFloat(req.body.leavePaySupplement) : existing.leavePaySupplement,
    };

    // Prepare overridden attendance & adjustments using existing record data
    const attendanceSummary = {
      workDays: req.body.workDays !== undefined ? parseFloat(req.body.workDays) : existing.workDays,
      leaveDays: req.body.leaveDays !== undefined ? parseFloat(req.body.leaveDays) : existing.leaveDays,
      absentDays: req.body.absentDays !== undefined ? parseFloat(req.body.absentDays) : existing.absentDays,
      regularHours: req.body.regularHours !== undefined ? parseFloat(req.body.regularHours) : existing.regularHours,
      overtimeHours134: req.body.overtimeHours134 !== undefined ? parseFloat(req.body.overtimeHours134) : existing.overtimeHours134,
      overtimeHours167: req.body.overtimeHours167 !== undefined ? parseFloat(req.body.overtimeHours167) : existing.overtimeHours167,
      overtimeHours200: req.body.overtimeHours200 !== undefined ? parseFloat(req.body.overtimeHours200) : existing.overtimeHours200,
      overtimeHours267: req.body.overtimeHours267 !== undefined ? parseFloat(req.body.overtimeHours267) : existing.overtimeHours267,
      overtimeHours: (req.body.overtimeHours134 !== undefined ? parseFloat(req.body.overtimeHours134) : existing.overtimeHours134) +
                     (req.body.overtimeHours167 !== undefined ? parseFloat(req.body.overtimeHours167) : existing.overtimeHours167) +
                     (req.body.overtimeHours200 !== undefined ? parseFloat(req.body.overtimeHours200) : existing.overtimeHours200) +
                     (req.body.overtimeHours267 !== undefined ? parseFloat(req.body.overtimeHours267) : existing.overtimeHours267),
      bonus: req.body.bonus !== undefined ? parseFloat(req.body.bonus) : existing.bonus,
      retroPay: req.body.retroPay !== undefined ? parseFloat(req.body.retroPay) : existing.retroPay,
      otherDeductions: req.body.otherDeductions !== undefined ? parseFloat(req.body.otherDeductions) : existing.otherDeductions,
      leaveDeduction: req.body.leaveDeduction !== undefined ? parseFloat(req.body.leaveDeduction) : existing.leaveDeduction,
      // We do not pass leaveHoursHalf and leaveHoursPaid because we want calculatePayroll 
      // to respect the manual leavePaySupplement if it was edited.
      leaveHoursHalf: undefined,
      leaveHoursPaid: undefined,
      supplementaryHealthInsurance: req.body.supplementaryHealthInsurance !== undefined ? parseFloat(req.body.supplementaryHealthInsurance) : existing.supplementaryHealthInsurance,
      prevInsuranceDifference: req.body.prevInsuranceDifference !== undefined ? parseFloat(req.body.prevInsuranceDifference) : existing.prevInsuranceDifference,
      healthDisabilityExemption: req.body.healthDisabilityExemption !== undefined ? parseFloat(req.body.healthDisabilityExemption) : existing.healthDisabilityExemption,
      laborDisabilityExemption: req.body.laborDisabilityExemption !== undefined ? parseFloat(req.body.laborDisabilityExemption) : existing.laborDisabilityExemption,
      healthGovSubsidy: req.body.healthGovSubsidy !== undefined ? parseFloat(req.body.healthGovSubsidy) : existing.healthGovSubsidy,
      leavePaySupplement: req.body.leavePaySupplement !== undefined ? parseFloat(req.body.leavePaySupplement) : existing.leavePaySupplement,
    };

    // Recalculate
    const payDetails = calculatePayroll(empOverride, attendanceSummary, settings);

    // Capture manual overrides for calculated results if explicitly provided
    const updateData = {
      ...payDetails,
      notes: req.body.notes !== undefined ? req.body.notes : existing.notes,
      calculatedAt: new Date().toISOString()
    };

    // If specific fields are overridden manually and we don't want calculations to stomp them:
    const overrideFields = [
      'laborInsuranceEmployee', 'healthInsuranceEmployee', 'laborPensionEmployee',
      'incomeTax', 'otherDeductions', 'laborInsuranceEmployer', 'healthInsuranceEmployer',
      'laborPensionEmployer', 'laborOccupationalEmployer', 'totalEmployerCost', 'totalDeductions', 'netPay',
      'supplementaryHealthInsurance', 'prevInsuranceDifference', 'healthDisabilityExemption', 'laborDisabilityExemption', 'healthGovSubsidy', 'leavePaySupplement'
    ];
    overrideFields.forEach(f => {
      if (req.body[f] !== undefined) {
        updateData[f] = parseFloat(req.body[f]) || 0;
      }
    });

    const record = await req.prisma.payrollRecord.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        employee: {
          select: { id: true, employeeNo: true, name: true, department: true, position: true }
        }
      }
    });

    res.json({ data: record, message: '薪資明細調整成功' });
  } catch (error) {
    console.error('Update payroll record error:', error);
    res.status(500).json({ error: '調整薪資紀錄失敗' });
  }
});

/**
 * PUT or POST /api/payroll/:id/lock
 * Lock a payroll record (status -> LOCKED).
 */
const lockHandler = async (req, res) => {
  try {
    const existing = await req.prisma.payrollRecord.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: '找不到該筆薪資紀錄' });
    }

    if (existing.status !== 'DRAFT') {
      return res.status(400).json({ error: '僅能鎖定草稿狀態的薪資紀錄' });
    }

    const record = await req.prisma.payrollRecord.update({
      where: { id: req.params.id },
      data: { status: 'LOCKED' },
      include: {
        employee: {
          select: { id: true, employeeNo: true, name: true, department: true, position: true }
        }
      }
    });

    res.json({ data: record, message: '薪資紀錄已鎖定' });
  } catch (error) {
    console.error('Lock payroll error:', error);
    res.status(500).json({ error: '鎖定薪資紀錄失敗' });
  }
};
router.put('/:id/lock', validateId(), lockHandler);
router.post('/:id/lock', validateId(), lockHandler);

/**
 * PUT or POST /api/payroll/:id/unlock
 * Unlock a payroll record (status -> DRAFT).
 */
const unlockHandler = async (req, res) => {
  try {
    const existing = await req.prisma.payrollRecord.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: '找不到該筆薪資紀錄' });
    }

    if (existing.status !== 'LOCKED') {
      return res.status(400).json({ error: '僅能解鎖已鎖定狀態的薪資紀錄' });
    }

    const record = await req.prisma.payrollRecord.update({
      where: { id: req.params.id },
      data: { status: 'DRAFT' },
      include: {
        employee: {
          select: { id: true, employeeNo: true, name: true, department: true, position: true }
        }
      }
    });

    res.json({ data: record, message: '薪資紀錄已解除鎖定，回復為草稿狀態' });
  } catch (error) {
    console.error('Unlock payroll error:', error);
    res.status(500).json({ error: '解鎖薪資紀錄失敗' });
  }
};
router.put('/:id/unlock', validateId(), unlockHandler);
router.post('/:id/unlock', validateId(), unlockHandler);

/**
 * PUT or POST /api/payroll/:id/approve
 * Approve a payroll record (status -> APPROVED).
 */
const approveHandler = async (req, res) => {
  try {
    const existing = await req.prisma.payrollRecord.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: '找不到該筆薪資紀錄' });
    }

    if (existing.status !== 'LOCKED' && existing.status !== 'DRAFT') {
      return res.status(400).json({ error: '薪資紀錄狀態不合適核准' });
    }

    const record = await req.prisma.payrollRecord.update({
      where: { id: req.params.id },
      data: {
        status: 'APPROVED',
        approvedBy: req.user.name,
        approvedAt: new Date().toISOString()
      },
      include: {
        employee: {
          select: { id: true, employeeNo: true, name: true, department: true, position: true }
        }
      }
    });

    res.json({ data: record, message: '薪資紀錄已核准' });
  } catch (error) {
    console.error('Approve payroll error:', error);
    res.status(500).json({ error: '核准薪資紀錄失敗' });
  }
};
router.put('/:id/approve', validateId(), approveHandler);
router.post('/:id/approve', validateId(), approveHandler);

/**
 * POST /api/payroll/batch-update-adjustments
 * Batch update adjustments (bonuses, allowances, notes) for multiple employees.
 * Recalculates gross pay, deductions, and net pay.
 */
router.post('/batch-update-adjustments', async (req, res) => {
  try {
    const { year, month, adjustments, skipSync } = req.body;
    if (!year || !month || !Array.isArray(adjustments)) {
      return res.status(400).json({ error: '請提供年份、月份與調整陣列' });
    }

    const y = parseInt(year);
    const m = parseInt(month);

    // Sync attendance logs and approved leaves from Supabase first
    if (!skipSync) {
      await syncAttendanceAndLeaves(y, m).catch(err => console.error("Sync attendance/leaves failed:", err));
    }

    // Get settings
    const rawSettings = await req.prisma.systemSetting.findMany();
    const settings = {};
    rawSettings.forEach(s => { settings[s.key] = s.value; });

    const updatedRecords = [];

    for (const adj of adjustments) {
      const {
        employeeNo, employeeName, bonus, allowanceAA, allowanceLicense, otherAllowance, mealAllowance, notes,
        supplementaryHealthInsurance, prevInsuranceDifference, healthDisabilityExemption, laborDisabilityExemption, healthGovSubsidy, leavePaySupplement,
        otherDeductions, laborInsuranceGrade, laborOccupationalGrade, healthInsuranceGrade, laborPensionGrade
      } = adj;

      // Find employee
      const emp = await req.prisma.employee.findFirst({
        where: {
          OR: [
            employeeNo ? { employeeNo: String(employeeNo).trim() } : null,
            employeeName ? { name: String(employeeName).trim() } : null
          ].filter(Boolean)
        }
      });

      if (!emp) continue;

      // Find payroll record
      const payrollRecord = await req.prisma.payrollRecord.findUnique({
        where: {
          employeeId_year_month: { employeeId: emp.id, year: y, month: m }
        }
      });

      if (!payrollRecord || payrollRecord.status !== 'DRAFT') continue;

      // Update fields
      const updatedBonus = bonus !== undefined ? parseFloat(bonus) : payrollRecord.bonus;
      const updatedAA = allowanceAA !== undefined ? parseFloat(allowanceAA) : payrollRecord.allowanceAA;
      const updatedLicense = allowanceLicense !== undefined ? parseFloat(allowanceLicense) : payrollRecord.allowanceLicense;
      const updatedOther = otherAllowance !== undefined ? parseFloat(otherAllowance) : payrollRecord.otherAllowance;
      const updatedMeal = mealAllowance !== undefined ? parseFloat(mealAllowance) : payrollRecord.mealAllowance;
      const updatedNotes = notes !== undefined ? notes : payrollRecord.notes;

      const updatedSuppHealth = (supplementaryHealthInsurance !== undefined && parseFloat(supplementaryHealthInsurance) !== 0)
        ? parseFloat(supplementaryHealthInsurance)
        : emp.supplementaryHealthInsurance;
      const updatedPrevDiff = (prevInsuranceDifference !== undefined && parseFloat(prevInsuranceDifference) !== 0)
        ? parseFloat(prevInsuranceDifference)
        : emp.prevInsuranceDifference;
      const updatedExemption = (healthDisabilityExemption !== undefined && parseFloat(healthDisabilityExemption) !== 0)
        ? parseFloat(healthDisabilityExemption)
        : emp.healthDisabilityExemption;
      const updatedLaborExemption = (laborDisabilityExemption !== undefined && parseFloat(laborDisabilityExemption) !== 0)
        ? parseFloat(laborDisabilityExemption)
        : emp.laborDisabilityExemption;
      const updatedSubsidy = (healthGovSubsidy !== undefined && parseFloat(healthGovSubsidy) !== 0)
        ? parseFloat(healthGovSubsidy)
        : emp.healthGovSubsidy;
      const updatedLeaveSupp = (leavePaySupplement !== undefined && parseFloat(leavePaySupplement) !== 0)
        ? parseFloat(leavePaySupplement)
        : emp.leavePaySupplement;

      const updatedOtherDeductions = otherDeductions !== undefined ? parseFloat(otherDeductions) : payrollRecord.otherDeductions;
      const updatedLaborGrade = (laborInsuranceGrade !== undefined && parseFloat(laborInsuranceGrade) !== 0)
        ? parseFloat(laborInsuranceGrade)
        : emp.laborInsuranceGrade;
      const updatedOccupationalGrade = (laborOccupationalGrade !== undefined && parseFloat(laborOccupationalGrade) !== 0)
        ? parseFloat(laborOccupationalGrade)
        : emp.laborOccupationalGrade;
      const updatedHealthGrade = (healthInsuranceGrade !== undefined && parseFloat(healthInsuranceGrade) !== 0)
        ? parseFloat(healthInsuranceGrade)
        : emp.healthInsuranceGrade;
      const updatedPensionGrade = (laborPensionGrade !== undefined && parseFloat(laborPensionGrade) !== 0)
        ? parseFloat(laborPensionGrade)
        : emp.laborPensionGrade;

      const freshAttendance = await getFreshAttendanceSummary(
        req.prisma,
        emp,
        y,
        m,
        {
          baseSalary: payrollRecord.baseSalary > 0 ? payrollRecord.baseSalary : emp.baseSalary,
          allowanceAA: updatedAA,
          allowanceLicense: updatedLicense,
          allowanceManager: payrollRecord.allowanceManager || emp.allowanceManager || 0,
          otherAllowance: updatedOther,
          bonus: updatedBonus
        },
        settings
      );

      // Prepare attendance summary for recalculation
      // Preserve existing hours from payrollRecord so manual edits and calculated hours are not lost during import.
      const attendanceSummary = {
        workDays: req.body.overrides?.workDays !== undefined ? parseFloat(req.body.overrides.workDays) : payrollRecord.workDays,
        leaveDays: req.body.overrides?.leaveDays !== undefined ? parseFloat(req.body.overrides.leaveDays) : payrollRecord.leaveDays,
        absentDays: req.body.overrides?.absentDays !== undefined ? parseFloat(req.body.overrides.absentDays) : payrollRecord.absentDays,
        overtimeHours: payrollRecord.overtimeHours,
        overtimeHours134: payrollRecord.overtimeHours134,
        overtimeHours167: payrollRecord.overtimeHours167,
        overtimeHours200: payrollRecord.overtimeHours200,
        overtimeHours267: payrollRecord.overtimeHours267,
        regularHours: req.body.overrides?.regularHours !== undefined ? parseFloat(req.body.overrides.regularHours) : payrollRecord.regularHours,
        bonus: updatedBonus,
        retroPay: payrollRecord.retroPay,
        otherDeductions: updatedOtherDeductions,
        leaveDeduction: freshAttendance.leaveDeduction,
        leaveHoursHalf: freshAttendance.leaveHoursHalf,
        leaveHoursPaid: freshAttendance.leaveHoursPaid,
        supplementaryHealthInsurance: updatedSuppHealth,
        prevInsuranceDifference: updatedPrevDiff,
        healthDisabilityExemption: updatedExemption,
        laborDisabilityExemption: updatedLaborExemption,
        healthGovSubsidy: updatedSubsidy,
        leavePaySupplement: updatedLeaveSupp
      };

      // Recalculate
      // Temporarily override employee's allowances and settings for calculation
      const empOverride = {
        ...emp,
        allowanceAA: updatedAA,
        allowanceLicense: updatedLicense,
        otherAllowance: updatedOther,
        mealAllowance: updatedMeal,
        supplementaryHealthInsurance: updatedSuppHealth,
        prevInsuranceDifference: updatedPrevDiff,
        healthDisabilityExemption: updatedExemption,
        laborDisabilityExemption: updatedLaborExemption,
        healthGovSubsidy: updatedSubsidy,
        leavePaySupplement: updatedLeaveSupp,
        laborInsuranceGrade: updatedLaborGrade,
        laborOccupationalGrade: updatedOccupationalGrade,
        healthInsuranceGrade: updatedHealthGrade,
        laborPensionGrade: updatedPensionGrade
      };

      const payDetails = calculatePayroll(empOverride, attendanceSummary, settings);

      const updatedRecord = await req.prisma.payrollRecord.update({
        where: { id: payrollRecord.id },
        data: {
          ...payDetails,
          notes: updatedNotes,
          calculatedAt: new Date().toISOString()
        },
        include: {
          employee: {
            select: { id: true, employeeNo: true, name: true, department: true, position: true }
          }
        }
      });

      updatedRecords.push(updatedRecord);
    }

    res.json({
      message: `成功更新 ${updatedRecords.length} 筆薪資紀錄`,
      data: updatedRecords
    });
  } catch (error) {
    console.error('Batch update adjustments error:', error);
    res.status(500).json({ error: '批次調整失敗' });
  }
});

/**
 * POST /api/payroll/batch-delete
 * Delete multiple payroll records. Only allowed for DRAFT records.
 */
router.post('/batch-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: '請提供要刪除的薪資紀錄 ID 陣列' });
    }

    const result = await req.prisma.payrollRecord.deleteMany({
      where: {
        id: { in: ids.map(id => parseInt(id)) },
        status: 'DRAFT'
      }
    });

    res.json({ message: `成功刪除 ${result.count} 筆草稿薪資紀錄` });
  } catch (error) {
    console.error('Batch delete payroll error:', error);
    res.status(500).json({ error: '批次刪除薪資紀錄失敗' });
  }
});

/**
 * POST /api/payroll/batch-lock
 * Lock multiple payroll records.
 */
router.post('/batch-lock', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: '請提供要鎖定的薪資紀錄 ID 陣列' });
    }

    const result = await req.prisma.payrollRecord.updateMany({
      where: {
        id: { in: ids.map(id => parseInt(id)) },
        status: 'DRAFT'
      },
      data: { status: 'LOCKED' }
    });

    res.json({ message: `成功鎖定 ${result.count} 筆薪資紀錄` });
  } catch (error) {
    console.error('Batch lock payroll error:', error);
    res.status(500).json({ error: '批次鎖定薪資紀錄失敗' });
  }
});

/**
 * POST /api/payroll/batch-approve
 * Approve multiple payroll records.
 */
router.post('/batch-approve', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: '請提供要核准的薪資紀錄 ID 陣列' });
    }

    const result = await req.prisma.payrollRecord.updateMany({
      where: {
        id: { in: ids.map(id => parseInt(id)) },
        status: { in: ['DRAFT', 'LOCKED'] }
      },
      data: {
        status: 'APPROVED',
        approvedBy: req.user.name,
        approvedAt: new Date().toISOString()
      }
    });

    res.json({ message: `成功核准 ${result.count} 筆薪資紀錄` });
  } catch (error) {
    console.error('Batch approve payroll error:', error);
    res.status(500).json({ error: '批次核准薪資紀錄失敗' });
  }
});

/**
 * GET /api/payroll/:id/pdf
 * Download single payroll slip as PDF.
 */
router.get('/:id/pdf', validateId(), async (req, res) => {
  try {
    const record = await req.prisma.payrollRecord.findUnique({
      where: { id: req.params.id },
      include: { employee: true }
    });

    if (!record) {
      return res.status(404).json({ error: '找不到該筆薪資紀錄' });
    }

    // Get settings
    const rawSettings = await req.prisma.systemSetting.findMany();
    const settings = {};
    rawSettings.forEach(s => { settings[s.key] = s.value; });

    const startDate = `${record.year}-${String(record.month).padStart(2, '0')}-01`;
    const lastDay = new Date(record.year, record.month, 0).getDate();
    const endDate = `${record.year}-${String(record.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const leaves = await req.prisma.leaveRecord.findMany({
      where: {
        employeeId: record.employeeId,
        status: 'approved',
        startDate: { lte: endDate },
        endDate: { gte: startDate }
      }
    });

    record.employee.standardDailyHours = await getStandardHoursForEmployee(record.employee.name, record.year, record.month);
    const pdfBuffer = await generatePayrollPDF(record, record.employee, settings, leaves);

    const filename = `payroll_${record.year}_${record.month}_${record.employee.name}.pdf`;
    const encodedFilename = encodeURIComponent(filename);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Generate PDF error:', error);
    res.status(500).json({ error: '薪資單 PDF 產生失敗' });
  }
});

/**
 * POST /api/payroll/batch-pdf
 * Download multiple payroll slips combined in a single PDF.
 */
router.post('/batch-pdf', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: '請提供要下載的薪資紀錄 ID 陣列' });
    }

    const records = await req.prisma.payrollRecord.findMany({
      where: { id: { in: ids.map(id => parseInt(id)) } },
      include: { employee: true }
    });

    if (records.length === 0) {
      return res.status(404).json({ error: '找不到對應的薪資紀錄' });
    }

    // Get settings
    const rawSettings = await req.prisma.systemSetting.findMany();
    const settings = {};
    rawSettings.forEach(s => { settings[s.key] = s.value; });

    // Fetch all leaves for these records at once to be efficient
    const employeeIds = records.map(r => r.employeeId);
    const years = [...new Set(records.map(r => r.year))];
    const months = [...new Set(records.map(r => r.month))];
    const leaves = await req.prisma.leaveRecord.findMany({
      where: {
        employeeId: { in: employeeIds },
        status: 'approved',
        startDate: { lte: `${Math.max(...years)}-${String(Math.max(...months)).padStart(2, '0')}-31` },
        endDate: { gte: `${Math.min(...years)}-${String(Math.min(...months)).padStart(2, '0')}-01` }
      }
    });

    // We can generate PDFs and join them or write directly in a single document
    // Let's create a combined PDF using pdfkit directly to avoid extra libraries
    // and write custom rendering
    const doc = new PDFDocument({ size: 'A4', margin: 40 });

    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => {
      const combinedBuffer = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=payroll_slips_batch.pdf`);
      res.send(combinedBuffer);
    });

    // Fetch and cache standard daily hours for batch records
    const standardHoursCache = {};
    for (const record of records) {
      const cacheKey = `${record.employee.name}_${record.year}_${record.month}`;
      if (standardHoursCache[cacheKey] === undefined) {
        standardHoursCache[cacheKey] = await getStandardHoursForEmployee(record.employee.name, record.year, record.month);
      }
      record.employee.standardDailyHours = standardHoursCache[cacheKey];
    }

    records.forEach((record, index) => {
      if (index > 0) doc.addPage();
      const startDate = `${record.year}-${String(record.month).padStart(2, '0')}-01`;
      const lastDay = new Date(record.year, record.month, 0).getDate();
      const endDate = `${record.year}-${String(record.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const recordLeaves = leaves.filter(l => 
        l.employeeId === record.employeeId &&
        l.startDate <= endDate &&
        l.endDate >= startDate
      );

      drawPayrollSlip(doc, record, record.employee, settings, recordLeaves);
    });

    doc.end();
  } catch (error) {
    console.error('Batch PDF generation error:', error);
    res.status(500).json({ error: '批次薪資單產生失敗' });
  }
});

/**
 * DELETE /api/payroll/:id
 * Delete a single payroll record. Only allowed for DRAFT records.
 */
router.delete('/:id', validateId(), async (req, res) => {
  try {
    const existing = await req.prisma.payrollRecord.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: '找不到該筆薪資紀錄' });
    }
    if (existing.status !== 'DRAFT') {
      return res.status(400).json({ error: '僅能刪除草稿狀態的薪資紀錄' });
    }

    await req.prisma.payrollRecord.delete({ where: { id: req.params.id } });
    res.json({ message: '薪資紀錄已成功刪除' });
  } catch (error) {
    console.error('Delete payroll error:', error);
    res.status(500).json({ error: '刪除薪資紀錄失敗' });
  }
});

export default router;

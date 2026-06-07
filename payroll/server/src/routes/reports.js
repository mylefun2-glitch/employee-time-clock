import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { validateYearMonth } from '../middleware/validate.js';

const router = Router();
router.use(authenticate);

/**
 * GET /api/reports/monthly
 * Get monthly payroll summary.
 */
router.get('/monthly', validateYearMonth, async (req, res) => {
  try {
    const { year, month } = req.yearMonth;

    const records = await req.prisma.payrollRecord.findMany({
      where: { year, month, status: 'APPROVED' },
      include: {
        employee: { select: { department: true } }
      }
    });

    const summary = {
      totalGrossPay: 0,
      totalNetPay: 0,
      totalDeductions: 0,
      totalLaborInsEmployee: 0,
      totalHealthInsEmployee: 0,
      totalPensionEmployee: 0,
      totalTax: 0,
      totalLaborInsEmployer: 0,
      totalHealthInsEmployer: 0,
      totalPensionEmployer: 0,
      totalEmployerCost: 0,
      employeeCount: records.length,
      departmentBreakdown: {}
    };

    records.forEach(r => {
      summary.totalGrossPay += r.grossPay;
      summary.totalNetPay += r.netPay;
      summary.totalDeductions += r.totalDeductions;
      
      summary.totalLaborInsEmployee += r.laborInsuranceEmployee;
      summary.totalHealthInsEmployee += r.healthInsuranceEmployee;
      summary.totalPensionEmployee += r.laborPensionEmployee;
      summary.totalTax += r.incomeTax;

      summary.totalLaborInsEmployer += r.laborInsuranceEmployer;
      summary.totalHealthInsEmployer += r.healthInsuranceEmployer;
      summary.totalPensionEmployer += r.laborPensionEmployer;
      summary.totalEmployerCost += r.totalEmployerCost;

      const dept = r.employee.department;
      if (!summary.departmentBreakdown[dept]) {
        summary.departmentBreakdown[dept] = { grossPay: 0, netPay: 0, count: 0 };
      }
      summary.departmentBreakdown[dept].grossPay += r.grossPay;
      summary.departmentBreakdown[dept].netPay += r.netPay;
      summary.departmentBreakdown[dept].count += 1;
    });

    res.json({ data: summary });
  } catch (error) {
    console.error('Monthly report error:', error);
    res.status(500).json({ error: '產生月報表失敗' });
  }
});

/**
 * GET /api/reports/department
 * Get department payroll distribution.
 */
router.get('/department', validateYearMonth, async (req, res) => {
  try {
    const { year, month } = req.yearMonth;

    const records = await req.prisma.payrollRecord.findMany({
      where: { year, month, status: 'APPROVED' },
      include: {
        employee: { select: { department: true } }
      }
    });

    const breakdown = {};
    records.forEach(r => {
      const dept = r.employee.department;
      if (!breakdown[dept]) {
        breakdown[dept] = {
          department: dept,
          grossPay: 0,
          netPay: 0,
          overtimePay: 0,
          employerCost: 0,
          employeeCount: 0
        };
      }
      breakdown[dept].grossPay += r.grossPay;
      breakdown[dept].netPay += r.netPay;
      breakdown[dept].overtimePay += r.overtimePay;
      breakdown[dept].employerCost += r.totalEmployerCost;
      breakdown[dept].employeeCount += 1;
    });

    res.json({ data: Object.values(breakdown) });
  } catch (error) {
    console.error('Department report error:', error);
    res.status(500).json({ error: '產生部門報表失敗' });
  }
});

/**
 * GET /api/reports/yearly
 * Get yearly payroll summary.
 */
router.get('/yearly', async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();

    const records = await req.prisma.payrollRecord.findMany({
      where: { year, status: 'APPROVED' }
    });

    const months = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      grossPay: 0,
      netPay: 0,
      employeeCount: 0
    }));

    records.forEach(r => {
      const mIdx = r.month - 1;
      if (mIdx >= 0 && mIdx < 12) {
        months[mIdx].grossPay += r.grossPay;
        months[mIdx].netPay += r.netPay;
        months[mIdx].employeeCount += 1;
      }
    });

    res.json({ data: months, year });
  } catch (error) {
    console.error('Yearly report error:', error);
    res.status(500).json({ error: '產生年報表失敗' });
  }
});

/**
 * GET /api/reports/insurance
 * Get monthly labor and health insurance summary (both employee and employer shares).
 */
router.get('/insurance', validateYearMonth, async (req, res) => {
  try {
    const { year, month } = req.yearMonth;

    const records = await req.prisma.payrollRecord.findMany({
      where: { year, month, status: 'APPROVED' },
      include: {
        employee: {
          select: { employeeNo: true, name: true, department: true }
        }
      },
      orderBy: { employee: { employeeNo: 'asc' } }
    });

    const list = records.map(r => ({
      employeeId: r.employeeId,
      employeeNo: r.employee.employeeNo,
      name: r.employee.name,
      department: r.employee.department,
      laborEmployee: r.laborInsuranceEmployee,
      laborEmployer: r.laborInsuranceEmployer,
      laborTotal: r.laborInsuranceEmployee + r.laborInsuranceEmployer,
      healthEmployee: r.healthInsuranceEmployee,
      healthEmployer: r.healthInsuranceEmployer,
      healthTotal: r.healthInsuranceEmployee + r.healthInsuranceEmployer,
      pensionEmployee: r.laborPensionEmployee,
      pensionEmployer: r.laborPensionEmployer,
      pensionTotal: r.laborPensionEmployee + r.laborPensionEmployer
    }));

    // Calculate totals
    const totals = {
      laborEmployee: 0,
      laborEmployer: 0,
      laborTotal: 0,
      healthEmployee: 0,
      healthEmployer: 0,
      healthTotal: 0,
      pensionEmployee: 0,
      pensionEmployer: 0,
      pensionTotal: 0
    };

    list.forEach(item => {
      totals.laborEmployee += item.laborEmployee;
      totals.laborEmployer += item.laborEmployer;
      totals.laborTotal += item.laborTotal;
      totals.healthEmployee += item.healthEmployee;
      totals.healthEmployer += item.healthEmployer;
      totals.healthTotal += item.healthTotal;
      totals.pensionEmployee += item.pensionEmployee;
      totals.pensionEmployer += item.pensionEmployer;
      totals.pensionTotal += item.pensionTotal;
    });

    res.json({ data: list, totals });
  } catch (error) {
    console.error('Insurance report error:', error);
    res.status(500).json({ error: '產生勞健保彙總表失敗' });
  }
});

/**
 * GET /api/reports/dashboard
 * Get system dashboard statistics.
 */
router.get('/dashboard', async (req, res) => {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // 1. Count active employees
    const activeEmployeeCount = await req.prisma.employee.count({
      where: { isActive: true }
    });

    // 2. Count pending leave requests
    const pendingLeavesCount = await req.prisma.leaveRecord.count({
      where: { status: 'pending' }
    });

    // 3. Get payroll summary for current month (approved + drafts)
    const currentMonthPayroll = await req.prisma.payrollRecord.findMany({
      where: { year: currentYear, month: currentMonth }
    });

    let totalMonthlyGrossPay = 0;
    let totalMonthlyOvertimeHours = 0;
    currentMonthPayroll.forEach(p => {
      totalMonthlyGrossPay += p.grossPay;
      totalMonthlyOvertimeHours += p.overtimeHours;
    });

    // 4. Calculate monthly trends (last 6 months)
    const trends = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      
      const monthlyPayroll = await req.prisma.payrollRecord.findMany({
        where: { year: y, month: m }
      });
      
      let gross = 0;
      let net = 0;
      monthlyPayroll.forEach(p => {
        gross += p.grossPay;
        net += p.netPay;
      });

      trends.push({
        name: `${y}/${m}`,
        實發薪資: net,
        應發薪資: gross,
        員工人數: monthlyPayroll.length
      });
    }

    // 5. Get department breakdown for current month
    const employeesWithPayroll = await req.prisma.payrollRecord.findMany({
      where: { year: currentYear, month: currentMonth },
      include: { employee: { select: { department: true } } }
    });

    const deptBreakdown = {};
    employeesWithPayroll.forEach(p => {
      const dept = p.employee.department;
      if (!deptBreakdown[dept]) {
        deptBreakdown[dept] = { name: dept, value: 0, count: 0 };
      }
      deptBreakdown[dept].value += p.grossPay;
      deptBreakdown[dept].count += 1;
    });

    // Format department stats for pie chart
    const departmentStats = Object.values(deptBreakdown);

    res.json({
      activeEmployeeCount,
      pendingLeavesCount,
      totalMonthlyGrossPay,
      totalMonthlyOvertimeHours,
      trends,
      departmentStats
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: '取得儀表板數據失敗' });
  }
});

export default router;

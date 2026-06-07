import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireFields, validateId, validateYearMonth } from '../middleware/validate.js';
import { syncAttendanceAndLeaves } from '../services/supabaseSync.js';

const router = Router();
router.use(authenticate);

/**
 * GET /api/attendance
 * List attendance records with filters.
 * Query params: employeeId, year, month, startDate, endDate
 * Dynamically syncs from Supabase first.
 */
router.get('/', validateYearMonth, async (req, res) => {
  try {
    const { employeeId, startDate, endDate } = req.query;
    const { year, month } = req.yearMonth;

    // 1. Trigger dynamic sync from Supabase
    await syncAttendanceAndLeaves(year, month).catch(err => {
      console.error('Dynamic attendance sync error:', err);
    });

    const where = {};
    
    if (employeeId) {
      where.employeeId = parseInt(employeeId, 10);
    }
    
    if (startDate && endDate) {
      where.date = { gte: startDate, lte: endDate };
    } else {
      // Default to year/month filter
      const monthStr = String(month).padStart(2, '0');
      
      // Calculate exact days in this month to avoid range issue
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      const lastDay = new Date(nextYear, nextMonth - 1, 0).getDate();
      
      where.date = {
        gte: `${year}-${monthStr}-01`,
        lte: `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`,
      };
    }

    const records = await req.prisma.attendanceRecord.findMany({
      where,
      include: {
        employee: {
          select: { id: true, employeeNo: true, name: true, department: true },
        },
      },
      orderBy: [{ date: 'asc' }, { employeeId: 'asc' }],
    });

    res.json({ data: records, total: records.length });
  } catch (error) {
    console.error('List attendance error:', error);
    res.status(500).json({ error: '取得出勤記錄失敗' });
  }
});

/**
 * POST /api/attendance
 * Disabled: Attendance managed by external system.
 */
router.post('/', async (req, res) => {
  res.status(403).json({ error: '出勤資料由外部系統管理，此處僅供檢視與結算薪資。' });
});

/**
 * POST /api/attendance/batch
 * Disabled: Attendance managed by external system.
 */
router.post('/batch', async (req, res) => {
  res.status(403).json({ error: '出勤資料由外部系統管理，此處僅供檢視與結算薪資。' });
});

/**
 * PUT /api/attendance/:id
 * Disabled: Attendance managed by external system.
 */
router.put('/:id', async (req, res) => {
  res.status(403).json({ error: '出勤資料由外部系統管理，此處僅供檢視與結算薪資。' });
});

/**
 * POST /api/attendance/import
 * Disabled: Attendance managed by external system.
 */
router.post('/import', async (req, res) => {
  res.status(403).json({ error: '出勤資料由外部系統管理，此處僅供檢視與結算薪資。' });
});

export default router;

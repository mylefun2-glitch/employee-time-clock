import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { validatePagination } from '../middleware/validate.js';
import { syncAttendanceAndLeaves } from '../services/supabaseSync.js';

const router = Router();
router.use(authenticate);

/**
 * GET /api/leaves
 * List leave records with filters.
 * Dynamically syncs from Supabase first.
 */
router.get('/', validatePagination, async (req, res) => {
  try {
    const { page, pageSize, skip } = req.pagination;
    const { employeeId, leaveType, status, startDate, endDate } = req.query;

    // 1. Dynamic sync from Supabase first
    if (startDate) {
      try {
        const start = new Date(startDate);
        const end = endDate ? new Date(endDate) : new Date();
        
        let cur = new Date(start.getFullYear(), start.getMonth(), 1);
        const limit = new Date(end.getFullYear(), end.getMonth(), 1);
        
        let count = 0;
        while (cur <= limit && count < 6) {
          await syncAttendanceAndLeaves(cur.getFullYear(), cur.getMonth() + 1);
          cur.setMonth(cur.getMonth() + 1);
          count++;
        }
      } catch (err) {
        console.error('Dynamic leave range sync failed:', err);
      }
    } else {
      try {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        await syncAttendanceAndLeaves(currentYear, currentMonth);
        
        const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
        const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
        await syncAttendanceAndLeaves(prevYear, prevMonth);
      } catch (err) {
        console.error('Dynamic default leave sync failed:', err);
      }
    }

    const where = {};
    if (employeeId) where.employeeId = parseInt(employeeId, 10);
    if (leaveType) where.leaveType = leaveType;
    if (status) where.status = status;
    if (startDate && endDate) {
      where.startDate = { gte: startDate };
      where.endDate = { lte: endDate };
    }

    const [records, total] = await Promise.all([
      req.prisma.leaveRecord.findMany({
        where,
        include: {
          employee: {
            select: { id: true, employeeNo: true, name: true, department: true },
          },
        },
        skip,
        take: pageSize,
        orderBy: { startDate: 'desc' },
      }),
      req.prisma.leaveRecord.count({ where }),
    ]);

    res.json({
      data: records,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error('List leaves error:', error);
    res.status(500).json({ error: '取得請假記錄失敗' });
  }
});

/**
 * POST /api/leaves
 * Disabled: Leave management managed by external system.
 */
router.post('/', async (req, res) => {
  res.status(403).json({ error: '請假申請由外部系統管理，此處僅供檢視與結算薪資。' });
});

/**
 * PUT /api/leaves/:id
 * Disabled: Leave management managed by external system.
 */
router.put('/:id', async (req, res) => {
  res.status(403).json({ error: '請假申請由外部系統管理，此處僅供檢視與結算薪資。' });
});

/**
 * PUT /api/leaves/:id/approve
 * Disabled: Leave management managed by external system.
 */
router.put('/:id/approve', async (req, res) => {
  res.status(403).json({ error: '請假申請由外部系統管理，此處僅供檢視與結算薪資。' });
});

/**
 * POST /api/leaves/:id/approve
 * Disabled: Leave management managed by external system.
 */
router.post('/:id/approve', async (req, res) => {
  res.status(403).json({ error: '請假申請由外部系統管理，此處僅供檢視與結算薪資。' });
});

/**
 * POST /api/leaves/:id/reject
 * Disabled: Leave management managed by external system.
 */
router.post('/:id/reject', async (req, res) => {
  res.status(403).json({ error: '請假申請由外部系統管理，此處僅供檢視與結算薪資。' });
});

export default router;

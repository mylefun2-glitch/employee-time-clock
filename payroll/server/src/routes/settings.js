import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

/**
 * GET /api/settings
 * Get all system settings grouped by category.
 */
router.get('/', async (req, res) => {
  try {
    const settings = await req.prisma.systemSetting.findMany();
    
    // Group settings by category
    const grouped = {};
    settings.forEach(s => {
      if (!grouped[s.category]) {
        grouped[s.category] = [];
      }
      
      // Parse grade tables as JSON for easier consumption on frontend
      if (s.category === 'grade_table') {
        try {
          grouped[s.category].push({
            ...s,
            value: JSON.parse(s.value)
          });
        } catch (e) {
          grouped[s.category].push(s);
        }
      } else {
        grouped[s.category].push(s);
      }
    });

    res.json({ data: grouped });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: '取得系統設定失敗' });
  }
});

/**
 * PUT /api/settings
 * Bulk update settings.
 * Accepts format: { settings: { [key]: value } } or { settings: [{ key, value }] }
 */
router.put('/', async (req, res) => {
  try {
    const { settings } = req.body;

    if (!settings) {
      return res.status(400).json({ error: '請提供設定資料' });
    }

    const updated = [];

    if (Array.isArray(settings)) {
      // [{ key, value }]
      for (const item of settings) {
        let val = typeof item.value === 'object' ? JSON.stringify(item.value) : String(item.value);
        const s = await req.prisma.systemSetting.update({
          where: { key: item.key },
          data: { value: val }
        });
        updated.push(s);
      }
    } else if (typeof settings === 'object') {
      // { [key]: value }
      const keys = Object.keys(settings);
      for (const key of keys) {
        let val = typeof settings[key] === 'object' ? JSON.stringify(settings[key]) : String(settings[key]);
        const s = await req.prisma.systemSetting.update({
          where: { key },
          data: { value: val }
        });
        updated.push(s);
      }
    } else {
      return res.status(400).json({ error: '不支援的資料格式' });
    }

    res.json({ message: '系統設定已更新', count: updated.length });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: '更新系統設定失敗' });
  }
});

export default router;

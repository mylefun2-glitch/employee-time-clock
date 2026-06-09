import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Route imports
import authRoutes from './routes/auth.js';
import employeeRoutes from './routes/employees.js';
import attendanceRoutes from './routes/attendance.js';
import leaveRoutes from './routes/leaves.js';
import payrollRoutes from './routes/payroll.js';
import reportRoutes from './routes/reports.js';
import settingsRoutes from './routes/settings.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

// Middleware
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://localhost:3001',
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    
    const isAllowed = allowedOrigins.includes(origin) ||
      origin.endsWith('.vercel.app') ||
      (process.env.ALLOWED_ORIGINS && process.env.ALLOWED_ORIGINS.split(',').includes(origin));
      
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Make prisma available to routes
app.use((req, res, next) => {
  req.prisma = prisma;
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: '社照會薪資系統 API' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);

// Serve client static files
const clientDistPath = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));

// API 404 handler
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API 路由不存在', path: req.path });
});

// HTML5 routing fallback for SPA
app.get('/*splat', (req, res) => {
  const indexPath = path.join(clientDistPath, 'index.html');
  console.log(`[Server] SPA fallback request: ${req.path} -> resolved to: ${indexPath}`);
  res.sendFile(indexPath, { dotfiles: 'allow' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: '伺服器內部錯誤',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Ensure leave deduction rules setting exists on startup
async function ensureLeaveDeductionRules() {
  try {
    const key = 'leave_deduction_rules';
    const existing = await prisma.systemSetting.findUnique({ where: { key } });
    const defaultRules = [
      { leaveType: '生理假', deductionType: 'half', rate: 0.5, label: '生理假' },
      { leaveType: '病假', deductionType: 'half', rate: 0.5, label: '普通傷病假' },
      { leaveType: '事假', deductionType: 'full', rate: 1.0, label: '事假' },
      { leaveType: '家庭照顧假', deductionType: 'full', rate: 1.0, label: '家庭照顧假' },
      { leaveType: '特休', deductionType: 'none', rate: 0.0, label: '特別休假' },
      { leaveType: '公假', deductionType: 'none', rate: 0.0, label: '公假' },
      { leaveType: '婚假', deductionType: 'none', rate: 0.0, label: '婚假' },
      { leaveType: '喪假', deductionType: 'none', rate: 0.0, label: '喪假' },
      { leaveType: '產假', deductionType: 'none', rate: 0.0, label: '產假' },
      { leaveType: '陪產假', deductionType: 'none', rate: 0.0, label: '陪產檢及陪產假' },
      { leaveType: '補休', deductionType: 'none', rate: 0.0, label: '補休' },
      { leaveType: '公出', deductionType: 'none', rate: 0.0, label: '公出' },
      { leaveType: '家訪', deductionType: 'none', rate: 0.0, label: '家訪' },
      { leaveType: '出差', deductionType: 'none', rate: 0.0, label: '出差' },
      { leaveType: '會議', deductionType: 'none', rate: 0.0, label: '會議' },
      { leaveType: '訓練', deductionType: 'none', rate: 0.0, label: '訓練' },
      { leaveType: '培訓', deductionType: 'none', rate: 0.0, label: '培訓' }
    ];

    if (!existing) {
      await prisma.systemSetting.create({
        data: {
          category: 'leave_rules',
          key,
          value: JSON.stringify(defaultRules),
          label: '請假扣薪規則設定',
          notes: '自訂假別的扣薪規則與比例'
        }
      });
      console.log('[Startup] Created default leave deduction rules setting.');
    } else {
      // Merge missing default rules into the existing rules list
      try {
        const currentRules = JSON.parse(existing.value);
        let modified = false;
        defaultRules.forEach(defRule => {
          const exists = currentRules.some(r => r.leaveType.toLowerCase() === defRule.leaveType.toLowerCase());
          if (!exists) {
            currentRules.push(defRule);
            modified = true;
          }
        });
        if (modified) {
          await prisma.systemSetting.update({
            where: { key },
            data: { value: JSON.stringify(currentRules) }
          });
          console.log('[Startup] Upgraded leave deduction rules setting with missing default types.');
        }
      } catch (e) {
        console.error('[Startup] Failed to upgrade existing leave rules:', e);
      }
    }
  } catch (error) {
    console.error('[Startup] Failed to check/create leave deduction rules:', error);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

app.listen(PORT, async () => {
  console.log(`社照會薪資系統 API server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  await ensureLeaveDeductionRules();
});

export default app;

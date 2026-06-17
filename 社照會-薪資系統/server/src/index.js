import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Route imports
import authRoutes from './routes/auth.js';
import employeeRoutes from './routes/employees.js';
import attendanceRoutes from './routes/attendance.js';
import leaveRoutes from './routes/leaves.js';
import payrollRoutes from './routes/payroll.js';
import reportRoutes from './routes/reports.js';
import settingsRoutes from './routes/settings.js';
import { ensureFontDownloaded } from './services/pdfGenerator.js';

dotenv.config();

// Ensure DATABASE_URL specifies schema=payroll for PostgreSQL if not already present
if (process.env.DATABASE_URL && (process.env.DATABASE_URL.startsWith('postgres:') || process.env.DATABASE_URL.startsWith('postgresql:')) && !process.env.DATABASE_URL.includes('schema=')) {
  const separator = process.env.DATABASE_URL.includes('?') ? '&' : '?';
  process.env.DATABASE_URL = `${process.env.DATABASE_URL}${separator}schema=payroll`;
  console.log('[Prisma] Appended schema=payroll to DATABASE_URL');
}

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
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
  res.json({
    status: 'ok',
    timestamp: new Date(),
    service: '社照會薪資系統 API'
  });
});

app.get('/api/version', (req, res) => {
  res.json({ version: 'fix-nhi-1' });
});

app.get('/api/test-nhi-calc', async (req, res) => {
  try {
    const { calculatePayroll } = await import('./services/payrollCalculator.js');
    const result = calculatePayroll(
      { baseSalary: 33000, salaryType: 'monthly', healthInsuranceGrade: -1 },
      { leaveDeduction: 11000 },
      { minimum_wage_monthly: '29500' }
    );
    res.json({ result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: '路由不存在', path: req.path });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: '伺服器內部錯誤',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`社照會薪資系統 API server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  ensureFontDownloaded().catch(err => console.error('[Startup] Failed to download Chinese font:', err));
});

export default app;

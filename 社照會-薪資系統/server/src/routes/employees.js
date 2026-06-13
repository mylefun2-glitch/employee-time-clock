import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireFields, validateId, validatePagination, sanitizeBody } from '../middleware/validate.js';
import { supabase } from '../services/supabase.js';
import { syncEmployees } from '../services/supabaseSync.js';

const router = Router();

// All employee routes require authentication
router.use(authenticate);

/**
 * GET /api/employees
 * List employees with search, filter, and pagination.
 * Syncs employees from Supabase before querying SQLite.
 */
router.get('/', validatePagination, async (req, res) => {
  try {
    // 1. Sync from Supabase to keep SQLite cache updated
    await syncEmployees().catch(err => console.error('Supabase sync error:', err));

    const { page, pageSize, skip } = req.pagination;
    const { search, department, isActive, salaryType, sortBy, sortOrder } = req.query;

    // Build where clause
    const where = {};
    
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { employeeNo: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ];
    }
    
    if (department) {
      where.department = department;
    }
    
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    } else {
      where.isActive = true;
    }
    
    if (salaryType) {
      where.salaryType = salaryType;
    }

    // Determine sorting
    let orderBy = { department: 'asc' };
    if (sortBy) {
      orderBy = { [sortBy]: sortOrder === 'desc' ? 'desc' : 'asc' };
    }

    const [employees, total] = await Promise.all([
      req.prisma.employee.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
      }),
      req.prisma.employee.count({ where }),
    ]);

    res.json({
      data: employees,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('List employees error:', error);
    res.status(500).json({ error: '取得員工列表失敗' });
  }
});

/**
 * POST /api/employees
 * Create a new employee. Write to Supabase first, then sync to SQLite.
 */
router.post('/', sanitizeBody, requireFields('employeeNo', 'name', 'department', 'hireDate'), async (req, res) => {
  try {
    const {
      employeeNo, name, idNumber, gender, birthDate, phone, address, email,
      department, position, hireDate, salaryType, baseSalary,
      mealAllowance, transportAllowance, otherAllowance,
      laborInsuranceGrade, healthInsuranceGrade, laborPensionGrade,
      voluntaryPensionRate, dependents, bankAccount, bankName, notes,
    } = req.body;

    // Check for duplicate employee number locally
    const existing = await req.prisma.employee.findUnique({ where: { employeeNo } });
    if (existing) {
      return res.status(409).json({ error: '員工編號已存在', field: 'employeeNo' });
    }

    // 1. Write profile to Supabase
    const sbGender = gender === 'M' ? 'MALE' : 'FEMALE';
    const { data: sbEmp, error: sbError } = await supabase
      .from('employees')
      .insert({
        name,
        pin: idNumber || '123456',
        username: email || `${employeeNo.toLowerCase()}@socialcare.org.tw`,
        gmail: email || null,
        department,
        position: position || '員工',
        is_active: true,
        join_date: hireDate,
        birth_date: birthDate || null,
        contact_phone: phone || null,
        mailing_address: address || null,
        gender: sbGender
      })
      .select('*');

    if (sbError) {
      console.error('Supabase create employee error:', sbError);
      return res.status(500).json({ error: '建立 Supabase 員工檔案失敗' });
    }

    // 2. Write schedule to Supabase
    if (sbEmp && sbEmp.length > 0) {
      const newSbEmpId = sbEmp[0].id;
      const { error: schedError } = await supabase
        .from('employee_schedules')
        .insert({
          employee_id: newSbEmpId,
          effective_date: hireDate,
          work_start_time: '08:00',
          work_end_time: '17:00',
          break_start_time: '12:00',
          break_end_time: '13:00',
          salary_type: salaryType === 'hourly' ? 'HOURLY' : 'MONTHLY',
          standard_daily_hours: 8
        });
      if (schedError) {
        console.error('Supabase create schedule error:', schedError);
      }
    }

    // 3. Sync from Supabase to SQLite
    await syncEmployees().catch(err => console.error('Post-sync failed:', err));

    // 4. Update the newly created local employee with remaining payroll parameters (allowances, grades)
    const localEmp = await req.prisma.employee.update({
      where: { employeeNo },
      data: {
        baseSalary: parseFloat(baseSalary) || 0,
        mealAllowance: parseFloat(mealAllowance) || 0,
        transportAllowance: parseFloat(transportAllowance) || 0,
        otherAllowance: parseFloat(otherAllowance) || 0,
        laborInsuranceGrade: parseFloat(laborInsuranceGrade) || 0,
        healthInsuranceGrade: parseFloat(healthInsuranceGrade) || 0,
        laborPensionGrade: parseFloat(laborPensionGrade) || 0,
        voluntaryPensionRate: parseFloat(voluntaryPensionRate) || 0,
        dependents: parseInt(dependents) || 0,
        bankAccount: bankAccount || null,
        bankName: bankName || null,
        notes: notes || null,
      }
    });

    res.status(201).json({ data: localEmp, message: '員工建立成功' });
  } catch (error) {
    console.error('Create employee error:', error);
    res.status(500).json({ error: '建立員工失敗' });
  }
});

/**
 * GET /api/employees/departments
 * Get all unique departments currently in the database.
 */
router.get('/departments', async (req, res) => {
  try {
    const departments = await req.prisma.employee.findMany({
      select: { department: true },
      distinct: ['department'],
      where: { isActive: true }
    });
    const list = departments.map(d => d.department).filter(Boolean);
    res.json(list);
  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({ error: '取得部門清單失敗' });
  }
});

/**
 * GET /api/employees/:id
 * Get a single employee with related records.
 */
router.get('/:id', validateId(), async (req, res) => {
  try {
    const employee = await req.prisma.employee.findUnique({
      where: { id: req.params.id },
      include: {
        attendanceRecords: {
          orderBy: { date: 'desc' },
          take: 30,
        },
        leaveRecords: {
          orderBy: { startDate: 'desc' },
          take: 10,
        },
        payrollRecords: {
          orderBy: [{ year: 'desc' }, { month: 'desc' }],
          take: 12,
        },
      },
    });

    if (!employee) {
      return res.status(404).json({ error: '員工不存在' });
    }

    res.json({ data: employee });
  } catch (error) {
    console.error('Get employee error:', error);
    res.status(500).json({ error: '取得員工資訊失敗' });
  }
});

/**
 * GET /api/employees/:id/salary-history
 */
router.get('/:id/salary-history', validateId(), async (req, res) => {
  try {
    const history = await req.prisma.payrollRecord.findMany({
      where: { employeeId: req.params.id },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
    res.json({ data: history });
  } catch (error) {
    console.error('Get salary history error:', error);
    res.status(500).json({ error: '取得員工薪資歷史失敗' });
  }
});

/**
 * GET /api/employees/:id/attendance
 */
router.get('/:id/attendance', validateId(), async (req, res) => {
  try {
    const records = await req.prisma.attendanceRecord.findMany({
      where: { employeeId: req.params.id },
      orderBy: { date: 'desc' },
      take: 60,
    });
    res.json({ data: records });
  } catch (error) {
    console.error('Get employee attendance error:', error);
    res.status(500).json({ error: '取得員工出勤記錄失敗' });
  }
});

/**
 * GET /api/employees/:id/leaves
 */
router.get('/:id/leaves', validateId(), async (req, res) => {
  try {
    const records = await req.prisma.leaveRecord.findMany({
      where: { employeeId: req.params.id },
      orderBy: { startDate: 'desc' },
    });
    res.json({ data: records });
  } catch (error) {
    console.error('Get employee leaves error:', error);
    res.status(500).json({ error: '取得員工請假記錄失敗' });
  }
});

/**
 * PUT /api/employees/:id
 * Update an employee. Updates Supabase first, then syncs to SQLite.
 */
router.put('/:id', validateId(), sanitizeBody, async (req, res) => {
  try {
    const existing = await req.prisma.employee.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: '員工不存在' });
    }

    const {
      name, idNumber, gender, birthDate, phone, address, email,
      department, position, hireDate, salaryType, baseSalary,
      mealAllowance, transportAllowance, otherAllowance,
      laborInsuranceGrade, healthInsuranceGrade, laborPensionGrade,
      voluntaryPensionRate, dependents, bankAccount, bankName, notes, isActive
    } = req.body;

    // 1. Update in Supabase (key off their email/username)
    const sbUpdate = {};
    if (name !== undefined) sbUpdate.name = name;
    if (idNumber !== undefined) sbUpdate.pin = idNumber;
    if (department !== undefined) sbUpdate.department = department;
    if (position !== undefined) sbUpdate.position = position;
    if (hireDate !== undefined) sbUpdate.join_date = hireDate;
    if (birthDate !== undefined) sbUpdate.birth_date = birthDate;
    if (phone !== undefined) sbUpdate.contact_phone = phone;
    if (address !== undefined) sbUpdate.mailing_address = address;
    if (gender !== undefined) sbUpdate.gender = gender === 'M' ? 'MALE' : 'FEMALE';
    if (isActive !== undefined) sbUpdate.is_active = Boolean(isActive);

    const matchEmail = existing.email || `${existing.employeeNo.toLowerCase()}@socialcare.org.tw`;

    const { error: sbError } = await supabase
      .from('employees')
      .update(sbUpdate)
      .eq('username', matchEmail);

    if (sbError) {
      console.error('Supabase update employee error:', sbError);
    }

    // 2. Also update schedule salary type if it was updated
    if (salaryType !== undefined) {
      // Find Supabase ID of employee
      const { data: sbEmp } = await supabase
        .from('employees')
        .select('id')
        .eq('username', matchEmail)
        .limit(1);

      if (sbEmp && sbEmp.length > 0) {
        await supabase
          .from('employee_schedules')
          .update({ salary_type: salaryType === 'hourly' ? 'HOURLY' : 'MONTHLY' })
          .eq('employee_id', sbEmp[0].id);
      }
    }

    // 3. Sync from Supabase to SQLite
    await syncEmployees().catch(err => console.error('Post-sync failed:', err));

    // 4. Update the remaining SQLite payroll settings
    const updateData = {};
    const numericFields = [
      'baseSalary', 'mealAllowance', 'transportAllowance', 'otherAllowance',
      'laborInsuranceGrade', 'healthInsuranceGrade', 'laborPensionGrade',
      'voluntaryPensionRate',
    ];
    const intFields = ['dependents'];

    numericFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = parseFloat(req.body[field]) || 0;
      }
    });
    intFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = parseInt(req.body[field]) || 0;
      }
    });
    if (bankAccount !== undefined) updateData.bankAccount = bankAccount;
    if (bankName !== undefined) updateData.bankName = bankName;
    if (notes !== undefined) updateData.notes = notes;

    const employee = await req.prisma.employee.update({
      where: { id: req.params.id },
      data: updateData,
    });

    res.json({ data: employee, message: '員工更新成功' });
  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({ error: '更新員工失敗' });
  }
});

/**
 * DELETE /api/employees/:id
 * Soft delete an employee (set isActive = false). Updates Supabase, then syncs.
 */
router.delete('/:id', validateId(), async (req, res) => {
  try {
    const existing = await req.prisma.employee.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: '員工不存在' });
    }

    // 1. Deactivate in Supabase
    const matchEmail = existing.email || `${existing.employeeNo.toLowerCase()}@socialcare.org.tw`;
    const { error: sbError } = await supabase
      .from('employees')
      .update({ is_active: false })
      .eq('username', matchEmail);

    if (sbError) {
      console.error('Supabase delete employee error:', sbError);
    }

    // 2. Sync from Supabase to SQLite
    await syncEmployees().catch(err => console.error('Post-sync failed:', err));

    // 3. Mark in SQLite
    await req.prisma.employee.update({
      where: { id: req.params.id },
      data: { isActive: false, resignDate: new Date().toISOString().split('T')[0] },
    });

    res.json({ message: '員工已停用' });
  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({ error: '停用員工失敗' });
  }
});

export default router;

import { supabase } from './supabase.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

let lastEmployeeSync = 0;
const lastAttendanceSyncs = {};
const SYNC_COOLDOWN_MS = 30 * 1000; // 30 seconds cooldown

/**
 * Sync employees from Supabase to SQLite.
 */
export async function syncEmployees(force = false) {
  const now = Date.now();
  if (!force && (now - lastEmployeeSync < SYNC_COOLDOWN_MS)) {
    console.log('[Sync] Skipping employee sync (cooldown active)');
    return 0;
  }

  console.log('Starting employee sync from Supabase...');
  try {
    // 1. Fetch all employees from Supabase
    const { data: sbEmployees, error } = await supabase
      .from('employees')
      .select('*');

    if (error) {
      throw error;
    }

    console.log(`Fetched ${sbEmployees.length} employees from Supabase.`);

    let syncedCount = 0;
    const syncedEmployeeNos = [];

    for (const sbEmp of sbEmployees) {
      // Generate a clean employee no if not present
      let employeeNo = '';
      if (sbEmp.username && sbEmp.username.includes('@')) {
        employeeNo = sbEmp.username.split('@')[0].toUpperCase();
      } else {
        employeeNo = `EMP-${sbEmp.id.substring(0, 4).toUpperCase()}`;
      }
      syncedEmployeeNos.push(employeeNo);

      const salaryType = (sbEmp.salary_type || 'MONTHLY').toLowerCase() === 'hourly' ? 'hourly' : 'monthly';
      const gender = sbEmp.gender === 'FEMALE' ? 'F' : sbEmp.gender === 'MALE' ? 'M' : 'F';

      const baseSalaryVal = salaryType === 'hourly'
        ? (parseFloat(sbEmp.hourly_rate) || 0)
        : (parseFloat(sbEmp.base_salary) || 0);
      const allowanceManagerVal = parseFloat(sbEmp.allowance_manager) || 0;
      const allowanceLicenseVal = parseFloat(sbEmp.allowance_license) || 0;
      const otherAllowanceVal = parseFloat(sbEmp.other_allowance) || 0;

      // Upsert into local SQLite Employee table
      await prisma.employee.upsert({
        where: { employeeNo },
        update: {
          name: sbEmp.name || '無名',
          idNumber: sbEmp.pin || null,
          gender,
          birthDate: sbEmp.birth_date || null,
          phone: sbEmp.contact_phone || null,
          address: sbEmp.mailing_address || null,
          email: sbEmp.gmail || sbEmp.username || null,
          department: sbEmp.department || '未核定',
          position: sbEmp.position || '員工',
           hireDate: sbEmp.join_date || new Date().toISOString().split('T')[0],
          resignDate: sbEmp.insurance_end_date || null,
          salaryType,
          baseSalary: baseSalaryVal,
          allowanceManager: allowanceManagerVal,
          allowanceLicense: allowanceLicenseVal,
          otherAllowance: otherAllowanceVal,
          isActive: sbEmp.is_active !== false,
          bankName: sbEmp.bank_name || null,
          bankAccount: sbEmp.bank_account || null,
        },
        create: {
          employeeNo,
          name: sbEmp.name || '無名',
          idNumber: sbEmp.pin || null,
          gender,
          birthDate: sbEmp.birth_date || null,
          phone: sbEmp.contact_phone || null,
          address: sbEmp.mailing_address || null,
          email: sbEmp.gmail || sbEmp.username || null,
          department: sbEmp.department || '未核定',
          position: sbEmp.position || '員工',
          hireDate: sbEmp.join_date || new Date().toISOString().split('T')[0],
          resignDate: sbEmp.insurance_end_date || null,
          salaryType,
          baseSalary: baseSalaryVal,
          allowanceManager: allowanceManagerVal,
          allowanceLicense: allowanceLicenseVal,
          otherAllowance: otherAllowanceVal,
          mealAllowance: 0,
          transportAllowance: 0,
          isActive: sbEmp.is_active !== false,
          bankName: sbEmp.bank_name || null,
          bankAccount: sbEmp.bank_account || null,
        }
      });

      syncedCount++;
    }

    // Deactivate local employees that do not exist in Supabase (e.g. old seeded test data)
    await prisma.employee.updateMany({
      where: {
        employeeNo: { notIn: syncedEmployeeNos }
      },
      data: {
        isActive: false
      }
    });

    lastEmployeeSync = Date.now();
    console.log(`Successfully synced ${syncedCount} employees to SQLite.`);
    return syncedCount;
  } catch (err) {
    console.error('Error syncing employees:', err);
    throw err;
  }
}

/**
 * Sync attendance and leaves from Supabase to SQLite for a specific month.
 * This translates Supabase logs and leave_requests into local AttendanceRecord and LeaveRecord.
 */
const activeSyncs = {};

export function syncAttendanceAndLeaves(year, month, force = false, targetEmployeeId = null) {
  const key = targetEmployeeId ? `${year}_${month}_${targetEmployeeId}` : `${year}_${month}`;
  const now = Date.now();
  if (!targetEmployeeId && !force && lastAttendanceSyncs[key] && (now - lastAttendanceSyncs[key] < SYNC_COOLDOWN_MS)) {
    console.log(`[Sync] Skipping attendance and leaves sync for ${key} (cooldown active)`);
    return Promise.resolve();
  }

  if (activeSyncs[key]) {
    console.log(`[Sync] Reusing active sync promise for ${key}`);
    return activeSyncs[key];
  }

  const promise = (async () => {
    const monthStr = String(month).padStart(2, '0');
    
    // Calculate exact days in this month to avoid out-of-bounds queries or delete range errors
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const lastDay = new Date(nextYear, nextMonth - 1, 0).getDate();
    
    const startDate = `${year}-${monthStr}-01`;
    const endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

    try {
      console.log(`Syncing attendance and leaves for ${year}-${monthStr} (${startDate} to ${endDate}) targetEmployeeId=${targetEmployeeId}...`);

      // Get all synced local employees to map Supabase UUIDs
      const dbEmployees = await prisma.employee.findMany();

      let targetSbUuid = null;
      if (targetEmployeeId) {
        const localEmp = dbEmployees.find(e => e.id === targetEmployeeId);
        if (localEmp) {
          // Fetch employees from Supabase to find their UUID
          const { data: targetSbEmp, error: targetSbEmpErr } = await supabase
            .from('employees')
            .select('id, username')
            .or(`username.eq.${localEmp.email},name.eq.${localEmp.name}`);
          
          if (!targetSbEmpErr && targetSbEmp && targetSbEmp.length > 0) {
            targetSbUuid = targetSbEmp[0].id;
            console.log(`Found target employee UUID: ${targetSbUuid} for local ID: ${targetEmployeeId}`);
          }
        }
      }

      // 1. Clear existing cache for this month (filtered by employee if targetEmployeeId is provided)
      const deleteAttendanceWhere = {
        date: { gte: startDate, lte: endDate }
      };
      if (targetEmployeeId) {
        deleteAttendanceWhere.employeeId = targetEmployeeId;
      }
      await prisma.attendanceRecord.deleteMany({
        where: deleteAttendanceWhere
      });

      const deleteLeaveWhere = {
        startDate: { lte: endDate },
        endDate: { gte: startDate }
      };
      if (targetEmployeeId) {
        deleteLeaveWhere.employeeId = targetEmployeeId;
      }
      await prisma.leaveRecord.deleteMany({
        where: deleteLeaveWhere
      });

      // Fetch all employees from Supabase to match UUID to email/employeeNo
      const { data: sbEmployees, error: sbEmpError } = await supabase
        .from('employees')
        .select('id, name, username, gmail');
        
      if (sbEmpError) throw sbEmpError;

      // Create mapping of Supabase UUID -> SQLite Int ID
      const uuidToDbId = {};
      sbEmployees.forEach(sbEmp => {
        let employeeNo = '';
        if (sbEmp.username && sbEmp.username.includes('@')) {
          employeeNo = sbEmp.username.split('@')[0].toUpperCase();
        } else {
          employeeNo = `EMP-${sbEmp.id.substring(0, 4).toUpperCase()}`;
        }
        
        const matched = dbEmployees.find(e => e.employeeNo === employeeNo);
        if (matched) {
          uuidToDbId[sbEmp.id] = matched.id;
        }
      });

      // 2. Fetch leave requests from Supabase for this period (overlapping with the month)
      let leaveQuery = supabase
        .from('leave_requests')
        .select('*, leave_types(code, name)')
        .lte('start_date', `${endDate}T23:59:59`)
        .gte('end_date', `${startDate}T00:00:00`);
      
      if (targetSbUuid) {
        leaveQuery = leaveQuery.eq('employee_id', targetSbUuid);
      }
      const { data: sbLeaves, error: leaveError } = await leaveQuery;

      if (leaveError) throw leaveError;

      if (sbLeaves && sbLeaves.length > 0) {
        console.log(`Syncing ${sbLeaves.length} leave requests...`);
        const leaveRecordsData = [];
        for (const leave of sbLeaves) {
          const localEmpId = uuidToDbId[leave.employee_id];
          if (!localEmpId) continue;

          // Convert timestamps to clean YYYY-MM-DD in Taipei timezone (GMT+8)
          const toTaipeiYMD = (utcStr) => {
            if (!utcStr) return null;
            const dateObj = new Date(utcStr);
            const taipeiTime = new Date(dateObj.getTime() + (8 * 60 * 60 * 1000));
            const yyyy = taipeiTime.getUTCFullYear();
            const monthVal = String(taipeiTime.getUTCMonth() + 1).padStart(2, '0');
            const dayVal = String(taipeiTime.getUTCDate()).padStart(2, '0');
            return `${yyyy}-${monthVal}-${dayVal}`;
          };
          const startYMD = toTaipeiYMD(leave.start_date);
          const endYMD = toTaipeiYMD(leave.end_date);
          const leaveName = leave.leave_types?.name || leave.leave_types?.code || '事假';
          const leaveDays = parseFloat(leave.hours) / 8 || 1;
          const status = (leave.status || 'pending').toLowerCase();

          leaveRecordsData.push({
            employeeId: localEmpId,
            leaveType: leaveName,
            startDate: startYMD,
            endDate: endYMD,
            days: leaveDays,
            reason: leave.reason || '',
            status,
            approvedBy: leave.approver_id || null,
            approvedAt: leave.approved_at || null,
            notes: leave.notes || null,
          });
        }
        if (leaveRecordsData.length > 0) {
          await prisma.leaveRecord.createMany({
            data: leaveRecordsData
          });
        }
      }

      // 3. Fetch attendance logs from Supabase
      let logQuery = supabase
        .from('attendance_logs')
        .select('*')
        .gte('timestamp', `${startDate}T00:00:00`)
        .lte('timestamp', `${endDate}T23:59:59`);
      
      if (targetSbUuid) {
        logQuery = logQuery.eq('employee_id', targetSbUuid);
      }
      const { data: logs, error: logError } = await logQuery;

      if (logError) throw logError;

      if (logs && logs.length > 0) {
        console.log(`Processing ${logs.length} raw attendance logs...`);
        
        // Group logs by employee_id and date (YYYY-MM-DD)
        const groupedLogs = {};
        logs.forEach(log => {
          const localEmpId = uuidToDbId[log.employee_id];
          if (!localEmpId) return;

          // Convert UTC timestamp to Taipei local time (GMT+8)
          const dateObj = new Date(log.timestamp);
          const taipeiTime = new Date(dateObj.getTime() + (8 * 60 * 60 * 1000));
          
          // Filter out logs that fall outside the target month in Taipei timezone
          if (taipeiTime.getUTCFullYear() !== year || taipeiTime.getUTCMonth() + 1 !== month) {
            return;
          }
          
          const yyyy = taipeiTime.getUTCFullYear();
          const monthVal = String(taipeiTime.getUTCMonth() + 1).padStart(2, '0');
          const dayVal = String(taipeiTime.getUTCDate()).padStart(2, '0');
          const date = `${yyyy}-${monthVal}-${dayVal}`;

          const hh = String(taipeiTime.getUTCHours()).padStart(2, '0');
          const mm = String(taipeiTime.getUTCMinutes()).padStart(2, '0');
          const logTime = `${hh}:${mm}`;

          const key = `${localEmpId}_${date}`;

          if (!groupedLogs[key]) {
            groupedLogs[key] = {
              employeeId: localEmpId,
              date,
              inTime: null,
              outTime: null,
            };
          }

          if (log.check_type === 'IN') {
            if (!groupedLogs[key].inTime || logTime < groupedLogs[key].inTime) {
              groupedLogs[key].inTime = logTime;
            }
          } else if (log.check_type === 'OUT') {
            if (!groupedLogs[key].outTime || logTime > groupedLogs[key].outTime) {
              groupedLogs[key].outTime = logTime;
            }
          }
        });

        // Insert aggregated logs as AttendanceRecord
        const attendanceRecordsData = [];
        for (const key of Object.keys(groupedLogs)) {
          const { employeeId, date, inTime, outTime } = groupedLogs[key];
          
          let regularHours = 0;
          let overtimeHours = 0;
          let status = 'absent';

          if (inTime && outTime) {
            status = 'present';
            const [inH, inM] = inTime.split(':').map(Number);
            const [outH, outM] = outTime.split(':').map(Number);
            
            // If they clock in by 8:30 (510 min) and out after 17:00 (1020 min), it's a standard 8 hour workday
            if (inH * 60 + inM <= 510 && outH * 60 + outM >= 1020) {
              regularHours = 8;
            } else {
              const inHour = inH + inM / 60;
              const outHour = outH + outM / 60;
              let duration = Math.max(0, outHour - inHour);
              // Only subtract 1 hour break if they worked 5 hours or more
              let hoursWorked = duration >= 5 ? duration - 1 : duration;
              regularHours = Math.min(8, hoursWorked);
            }
            const inHourRaw = inH + inM / 60;
            const outHourRaw = outH + outM / 60;
            let hoursWorkedRaw = Math.max(0, outHourRaw - inHourRaw - 1);
            overtimeHours = Math.max(0, hoursWorkedRaw - 8);
          } else if (inTime || outTime) {
            status = 'present'; // missing punch but attended
            regularHours = 8;
          }

          attendanceRecordsData.push({
            employeeId,
            date,
            clockIn: inTime,
            clockOut: outTime,
            regularHours,
            overtimeHours,
            status,
          });
        }
        if (attendanceRecordsData.length > 0) {
          await prisma.attendanceRecord.createMany({
            data: attendanceRecordsData
          });
        }
      }

      lastAttendanceSyncs[key] = Date.now();
      console.log('Supabase attendance and leaves sync completed!');
    } catch (err) {
      console.error('Error syncing attendance and leaves:', err);
      throw err;
    }
  })().finally(() => {
    delete activeSyncs[key];
  });

  activeSyncs[key] = promise;
  return promise;
}

export default {
  syncEmployees,
  syncAttendanceAndLeaves
};


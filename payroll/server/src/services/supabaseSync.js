import { supabase } from './supabase.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Sync employees from Supabase to SQLite.
 */
export async function syncEmployees() {
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

    for (const sbEmp of sbEmployees) {
      // Generate a clean employee no if not present
      // e.g. based on ID first 4 chars or email
      let employeeNo = '';
      if (sbEmp.username && sbEmp.username.includes('@')) {
        employeeNo = sbEmp.username.split('@')[0].toUpperCase();
      } else {
        employeeNo = `EMP-${sbEmp.id.substring(0, 4).toUpperCase()}`;
      }

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
          idNumber: sbEmp.pin || null, // Fallback pin as placeholder or leave null
          gender,
          birthDate: sbEmp.birth_date || null,
          phone: sbEmp.contact_phone || null,
          address: sbEmp.mailing_address || null,
          email: sbEmp.gmail || sbEmp.username || null,
          department: sbEmp.department || '未核定',
          position: sbEmp.position || '員工',
          hireDate: sbEmp.join_date || new Date().toISOString().split('T')[0],
          salaryType,
          baseSalary: baseSalaryVal,
          allowanceManager: allowanceManagerVal,
          allowanceLicense: allowanceLicenseVal,
          otherAllowance: otherAllowanceVal,
          isActive: sbEmp.is_active !== false,
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
          salaryType,
          baseSalary: baseSalaryVal,
          allowanceManager: allowanceManagerVal,
          allowanceLicense: allowanceLicenseVal,
          otherAllowance: otherAllowanceVal,
          mealAllowance: 0,
          transportAllowance: 0,
          isActive: sbEmp.is_active !== false,
        }
      });

      syncedCount++;
    }

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

export function syncAttendanceAndLeaves(year, month) {
  const key = `${year}_${month}`;
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
      console.log(`Syncing attendance and leaves for ${year}-${monthStr} (${startDate} to ${endDate})...`);

      // 1. Clear existing cache for this month first
      await prisma.attendanceRecord.deleteMany({
        where: {
          date: {
            gte: startDate,
            lte: endDate
          }
        }
      });

      await prisma.leaveRecord.deleteMany({
        where: {
          OR: [
            {
              startDate: {
                gte: startDate,
                lte: endDate
              }
            },
            {
              endDate: {
                gte: startDate,
                lte: endDate
              }
            }
          ]
        }
      });

      // Get all synced local employees to map Supabase UUIDs
      const dbEmployees = await prisma.employee.findMany();
      
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

      // 2. Fetch leave requests from Supabase for this period (no status filter)
      const { data: sbLeaves, error: leaveError } = await supabase
        .from('leave_requests')
        .select('*, leave_types(code, name)')
        .gte('start_date', `${startDate}T00:00:00`)
        .lte('end_date', `${endDate}T23:59:59`);

      if (leaveError) throw leaveError;

      if (sbLeaves) {
        console.log(`Syncing ${sbLeaves.length} leave requests...`);
        for (const leave of sbLeaves) {
          const localEmpId = uuidToDbId[leave.employee_id];
          if (!localEmpId) continue;

          // Convert timestamps to clean YYYY-MM-DD
          const startYMD = leave.start_date.substring(0, 10);
          const endYMD = leave.end_date.substring(0, 10);
          const leaveName = leave.leave_types?.name || leave.leave_types?.code || '事假';
          const leaveDays = parseFloat(leave.hours) / 8 || 1;
          const status = (leave.status || 'pending').toLowerCase();

          await prisma.leaveRecord.create({
            data: {
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
            }
          });
        }
      }

      // 3. Fetch attendance logs from Supabase
      const { data: logs, error: logError } = await supabase
        .from('attendance_logs')
        .select('*')
        .gte('timestamp', `${startDate}T00:00:00`)
        .lte('timestamp', `${endDate}T23:59:59`);

      if (logError) throw logError;

      if (logs) {
        console.log(`Processing ${logs.length} raw attendance logs...`);
        
        // Group logs by employee_id and date (YYYY-MM-DD)
        const groupedLogs = {};
        logs.forEach(log => {
          const localEmpId = uuidToDbId[log.employee_id];
          if (!localEmpId) return;

          // Convert UTC timestamp to Taipei local time (GMT+8)
          const dateObj = new Date(log.timestamp);
          const taipeiTime = new Date(dateObj.getTime() + (8 * 60 * 60 * 1000));
          
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
              let hoursWorked = Math.max(0, outHour - inHour - 1); // subtract 1 hour break
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

          await prisma.attendanceRecord.create({
            data: {
              employeeId,
              date,
              clockIn: inTime,
              clockOut: outTime,
              regularHours,
              overtimeHours,
              status,
            }
          });
        }
      }

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

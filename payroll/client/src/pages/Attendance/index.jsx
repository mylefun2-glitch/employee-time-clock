import React, { useState, useEffect } from 'react';
import attendanceService from '../../services/attendanceService';
import employeeService from '../../services/employeeService';
import leaveService from '../../services/leaveService';
import { Card, DataTable, Input, LoadingSpinner, Badge, Button } from '../../components/common';

export default function Attendance() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear().toString());
  const [month, setMonth] = useState((now.getMonth() + 1).toString());
  const [records, setRecords] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('summary'); // 'summary' or 'detail'

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    loadAttendanceAndConversion();
  }, [year, month]);

  const loadEmployees = async () => {
    try {
      const res = await employeeService.getEmployees({ pageSize: 10000 });
      setEmployees(res.data || []);
    } catch (err) {
      console.error('Failed to load employees:', err);
    }
  };

  const loadAttendanceAndConversion = async () => {
    setLoading(true);
    try {
      const monthStr = String(month).padStart(2, '0');
      // Calculate exact last day of the month
      const nextMonth = parseInt(month) === 12 ? 1 : parseInt(month) + 1;
      const nextYear = parseInt(month) === 12 ? parseInt(year) + 1 : parseInt(year);
      const lastDay = new Date(nextYear, nextMonth - 1, 0).getDate();
      
      const startDate = `${year}-${monthStr}-01`;
      const endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

      // Fetch attendance and approved leaves for overtime conversion (CO, ALC)
      const [attRes, leavesRes] = await Promise.all([
        attendanceService.getAttendance({ year, month }),
        leaveService.getLeaves({ startDate, endDate, status: 'approved', pageSize: 10000 })
      ]);

      const rawRecords = attRes.data || [];
      const sortedRecords = [...rawRecords].sort((a, b) => {
        const deptA = a.employee?.department || '';
        const deptB = b.employee?.department || '';
        if (deptA !== deptB) return deptA.localeCompare(deptB, 'zh-Hant');
        
        const nameA = a.employee?.name || '';
        const nameB = b.employee?.name || '';
        if (nameA !== nameB) return nameA.localeCompare(nameB, 'zh-Hant');
        
        return (a.date || '').localeCompare(b.date || '');
      });

      setRecords(sortedRecords);
      setLeaves(leavesRes.data || []);
    } catch (err) {
      console.error('Failed to load attendance/leaves:', err);
    } finally {
      setLoading(false);
    }
  };

  // Compile overtime and conversion stats
  const getOvertimeSummary = () => {
    const employeeMap = {};

    // Initialize map with all employees
    employees.forEach(emp => {
      employeeMap[emp.id] = {
        employee: emp,
        regularHours: 0,
        overtimeHours: 0,
        compConversionHours: 0, // Overtime converted to compensatory leave
        cashConversionHours: 0  // Overtime converted to cashout
      };
    });

    // Aggregate attendance logs
    records.forEach(r => {
      const empId = r.employeeId;
      const emp = r.employee || employees.find(e => e.id === empId);
      if (!employeeMap[empId]) {
        employeeMap[empId] = {
          employee: emp || { name: '未知', department: '未知', salaryType: 'monthly' },
          regularHours: 0,
          overtimeHours: 0,
          compConversionHours: 0,
          cashConversionHours: 0
        };
      }
      // Sum punched regular hours for all employees
      employeeMap[empId].regularHours += r.regularHours || 0;
    });

    // Aggregate leave requests representing overtime and conversions
    leaves.forEach(l => {
      const empId = l.employeeId;
      if (!employeeMap[empId]) return;

      const type = (l.leaveType || '').toLowerCase();
      const hours = parseFloat(l.days * 8) || 0;

      // Classify overtime requests vs conversions
      if (type === '加班' || (type.includes('加班') && !type.includes('折算') && !type.includes('折現') && !type.includes('補休'))) {
        employeeMap[empId].overtimeHours += hours;
      } else if (type.includes('折算') || type.includes('補休') || type === 'co') {
        employeeMap[empId].compConversionHours += hours;
      } else if (type.includes('折現') || type === 'alc') {
        employeeMap[empId].cashConversionHours += hours;
      }
    });

    return Object.values(employeeMap)
      .filter(item => item.overtimeHours > 0 || item.compConversionHours > 0 || item.cashConversionHours > 0 || records.some(r => r.employeeId === item.employee.id))
      .map((item, idx) => ({
        id: item.employee.id || idx,
        department: item.employee.department,
        name: item.employee.name,
        regularHours: parseFloat(item.regularHours.toFixed(2)),
        overtimeHours: parseFloat(item.overtimeHours.toFixed(2)),
        compConversionHours: parseFloat(item.compConversionHours.toFixed(2)),
        cashConversionHours: parseFloat(item.cashConversionHours.toFixed(2))
      }))
      .sort((a, b) => b.overtimeHours - a.overtimeHours);
  };

  const summaryColumns = [
    { title: '部門', key: 'department', bold: true },
    { title: '姓名', key: 'name', bold: true },
    { title: '當月正常出勤 (小時)', key: 'regularHours', align: 'center', render: (val) => `${val} H` },
    { 
      title: '加班申報總時數 (小時)', 
      key: 'overtimeHours', 
      align: 'center', 
      bold: true, 
      render: (val) => val > 0 ? <span style={{ color: 'var(--color-primary-700)', fontWeight: 'bold' }}>{val} H</span> : '—' 
    },
    { title: '加班折算補休 (小時)', key: 'compConversionHours', align: 'center', render: (val) => val > 0 ? `${val} H` : '—' },
    { title: '加班折算薪資 (小時)', key: 'cashConversionHours', align: 'center', render: (val) => val > 0 ? `${val} H` : '—' }
  ];

  const detailColumns = [
    { title: '部門', key: 'employee.department', bold: true, render: (_, row) => row.employee?.department },
    { title: '姓名', key: 'employee.name', bold: true, render: (_, row) => row.employee?.name },
    { title: '日期', key: 'date', bold: true, render: (val) => val ? val.substring(5).replace('-', '/') : '—' },
    { title: '上班打卡', key: 'clockIn', render: (val) => val || '—' },
    { title: '下班打卡', key: 'clockOut', render: (val) => val || '—' },
    { title: '正常工時', key: 'regularHours', render: (val) => `${parseFloat(val || 0).toFixed(2)} hr` },
    { title: '加班工時', key: 'overtimeHours', render: (val) => val > 0 ? `${parseFloat(val).toFixed(2)} hr` : '—' },
    { 
      title: '狀態', 
      key: 'status',
      render: (val) => {
        let badgeStatus = 'DRAFT';
        if (val === 'present') badgeStatus = 'APPROVED';
        if (val === 'absent') badgeStatus = 'ERROR';
        if (val === 'leave') badgeStatus = 'WARNING';
        
        const textMap = { present: '出勤', absent: '曠職', leave: '請假', holiday: '休假' };
        return <Badge status={badgeStatus} text={textMap[val] || val} />;
      }
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Top Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
          <Input 
            label="年份" 
            type="select"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            options={Array.from({ length: 5 }, (_, i) => {
              const y = (now.getFullYear() - 2 + i).toString();
              return { value: y, label: `${y} 年` };
            })}
            style={{ marginBottom: 0, width: '120px' }}
          />
          <Input 
            label="月份" 
            type="select"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            options={Array.from({ length: 12 }, (_, i) => {
              const m = (i + 1).toString();
              return { value: m, label: `${m} 月` };
            })}
            style={{ marginBottom: 0, width: '100px' }}
          />
        </div>
        
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 'var(--space-2)', 
          color: 'var(--color-primary-700)', 
          fontSize: 'var(--text-xs)', 
          fontWeight: '500', 
          backgroundColor: 'var(--color-primary-50)', 
          padding: 'var(--space-2) var(--space-4)', 
          borderRadius: 'var(--radius-md)', 
          border: '1px solid var(--color-primary-200)' 
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: '18px', verticalAlign: 'middle' }}>info</span>
          <span>出勤資料與加班轉換由外部系統管理與審核，此處提供加班結算統計。</span>
        </div>
      </div>

      {/* Tabs Layout */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '2px solid var(--color-neutral-200)' }}>
        <Button 
          variant={activeTab === 'summary' ? 'primary' : 'outline'} 
          style={{ 
            borderBottomLeftRadius: 0, 
            borderBottomRightRadius: 0, 
            borderBottom: activeTab === 'summary' ? '2px solid var(--color-primary-600)' : 'none',
            marginBottom: '-2px'
          }}
          onClick={() => setActiveTab('summary')}
        >
          加班及折算統計
        </Button>
        <Button 
          variant={activeTab === 'detail' ? 'primary' : 'outline'}
          style={{ 
            borderBottomLeftRadius: 0, 
            borderBottomRightRadius: 0, 
            borderBottom: activeTab === 'detail' ? '2px solid var(--color-primary-600)' : 'none',
            marginBottom: '-2px'
          }}
          onClick={() => setActiveTab('detail')}
        >
          出勤打卡明細
        </Button>
      </div>

      {/* Table List / Summary */}
      <Card>
        <DataTable 
          columns={activeTab === 'summary' ? summaryColumns : detailColumns}
          data={activeTab === 'summary' ? getOvertimeSummary() : records}
          loading={loading}
          emptyMessage={activeTab === 'summary' ? "該月份尚無任何員工的加班及折算數據" : "該月份尚無任何出勤打卡明細資料"}
        />
      </Card>
    </div>
  );
}

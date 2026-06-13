import React, { useState, useEffect } from 'react';
import attendanceService from '../../services/attendanceService';
import employeeService from '../../services/employeeService';
import { Button, Card, DataTable, Input, Modal, LoadingSpinner, Badge } from '../../components/common';

export default function Attendance() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear().toString());
  const [month, setMonth] = useState((now.getMonth() + 1).toString());
  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [isSingleModalOpen, setIsSingleModalOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  
  // Single record form state
  const [singleForm, setSingleForm] = useState({
    employeeId: '',
    date: new Date().toISOString().split('T')[0],
    clockIn: '09:00',
    clockOut: '18:00',
    regularHours: '8',
    overtimeHours: '0',
    overtimeType: 'weekday',
    status: 'present',
    notes: ''
  });

  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    loadAttendance();
  }, [year, month]);

  const loadEmployees = async () => {
    try {
      const res = await employeeService.getEmployees({ pageSize: 100 });
      setEmployees(res.data || []);
      if (res.data && res.data.length > 0) {
        setSingleForm(prev => ({ ...prev, employeeId: res.data[0].id.toString() }));
      }
    } catch (err) {
      console.error('Failed to load employees for form dropdown:', err);
    }
  };

  const loadAttendance = async () => {
    setLoading(true);
    try {
      const res = await attendanceService.getAttendance({ year, month });
      setRecords(res.data || []);
    } catch (err) {
      console.error('Failed to load attendance:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSingleSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      await attendanceService.createAttendance({
        ...singleForm,
        employeeId: parseInt(singleForm.employeeId),
        regularHours: parseFloat(singleForm.regularHours),
        overtimeHours: parseFloat(singleForm.overtimeHours)
      });
      alert('出勤記錄新增成功');
      setIsSingleModalOpen(false);
      loadAttendance();
    } catch (err) {
      console.error(err);
      alert(err.message || '新增失敗');
    } finally {
      setFormLoading(false);
    }
  };

  const handleCsvImport = async (e) => {
    e.preventDefault();
    if (!csvText.trim()) {
      alert('請貼入 CSV 資料');
      return;
    }
    setFormLoading(true);
    try {
      const res = await attendanceService.importAttendanceCSV({ csvText });
      alert(res.message || '匯入成功');
      setIsCsvModalOpen(false);
      setCsvText('');
      loadAttendance();
    } catch (err) {
      console.error(err);
      alert(err.message || '匯入失敗');
    } finally {
      setFormLoading(false);
    }
  };

  const columns = [
    { title: '部門', key: 'employee.department', bold: true, render: (_, row) => row.employee?.department },
    { title: '姓名', key: 'employee.name', bold: true, render: (_, row) => row.employee?.name },
    { title: '日期', key: 'date', bold: true },
    { title: '上班打卡', key: 'clockIn', render: (val) => val || '—' },
    { title: '下班打卡', key: 'clockOut', render: (val) => val || '—' },
    { title: '正常工時', key: 'regularHours', render: (val) => `${val} hr` },
    { title: '加班工時', key: 'overtimeHours', render: (val) => val > 0 ? `${val} hr` : '—' },
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
          <span>出勤資料由外部系統管理，此處僅供檢視。</span>
        </div>
      </div>

      {/* Table List */}
      <Card>
        <DataTable 
          columns={columns}
          data={records}
          loading={loading}
          emptyMessage="該月份尚無出勤紀錄，請確認外部打卡系統是否已完成該期資料上傳。"
        />
      </Card>
    </div>
  );
}

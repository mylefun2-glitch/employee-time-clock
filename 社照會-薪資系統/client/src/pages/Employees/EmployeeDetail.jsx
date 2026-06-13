import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import employeeService from '../../services/employeeService';
import { Button, Card, LoadingSpinner, Badge, DataTable } from '../../components/common';

export default function EmployeeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('payroll'); // payroll, attendance, leave

  useEffect(() => {
    loadEmployeeDetails();
  }, [id]);

  const loadEmployeeDetails = async () => {
    setLoading(true);
    try {
      const res = await employeeService.getEmployee(id);
      setEmployee(res.data);
    } catch (err) {
      console.error('Failed to load employee details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async () => {
    if (window.confirm('確定要停用該員工檔案嗎？離職日將自動設定為今日。')) {
      try {
        await employeeService.deleteEmployee(id);
        alert('員工檔案已停用');
        loadEmployeeDetails();
      } catch (err) {
        console.error('Failed to deactivate employee:', err);
        alert(err.message || '停用失敗');
      }
    }
  };

  if (loading) return <LoadingSpinner fullPage size="lg" />;
  if (!employee) return <Card>找不到員工資料</Card>;

  // Tab 1: Payroll Columns
  const payrollColumns = [
    { title: '期別', key: 'period', bold: true, render: (_, row) => `${row.year}年${row.month}月` },
    { title: '應發金額', key: 'grossPay', align: 'right', render: (val) => `NT$ ${Math.round(val).toLocaleString('zh-TW')}` },
    { title: '應扣金額', key: 'totalDeductions', align: 'right', render: (val) => `NT$ ${Math.round(val).toLocaleString('zh-TW')}` },
    { title: '實發淨額', key: 'netPay', align: 'right', bold: true, render: (val) => `NT$ ${Math.round(val).toLocaleString('zh-TW')}` },
    { title: '狀態', key: 'status', render: (val) => <Badge status={val} /> },
    { 
      title: '操作', 
      key: 'actions', 
      align: 'center', 
      render: (_, row) => (
        <Button variant="outline" size="sm" icon="visibility" onClick={() => navigate(`/payroll/${row.id}`)}>
          查看明細
        </Button>
      )
    }
  ];

  // Tab 2: Attendance Columns
  const attendanceColumns = [
    { title: '日期', key: 'date', bold: true },
    { title: '上班時間', key: 'clockIn', render: (val) => val || '—' },
    { title: '下班時間', key: 'clockOut', render: (val) => val || '—' },
    { title: '正常工時', key: 'regularHours', render: (val) => `${val} 小時` },
    { title: '加班工時', key: 'overtimeHours', render: (val) => val > 0 ? `${val} 小時` : '—' },
    { 
      title: '狀態', 
      key: 'status', 
      render: (val) => {
        let status = 'DRAFT';
        if (val === 'present') status = 'APPROVED';
        if (val === 'absent') status = 'ERROR';
        if (val === 'leave') status = 'WARNING';
        
        const labelMap = { present: '出勤', absent: '曠職', leave: '請假', holiday: '休假' };
        return <Badge status={status} text={labelMap[val] || val} />;
      }
    }
  ];

  // Tab 3: Leave Columns
  const leaveColumns = [
    { title: '假別', key: 'leaveType', bold: true, render: (val) => val },
    { title: '請假天數', key: 'days', render: (val) => `${val} 天` },
    { title: '狀態', key: 'status', render: (val) => <Badge status={val === 'approved' ? 'APPROVED' : val === 'rejected' ? 'REJECTED' : 'PENDING'} /> }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header Info Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--color-primary-600)',
            color: 'var(--color-neutral-0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            fontSize: 'var(--text-xl)'
          }}>
            {employee.name.charAt(0)}
          </div>
          <div>
            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              {employee.name}
              <Badge status={employee.isActive ? 'APPROVED' : 'REJECTED'} text={employee.isActive ? '在職' : '離職'} />
            </h2>
            <p style={{ margin: 0, color: 'var(--color-neutral-500)' }}>
              工號: {employee.employeeNo} | {employee.department} - {employee.position || '員工'}
            </p>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
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
            <span className="material-symbols-outlined" style={{ fontSize: '16px', verticalAlign: 'middle' }}>info</span>
            <span>唯讀模式：員工資料由外部系統管理。</span>
          </div>
          <Button variant="outline" icon="arrow_back" onClick={() => navigate('/employees')}>返回列表</Button>
        </div>
      </div>

      {/* Grid of Profile Information */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 'var(--space-4)'
      }}>
        <Card title="基本資料">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <div><strong style={{ color: 'var(--color-neutral-600)' }}>身份證字號:</strong> {employee.idNumber || '未設定'}</div>
            <div><strong style={{ color: 'var(--color-neutral-600)' }}>性別:</strong> {employee.gender === 'M' ? '男' : employee.gender === 'F' ? '女' : '未設定'}</div>
            <div><strong style={{ color: 'var(--color-neutral-600)' }}>出生日期:</strong> {employee.birthDate || '未設定'}</div>
            <div><strong style={{ color: 'var(--color-neutral-600)' }}>聯絡電話:</strong> {employee.phone || '未設定'}</div>
            <div><strong style={{ color: 'var(--color-neutral-600)' }}>聯絡信箱:</strong> {employee.email || '未設定'}</div>
            <div><strong style={{ color: 'var(--color-neutral-600)' }}>聯絡地址:</strong> {employee.address || '未設定'}</div>
          </div>
        </Card>

        <Card title="薪資與保險">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <div>
              <strong style={{ color: 'var(--color-neutral-600)' }}>計薪類型:</strong> {employee.salaryType === 'monthly' ? '月薪制' : '時薪制'}
            </div>
            <div>
              <strong style={{ color: 'var(--color-neutral-600)' }}>{employee.salaryType === 'monthly' ? '月薪底薪:' : '約定時薪:'}</strong>{' '}
              NT$ {Math.round(employee.baseSalary).toLocaleString('zh-TW')}
            </div>
            <div><strong style={{ color: 'var(--color-neutral-600)' }}>勞保投保薪資:</strong> NT$ {Math.round(employee.laborInsuranceGrade).toLocaleString('zh-TW')}</div>
            <div><strong style={{ color: 'var(--color-neutral-600)' }}>健保投保薪資:</strong> NT$ {Math.round(employee.healthInsuranceGrade).toLocaleString('zh-TW')}</div>
            <div><strong style={{ color: 'var(--color-neutral-600)' }}>勞退提繳薪資:</strong> NT$ {Math.round(employee.laborPensionGrade).toLocaleString('zh-TW')}</div>
            <div><strong style={{ color: 'var(--color-neutral-600)' }}>健保扶養人數:</strong> {employee.dependents} 人</div>
            <div><strong style={{ color: 'var(--color-neutral-600)' }}>自願提繳勞退:</strong> {employee.voluntaryPensionRate} %</div>
          </div>
        </Card>

        <Card title="匯款資訊">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <div><strong style={{ color: 'var(--color-neutral-600)' }}>到職日期:</strong> {employee.hireDate}</div>
            <div><strong style={{ color: 'var(--color-neutral-600)' }}>離職日期:</strong> {employee.resignDate || '在職中'}</div>
            <div><strong style={{ color: 'var(--color-neutral-600)' }}>銀行名稱:</strong> {employee.bankName || '未設定'}</div>
            <div><strong style={{ color: 'var(--color-neutral-600)' }}>銀行帳號:</strong> {employee.bankAccount || '未設定'}</div>
            <div><strong style={{ color: 'var(--color-neutral-600)' }}>備註說明:</strong> {employee.notes || '無'}</div>
          </div>
        </Card>
      </div>

      {/* Tabs for Related Records */}
      <Card>
        {/* Tab Headers */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--color-neutral-200)',
          marginBottom: 'var(--space-4)',
          gap: 'var(--space-2)'
        }}>
          <button
            onClick={() => setActiveTab('payroll')}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              borderBottom: activeTab === 'payroll' ? '3px solid var(--color-primary-600)' : '3px solid transparent',
              color: activeTab === 'payroll' ? 'var(--color-primary-700)' : 'var(--color-neutral-500)',
              fontWeight: activeTab === 'payroll' ? '600' : '400',
              cursor: 'pointer'
            }}
          >
            薪資發放歷史
          </button>
          <button
            onClick={() => setActiveTab('attendance')}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              borderBottom: activeTab === 'attendance' ? '3px solid var(--color-primary-600)' : '3px solid transparent',
              color: activeTab === 'attendance' ? 'var(--color-primary-700)' : 'var(--color-neutral-500)',
              fontWeight: activeTab === 'attendance' ? '600' : '400',
              cursor: 'pointer'
            }}
          >
            出勤紀錄 (近30天)
          </button>
          <button
            onClick={() => setActiveTab('leave')}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              borderBottom: activeTab === 'leave' ? '3px solid var(--color-primary-600)' : '3px solid transparent',
              color: activeTab === 'leave' ? 'var(--color-primary-700)' : 'var(--color-neutral-500)',
              fontWeight: activeTab === 'leave' ? '600' : '400',
              cursor: 'pointer'
            }}
          >
            請假紀錄
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'payroll' && (
          <DataTable 
            columns={payrollColumns}
            data={employee.payrollRecords || []}
            emptyMessage="本員工尚無薪資結算紀錄"
          />
        )}

        {activeTab === 'attendance' && (
          <DataTable 
            columns={attendanceColumns}
            data={employee.attendanceRecords || []}
            emptyMessage="本員工尚無出勤紀錄"
          />
        )}

        {activeTab === 'leave' && (
          <DataTable 
            columns={leaveColumns}
            data={employee.leaveRecords || []}
            emptyMessage="本員工尚無請假紀錄"
          />
        )}
      </Card>
    </div>
  );
}

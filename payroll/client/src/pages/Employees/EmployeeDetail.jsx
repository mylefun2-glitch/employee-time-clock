import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import employeeService from '../../services/employeeService';
import { Button, Card, LoadingSpinner, Badge, DataTable, Modal, Input } from '../../components/common';

export default function EmployeeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('payroll'); // payroll, attendance, leave
  
  // Edit Settings Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    salaryType: 'monthly',
    baseSalary: '0',
    allowanceAA: '0',
    allowanceLicense: '0',
    allowanceManager: '0',
    otherAllowance: '0',
    mealAllowance: '0',
    laborInsuranceGrade: '0',
    laborOccupationalGrade: '0',
    healthInsuranceGrade: '0',
    laborPensionGrade: '0',
    voluntaryPensionRate: '0',
    dependents: '0',
    bankName: '',
    bankAccount: '',
    notes: '',
    supplementaryHealthInsurance: '0',
    prevInsuranceDifference: '0',
    healthDisabilityExemption: '0',
    laborDisabilityExemption: '0',
    healthGovSubsidy: '0',
    leavePaySupplement: '0'
  });

  useEffect(() => {
    loadEmployeeDetails();
  }, [id]);

  const loadEmployeeDetails = async () => {
    setLoading(true);
    try {
      const res = await employeeService.getEmployee(id);
      setEmployee(res.data);
      if (res.data) {
        setFormData({
          salaryType: res.data.salaryType || 'monthly',
          baseSalary: (res.data.baseSalary || 0).toString(),
          allowanceAA: (res.data.allowanceAA || 0).toString(),
          allowanceLicense: (res.data.allowanceLicense || 0).toString(),
          allowanceManager: (res.data.allowanceManager || 0).toString(),
          otherAllowance: (res.data.otherAllowance || 0).toString(),
          mealAllowance: (res.data.mealAllowance || 0).toString(),
          laborInsuranceGrade: (res.data.laborInsuranceGrade || 0).toString(),
          laborOccupationalGrade: (res.data.laborOccupationalGrade || 0).toString(),
          healthInsuranceGrade: (res.data.healthInsuranceGrade || 0).toString(),
          laborPensionGrade: (res.data.laborPensionGrade || 0).toString(),
          voluntaryPensionRate: (res.data.voluntaryPensionRate || 0).toString(),
          dependents: (res.data.dependents || 0).toString(),
          bankName: res.data.bankName || '',
          bankAccount: res.data.bankAccount || '',
          notes: res.data.notes || '',
          supplementaryHealthInsurance: (res.data.supplementaryHealthInsurance || 0).toString(),
          prevInsuranceDifference: (res.data.prevInsuranceDifference || 0).toString(),
          healthDisabilityExemption: (res.data.healthDisabilityExemption || 0).toString(),
          laborDisabilityExemption: (res.data.laborDisabilityExemption || 0).toString(),
          healthGovSubsidy: (res.data.healthGovSubsidy || 0).toString(),
          leavePaySupplement: (res.data.leavePaySupplement || 0).toString()
        });
      }
    } catch (err) {
      console.error('Failed to load employee details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    // Close modal early for better UX
    setIsEditModalOpen(false);
    
    try {
      await employeeService.updateEmployee(id, {
        salaryType: formData.salaryType,
        baseSalary: parseFloat(formData.baseSalary) || 0,
        mealAllowance: parseFloat(formData.mealAllowance) || 0,
        transportAllowance: 0,
        allowanceAA: parseFloat(formData.allowanceAA) || 0,
        allowanceLicense: parseFloat(formData.allowanceLicense) || 0,
        allowanceManager: parseFloat(formData.allowanceManager) || 0,
        otherAllowance: parseFloat(formData.otherAllowance) || 0,
        laborInsuranceGrade: parseFloat(formData.laborInsuranceGrade) || 0,
        laborOccupationalGrade: parseFloat(formData.laborOccupationalGrade) || 0,
        healthInsuranceGrade: parseFloat(formData.healthInsuranceGrade) || 0,
        laborPensionGrade: parseFloat(formData.laborPensionGrade) || 0,
        voluntaryPensionRate: parseFloat(formData.voluntaryPensionRate) || 0,
        dependents: parseInt(formData.dependents) || 0,
        bankName: formData.bankName,
        bankAccount: formData.bankAccount,
        notes: formData.notes,
        supplementaryHealthInsurance: parseFloat(formData.supplementaryHealthInsurance) || 0,
        prevInsuranceDifference: parseFloat(formData.prevInsuranceDifference) || 0,
        healthDisabilityExemption: parseFloat(formData.healthDisabilityExemption) || 0,
        laborDisabilityExemption: parseFloat(formData.laborDisabilityExemption) || 0,
        healthGovSubsidy: parseFloat(formData.healthGovSubsidy) || 0,
        leavePaySupplement: parseFloat(formData.leavePaySupplement) || 0
      });
      alert('薪資與保險參數已更新');
      loadEmployeeDetails();
    } catch (err) {
      console.error(err);
      alert(err.message || '更新失敗');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner fullPage size="lg" />;
  if (!employee) return <Card>找不到員工資料</Card>;

  // Tab 1: Payroll Columns
  const payrollColumns = [
    { title: '期別', key: 'period', bold: true, render: (_, row) => `${row.year}年${row.month}月` },
    { title: '應發金額', key: 'grossPay', align: 'right', render: (val) => `${Math.round(val).toLocaleString('zh-TW')}` },
    { title: '應扣金額', key: 'totalDeductions', align: 'right', render: (val) => `${Math.round(val).toLocaleString('zh-TW')}` },
    { title: '實發淨額', key: 'netPay', align: 'right', bold: true, render: (val) => `${Math.round(val).toLocaleString('zh-TW')}` },
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
    { title: '加班工時', key: 'overtimeHours', render: (val) => val > 0 ? `${parseFloat(parseFloat(val).toFixed(4))} 小時` : '—' },
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
          <Button variant="primary" icon="edit" onClick={() => setIsEditModalOpen(true)}>
            編輯薪資保險
          </Button>
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

        <Card title="薪資與保險設定">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <div>
              <strong style={{ color: 'var(--color-neutral-600)' }}>計薪類型:</strong> {employee.salaryType === 'monthly' ? '月薪制' : '時薪制'}
            </div>
            <div>
              <strong style={{ color: 'var(--color-neutral-600)' }}>{employee.salaryType === 'monthly' ? '月薪底薪:' : '約定時薪:'}</strong>{' '}
              {Math.round(employee.baseSalary).toLocaleString('zh-TW')}
            </div>
            {employee.allowanceAA > 0 && <div><strong style={{ color: 'var(--color-neutral-600)' }}>AA 加給:</strong> {Math.round(employee.allowanceAA).toLocaleString('zh-TW')}</div>}
            {employee.allowanceLicense > 0 && <div><strong style={{ color: 'var(--color-neutral-600)' }}>專業證照加給:</strong> {Math.round(employee.allowanceLicense).toLocaleString('zh-TW')}</div>}
            {employee.allowanceManager > 0 && <div><strong style={{ color: 'var(--color-neutral-600)' }}>主管加給:</strong> {Math.round(employee.allowanceManager).toLocaleString('zh-TW')}</div>}
            {employee.otherAllowance > 0 && <div><strong style={{ color: 'var(--color-neutral-600)' }}>其他津貼:</strong> {Math.round(employee.otherAllowance).toLocaleString('zh-TW')}</div>}
            {employee.mealAllowance > 0 && <div><strong style={{ color: 'var(--color-neutral-600)' }}>其他津貼（不列入平均時薪計算）:</strong> {Math.round(employee.mealAllowance).toLocaleString('zh-TW')}</div>}
            <div>
              <strong style={{ color: 'var(--color-neutral-600)' }}>勞保投保薪資:</strong>{' '}
              {employee.laborInsuranceGrade === -1 
                ? '不加保/免繳勞保自付額' 
                : employee.laborInsuranceGrade === 0 
                  ? '按薪資自動計算' 
                  : `${Math.round(employee.laborInsuranceGrade).toLocaleString('zh-TW')} 元`}
            </div>
            <div>
              <strong style={{ color: 'var(--color-neutral-600)' }}>職保投保薪資:</strong>{' '}
              {employee.laborOccupationalGrade === -1 
                ? '免加保/免繳職保' 
                : employee.laborOccupationalGrade === 0 
                  ? (employee.laborPensionGrade > 0 
                      ? `${Math.round(employee.laborPensionGrade).toLocaleString('zh-TW')} 元 (隨勞退)` 
                      : '按薪資自動計算')
                  : `${Math.round(employee.laborOccupationalGrade).toLocaleString('zh-TW')} 元`}
            </div>
            <div>
              <strong style={{ color: 'var(--color-neutral-600)' }}>健保投保薪資:</strong>{' '}
              {employee.healthInsuranceGrade === -1 
                ? '不加保（投保於其他單位）' 
                : employee.healthInsuranceGrade === 0 
                  ? '按薪資自動計算' 
                  : `${Math.round(employee.healthInsuranceGrade).toLocaleString('zh-TW')} 元`}
            </div>
            <div>
              <strong style={{ color: 'var(--color-neutral-600)' }}>勞退提繳薪資:</strong>{' '}
              {employee.laborPensionGrade === -1 
                ? '免提繳' 
                : employee.laborPensionGrade === 0 
                  ? '按薪資自動計算' 
                  : `${Math.round(employee.laborPensionGrade).toLocaleString('zh-TW')} 元`}
            </div>
            <div><strong style={{ color: 'var(--color-neutral-600)' }}>健保扶養人數:</strong> {employee.dependents} 人</div>
            <div><strong style={{ color: 'var(--color-neutral-600)' }}>自願提繳勞退:</strong> {employee.voluntaryPensionRate} %</div>
            <div><strong style={{ color: 'var(--color-neutral-600)' }}>二代健保自付額:</strong> {Math.round(employee.supplementaryHealthInsurance || 0).toLocaleString('zh-TW')}</div>
            <div><strong style={{ color: 'var(--color-neutral-600)' }}>前期勞健退差額:</strong> {Math.round(employee.prevInsuranceDifference || 0).toLocaleString('zh-TW')}</div>
            <div><strong style={{ color: 'var(--color-neutral-600)' }}>健保保費減免:</strong> {Math.round((employee.healthDisabilityExemption || 0) * 100)} %</div>
            <div><strong style={{ color: 'var(--color-neutral-600)' }}>勞保保費減免:</strong> {Math.round((employee.laborDisabilityExemption || 0) * 100)} %</div>
            <div><strong style={{ color: 'var(--color-neutral-600)' }}>健保政府補貼定額:</strong> {Math.round(employee.healthGovSubsidy || 0).toLocaleString('zh-TW')}</div>
          </div>
        </Card>

        <Card title="匯款與其他資訊">
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

      {/* Edit Salary & Insurance Settings Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`編輯 ${employee.name} 的薪資與保險參數`}
        footer={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>取消</Button>
            <Button variant="primary" loading={saving} onClick={handleSaveSettings}>儲存參數</Button>
          </div>
        }
      >
        <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ padding: 'var(--space-2) var(--space-3)', background: 'var(--color-neutral-50)', border: '1px dashed var(--color-neutral-200)', borderRadius: '8px', fontSize: '11px', color: 'var(--color-neutral-600)' }}>
            提示：計薪類型、底薪/時薪、主管/證照加給與其他津貼已與「主系統班表歷史紀錄」同步，為唯讀欄位。如需變更，請直接至主系統的「班表紀錄」頁面進行編輯。
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <Input
              label="計薪類型 (唯讀)"
              type="select"
              value={formData.salaryType}
              onChange={e => setFormData(prev => ({ ...prev, salaryType: e.target.value }))}
              disabled={true}
              options={[
                { value: 'monthly', label: '月薪制' },
                { value: 'hourly', label: '時薪制' }
              ]}
            />
            <Input
              label={formData.salaryType === 'monthly' ? '月薪底薪 (元) (唯讀)' : '約定時薪 (元) (唯讀)'}
              type="number"
              value={formData.baseSalary}
              onChange={e => setFormData(prev => ({ ...prev, baseSalary: e.target.value }))}
              disabled={true}
            />
            <Input
              label="AA 加給 (元)"
              type="number"
              value={formData.allowanceAA}
              onChange={e => setFormData(prev => ({ ...prev, allowanceAA: e.target.value }))}
            />
            <Input
              label="專業證照加給 (元) (唯讀)"
              type="number"
              value={formData.allowanceLicense}
              onChange={e => setFormData(prev => ({ ...prev, allowanceLicense: e.target.value }))}
              disabled={true}
            />
            <Input
              label="主管加給 (元) (唯讀)"
              type="number"
              value={formData.allowanceManager}
              onChange={e => setFormData(prev => ({ ...prev, allowanceManager: e.target.value }))}
              disabled={true}
            />
            <Input
              label="其他津貼 (元) (唯讀)"
              type="number"
              value={formData.otherAllowance}
              onChange={e => setFormData(prev => ({ ...prev, otherAllowance: e.target.value }))}
              disabled={true}
            />
            <Input
              label="其他津貼（不列入平均時薪計算） (元)"
              type="number"
              value={formData.mealAllowance}
              onChange={e => setFormData(prev => ({ ...prev, mealAllowance: e.target.value }))}
            />
          </div>
          
          <h4 style={{ margin: 'var(--space-2) 0 0 0', borderBottom: '1px solid var(--color-neutral-200)', paddingBottom: '4px' }}>保險與級距設定 (填寫級距金額，0代表按薪資自動計算)</h4>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <Input
              label="勞保投保薪資級距 (0:自動, -1:免繳)"
              type="number"
              value={formData.laborInsuranceGrade}
              onChange={e => setFormData(prev => ({ ...prev, laborInsuranceGrade: e.target.value }))}
              placeholder="輸入0為自動計算，-1為已退休免扣自付額"
            />
            <Input
              label="職保投保薪資級距 (0:自動, -1:免繳)"
              type="number"
              value={formData.laborOccupationalGrade}
              onChange={e => setFormData(prev => ({ ...prev, laborOccupationalGrade: e.target.value }))}
              placeholder="輸入0為自動計算，-1為免投保職保"
            />
            <Input
              label="健保投保薪資級距 (0:自動, -1:不加保)"
              type="number"
              value={formData.healthInsuranceGrade}
              onChange={e => setFormData(prev => ({ ...prev, healthInsuranceGrade: e.target.value }))}
              placeholder="輸入0為自動計算，-1為投保於其他單位"
            />
            <Input
              label="勞退提繳薪資級距 (0:自動, -1:免提繳)"
              type="number"
              value={formData.laborPensionGrade}
              onChange={e => setFormData(prev => ({ ...prev, laborPensionGrade: e.target.value }))}
              placeholder="輸入0為自動計算，-1為免提繳勞退"
            />
            <Input
              label="自願提繳比率 (%)"
              type="number"
              min="0"
              max="6"
              value={formData.voluntaryPensionRate}
              onChange={e => setFormData(prev => ({ ...prev, voluntaryPensionRate: e.target.value }))}
            />
            <Input
              label="健保扶養人數"
              type="number"
              min="0"
              value={formData.dependents}
              onChange={e => setFormData(prev => ({ ...prev, dependents: e.target.value }))}
            />
            <Input
              label="二代健保自付額 (元)"
              type="number"
              min="0"
              value={formData.supplementaryHealthInsurance}
              onChange={e => setFormData(prev => ({ ...prev, supplementaryHealthInsurance: e.target.value }))}
            />
            <Input
              label="前期勞健退差額 (元)"
              type="number"
              value={formData.prevInsuranceDifference}
              onChange={e => setFormData(prev => ({ ...prev, prevInsuranceDifference: e.target.value }))}
            />
            <Input
              label="健保保費減免比例 (0-1.0)"
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={formData.healthDisabilityExemption}
              onChange={e => setFormData(prev => ({ ...prev, healthDisabilityExemption: e.target.value }))}
            />
            <Input
              label="勞保保費減免比例 (0-1.0)"
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={formData.laborDisabilityExemption}
              onChange={e => setFormData(prev => ({ ...prev, laborDisabilityExemption: e.target.value }))}
            />
            <Input
              label="健保政府補貼定額 (元)"
              type="number"
              min="0"
              value={formData.healthGovSubsidy}
              onChange={e => setFormData(prev => ({ ...prev, healthGovSubsidy: e.target.value }))}
            />
          </div>

          <h4 style={{ margin: 'var(--space-2) 0 0 0', borderBottom: '1px solid var(--color-neutral-200)', paddingBottom: '4px' }}>撥款資訊</h4>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <Input
              label="銀行名稱"
              type="text"
              value={formData.bankName}
              onChange={e => setFormData(prev => ({ ...prev, bankName: e.target.value }))}
            />
            <Input
              label="銀行帳號"
              type="text"
              value={formData.bankAccount}
              onChange={e => setFormData(prev => ({ ...prev, bankAccount: e.target.value }))}
            />
            <Input
              label="備註"
              type="textarea"
              value={formData.notes}
              onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              style={{ gridColumn: 'span 2' }}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}

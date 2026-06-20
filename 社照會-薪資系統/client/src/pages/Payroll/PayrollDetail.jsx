import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import payrollService from '../../services/payrollService';
import { Button, Card, LoadingSpinner, Badge, Input } from '../../components/common';
import { BASE_URL } from '../../services/api';

export default function PayrollDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [record, setRecord] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isFormulaExpanded, setIsFormulaExpanded] = useState(false);

  const formatHours = (h) => {
    if (h === undefined || h === null) return '0';
    const val = parseFloat(parseFloat(h).toFixed(4));
    return val.toString();
  };
  
  // Editable fields state
  const [editForm, setEditForm] = useState({
    baseSalary: '0',
    regularHours: '0',
    workDays: '0',
    allowanceAA: '0',
    allowanceLicense: '0',
    allowanceManager: '0',
    otherAllowance: '0',
    mealAllowance: '0',
    bonus: '0',
    retroPay: '0',
    leaveDeduction: '0',
    otherDeductions: '0',
    overtimeHours134: '0',
    overtimeHours167: '0',
    overtimeHours200: '0',
    overtimeHours267: '0',
    laborInsuranceGrade: '0',
    laborOccupationalGrade: '0',
    healthInsuranceGrade: '0',
    laborPensionGrade: '0',
    notes: '',
    supplementaryHealthInsurance: '0',
    prevInsuranceDifference: '0',
    healthDisabilityExemption: '0',
    laborDisabilityExemption: '0',
    healthGovSubsidy: '0',
    leavePaySupplement: '0',
    incomeTax: '0',
    dependents: '0',
    laborPensionEmployee: '0'
  });

  useEffect(() => {
    loadPayrollRecord();
  }, [id]);

  const loadPayrollRecord = async () => {
    setLoading(true);
    try {
      const res = await payrollService.getPayroll(id);
      setRecord(res.data);
      setEmployee(res.data?.employee);
      
      if (res.data) {
        setEditForm({
          baseSalary: (res.data.baseSalary || 0).toString(),
          regularHours: (res.data.regularHours || 0).toString(),
          workDays: (res.data.workDays || 0).toString(),
          allowanceAA: (res.data.allowanceAA || 0).toString(),
          allowanceLicense: (res.data.allowanceLicense || 0).toString(),
          allowanceManager: (res.data.allowanceManager || 0).toString(),
          otherAllowance: (res.data.otherAllowance || 0).toString(),
          mealAllowance: (res.data.mealAllowance || 0).toString(),
          bonus: (res.data.bonus || 0).toString(),
          retroPay: (res.data.retroPay || 0).toString(),
          leaveDeduction: (res.data.leaveDeduction || 0).toString(),
          otherDeductions: (res.data.otherDeductions || 0).toString(),
          overtimeHours134: formatHours(res.data.overtimeHours134),
          overtimeHours167: formatHours(res.data.overtimeHours167),
          overtimeHours200: formatHours(res.data.overtimeHours200),
          overtimeHours267: formatHours(res.data.overtimeHours267),
          laborInsuranceGrade: (res.data.laborInsuranceGrade || 0).toString(),
          laborOccupationalGrade: (res.data.laborOccupationalGrade || 0).toString(),
          healthInsuranceGrade: (res.data.healthInsuranceGrade || 0).toString(),
          laborPensionGrade: (res.data.laborPensionGrade || 0).toString(),
          notes: res.data.notes || '',
          supplementaryHealthInsurance: (res.data.supplementaryHealthInsurance || 0).toString(),
          prevInsuranceDifference: (res.data.prevInsuranceDifference || 0).toString(),
          healthDisabilityExemption: (res.data.healthDisabilityExemption || 0).toString(),
          laborDisabilityExemption: (res.data.laborDisabilityExemption || 0).toString(),
          healthGovSubsidy: (res.data.healthGovSubsidy || 0).toString(),
          leavePaySupplement: (res.data.leavePaySupplement || 0).toString(),
          incomeTax: (res.data.incomeTax || 0).toString(),
          dependents: (res.data.dependents || 0).toString(),
          laborPensionEmployee: (res.data.laborPensionEmployee || 0).toString()
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAdjustments = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Backend now automatically recalculates based on raw parameters passed!
      await payrollService.updatePayroll(id, {
        baseSalary: parseFloat(editForm.baseSalary) || 0,
        regularHours: parseFloat(editForm.regularHours) || 0,
        workDays: parseFloat(editForm.workDays) || 0,
        allowanceAA: parseFloat(editForm.allowanceAA) || 0,
        allowanceLicense: parseFloat(editForm.allowanceLicense) || 0,
        allowanceManager: parseFloat(editForm.allowanceManager) || 0,
        otherAllowance: parseFloat(editForm.otherAllowance) || 0,
        mealAllowance: parseFloat(editForm.mealAllowance) || 0,
        bonus: parseFloat(editForm.bonus) || 0,
        retroPay: parseFloat(editForm.retroPay) || 0,
        leaveDeduction: parseFloat(editForm.leaveDeduction) || 0,
        otherDeductions: parseFloat(editForm.otherDeductions) || 0,
        overtimeHours134: parseFloat(editForm.overtimeHours134) || 0,
        overtimeHours167: parseFloat(editForm.overtimeHours167) || 0,
        overtimeHours200: parseFloat(editForm.overtimeHours200) || 0,
        overtimeHours267: parseFloat(editForm.overtimeHours267) || 0,
        laborInsuranceGrade: parseFloat(editForm.laborInsuranceGrade) || 0,
        laborOccupationalGrade: parseFloat(editForm.laborOccupationalGrade) || 0,
        healthInsuranceGrade: parseFloat(editForm.healthInsuranceGrade) || 0,
        laborPensionGrade: parseFloat(editForm.laborPensionGrade) || 0,
        notes: editForm.notes,
        supplementaryHealthInsurance: parseFloat(editForm.supplementaryHealthInsurance) || 0,
        prevInsuranceDifference: parseFloat(editForm.prevInsuranceDifference) || 0,
        healthDisabilityExemption: parseFloat(editForm.healthDisabilityExemption) || 0,
        laborDisabilityExemption: parseFloat(editForm.laborDisabilityExemption) || 0,
        healthGovSubsidy: parseFloat(editForm.healthGovSubsidy) || 0,
        leavePaySupplement: parseFloat(editForm.leavePaySupplement) || 0,
        incomeTax: parseFloat(editForm.incomeTax) || 0,
        dependents: parseInt(editForm.dependents) || 0,
        laborPensionEmployee: parseFloat(editForm.laborPensionEmployee) || 0
      });

      alert('薪資調整與計算已完成');
      setIsEditing(false);
      loadPayrollRecord();
    } catch (err) {
      console.error(err);
      alert(err.message || '儲存與重新計算失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleRecalculate = async () => {
    if (window.confirm('確定要依據目前最新的員工設定與當月差勤資料，重新計算此人的薪資明細嗎？這將會覆蓋目前的草稿資料。')) {
      try {
        setSaving(true);
        const res = await payrollService.calculatePayroll({
          year: record.year.toString(),
          month: record.month.toString(),
          employeeIds: [employee.id],
          resetSettings: true
        });
        alert(res.message || '重新計算成功！');
        loadPayrollRecord();
      } catch (err) {
        console.error(err);
        alert(err.message || '重新計算失敗');
      } finally {
        setSaving(false);
      }
    }
  };

  const handleLock = async () => {
    if (window.confirm('確定要鎖定此筆薪資紀錄嗎？鎖定後將無法再進行編輯（但仍可直接進行核准）。')) {
      try {
        setSaving(true);
        await payrollService.lockPayroll(id);
        alert('薪資紀錄已鎖定');
        loadPayrollRecord();
      } catch (err) {
        console.error(err);
        alert(err.message || '鎖定失敗');
      } finally {
        setSaving(false);
      }
    }
  };

  const handleUnlock = async () => {
    if (window.confirm('確定要解除此筆薪資紀錄的鎖定嗎？解除鎖定後將回復為草稿狀態，可再次進行編輯。')) {
      try {
        setSaving(true);
        await payrollService.unlockPayroll(id);
        alert('薪資紀錄已解除鎖定');
        loadPayrollRecord();
      } catch (err) {
        console.error(err);
        alert(err.message || '解鎖失敗');
      } finally {
        setSaving(false);
      }
    }
  };

  const handleApprove = async () => {
    if (window.confirm('確定要核准此筆薪資紀錄嗎？核准後將正式發放，且無法再調整。')) {
      try {
        setSaving(true);
        await payrollService.approvePayroll(id);
        alert('薪資紀錄已核准');
        loadPayrollRecord();
      } catch (err) {
        console.error(err);
        alert(err.message || '核准失敗');
      } finally {
        setSaving(false);
      }
    }
  };

  const handleDelete = async () => {
    if (window.confirm('確定要刪除此筆草稿狀態的薪資紀錄嗎？刪除後不可復原！')) {
      try {
        setSaving(true);
        await payrollService.deletePayroll(id);
        alert('薪資紀錄已刪除');
        navigate('/payroll', {
          state: {
            year: record?.year?.toString() || location.state?.year,
            month: record?.month?.toString() || location.state?.month,
            statusFilter: location.state?.statusFilter || '',
            deptFilter: location.state?.deptFilter || '',
            nameFilter: location.state?.nameFilter || ''
          }
        });
      } catch (err) {
        console.error(err);
        alert(err.message || '刪除失敗');
      } finally {
        setSaving(false);
      }
    }
  };

  const handleDownloadPDF = () => {
    setSaving(true);
    const a = document.createElement('a');
    a.href = `${BASE_URL}/payroll/${id}/pdf?token=${localStorage.getItem('token')}`;
    fetch(`${BASE_URL}/payroll/${id}/pdf`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })
    .then(async res => {
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'PDF 檔案下載失敗');
      }
      return res.blob();
    })
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      a.href = url;
      a.download = `payroll_${record.year}_${record.month}_${employee.name}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    })
    .catch(err => {
      console.error(err);
      alert(err.message);
    })
    .finally(() => {
      setSaving(false);
    });
  };

  if (loading) return <LoadingSpinner fullPage size="lg" />;
  if (!record || !employee) return <Card>找不到該筆薪資紀錄</Card>;

  const formatCurr = (v) => {
    if (v === undefined || v === null || isNaN(v)) return '0';
    return `${Math.round(parseFloat(parseFloat(v).toFixed(4))).toLocaleString('zh-TW')}`;
  };

  // Helper to calculate Average Hourly Rate for display
  let averageHourlyRateDisplay = 0;
  if (employee.salaryType === 'hourly' && record.regularHours > 0) {
    const regHoursRounded = parseFloat(record.regularHours.toFixed(2));
    const hourlyRate = record.baseSalary > 0 ? record.baseSalary : employee.baseSalary;
    const normalWageForAverage = Math.round(regHoursRounded * hourlyRate);
    averageHourlyRateDisplay = ((normalWageForAverage + record.allowanceAA + record.allowanceLicense + record.bonus) / record.regularHours);
    averageHourlyRateDisplay = parseFloat(averageHourlyRateDisplay.toFixed(2));
  } else if (employee.salaryType === 'monthly') {
    const fixedMonthly = record.baseSalary + record.allowanceAA + record.allowanceLicense + record.allowanceManager + record.otherAllowance;
    // Include performance bonus (績效獎金) in average hourly rate
    averageHourlyRateDisplay = parseFloat(((fixedMonthly + record.bonus) / 240).toFixed(2));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {saving && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999
        }}>
          <div style={{
            backgroundColor: 'var(--color-neutral-0)',
            padding: 'var(--space-6) var(--space-8)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 'var(--space-4)'
          }}>
            <LoadingSpinner size="lg" />
            <span style={{ fontWeight: '600', color: 'var(--color-neutral-800)' }}>執行中，請稍候...</span>
          </div>
        </div>
      )}
      {/* Header Panel */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            {employee.name} 的薪資明細
            <Badge status={record.status} />
          </h2>
          <p style={{ margin: 0, color: 'var(--color-neutral-500)' }}>
            工號: {employee.employeeNo} | {record.year} 年 {record.month} 月期別 | {employee.department} - {employee.salaryType === 'monthly' ? '月薪制' : '時薪制'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <Button variant="outline" icon="arrow_back" onClick={() => navigate('/payroll', {
            state: {
              year: record?.year?.toString() || location.state?.year,
              month: record?.month?.toString() || location.state?.month,
              statusFilter: location.state?.statusFilter || '',
              deptFilter: location.state?.deptFilter || '',
              nameFilter: location.state?.nameFilter || ''
            }
          })}>
            返回列表
          </Button>
          {record.status === 'DRAFT' && !isEditing && (
            <Button variant="outline" icon="calculate" onClick={handleRecalculate}>
              重新計算
            </Button>
          )}
          {record.status === 'DRAFT' && !isEditing && (
            <Button variant="outline" icon="edit" onClick={() => setIsEditing(true)}>
              手動調整
            </Button>
          )}
          {record.status === 'DRAFT' && (
            <Button 
              variant="outline" 
              icon="delete" 
              style={{ color: 'var(--color-error)', borderColor: 'var(--color-error)', backgroundColor: 'rgba(220, 38, 38, 0.05)' }}
              onClick={handleDelete}
            >
              刪除草稿
            </Button>
          )}
          {record.status === 'DRAFT' && (
            <Button variant="outline" icon="lock" onClick={handleLock}>
              鎖定明細
            </Button>
          )}
          {record.status === 'LOCKED' && (
            <Button variant="outline" icon="lock_open" onClick={handleUnlock}>
              解除鎖定
            </Button>
          )}
          {(record.status === 'DRAFT' || record.status === 'LOCKED') && (
            <Button variant="primary" icon="done" onClick={handleApprove}>
              核准發放
            </Button>
          )}
          <Button variant="outline" icon="download" onClick={handleDownloadPDF}>
            下載 PDF 薪資單
          </Button>
        </div>
      </div>

      {/* Main Details Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isEditing ? '1fr' : '1fr 1fr',
        gap: 'var(--space-6)',
        alignItems: 'start'
      }}>
        {isEditing ? (
          /* Editable adjustments form */
          <Card title="手動調整薪資項目">
            <form onSubmit={handleSaveAdjustments} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div style={{ backgroundColor: 'var(--color-warning-light)', color: 'var(--color-warning)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-xs)', fontWeight: '500' }}>
                提示：修改任何時數、加給或金額後，系統將在儲存時自動進行全套勞健保及所得稅重新計算。
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
                {/* Left Column: Earnings Adjustment */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  <h4 style={{ borderBottom: '1px solid var(--color-neutral-200)', paddingBottom: '4px', margin: '4px 0', color: 'var(--color-primary-700)' }}>應發項目調整 (Earnings)</h4>
                  <Input
                    label={employee.salaryType === 'monthly' ? '本薪/底薪 (元)' : '約定時薪 (元)'}
                    type="number"
                    value={editForm.baseSalary}
                    onChange={e => setEditForm(prev => ({ ...prev, baseSalary: e.target.value }))}
                  />
                  <Input
                    label="AA 加給 (元)"
                    type="number"
                    value={editForm.allowanceAA}
                    onChange={e => setEditForm(prev => ({ ...prev, allowanceAA: e.target.value }))}
                  />
                  <Input
                    label="專業證照加給 (元)"
                    type="number"
                    value={editForm.allowanceLicense}
                    onChange={e => setEditForm(prev => ({ ...prev, allowanceLicense: e.target.value }))}
                  />
                  <Input
                    label="主管加給 (元)"
                    type="number"
                    value={editForm.allowanceManager}
                    onChange={e => setEditForm(prev => ({ ...prev, allowanceManager: e.target.value }))}
                    disabled={employee.salaryType === 'hourly'}
                  />
                  <Input
                    label="其他津貼 (元)"
                    type="number"
                    value={editForm.otherAllowance}
                    onChange={e => setEditForm(prev => ({ ...prev, otherAllowance: e.target.value }))}
                  />
                  <Input
                    label="其他津貼（不列入平均時薪計算） (元)"
                    type="number"
                    value={editForm.mealAllowance}
                    onChange={e => setEditForm(prev => ({ ...prev, mealAllowance: e.target.value }))}
                  />
                  <Input
                    label="發放獎金 (元)"
                    type="number"
                    value={editForm.bonus}
                    onChange={e => setEditForm(prev => ({ ...prev, bonus: e.target.value }))}
                  />
                  <Input
                    label="補發薪資 (元)"
                    type="number"
                    value={editForm.retroPay}
                    onChange={e => setEditForm(prev => ({ ...prev, retroPay: e.target.value }))}
                  />
                  <Input
                    label="請假補貼薪資 (時薪制適用) (元)"
                    type="number"
                    value={editForm.leavePaySupplement}
                    onChange={e => setEditForm(prev => ({ ...prev, leavePaySupplement: e.target.value }))}
                    disabled={employee.salaryType === 'monthly'}
                  />

                  <h4 style={{ borderBottom: '1px solid var(--color-neutral-200)', paddingBottom: '4px', margin: '12px 0 4px 0', color: 'var(--color-primary-700)' }}>加班時數調整 (小時)</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                    <Input
                      label="1.34倍加班"
                      type="number"
                      step="0.01"
                      value={editForm.overtimeHours134}
                      onChange={e => setEditForm(prev => ({ ...prev, overtimeHours134: e.target.value }))}
                    />
                    <Input
                      label="1.67倍加班"
                      type="number"
                      step="0.01"
                      value={editForm.overtimeHours167}
                      onChange={e => setEditForm(prev => ({ ...prev, overtimeHours167: e.target.value }))}
                    />
                    <Input
                      label={employee?.salaryType === 'monthly' ? "加發 1.000 倍加班 (國假/例假)" : "2.000倍加班"}
                      type="number"
                      step="0.01"
                      value={editForm.overtimeHours200}
                      onChange={e => setEditForm(prev => ({ ...prev, overtimeHours200: e.target.value }))}
                    />
                    <Input
                      label="2.67倍加班"
                      type="number"
                      step="0.01"
                      value={editForm.overtimeHours267}
                      onChange={e => setEditForm(prev => ({ ...prev, overtimeHours267: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Right Column: Deductions Adjustment */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  <h4 style={{ borderBottom: '1px solid var(--color-neutral-200)', paddingBottom: '4px', margin: '4px 0', color: 'var(--color-error)' }}>應扣項目調整 (Deductions)</h4>
                  <Input
                    label="請假扣薪 (元)"
                    type="number"
                    value={editForm.leaveDeduction}
                    onChange={e => setEditForm(prev => ({ ...prev, leaveDeduction: e.target.value }))}
                    disabled={employee.salaryType === 'hourly'}
                  />
                  <Input
                    label="二代健保自付額 (元)"
                    type="number"
                    value={editForm.supplementaryHealthInsurance}
                    onChange={e => setEditForm(prev => ({ ...prev, supplementaryHealthInsurance: e.target.value }))}
                  />
                  <Input
                    label="前期勞健退差額 (元)"
                    type="number"
                    value={editForm.prevInsuranceDifference}
                    onChange={e => setEditForm(prev => ({ ...prev, prevInsuranceDifference: e.target.value }))}
                  />

                  <Input
                    label="勞退自提額 (元)"
                    type="number"
                    value={editForm.laborPensionEmployee}
                    onChange={e => setEditForm(prev => ({ ...prev, laborPensionEmployee: e.target.value }))}
                  />

                  <Input
                    label="其他扣除額 (元)"
                    type="number"
                    value={editForm.otherDeductions}
                    onChange={e => setEditForm(prev => ({ ...prev, otherDeductions: e.target.value }))}
                  />

                  <h4 style={{ borderBottom: '1px solid var(--color-neutral-200)', paddingBottom: '4px', margin: '12px 0 4px 0', color: 'var(--color-neutral-700)' }}>勞健保減免與政府補貼</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                    <Input
                      label="勞保保費減免比例 (0-1.0)"
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      value={editForm.laborDisabilityExemption}
                      onChange={e => setEditForm(prev => ({ ...prev, laborDisabilityExemption: e.target.value }))}
                    />
                    <Input
                      label="健保保費減免比例 (0-1.0)"
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      value={editForm.healthDisabilityExemption}
                      onChange={e => setEditForm(prev => ({ ...prev, healthDisabilityExemption: e.target.value }))}
                    />
                    <Input
                      label="健保扶養人數 (眷口數)"
                      type="number"
                      min="0"
                      value={editForm.dependents}
                      onChange={e => setEditForm(prev => ({ ...prev, dependents: e.target.value }))}
                    />
                    <Input
                      label="健保政府補貼定額 (元)"
                      type="number"
                      min="0"
                      value={editForm.healthGovSubsidy}
                      onChange={e => setEditForm(prev => ({ ...prev, healthGovSubsidy: e.target.value }))}
                    />
                  </div>

                  <h4 style={{ borderBottom: '1px solid var(--color-neutral-200)', paddingBottom: '4px', margin: '12px 0 4px 0', color: 'var(--color-neutral-700)' }}>投保級距覆蓋 (0代表依薪資自動對照)</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                    <Input
                      label="勞保投保級距"
                      type="number"
                      value={editForm.laborInsuranceGrade}
                      onChange={e => setEditForm(prev => ({ ...prev, laborInsuranceGrade: e.target.value }))}
                    />
                    <Input
                      label="職保投保級距"
                      type="number"
                      value={editForm.laborOccupationalGrade}
                      onChange={e => setEditForm(prev => ({ ...prev, laborOccupationalGrade: e.target.value }))}
                    />
                    <Input
                      label="健保投保級距"
                      type="number"
                      value={editForm.healthInsuranceGrade}
                      onChange={e => setEditForm(prev => ({ ...prev, healthInsuranceGrade: e.target.value }))}
                    />
                    <Input
                      label="勞退提繳級距"
                      type="number"
                      value={editForm.laborPensionGrade}
                      onChange={e => setEditForm(prev => ({ ...prev, laborPensionGrade: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <Input
                label="備註 / 調整說明"
                type="textarea"
                value={editForm.notes}
                onChange={e => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
              />
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
                <Button variant="outline" onClick={() => setIsEditing(false)}>取消</Button>
                <Button type="submit" variant="primary" loading={saving}>儲存並重新計算</Button>
              </div>
            </form>
          </Card>
        ) : (
          /* Static Display Dashboard */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', gridColumn: 'span 2' }}>
            
            {/* 1. Summary Cards Banner */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 'var(--space-4)',
              width: '100%'
            }}>
              {/* Net Pay Card */}
              <div style={{
                backgroundColor: 'var(--color-primary-50)',
                border: '1px solid var(--color-primary-200)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-4) var(--space-5)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-4)',
                boxShadow: 'var(--shadow-xs)'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '44px',
                  height: '44px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-primary-100)',
                  color: 'var(--color-primary-600)'
                }}>
                  <span className="material-symbols-outlined icon-md">payments</span>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-primary-700)', fontWeight: '500' }}>實發淨額 (Net Pay)</p>
                  <h3 style={{ margin: 0, fontSize: 'var(--text-xl)', color: 'var(--color-primary-900)', fontWeight: 'bold' }} className="font-mono">{formatCurr(record.netPay)}</h3>
                </div>
              </div>

              {/* Gross Pay Card */}
              <div style={{
                backgroundColor: 'var(--color-neutral-0)',
                border: '1px solid var(--color-neutral-200)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-4) var(--space-5)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-4)',
                boxShadow: 'var(--shadow-xs)'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '44px',
                  height: '44px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-success-light)',
                  color: 'var(--color-success)'
                }}>
                  <span className="material-symbols-outlined icon-md">add_card</span>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-neutral-500)', fontWeight: '500' }}>應發薪資總額 (Gross)</p>
                  <h3 style={{ margin: 0, fontSize: 'var(--text-xl)', color: 'var(--color-neutral-800)', fontWeight: 'bold' }} className="font-mono">{formatCurr(record.grossPay)}</h3>
                </div>
              </div>

              {/* Deductions Card */}
              <div style={{
                backgroundColor: 'var(--color-neutral-0)',
                border: '1px solid var(--color-neutral-200)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-4) var(--space-5)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-4)',
                boxShadow: 'var(--shadow-xs)'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '44px',
                  height: '44px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-error-light)',
                  color: 'var(--color-error)'
                }}>
                  <span className="material-symbols-outlined icon-md">money_off</span>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-neutral-500)', fontWeight: '500' }}>應扣項目總額 (Deductions)</p>
                  <h3 style={{ margin: 0, fontSize: 'var(--text-xl)', color: 'var(--color-neutral-800)', fontWeight: 'bold' }} className="font-mono">{formatCurr(record.totalDeductions)}</h3>
                </div>
              </div>

              {/* Employer Cost Card */}
              <div style={{
                backgroundColor: 'var(--color-neutral-0)',
                border: '1px solid var(--color-neutral-200)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-4) var(--space-5)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-4)',
                boxShadow: 'var(--shadow-xs)'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '44px',
                  height: '44px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-info-light)',
                  color: 'var(--color-info)'
                }}>
                  <span className="material-symbols-outlined icon-md">account_balance</span>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-neutral-500)', fontWeight: '500' }}>公提成本總計 (Employer Cost)</p>
                  <h3 style={{ margin: 0, fontSize: 'var(--text-xl)', color: 'var(--color-neutral-800)', fontWeight: 'bold' }} className="font-mono">{formatCurr(record.totalEmployerCost)}</h3>
                </div>
              </div>
            </div>

            {/* 2. Payslip Statement (Earnings & Deductions side-by-side) */}
            <Card title="收支項目核對清單">
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 'var(--space-8)',
                position: 'relative'
              }}>
                {/* Left Column: Earnings */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  <h4 style={{
                    borderBottom: '2px solid var(--color-success)',
                    paddingBottom: 'var(--space-2)',
                    marginBottom: 'var(--space-2)',
                    color: 'var(--color-success)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span>應發項目 (Earnings)</span>
                    <span className="material-symbols-outlined icon-sm">add_circle</span>
                  </h4>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    {employee.salaryType === 'hourly' ? (
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-neutral-100)', paddingBottom: 'var(--space-2)' }}>
                        <div>
                          <span style={{ fontWeight: '500' }}>平日時數工資</span>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-neutral-500)', marginTop: '2px' }}>
                            時數 {formatHours(record.regularHours)} H × 時薪 {formatCurr(record.baseSalary > 0 ? record.baseSalary : employee.baseSalary)}元
                          </div>
                        </div>
                        <span className="font-mono" style={{ fontWeight: '500' }}>{formatCurr(Math.round(record.regularHours * (record.baseSalary > 0 ? record.baseSalary : employee.baseSalary)))}</span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-neutral-100)', paddingBottom: 'var(--space-2)' }}>
                        <span style={{ fontWeight: '500' }}>本薪/底薪</span>
                        <span className="font-mono" style={{ fontWeight: '500' }}>{formatCurr(record.baseSalary)}</span>
                      </div>
                    )}
                    
                    {record.allowanceAA > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-neutral-100)', paddingBottom: 'var(--space-2)' }}>
                        <span>AA 加給</span>
                        <span className="font-mono">{formatCurr(record.allowanceAA)}</span>
                      </div>
                    )}
                    {record.allowanceLicense > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-neutral-100)', paddingBottom: 'var(--space-2)' }}>
                        <span>專業證照加給</span>
                        <span className="font-mono">{formatCurr(record.allowanceLicense)}</span>
                      </div>
                    )}
                    {record.allowanceManager > 0 && employee.salaryType === 'monthly' && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-neutral-100)', paddingBottom: 'var(--space-2)' }}>
                        <span>主管加給</span>
                        <span className="font-mono">{formatCurr(record.allowanceManager)}</span>
                      </div>
                    )}
                    {record.overtimePay > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-neutral-100)', paddingBottom: 'var(--space-2)' }}>
                        <span>加班費</span>
                        <span className="font-mono">{formatCurr(record.overtimePay)}</span>
                      </div>
                    )}
                    {record.otherAllowance > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-neutral-100)', paddingBottom: 'var(--space-2)' }}>
                        <span>其他津貼</span>
                        <span className="font-mono">{formatCurr(record.otherAllowance)}</span>
                      </div>
                    )}
                    {record.mealAllowance > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-neutral-100)', paddingBottom: 'var(--space-2)' }}>
                        <span>其他津貼 (不計入平均時薪)</span>
                        <span className="font-mono">{formatCurr(record.mealAllowance)}</span>
                      </div>
                    )}
                    {record.bonus > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-neutral-100)', paddingBottom: 'var(--space-2)' }}>
                        <span>發放獎金 (績效獎金)</span>
                        <span className="font-mono">{formatCurr(record.bonus)}</span>
                      </div>
                    )}
                    {record.retroPay > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-neutral-100)', paddingBottom: 'var(--space-2)' }}>
                        <span>補發薪資</span>
                        <span className="font-mono">{formatCurr(record.retroPay)}</span>
                      </div>
                    )}
                  </div>

                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontWeight: 'bold',
                    fontSize: 'var(--text-base)',
                    color: 'var(--color-success)',
                    paddingTop: 'var(--space-2)',
                    marginTop: 'auto',
                    borderTop: '2px solid var(--color-neutral-200)'
                  }}>
                    <span>應發薪資總額</span>
                    <span className="font-mono">{formatCurr(record.grossPay)}</span>
                  </div>
                </div>

                {/* Right Column: Deductions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  <h4 style={{
                    borderBottom: '2px solid var(--color-error)',
                    paddingBottom: 'var(--space-2)',
                    marginBottom: 'var(--space-2)',
                    color: 'var(--color-error)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span>應扣項目 (Deductions)</span>
                    <span className="material-symbols-outlined icon-sm">remove_circle</span>
                  </h4>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-neutral-100)', paddingBottom: 'var(--space-2)' }}>
                      <span>勞保自付額</span>
                      <span className="font-mono">{formatCurr(record.laborInsuranceEmployee)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-neutral-100)', paddingBottom: 'var(--space-2)' }}>
                      <span>健保自付額</span>
                      <span className="font-mono">{formatCurr(record.healthInsuranceEmployee)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-neutral-100)', paddingBottom: 'var(--space-2)' }}>
                      <span>勞退自提金額 ({employee.voluntaryPensionRate}%)</span>
                      <span className="font-mono">{formatCurr(record.laborPensionEmployee)}</span>
                    </div>

                    {record.leaveDeduction > 0 && (
                      <div style={{ borderBottom: '1px solid var(--color-neutral-100)', paddingBottom: 'var(--space-2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>請假扣薪</span>
                          <span className="font-mono">{formatCurr(record.leaveDeduction)}</span>
                        </div>
                        
                        <div style={{ marginTop: 'var(--space-1)', textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsFormulaExpanded(!isFormulaExpanded);
                            }}
                            style={{
                              fontSize: 'var(--text-xs)',
                              color: 'var(--color-primary-500)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '2px',
                              fontWeight: '500',
                              cursor: 'pointer'
                            }}
                          >
                            <span>{isFormulaExpanded ? '隱藏計算公式' : '顯示計算公式'}</span>
                            <span className="material-symbols-outlined icon-sm">
                              {isFormulaExpanded ? 'expand_less' : 'expand_more'}
                            </span>
                          </button>
                        </div>

                        {isFormulaExpanded && (
                          <div style={{
                            backgroundColor: 'var(--color-neutral-50)',
                            border: '1px solid var(--color-neutral-200)',
                            borderRadius: 'var(--radius-sm)',
                            padding: 'var(--space-2) var(--space-3)',
                            fontSize: 'var(--text-xs)',
                            color: 'var(--color-neutral-600)',
                            marginTop: 'var(--space-2)',
                            lineHeight: '1.4',
                            textAlign: 'left'
                          }}>
                            {(() => {
                              const getRate = (l) => l.rate !== undefined ? l.rate : (l.leaveType.includes('病') ? 0.5 : (l.leaveType.includes('特') || l.leaveType.includes('公') || l.leaveType.includes('婚') || l.leaveType.includes('喪') ? 0.0 : 1.0));
                              const bonusVal = record.bonus || 0;
                              const fixedAdd = (record.allowanceAA || 0) + (record.allowanceLicense || 0) + (record.allowanceManager || 0) + (record.otherAllowance || 0) + bonusVal;
                              const totalWages = record.baseSalary + fixedAdd;
                              
                              const normalLeaves = record.leaves ? record.leaves.filter(l => {
                                const type = (l.leaveType || '').toLowerCase();
                                const isOt = type === 'co' || type === 'alc' || type.includes('折算') || type.includes('折現') || type === 'ot' || type === '加班';
                                const isOfficial = type.includes('公出') || type.includes('家訪') || type.includes('出差') || type.includes('會議') || type.includes('訓練') || type.includes('培訓') || type === 'ob' || type.includes('挪移') || type.includes('派案') || type.includes('個督');
                                if (isOt || isOfficial) return false;
                                return getRate(l) > 0.0;
                              }) : [];
                              
                              const totalWeightedHours = normalLeaves.reduce((sum, l) => sum + (l.days * 8 * getRate(l)), 0);

                              return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <div>
                                    <strong>公式：</strong>round( 薪資總額 / 30 / 8 × Sum(時數 × 扣薪比例) )
                                  </div>
                                  <div style={{ marginTop: '2px', paddingLeft: '8px', borderLeft: '2px solid var(--color-neutral-300)' }}>
                                    <div>薪資總額 = 底薪 {formatCurr(record.baseSalary)} + 加給/獎金 {formatCurr(fixedAdd)} = {formatCurr(totalWages)}</div>
                                    {normalLeaves.length > 0 ? (
                                      <>
                                        <div style={{ marginTop: '2px' }}>
                                          計算：round( {formatCurr(totalWages)} / 240 × ( {normalLeaves.map(l => `${l.leaveType} ${l.days * 8}H × ${getRate(l) * 100}%`).join(' + ')} ) )
                                        </div>
                                        <div style={{ marginTop: '2px', fontWeight: '500' }}>
                                          = round( {formatCurr(totalWages)} / 240 × {totalWeightedHours}H ) = -{formatCurr(record.leaveDeduction)}
                                        </div>
                                      </>
                                    ) : (
                                      <div style={{ marginTop: '2px' }}>無扣薪請假紀錄</div>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    )}
                    {record.supplementaryHealthInsurance > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-neutral-100)', paddingBottom: 'var(--space-2)' }}>
                        <span>二代健保自付額</span>
                        <span className="font-mono">{formatCurr(record.supplementaryHealthInsurance)}</span>
                      </div>
                    )}
                    {record.prevInsuranceDifference !== 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-neutral-100)', paddingBottom: 'var(--space-2)' }}>
                        <span>前期勞健退差額</span>
                        <span className="font-mono">{formatCurr(record.prevInsuranceDifference)}</span>
                      </div>
                    )}
                    {record.otherDeductions > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-neutral-100)', paddingBottom: 'var(--space-2)' }}>
                        <span>其他扣除額</span>
                        <span className="font-mono">{formatCurr(record.otherDeductions)}</span>
                      </div>
                    )}
                    
                    {record.laborDisabilityExemption > 0 && (
                      <div style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--color-neutral-500)',
                        backgroundColor: 'var(--color-neutral-50)',
                        border: '1px solid var(--color-neutral-100)',
                        padding: 'var(--space-2)',
                        borderRadius: 'var(--radius-sm)',
                        marginTop: 'var(--space-2)'
                      }}>
                        勞保減免：保費減免 {Math.round(record.laborDisabilityExemption * 100)}%
                      </div>
                    )}
                    {(record.healthDisabilityExemption > 0 || record.healthGovSubsidy > 0) && (
                      <div style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--color-neutral-500)',
                        backgroundColor: 'var(--color-neutral-50)',
                        border: '1px solid var(--color-neutral-100)',
                        padding: 'var(--space-2)',
                        borderRadius: 'var(--radius-sm)',
                        marginTop: 'var(--space-2)'
                      }}>
                        健保減免/補貼：
                        {record.healthDisabilityExemption > 0 && `保費減免 ${Math.round(record.healthDisabilityExemption * 100)}%`}
                        {record.healthDisabilityExemption > 0 && record.healthGovSubsidy > 0 && '，'}
                        {record.healthGovSubsidy > 0 && `政府定額補貼 ${record.healthGovSubsidy}元`}
                      </div>
                    )}
                  </div>

                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontWeight: 'bold',
                    fontSize: 'var(--text-base)',
                    color: 'var(--color-error)',
                    paddingTop: 'var(--space-2)',
                    marginTop: 'auto',
                    borderTop: '2px solid var(--color-neutral-200)'
                  }}>
                    <span>應扣項目總額</span>
                    <span className="font-mono">{formatCurr(record.totalDeductions)}</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* 3. Sub-panels: Attendance and Insurance/Employer Cost side-by-side */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1.2fr 1fr',
              gap: 'var(--space-6)',
              alignItems: 'start'
            }}>
              {/* Attendance and Overtime summary */}
              <Card title="出勤與加班分流明細">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
                  {/* Basic attendance */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    <h4 style={{ borderBottom: '1px solid var(--color-neutral-200)', paddingBottom: '4px', margin: 0, color: 'var(--color-neutral-700)' }}>基本出勤統計</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>實際出勤天數:</span>
                        <strong>{record.workDays} 天</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>請假扣薪天數:</span>
                        <strong>{record.leaveDays} 天</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>曠職缺勤天數:</span>
                        <strong style={{ color: record.absentDays > 0 ? 'var(--color-error)' : 'inherit' }}>{record.absentDays} 天</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--color-neutral-200)', paddingTop: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
                        <span>正常工時總計:</span>
                        <strong>{formatHours(record.regularHours)} 小時</strong>
                      </div>
                    </div>
                  </div>

                  {/* Overtime分流 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', borderLeft: '1px solid var(--color-neutral-200)', paddingLeft: 'var(--space-4)' }}>
                    <h4 style={{ borderBottom: '1px solid var(--color-neutral-200)', paddingBottom: '4px', margin: 0, color: 'var(--color-neutral-700)' }}>加班時數分流明細</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>1.34倍加班:</span>
                        <span className="font-mono">{formatHours(record.overtimeHours134)} 小時</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>1.67倍加班:</span>
                        <span className="font-mono">{formatHours(record.overtimeHours167)} 小時</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>{employee?.salaryType === 'monthly' ? '加發 1 倍加班 (國定/例假)' : '2.000倍加班'}:</span>
                        <span className="font-mono">{formatHours(record.overtimeHours200)} 小時</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>2.67倍加班:</span>
                        <span className="font-mono">{formatHours(record.overtimeHours267)} 小時</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: 'var(--color-primary-700)', borderTop: '1px dashed var(--color-neutral-200)', paddingTop: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
                        <span>加班總時數:</span>
                        <span className="font-mono">{formatHours(record.overtimeHours)} 小時</span>
                      </div>
                    </div>
                  </div>
                </div>

                {employee.salaryType === 'hourly' && (
                  <div style={{
                    borderTop: '1px dashed var(--color-neutral-200)',
                    paddingTop: 'var(--space-2)',
                    marginTop: 'var(--space-3)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-primary-700)',
                    lineHeight: '1.4'
                  }}>
                    <strong>加班費時薪基準 (平均時薪)：</strong> {averageHourlyRateDisplay} 元/小時<br />
                    <span style={{ color: 'var(--color-neutral-400)' }}>
                      (計算公式：(正常工時工資 {Math.round(parseFloat(record.regularHours.toFixed(2)) * (record.baseSalary > 0 ? record.baseSalary : employee.baseSalary))} + AA加給 {record.allowanceAA} + 證照加給 {record.allowanceLicense} + 獎金 {record.bonus}) / 正常工時 {record.regularHours.toFixed(2)} H)
                    </span>
                  </div>
                )}
              </Card>

              {/* Insurance Grade and Employer Cost Table */}
              <Card title="投保級距與雇主公提成本對照">
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--text-xs)' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--color-neutral-50)', borderBottom: '1px solid var(--color-neutral-200)' }}>
                        <th style={{ padding: 'var(--space-2) var(--space-3)', fontWeight: '600', color: 'var(--color-neutral-700)' }}>投保/提繳項目</th>
                        <th style={{ padding: 'var(--space-2) var(--space-3)', fontWeight: '600', color: 'var(--color-neutral-700)', textAlign: 'right' }}>級距 (元)</th>
                        <th style={{ padding: 'var(--space-2) var(--space-3)', fontWeight: '600', color: 'var(--color-neutral-700)', textAlign: 'right' }}>雇主負擔 (元)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid var(--color-neutral-100)' }}>
                        <td style={{ padding: 'var(--space-2) var(--space-3)', color: 'var(--color-neutral-800)' }}>勞工保險 (70%)</td>
                        <td style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatCurr(record.laborInsuranceGrade)}</td>
                        <td style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: '500' }}>{formatCurr(record.laborInsuranceEmployer)}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--color-neutral-100)' }}>
                        <td style={{ padding: 'var(--space-2) var(--space-3)', color: 'var(--color-neutral-800)' }}>職業災害保險 (職保)</td>
                        <td style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatCurr(record.laborOccupationalGrade)}</td>
                        <td style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: '500' }}>{formatCurr(record.laborOccupationalEmployer)}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--color-neutral-100)' }}>
                        <td style={{ padding: 'var(--space-2) var(--space-3)', color: 'var(--color-neutral-800)' }}>全民健保 (60%)</td>
                        <td style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatCurr(record.healthInsuranceGrade)}</td>
                        <td style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: '500' }}>{formatCurr(record.healthInsuranceEmployer)}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--color-neutral-100)' }}>
                        <td style={{ padding: 'var(--space-2) var(--space-3)', color: 'var(--color-neutral-800)' }}>勞退公提金 (6%)</td>
                        <td style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatCurr(record.laborPensionGrade)}</td>
                        <td style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: '500' }}>{formatCurr(record.laborPensionEmployer)}</td>
                      </tr>
                      <tr style={{ backgroundColor: 'var(--color-neutral-50)', fontWeight: 'bold' }}>
                        <td style={{ padding: 'var(--space-2) var(--space-3)', color: 'var(--color-primary-700)' }}>雇主公提成本總計</td>
                        <td style={{ padding: 'var(--space-2) var(--space-3)' }}></td>
                        <td style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--color-primary-700)' }}>{formatCurr(record.totalEmployerCost)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
            
            {/* Notes Section */}
            {record.notes && (
              <Card title="調整備註說明">
                <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-neutral-700)', lineHeight: '1.6' }}>
                  {record.notes}
                </p>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

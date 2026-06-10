import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import payrollService from '../../services/payrollService';
import { Button, Card, LoadingSpinner, Badge, Input } from '../../components/common';
import { BASE_URL } from '../../services/api';

export default function PayrollDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Editable fields state
  const [editForm, setEditForm] = useState({
    baseSalary: '0',
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
    healthGovSubsidy: '0',
    leavePaySupplement: '0'
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
          allowanceAA: (res.data.allowanceAA || 0).toString(),
          allowanceLicense: (res.data.allowanceLicense || 0).toString(),
          allowanceManager: (res.data.allowanceManager || 0).toString(),
          otherAllowance: (res.data.otherAllowance || 0).toString(),
          mealAllowance: (res.data.mealAllowance || 0).toString(),
          bonus: (res.data.bonus || 0).toString(),
          retroPay: (res.data.retroPay || 0).toString(),
          leaveDeduction: (res.data.leaveDeduction || 0).toString(),
          otherDeductions: (res.data.otherDeductions || 0).toString(),
          overtimeHours134: (res.data.overtimeHours134 || 0).toString(),
          overtimeHours167: (res.data.overtimeHours167 || 0).toString(),
          overtimeHours200: (res.data.overtimeHours200 || 0).toString(),
          overtimeHours267: (res.data.overtimeHours267 || 0).toString(),
          laborInsuranceGrade: (res.data.laborInsuranceGrade || 0).toString(),
          laborOccupationalGrade: (res.data.laborOccupationalGrade || 0).toString(),
          healthInsuranceGrade: (res.data.healthInsuranceGrade || 0).toString(),
          laborPensionGrade: (res.data.laborPensionGrade || 0).toString(),
          notes: res.data.notes || '',
          supplementaryHealthInsurance: (res.data.supplementaryHealthInsurance || 0).toString(),
          prevInsuranceDifference: (res.data.prevInsuranceDifference || 0).toString(),
          healthDisabilityExemption: (res.data.healthDisabilityExemption || 0).toString(),
          healthGovSubsidy: (res.data.healthGovSubsidy || 0).toString(),
          leavePaySupplement: (res.data.leavePaySupplement || 0).toString()
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
        healthGovSubsidy: parseFloat(editForm.healthGovSubsidy) || 0,
        leavePaySupplement: parseFloat(editForm.leavePaySupplement) || 0
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

  const handleLock = async () => {
    if (window.confirm('確定要鎖定此筆薪資紀錄嗎？鎖定後將無法再進行編輯（但仍可直接進行核准）。')) {
      try {
        await payrollService.lockPayroll(id);
        alert('薪資紀錄已鎖定');
        loadPayrollRecord();
      } catch (err) {
        console.error(err);
        alert(err.message || '鎖定失敗');
      }
    }
  };

  const handleApprove = async () => {
    if (window.confirm('確定要核准此筆薪資紀錄嗎？核准後將正式發放，且無法再調整。')) {
      try {
        await payrollService.approvePayroll(id);
        alert('薪資紀錄已核准');
        loadPayrollRecord();
      } catch (err) {
        console.error(err);
        alert(err.message || '核准失敗');
      }
    }
  };

  const handleDelete = async () => {
    if (window.confirm('確定要刪除此筆草稿狀態的薪資紀錄嗎？刪除後不可復原！')) {
      try {
        setSaving(true);
        await payrollService.deletePayroll(id);
        alert('薪資紀錄已刪除');
        navigate('/payroll');
      } catch (err) {
        console.error(err);
        alert(err.message || '刪除失敗');
      } finally {
        setSaving(false);
      }
    }
  };

  const handleDownloadPDF = () => {
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
    });
  };

  if (loading) return <LoadingSpinner fullPage size="lg" />;
  if (!record || !employee) return <Card>找不到該筆薪資紀錄</Card>;

  const formatCurr = (v) => `${Math.round(v).toLocaleString('zh-TW')}`;

  // Helper to calculate Average Hourly Rate for display
  let averageHourlyRateDisplay = 0;
  if (employee.salaryType === 'hourly' && record.regularHours > 0) {
    const regHoursRounded = parseFloat(record.regularHours.toFixed(2));
    const hourlyRate = record.baseSalary > 0 ? record.baseSalary : employee.baseSalary;
    const normalWageForAverage = Math.round(regHoursRounded * hourlyRate);
    averageHourlyRateDisplay = ((normalWageForAverage + record.allowanceAA + record.allowanceLicense + record.bonus) / record.regularHours);
    averageHourlyRateDisplay = parseFloat(averageHourlyRateDisplay.toFixed(2));
  } else if (employee.salaryType === 'monthly') {
    const fixedMonthly = record.baseSalary + record.allowanceAA + record.allowanceLicense + record.allowanceManager;
    averageHourlyRateDisplay = parseFloat((fixedMonthly / 240).toFixed(2));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
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
          <Button variant="outline" icon="arrow_back" onClick={() => navigate('/payroll')}>
            返回列表
          </Button>
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
                      label="1.334倍加班"
                      type="number"
                      step="0.01"
                      value={editForm.overtimeHours134}
                      onChange={e => setEditForm(prev => ({ ...prev, overtimeHours134: e.target.value }))}
                    />
                    <Input
                      label="1.667倍加班"
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
                      label="2.667倍加班"
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
                    label="其他扣除額 (元)"
                    type="number"
                    value={editForm.otherDeductions}
                    onChange={e => setEditForm(prev => ({ ...prev, otherDeductions: e.target.value }))}
                  />

                  <h4 style={{ borderBottom: '1px solid var(--color-neutral-200)', paddingBottom: '4px', margin: '12px 0 4px 0', color: 'var(--color-neutral-700)' }}>健保減免與政府補貼</h4>
                  <Input
                    label="健保身障減免比例 (0-1.0)"
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={editForm.healthDisabilityExemption}
                    onChange={e => setEditForm(prev => ({ ...prev, healthDisabilityExemption: e.target.value }))}
                  />
                  <Input
                    label="健保政府補貼定額 (元)"
                    type="number"
                    min="0"
                    value={editForm.healthGovSubsidy}
                    onChange={e => setEditForm(prev => ({ ...prev, healthGovSubsidy: e.target.value }))}
                  />

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
          /* Static Display columns */
          <>
            {/* Earnings column */}
            <Card title="應發項目 (Earnings)">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {employee.salaryType === 'hourly' ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-neutral-100)', paddingBottom: 'var(--space-2)' }}>
                      <div>
                        <span>平日時數工資:</span>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-neutral-500)' }}>
                          時數 {record.regularHours} H x 時薪 {record.baseSalary > 0 ? record.baseSalary : employee.baseSalary}
                        </div>
                      </div>
                      <span className="font-mono">{formatCurr(Math.round(record.regularHours * (record.baseSalary > 0 ? record.baseSalary : employee.baseSalary)))}</span>
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-neutral-100)', paddingBottom: 'var(--space-2)' }}>
                    <span>本薪/底薪:</span>
                    <span className="font-mono">{formatCurr(record.baseSalary)}</span>
                  </div>
                )}
                
                {record.allowanceAA > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-neutral-100)', paddingBottom: 'var(--space-2)' }}>
                    <span>AA 加給:</span>
                    <span className="font-mono">{formatCurr(record.allowanceAA)}</span>
                  </div>
                )}
                {record.allowanceLicense > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-neutral-100)', paddingBottom: 'var(--space-2)' }}>
                    <span>專業證照加給:</span>
                    <span className="font-mono">{formatCurr(record.allowanceLicense)}</span>
                  </div>
                )}
                {record.allowanceManager > 0 && employee.salaryType === 'monthly' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-neutral-100)', paddingBottom: 'var(--space-2)' }}>
                    <span>主管加給:</span>
                    <span className="font-mono">{formatCurr(record.allowanceManager)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-neutral-100)', paddingBottom: 'var(--space-2)' }}>
                  <span>加班費:</span>
                  <span className="font-mono">{formatCurr(record.overtimePay)}</span>
                </div>
                {record.otherAllowance > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-neutral-100)', paddingBottom: 'var(--space-2)' }}>
                    <span>其他津貼:</span>
                    <span className="font-mono">{formatCurr(record.otherAllowance)}</span>
                  </div>
                )}
                {record.mealAllowance > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-neutral-100)', paddingBottom: 'var(--space-2)' }}>
                    <span>其他津貼（不列入平均時薪計算）:</span>
                    <span className="font-mono">{formatCurr(record.mealAllowance)}</span>
                  </div>
                )}
                {record.bonus > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-neutral-100)', paddingBottom: 'var(--space-2)' }}>
                    <span>發放獎金 (績效獎金):</span>
                    <span className="font-mono">{formatCurr(record.bonus)}</span>
                  </div>
                )}
                {record.retroPay > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-neutral-100)', paddingBottom: 'var(--space-2)' }}>
                    <span>補發薪資:</span>
                    <span className="font-mono">{formatCurr(record.retroPay)}</span>
                  </div>
                )}
                
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: 'var(--text-md)', color: 'var(--color-primary-700)', paddingTop: 'var(--space-1)' }}>
                  <span>應發薪資總額:</span>
                  <span className="font-mono">{formatCurr(record.grossPay)}</span>
                </div>
              </div>
            </Card>

            {/* Deductions column */}
            <Card title="應扣項目 (Deductions)">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-neutral-100)', paddingBottom: 'var(--space-2)', color: 'var(--color-error)' }}>
                  <span>勞保自付額:</span>
                  <span className="font-mono">{formatCurr(record.laborInsuranceEmployee)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-neutral-100)', paddingBottom: 'var(--space-2)', color: 'var(--color-error)' }}>
                  <span>健保自付額:</span>
                  <span className="font-mono">{formatCurr(record.healthInsuranceEmployee)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-neutral-100)', paddingBottom: 'var(--space-2)', color: 'var(--color-error)' }}>
                  <span>勞退自提金額 ({employee.voluntaryPensionRate}%):</span>
                  <span className="font-mono">{formatCurr(record.laborPensionEmployee)}</span>
                </div>
                {record.incomeTax > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-neutral-100)', paddingBottom: 'var(--space-2)', color: 'var(--color-error)' }}>
                    <span>所得稅預扣:</span>
                    <span className="font-mono">{formatCurr(record.incomeTax)}</span>
                  </div>
                )}
                {record.leaveDeduction > 0 && (
                  <div style={{ borderBottom: '1px solid var(--color-neutral-100)', paddingBottom: 'var(--space-2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-error)' }}>
                      <span>請假扣薪:</span>
                      <span className="font-mono">{formatCurr(record.leaveDeduction)}</span>
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-neutral-500)', marginTop: '4px', textAlign: 'right', lineHeight: '1.4' }}>
                      {(() => {
                        const fixedAdd = (record.allowanceAA || 0) + (record.allowanceLicense || 0) + (record.allowanceManager || 0) + (record.otherAllowance || 0);
                        const normalLeaves = record.leaves ? record.leaves.filter(l => {
                          const type = (l.leaveType || '').toLowerCase();
                          const isOt = type === 'co' || type === 'alc' || type.includes('折算') || type.includes('折現') || type === 'ot' || type === '加班';
                          const isOfficial = type.includes('公出') || type.includes('家訪') || type.includes('出差') || type.includes('會議') || type.includes('訓練') || type.includes('培訓') || type === 'ob';
                          return !isOt && !isOfficial;
                        }) : [];
                        
                        return (
                          <>
                            {normalLeaves.length === 1 ? (
                              (() => {
                                const l = normalLeaves[0];
                                const hours = l.days * 8;
                                const rate = l.rate !== undefined ? l.rate : (l.leaveType.includes('病') ? 0.5 : (l.leaveType.includes('特') || l.leaveType.includes('公') || l.leaveType.includes('婚') || l.leaveType.includes('喪') ? 0.0 : 1.0));
                                return (
                                  <div>(公式：({formatCurr(record.baseSalary)} + {formatCurr(fixedAdd)}) / 30 / 8 × {hours}H × {Math.round(rate * 100)}% = -{formatCurr(record.leaveDeduction)})</div>
                                );
                              })()
                            ) : (
                              <div>(公式：(底薪 {formatCurr(record.baseSalary)} + 固定加給 {formatCurr(fixedAdd)}) / 30 / 8 × 請假時數 × 扣薪比例)</div>
                            )}
                            {normalLeaves.map((l, idx) => {
                              const hours = l.days * 8;
                              const rate = l.rate !== undefined ? l.rate : (l.leaveType.includes('病') ? 0.5 : (l.leaveType.includes('特') || l.leaveType.includes('公') || l.leaveType.includes('婚') || l.leaveType.includes('喪') ? 0.0 : 1.0));
                              
                              const hourlyLeaveRate = (record.baseSalary + fixedAdd) / 240;
                              const ded = Math.round(hourlyLeaveRate * hours * rate);
                              
                              return (
                                <div key={idx} style={{ marginTop: '2px' }}>
                                  • {l.leaveType} {hours}H (比例 {Math.round(rate * 100)}%)：({formatCurr(record.baseSalary)} + {formatCurr(fixedAdd)}) / 240 × {hours} × {rate} = -{formatCurr(ded)}
                                </div>
                              );
                            })}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
                {record.supplementaryHealthInsurance > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-neutral-100)', paddingBottom: 'var(--space-2)', color: 'var(--color-error)' }}>
                    <span>二代健保自付額:</span>
                    <span className="font-mono">{formatCurr(record.supplementaryHealthInsurance)}</span>
                  </div>
                )}
                {record.prevInsuranceDifference !== 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-neutral-100)', paddingBottom: 'var(--space-2)', color: 'var(--color-error)' }}>
                    <span>前期勞健退差額:</span>
                    <span className="font-mono">{formatCurr(record.prevInsuranceDifference)}</span>
                  </div>
                )}
                {record.otherDeductions > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-neutral-100)', paddingBottom: 'var(--space-2)', color: 'var(--color-error)' }}>
                    <span>其他扣除額:</span>
                    <span className="font-mono">{formatCurr(record.otherDeductions)}</span>
                  </div>
                )}
                
                {(record.healthDisabilityExemption > 0 || record.healthGovSubsidy > 0) && (
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-neutral-500)', borderBottom: '1px solid var(--color-neutral-100)', paddingBottom: 'var(--space-2)', paddingLeft: '4px' }}>
                    健保減免/補貼：
                    {record.healthDisabilityExemption > 0 && `身障減免 ${Math.round(record.healthDisabilityExemption * 100)}%`}
                    {record.healthDisabilityExemption > 0 && record.healthGovSubsidy > 0 && '，'}
                    {record.healthGovSubsidy > 0 && `政府定額補貼 ${record.healthGovSubsidy}元`}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: 'var(--text-md)', color: 'var(--color-error)', paddingTop: 'var(--space-1)' }}>
                  <span>應扣項目總額:</span>
                  <span className="font-mono">{formatCurr(record.totalDeductions)}</span>
                </div>
              </div>
            </Card>
          </>
        )}
      </div>

      {/* Net Pay and Costs Box (Hidden during edit) */}
      {!isEditing && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1.5fr 1fr',
          gap: 'var(--space-6)',
          alignItems: 'stretch'
        }}>
          {/* Net pay Display */}
          <div style={{
            backgroundColor: 'var(--color-primary-50)',
            border: '2px solid var(--color-primary-200)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-6)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 'var(--space-2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, color: 'var(--color-primary-800)', fontSize: 'var(--text-xl)' }}>實發淨額 (Net Pay)</h3>
              </div>
              <h2 style={{ margin: 0, color: 'var(--color-primary-700)', fontSize: 'var(--text-3xl)', fontWeight: 'bold' }} className="font-mono">
                {formatCurr(record.netPay)}
              </h2>
            </div>
            
            {employee.salaryType === 'hourly' && (
              <div style={{ borderTop: '1px dashed var(--color-primary-200)', paddingTop: 'var(--space-2)', marginTop: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-primary-700)' }}>
                <strong>加班費時薪基準 (平均時薪)：</strong> {averageHourlyRateDisplay} / 小時 
                <span style={{ color: 'var(--color-neutral-500)', marginLeft: '6px' }}>
                  (計算公式：(正常薪資 {Math.round(parseFloat(record.regularHours.toFixed(2)) * (record.baseSalary > 0 ? record.baseSalary : employee.baseSalary))} + AA加給 {record.allowanceAA} + 證照加給 {record.allowanceLicense} + 獎金 {record.bonus}) / 正常工時 {record.regularHours.toFixed(2)} hr)
                </span>
              </div>
            )}
          </div>

          {/* Employer cost Display */}
          <Card title="雇主額外負擔成本">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>雇主勞保負擔 (70%):</span>
                <span className="font-mono">{formatCurr(record.laborInsuranceEmployer)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>雇主職保負擔 (職災):</span>
                <span className="font-mono">{formatCurr(record.laborOccupationalEmployer)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>雇主健保負擔 (60%):</span>
                <span className="font-mono">{formatCurr(record.healthInsuranceEmployer)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>雇主提繳勞退 (6%):</span>
                <span className="font-mono">{formatCurr(record.laborPensionEmployer)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', borderTop: '1px dashed var(--color-neutral-200)', paddingTop: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
                <span>公提成本總計:</span>
                <span className="font-mono">{formatCurr(record.totalEmployerCost)}</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Attendance summary details */}
      {!isEditing && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 'var(--space-6)' }}>
          <Card title="本月出勤與加班分流明細">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: 'var(--text-sm)' }}>
                <div><strong>出勤天數：</strong> {record.workDays} 天</div>
                <div><strong>請假扣薪天數：</strong> {record.leaveDays} 天</div>
                <div><strong>曠職缺勤天數：</strong> {record.absentDays} 天</div>
                <div><strong>正常工時總計：</strong> {record.regularHours} 小時</div>
                {employee.salaryType === 'monthly' && (
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-neutral-500)', marginTop: 'var(--space-2)', borderTop: '1px dashed var(--color-neutral-200)', paddingTop: 'var(--space-2)' }}>
                    <strong>請假扣薪計算公式：</strong><br />
                    {(() => {
                      const fixedAdd = (record.allowanceAA || 0) + (record.allowanceLicense || 0) + (record.allowanceManager || 0) + (record.otherAllowance || 0);
                      const normalLeaves = record.leaves ? record.leaves.filter(l => {
                        const type = (l.leaveType || '').toLowerCase();
                        const isOt = type === 'co' || type === 'alc' || type.includes('折算') || type.includes('折現') || type === 'ot' || type === '加班';
                        const isOfficial = type.includes('公出') || type.includes('家訪') || type.includes('出差') || type.includes('會議') || type.includes('訓練') || type.includes('培訓') || type === 'ob';
                        return !isOt && !isOfficial;
                      }) : [];
                      
                      if (normalLeaves.length === 1) {
                        const l = normalLeaves[0];
                        const hours = l.days * 8;
                        const rate = l.rate !== undefined ? l.rate : (l.leaveType.includes('病') ? 0.5 : (l.leaveType.includes('特') || l.leaveType.includes('公') || l.leaveType.includes('婚') || l.leaveType.includes('喪') ? 0.0 : 1.0));
                        return `(公式：(${formatCurr(record.baseSalary)} + ${formatCurr(fixedAdd)}) / 30 / 8 × ${hours}H × 扣薪比例 ${Math.round(rate * 100)}% = ${formatCurr(record.leaveDeduction)})`;
                      }
                      
                      return `(底薪 ${formatCurr(record.baseSalary)} + 固定加給 ${formatCurr(fixedAdd)}) / 30 / 8 × 請假時數 × 扣薪比例`;
                    })()}<br />
                    <span style={{ fontSize: '10px', color: 'var(--color-neutral-400)' }}>
                      * 固定加給包含：AA加給、專業證照、主管加給、其他津貼。
                    </span>
                  </div>
                )}
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: 'var(--text-sm)', borderLeft: '1px solid var(--color-neutral-200)', paddingLeft: 'var(--space-4)' }}>
                <div><strong>加班總時數：</strong> {record.overtimeHours} 小時</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-neutral-600)' }}>
                  - 1.334倍加班：{record.overtimeHours134.toFixed(4)} 小時
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-neutral-600)' }}>
                  - 1.667倍加班：{record.overtimeHours167.toFixed(4)} 小時
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-neutral-600)' }}>
                  - {employee?.salaryType === 'monthly' ? '加發 1.000 倍加班' : '2.000倍加班'}：{record.overtimeHours200.toFixed(4)} 小時
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-neutral-600)' }}>
                  - 2.667倍加班：{record.overtimeHours267.toFixed(4)} 小時
                </div>
              </div>
            </div>
          </Card>

          <Card title="本期投保級距歷史紀錄">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>勞工保險投保級距：</span>
                <span className="font-mono">{formatCurr(record.laborInsuranceGrade)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>職災保險投保級距：</span>
                <span className="font-mono">{formatCurr(record.laborOccupationalGrade)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>全民健保投保級距：</span>
                <span className="font-mono">{formatCurr(record.healthInsuranceGrade)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>勞工退休金提繳級距：</span>
                <span className="font-mono">{formatCurr(record.laborPensionGrade)}</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Adjustment notes */}
      {record.notes && !isEditing && (
        <Card title="調整備註說明">
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-neutral-700)', lineHeight: '1.6' }}>
            {record.notes}
          </p>
        </Card>
      )}
    </div>
  );
}

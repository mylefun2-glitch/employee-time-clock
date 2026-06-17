import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import payrollService from '../../services/payrollService';
import settingService from '../../services/settingService';
import ImportModal from './ImportModal';
import { Button, Card, DataTable, Input, LoadingSpinner, Badge, Modal } from '../../components/common';
import { BASE_URL } from '../../services/api';

export default function PayrollList() {
  const now = new Date();
  const location = useLocation();
  const [year, setYear] = useState(location.state?.year || now.getFullYear().toString());
  const [month, setMonth] = useState(location.state?.month || (now.getMonth() + 1).toString());
  const [payrolls, setPayrolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(location.state?.statusFilter || '');
  const [deptFilter, setDeptFilter] = useState(location.state?.deptFilter || '');
  const [nameFilter, setNameFilter] = useState(location.state?.nameFilter || '');
  const [selectedIds, setSelectedIds] = useState([]);
  const [isCalcModalOpen, setIsCalcModalOpen] = useState(false);
  const [resetSettings, setResetSettings] = useState(false);
  const [calcSettings, setCalcSettings] = useState({
    labor_insurance_rate: '0.12',
    labor_insurance_employee_share: '0.20',
    labor_insurance_employer_share: '0.70',
    health_insurance_rate: '0.0517',
    health_insurance_employee_share: '0.30',
    health_insurance_employer_share: '0.60',
    health_insurance_avg_dependents: '0.61',
    labor_pension_employer_rate: '0.06',
    minimum_wage_monthly: '29500'
  });
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadPayrollRecords();
  }, [year, month, statusFilter]);

  useEffect(() => {
    setSelectedIds([]);
  }, [deptFilter, nameFilter]);

  const loadPayrollRecords = async () => {
    setLoading(true);
    setSelectedIds([]);
    try {
      const res = await payrollService.getPayrolls({
        year: parseInt(year),
        month: parseInt(month),
        status: statusFilter || undefined
      });
      setPayrolls(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Filter payroll records client-side by department and name
  const filteredPayrolls = payrolls.filter(p => {
    const matchesDept = !deptFilter || p.employee?.department === deptFilter;
    const matchesName = !nameFilter || (p.employee?.name || '').toLowerCase().includes(nameFilter.toLowerCase());
    return matchesDept && matchesName;
  });

  const handleCalculateClick = async () => {
    setLoading(true);
    try {
      const res = await settingService.getSettings();
      const sData = res.data;
      const initialSettings = { ...calcSettings };
      
      // Map loaded settings
      if (sData.insurance) {
        sData.insurance.forEach(s => {
          if (initialSettings[s.key] !== undefined) {
            initialSettings[s.key] = s.value;
          }
        });
      }
      if (sData.general) {
        sData.general.forEach(s => {
          if (initialSettings[s.key] !== undefined) {
            initialSettings[s.key] = s.value;
          }
        });
      }
      setCalcSettings(initialSettings);
      setIsCalcModalOpen(true);
    } catch (err) {
      console.error('Failed to load calculation settings:', err);
      alert('載入保險費率設定失敗，將使用預設費率');
      setIsCalcModalOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const [isCalculating, setIsCalculating] = useState(false);
  const [calcProgress, setCalcProgress] = useState(0);
  const [calcStatusText, setCalcStatusText] = useState('');

  const handleStartCalculation = async () => {
    setIsCalcModalOpen(false);
    setIsCalculating(true);
    setCalcProgress(0);
    setCalcStatusText('正在從系統同步出勤與請假紀錄...');

    let progressTimer = null;
    let currentProgress = 0;

    // Simulate progress smoothly
    const startProgressSimulation = () => {
      progressTimer = setInterval(() => {
        currentProgress += Math.random() * 8 + 3; // increment by 3% to 11%
        if (currentProgress >= 95) {
          currentProgress = 95; // cap it before API returns
          clearInterval(progressTimer);
        }
        
        // Update status text based on progress range
        if (currentProgress < 25) {
          setCalcStatusText('正在從系統同步出勤與請假紀錄...');
        } else if (currentProgress < 50) {
          setCalcStatusText('正在載入員工計薪排程設定...');
        } else if (currentProgress < 75) {
          setCalcStatusText('正在進行勞健退投保級距比對...');
        } else if (currentProgress < 90) {
          setCalcStatusText('正在計算加班費與各項請假扣除額...');
        } else {
          setCalcStatusText('正在寫入薪資明細草稿...');
        }
        
        setCalcProgress(Math.round(currentProgress));
      }, 300);
    };

    startProgressSimulation();

    try {
      await payrollService.calculatePayroll({
        year: parseInt(year),
        month: parseInt(month),
        resetSettings,
        settings: {
          labor_insurance_rate: calcSettings.labor_insurance_rate,
          labor_insurance_employee_share: calcSettings.labor_insurance_employee_share,
          labor_insurance_employer_share: calcSettings.labor_insurance_employer_share,
          health_insurance_rate: calcSettings.health_insurance_rate,
          health_insurance_employee_share: calcSettings.health_insurance_employee_share,
          health_insurance_employer_share: calcSettings.health_insurance_employer_share,
          health_insurance_avg_dependents: calcSettings.health_insurance_avg_dependents,
          labor_pension_employer_rate: calcSettings.labor_pension_employer_rate,
          minimum_wage_monthly: calcSettings.minimum_wage_monthly
        }
      });
      
      // Complete progress
      if (progressTimer) clearInterval(progressTimer);
      setCalcProgress(100);
      setCalcStatusText('薪資計算已完成！');
      
      // Delay closing modal slightly so they can see the success state
      setTimeout(() => {
        setIsCalculating(false);
        loadPayrollRecords();
      }, 800);
    } catch (err) {
      if (progressTimer) clearInterval(progressTimer);
      setIsCalculating(false);
      console.error(err);
      alert(err.message || '計算失敗');
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(filteredPayrolls.map(p => p.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (e, id) => {
    e.stopPropagation();
    if (e.target.checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(item => item !== id));
    }
  };

  const handleBatchLock = async () => {
    if (selectedIds.length === 0) {
      alert('請先勾選要鎖定的薪資明細');
      return;
    }
    const draftIds = filteredPayrolls.filter(p => selectedIds.includes(p.id) && p.status === 'DRAFT').map(p => p.id);
    if (draftIds.length === 0) {
      alert('選取的紀錄中無待鎖定的草稿薪資紀錄');
      return;
    }

    if (window.confirm(`確認要鎖定已勾選的 ${draftIds.length} 筆薪資明細嗎？`)) {
      try {
        await payrollService.batchLock(draftIds);
        alert('已選薪資紀錄已成功鎖定');
        setSelectedIds([]);
        loadPayrollRecords();
      } catch (err) {
        console.error(err);
        alert(err.message || '操作失敗');
      }
    }
  };

  const handleBatchApprove = async () => {
    if (selectedIds.length === 0) {
      alert('請先勾選要核准的薪資明細');
      return;
    }
    const lockIds = filteredPayrolls.filter(p => selectedIds.includes(p.id) && (p.status === 'LOCKED' || p.status === 'DRAFT')).map(p => p.id);
    if (lockIds.length === 0) {
      alert('選取的紀錄中無待核准的薪資紀錄');
      return;
    }

    if (window.confirm(`確認要核准已勾選的 ${lockIds.length} 筆薪資明細嗎？`)) {
      try {
        await payrollService.batchApprove(lockIds);
        alert('已選薪資紀錄已成功核准');
        setSelectedIds([]);
        loadPayrollRecords();
      } catch (err) {
        console.error(err);
        alert(err.message || '操作失敗');
      }
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) {
      alert('請先勾選要刪除的草稿明細');
      return;
    }
    const draftIds = filteredPayrolls.filter(p => selectedIds.includes(p.id) && p.status === 'DRAFT').map(p => p.id);
    if (draftIds.length === 0) {
      alert('選取的紀錄中沒有可刪除的草稿明細');
      return;
    }

    if (window.confirm(`確定要刪除已勾選的 ${draftIds.length} 筆草稿薪資紀錄嗎？此動作將無法復原！`)) {
      try {
        setLoading(true);
        const res = await payrollService.batchDelete(draftIds);
        alert(res.message || '已選草稿已成功刪除');
        setSelectedIds([]);
        loadPayrollRecords();
      } catch (err) {
        console.error(err);
        alert(err.message || '批次刪除失敗');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleBatchPDF = async () => {
    const ids = selectedIds.length > 0 ? selectedIds : filteredPayrolls.map(p => p.id);
    if (ids.length === 0) {
      alert('無可下載的薪資單');
      return;
    }
    
    try {
      const response = await fetch(`${BASE_URL}/payroll/batch-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ ids })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || '批次下載失敗');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payroll_slips_${year}_${month}_batch.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error(err);
      alert(err.message || '批次下載失敗');
    }
  };

  const handleRowClick = (row) => {
    navigate(`/payroll/${row.id}`, {
      state: {
        year,
        month,
        statusFilter,
        deptFilter,
        nameFilter
      }
    });
  };

  // Format currency helper
  const formatCurr = (v) => `${Math.round(v).toLocaleString('zh-TW')}`;

  const columns = [
    {
      title: (
        <input 
          type="checkbox" 
          checked={filteredPayrolls.length > 0 && selectedIds.length === filteredPayrolls.length}
          onChange={handleSelectAll}
          onClick={(e) => e.stopPropagation()}
          style={{ cursor: 'pointer' }}
        />
      ),
      key: 'select',
      align: 'center',
      render: (_, row) => (
        <input 
          type="checkbox" 
          checked={selectedIds.includes(row.id)}
          onChange={(e) => handleSelectRow(e, row.id)}
          onClick={(e) => e.stopPropagation()}
          style={{ cursor: 'pointer' }}
        />
      )
    },
    { title: '部門', key: 'department', render: (_, row) => row.employee?.department },
    { title: '姓名', key: 'name', bold: true, render: (_, row) => row.employee?.name },
    { title: '應發薪資', key: 'grossPay', align: 'right', render: (val) => formatCurr(val) },
    { title: '應扣項目', key: 'totalDeductions', align: 'right', render: (val) => <span style={{ color: 'var(--color-error)', fontWeight: '500' }}>{formatCurr(val)}</span> },
    { title: '實發淨額', key: 'netPay', align: 'right', bold: true, render: (val) => formatCurr(val) },
    { title: '狀態', key: 'status', render: (val) => <Badge status={val} /> },
    {
      title: '操作',
      key: 'actions',
      align: 'center',
      render: (_, row) => (
        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center' }}>
          <Button 
            variant="outline" 
            size="sm" 
            icon="visibility"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/payroll/${row.id}`, {
                state: {
                  year,
                  month,
                  statusFilter,
                  deptFilter,
                  nameFilter
                }
              });
            }}
            title="明細"
          />
          {row.status === 'DRAFT' && (
            <Button 
              variant="outline" 
              size="sm" 
              icon="delete"
              style={{ color: 'var(--color-error)', borderColor: 'var(--color-error)', backgroundColor: 'rgba(220, 38, 38, 0.05)' }}
              onClick={async (e) => {
                e.stopPropagation();
                if (window.confirm(`確定要刪除 ${row.employee?.name || ''} 該月的草稿薪資紀錄嗎？`)) {
                  try {
                    setLoading(true);
                    await payrollService.deletePayroll(row.id);
                    alert('薪資紀錄已刪除');
                    loadPayrollRecords();
                  } catch (err) {
                    console.error(err);
                    alert(err.message || '刪除失敗');
                  } finally {
                    setLoading(false);
                  }
                }
              }}
              title="刪除"
            />
          )}
        </div>
      )
    }
  ];

  // Calculate totals for summary bar
  const totalGross = filteredPayrolls.reduce((sum, p) => sum + p.grossPay, 0);
  const totalDeduction = filteredPayrolls.reduce((sum, p) => sum + p.totalDeductions, 0);
  const totalNet = filteredPayrolls.reduce((sum, p) => sum + p.netPay, 0);
  const totalEmployer = filteredPayrolls.reduce((sum, p) => sum + p.totalEmployerCost, 0);

  // Get unique departments present in the loaded payroll records
  const uniqueDepts = Array.from(new Set(payrolls.map(p => p.employee?.department).filter(Boolean))).sort();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Top Filter and Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          <Input 
            label="年份" 
            type="select"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            options={Array.from({ length: 5 }, (_, i) => {
              const y = (now.getFullYear() - 2 + i).toString();
              return { value: y, label: `${y} 年` };
            })}
            style={{ marginBottom: 0, width: '100px' }}
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
            style={{ marginBottom: 0, width: '85px' }}
          />
          <Input 
            label="發放狀態" 
            type="select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: '', label: '全部狀態' },
              { value: 'DRAFT', label: '草稿' },
              { value: 'LOCKED', label: '已鎖定' },
              { value: 'APPROVED', label: '已核准' }
            ]}
            style={{ marginBottom: 0, width: '110px' }}
          />
          <Input 
            label="部門" 
            type="select"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            options={[
              { value: '', label: '全部部門' },
              ...uniqueDepts.map(dept => ({ value: dept, label: dept }))
            ]}
            style={{ marginBottom: 0, width: '110px' }}
          />
          <Input 
            label="姓名" 
            placeholder="搜尋姓名..."
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            style={{ marginBottom: 0, width: '110px' }}
          />
        </div>
        
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          {selectedIds.length > 0 && (
            <span style={{ 
              fontSize: 'var(--text-xs)', 
              color: 'var(--color-primary-600)', 
              fontWeight: '600',
              backgroundColor: 'var(--color-primary-50)',
              padding: 'var(--space-1) var(--space-2)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-primary-200)'
            }}>
              已選擇 {selectedIds.length} 筆
            </span>
          )}
          <Button variant="outline" icon="calculate" onClick={handleCalculateClick} title="計算薪資" />
          {filteredPayrolls.some(p => p.status === 'DRAFT') && (
            <Button 
              variant="outline" 
              icon="delete" 
              style={{ color: 'var(--color-error)', borderColor: 'var(--color-error)', backgroundColor: 'rgba(220, 38, 38, 0.05)' }}
              onClick={handleBatchDelete}
              title={selectedIds.length > 0 ? `刪除已選草稿 (${selectedIds.length} 筆)` : "刪除本月草稿"}
            />
          )}
          <Button variant="outline" icon="upload" onClick={() => setIsImportModalOpen(true)} disabled={filteredPayrolls.length === 0} title="批量匯入" />
          <Button 
            variant="outline" 
            icon="lock" 
            onClick={handleBatchLock} 
            title={selectedIds.length > 0 ? `批次鎖定已選明細 (${selectedIds.length} 筆)` : "批次鎖定"} 
          />
          <Button 
            variant="outline" 
            icon="done_all" 
            onClick={handleBatchApprove} 
            title={selectedIds.length > 0 ? `批次核准已選明細 (${selectedIds.length} 筆)` : "批次核准"} 
          />
          <Button 
            variant="primary" 
            icon="download" 
            onClick={handleBatchPDF} 
            disabled={filteredPayrolls.length === 0} 
            title={selectedIds.length > 0 ? `批次下載已選薪資單 (${selectedIds.length} 筆)` : "批次下載薪資單"} 
          />
        </div>
      </div>

      {/* Summary card banner */}
      {filteredPayrolls.length > 0 && (
        <Card style={{ backgroundColor: 'var(--color-primary-50)', border: '1px solid var(--color-primary-200)' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 'var(--space-4)',
            textAlign: 'center'
          }}>
            <div>
              <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-primary-700)' }}>總應發金額 (Gross)</p>
              <h3 style={{ margin: 0, fontSize: 'var(--text-xl)', color: 'var(--color-primary-900)' }} className="font-mono">{formatCurr(totalGross)}</h3>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-primary-700)' }}>總扣除金額 (Deductions)</p>
              <h3 style={{ margin: 0, fontSize: 'var(--text-xl)', color: 'var(--color-primary-900)' }} className="font-mono">{formatCurr(totalDeduction)}</h3>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-primary-700)' }}>總實發淨額 (Net Pay)</p>
              <h3 style={{ margin: 0, fontSize: 'var(--text-xl)', color: 'var(--color-primary-900)' }} className="font-mono">{formatCurr(totalNet)}</h3>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-primary-700)' }}>總雇主額外負擔 (Employer Cost)</p>
              <h3 style={{ margin: 0, fontSize: 'var(--text-xl)', color: 'var(--color-primary-900)' }} className="font-mono">{formatCurr(totalEmployer)}</h3>
            </div>
          </div>
        </Card>
      )}

      {/* Table list */}
      <Card>
        <DataTable 
          columns={columns}
          data={filteredPayrolls}
          loading={loading}
          onRowClick={handleRowClick}
          emptyMessage="該月份尚未計算薪資。請點選上方「計算薪資」開始結算。"
        />
      </Card>

      {/* Calculation Settings Modal */}
      <Modal
        isOpen={isCalcModalOpen}
        onClose={() => setIsCalcModalOpen(false)}
        title={`${year} 年 ${month} 月 薪資計算參數確認`}
        footer={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="outline" onClick={() => setIsCalcModalOpen(false)}>取消</Button>
            <Button variant="primary" icon="play_arrow" onClick={handleStartCalculation}>確認開始計算</Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-neutral-600)' }}>
            提示：您可以在本次計算前調整勞健保費率與公提率。此處修改僅影響本月本次的計算，不會永久儲存至系統設定。
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', backgroundColor: 'var(--color-warning-50)', borderRadius: '4px', border: '1px solid var(--color-warning-200)' }}>
            <input 
              type="checkbox" 
              id="resetSettings" 
              checked={resetSettings} 
              onChange={e => setResetSettings(e.target.checked)} 
            />
            <label htmlFor="resetSettings" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-warning-900)', cursor: 'pointer' }}>
              <strong>重置並重新套用員工設定</strong> <br/>
              (注意：勾選此項將清除本月已存的薪資手動設定，強制用最新系統排班與時薪重新計算，建議修正時勾選)
            </label>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <Input
              label="勞保費率"
              type="number"
              step="0.001"
              value={calcSettings.labor_insurance_rate}
              onChange={e => setCalcSettings(prev => ({ ...prev, labor_insurance_rate: e.target.value }))}
            />
            <Input
              label="勞工自付比例"
              type="number"
              step="0.01"
              value={calcSettings.labor_insurance_employee_share}
              onChange={e => setCalcSettings(prev => ({ ...prev, labor_insurance_employee_share: e.target.value }))}
            />
            <Input
              label="雇主負擔比例"
              type="number"
              step="0.01"
              value={calcSettings.labor_insurance_employer_share}
              onChange={e => setCalcSettings(prev => ({ ...prev, labor_insurance_employer_share: e.target.value }))}
            />
            <Input
              label="健保費率"
              type="number"
              step="0.0001"
              value={calcSettings.health_insurance_rate}
              onChange={e => setCalcSettings(prev => ({ ...prev, health_insurance_rate: e.target.value }))}
            />
            <Input
              label="健保員工自付比例"
              type="number"
              step="0.01"
              value={calcSettings.health_insurance_employee_share}
              onChange={e => setCalcSettings(prev => ({ ...prev, health_insurance_employee_share: e.target.value }))}
            />
            <Input
              label="健保雇主負擔比例"
              type="number"
              step="0.01"
              value={calcSettings.health_insurance_employer_share}
              onChange={e => setCalcSettings(prev => ({ ...prev, health_insurance_employer_share: e.target.value }))}
            />
            <Input
              label="健保平均眷口數"
              type="number"
              step="0.01"
              value={calcSettings.health_insurance_avg_dependents}
              onChange={e => setCalcSettings(prev => ({ ...prev, health_insurance_avg_dependents: e.target.value }))}
            />
            <Input
              label="勞退雇主提繳比例"
              type="number"
              step="0.01"
              value={calcSettings.labor_pension_employer_rate}
              onChange={e => setCalcSettings(prev => ({ ...prev, labor_pension_employer_rate: e.target.value }))}
            />
            <Input
              label="每月基本工資 (元)"
              type="number"
              step="1"
              value={calcSettings.minimum_wage_monthly}
              onChange={e => setCalcSettings(prev => ({ ...prev, minimum_wage_monthly: e.target.value }))}
            />
          </div>
        </div>
      </Modal>

      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        year={year}
        month={month}
        payrolls={payrolls}
        onImportSuccess={loadPayrollRecords}
      />

      {/* Calculation Progress Modal */}
      {isCalculating && (
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
          <div className="animate-scale-in" style={{
            backgroundColor: 'var(--color-neutral-0)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-xl)',
            width: '100%',
            maxWidth: '500px',
            padding: 'var(--space-6)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 'var(--space-4)'
          }}>
            {/* Header / Icon */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              width: '64px',
              height: '64px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: calcProgress === 100 ? 'var(--color-success-light)' : 'var(--color-primary-50)',
              color: calcProgress === 100 ? 'var(--color-success)' : 'var(--color-primary-500)',
              transition: 'all 0.3s ease'
            }}>
              <span className="material-symbols-outlined icon-lg" style={{ fontSize: '36px' }}>
                {calcProgress === 100 ? 'check_circle' : 'sync'}
              </span>
            </div>

            {/* Title & Info */}
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ margin: '0 0 var(--space-1) 0', fontSize: 'var(--text-lg)' }}>
                {calcProgress === 100 ? '計算完成' : `正在結算 ${year} 年 ${month} 月薪資...`}
              </h3>
              <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-neutral-500)' }}>
                本作業同步出勤紀錄、核對假單與投保級距，約需耗時數秒
              </p>
            </div>

            {/* Progress Bar Container */}
            <div style={{
              width: '100%',
              height: '8px',
              backgroundColor: 'var(--color-neutral-100)',
              borderRadius: 'var(--radius-full)',
              overflow: 'hidden',
              marginTop: 'var(--space-2)'
            }}>
              <div style={{
                width: `${calcProgress}%`,
                height: '100%',
                backgroundColor: calcProgress === 100 ? 'var(--color-success)' : 'var(--color-primary-500)',
                borderRadius: 'var(--radius-full)',
                transition: 'width 0.3s ease-out, background-color 0.3s ease'
              }} />
            </div>

            {/* Progress Status and Percentage */}
            <div style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 'var(--text-xs)',
              color: 'var(--color-neutral-600)'
            }}>
              <span>{calcStatusText}</span>
              <span className="font-mono" style={{ fontWeight: '600' }}>{calcProgress}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

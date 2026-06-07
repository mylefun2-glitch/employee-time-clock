import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import payrollService from '../../services/payrollService';
import settingService from '../../services/settingService';
import ImportModal from './ImportModal';
import { Button, Card, DataTable, Input, LoadingSpinner, Badge, Modal } from '../../components/common';
import { BASE_URL } from '../../services/api';

export default function PayrollList() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear().toString());
  const [month, setMonth] = useState((now.getMonth() + 1).toString());
  const [payrolls, setPayrolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [isCalcModalOpen, setIsCalcModalOpen] = useState(false);
  const [calcSettings, setCalcSettings] = useState({
    labor_insurance_rate: '0.12',
    labor_insurance_employee_share: '0.20',
    labor_insurance_employer_share: '0.70',
    health_insurance_rate: '0.0517',
    health_insurance_employee_share: '0.30',
    health_insurance_employer_share: '0.60',
    health_insurance_avg_dependents: '0.61',
    labor_pension_employer_rate: '0.06'
  });
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadPayrollRecords();
  }, [year, month, statusFilter]);

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

  const handleStartCalculation = async () => {
    setIsCalcModalOpen(false);
    setLoading(true);
    try {
      await payrollService.calculatePayroll({
        year: parseInt(year),
        month: parseInt(month),
        settings: {
          labor_insurance_rate: calcSettings.labor_insurance_rate,
          labor_insurance_employee_share: calcSettings.labor_insurance_employee_share,
          labor_insurance_employer_share: calcSettings.labor_insurance_employer_share,
          health_insurance_rate: calcSettings.health_insurance_rate,
          health_insurance_employee_share: calcSettings.health_insurance_employee_share,
          health_insurance_employer_share: calcSettings.health_insurance_employer_share,
          health_insurance_avg_dependents: calcSettings.health_insurance_avg_dependents,
          labor_pension_employer_rate: calcSettings.labor_pension_employer_rate
        }
      });
      alert('薪資計算已完成');
      loadPayrollRecords();
    } catch (err) {
      console.error(err);
      alert(err.message || '計算失敗');
      setLoading(false);
    }
  };

  const handleBatchLock = async () => {
    const draftIds = payrolls.filter(p => p.status === 'DRAFT').map(p => p.id);
    if (draftIds.length === 0) {
      alert('無待鎖定的草稿薪資紀錄');
      return;
    }

    if (window.confirm(`確認要批次鎖定 ${draftIds.length} 筆薪資明細嗎？`)) {
      try {
        await payrollService.batchLock(draftIds);
        alert('薪資紀錄已批次鎖定');
        loadPayrollRecords();
      } catch (err) {
        console.error(err);
        alert(err.message || '操作失敗');
      }
    }
  };

  const handleBatchApprove = async () => {
    const lockIds = payrolls.filter(p => p.status === 'LOCKED' || p.status === 'DRAFT').map(p => p.id);
    if (lockIds.length === 0) {
      alert('無待核准的薪資紀錄');
      return;
    }

    if (window.confirm(`確認要批次核准 ${lockIds.length} 筆薪資明細嗎？`)) {
      try {
        await payrollService.batchApprove(lockIds);
        alert('薪資紀錄已批次核准');
        loadPayrollRecords();
      } catch (err) {
        console.error(err);
        alert(err.message || '操作失敗');
      }
    }
  };

  const handleBatchDelete = async () => {
    const draftIds = payrolls.filter(p => p.status === 'DRAFT').map(p => p.id);
    if (draftIds.length === 0) {
      alert('無待刪除的草稿薪資紀錄');
      return;
    }

    if (window.confirm(`確定要刪除該月份 ${draftIds.length} 筆所有草稿薪資紀錄嗎？此動作將無法復原！`)) {
      try {
        setLoading(true);
        const res = await payrollService.batchDelete(draftIds);
        alert(res.message || '草稿已成功刪除');
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
    if (payrolls.length === 0) {
      alert('無可下載的薪資單');
      return;
    }
    
    try {
      const ids = payrolls.map(p => p.id);
      // Generate batch PDF call
      const response = await fetch(`${BASE_URL}/payroll/batch-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ ids })
      });

      if (!response.ok) throw new Error('批次下載失敗');
      
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
    navigate(`/payroll/${row.id}`);
  };

  // Format currency helper
  const formatCurr = (v) => `${Math.round(v).toLocaleString('zh-TW')}`;

  const columns = [
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
              navigate(`/payroll/${row.id}`);
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
  const totalGross = payrolls.reduce((sum, p) => sum + p.grossPay, 0);
  const totalDeduction = payrolls.reduce((sum, p) => sum + p.totalDeductions, 0);
  const totalNet = payrolls.reduce((sum, p) => sum + p.netPay, 0);
  const totalEmployer = payrolls.reduce((sum, p) => sum + p.totalEmployerCost, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Top Filter and Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
            style={{ marginBottom: 0, width: '130px' }}
          />
        </div>
        
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <Button variant="outline" icon="calculate" onClick={handleCalculateClick} title="計算薪資" />
          {payrolls.some(p => p.status === 'DRAFT') && (
            <Button 
              variant="outline" 
              icon="delete" 
              style={{ color: 'var(--color-error)', borderColor: 'var(--color-error)', backgroundColor: 'rgba(220, 38, 38, 0.05)' }}
              onClick={handleBatchDelete}
              title="刪除本月草稿"
            />
          )}
          <Button variant="outline" icon="upload" onClick={() => setIsImportModalOpen(true)} disabled={payrolls.length === 0} title="批量匯入" />
          <Button variant="outline" icon="lock" onClick={handleBatchLock} title="批次鎖定" />
          <Button variant="outline" icon="done_all" onClick={handleBatchApprove} title="批次核准" />
          <Button variant="primary" icon="download" onClick={handleBatchPDF} disabled={payrolls.length === 0} title="批次下載薪資單" />
        </div>
      </div>

      {/* Summary card banner */}
      {payrolls.length > 0 && (
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
          data={payrolls}
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
    </div>
  );
}

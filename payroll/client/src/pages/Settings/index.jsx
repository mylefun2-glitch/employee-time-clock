import React, { useState, useEffect } from 'react';
import settingService from '../../services/settingService';
import { Button, Card, Input, LoadingSpinner } from '../../components/common';

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Local form state for key-value inputs
  const [formValues, setFormValues] = useState({});
  const [leaveRules, setLeaveRules] = useState([]);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await settingService.getSettings();
      setSettings(res.data);
      
      // Initialize form values
      const initialValues = {};
      Object.keys(res.data).forEach(cat => {
        res.data[cat].forEach(s => {
          if (cat !== 'grade_table' && s.key !== 'leave_deduction_rules') {
            initialValues[s.key] = s.value;
          }
        });
      });
      setFormValues(initialValues);

      // Initialize leave rules
      const leaveRulesSetting = res.data.leave_rules?.find(s => s.key === 'leave_deduction_rules');
      if (leaveRulesSetting) {
        try {
          setLeaveRules(JSON.parse(leaveRulesSetting.value));
        } catch (e) {
          console.error('Failed to parse leave rules:', e);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddLeaveRule = () => {
    setLeaveRules(prev => [
      ...prev,
      { leaveType: '', label: '', deductionType: 'full', rate: 1.0 }
    ]);
  };

  const handleRemoveLeaveRule = (index) => {
    setLeaveRules(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateLeaveRule = (index, field, value, rateOverride) => {
    setLeaveRules(prev => prev.map((rule, i) => {
      if (i === index) {
        const updated = { ...rule, [field]: value };
        if (rateOverride !== undefined) {
          updated.rate = rateOverride;
        }
        return updated;
      }
      return rule;
    }));
  };

  const handleSaveLeaveRules = async () => {
    setSaving(true);
    try {
      const invalid = leaveRules.some(r => !r.leaveType.trim() || !r.label.trim());
      if (invalid) {
        alert('請填寫所有規則的假別關鍵字與顯示名稱！');
        setSaving(false);
        return;
      }
      await settingService.updateSettings({
        leave_deduction_rules: JSON.stringify(leaveRules)
      });
      alert('請假扣薪設定更新成功！');
      loadSettings();
    } catch (err) {
      console.error(err);
      alert(err.message || '更新失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (key, val) => {
    setFormValues(prev => ({
      ...prev,
      [key]: val
    }));
  };

  const handleSaveCategory = async (categoryKeys) => {
    setSaving(true);
    try {
      const dataToSave = {};
      categoryKeys.forEach(k => {
        dataToSave[k] = formValues[k];
      });

      await settingService.updateSettings(dataToSave);
      alert('設定更新成功！');
      loadSettings();
    } catch (err) {
      console.error(err);
      alert(err.message || '更新失敗');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner fullPage size="lg" />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* 1. General Org settings */}
      <Card title="組織基本設定" footer={
        <Button variant="primary" loading={saving} onClick={() => handleSaveCategory([
          'org_name', 'org_tax_id', 'org_phone', 'org_address',
          'work_days_per_month', 'work_hours_per_day', 'minimum_wage_monthly', 'minimum_wage_hourly'
        ])}>
          儲存組織設定
        </Button>
      }>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
          <Input
            label="組織名稱"
            value={formValues.org_name || ''}
            onChange={e => handleChange('org_name', e.target.value)}
          />
          <Input
            label="統一編號"
            value={formValues.org_tax_id || ''}
            onChange={e => handleChange('org_tax_id', e.target.value)}
          />
          <Input
            label="聯絡電話"
            value={formValues.org_phone || ''}
            onChange={e => handleChange('org_phone', e.target.value)}
          />
          <Input
            label="地址"
            value={formValues.org_address || ''}
            onChange={e => handleChange('org_address', e.target.value)}
          />
          <Input
            label="每月工作天數預設"
            type="number"
            value={formValues.work_days_per_month || ''}
            onChange={e => handleChange('work_days_per_month', e.target.value)}
          />
          <Input
            label="每日工作工時預設"
            type="number"
            value={formValues.work_hours_per_day || ''}
            onChange={e => handleChange('work_hours_per_day', e.target.value)}
          />
          <Input
            label="法定每月基本工資 (NT$)"
            type="number"
            value={formValues.minimum_wage_monthly || ''}
            onChange={e => handleChange('minimum_wage_monthly', e.target.value)}
          />
          <Input
            label="法定每小時基本工資 (NT$)"
            type="number"
            value={formValues.minimum_wage_hourly || ''}
            onChange={e => handleChange('minimum_wage_hourly', e.target.value)}
          />
        </div>
      </Card>

      {/* 2. Insurance settings */}
      <Card title="勞健保與退職金提繳費率設定" footer={
        <Button variant="primary" loading={saving} onClick={() => handleSaveCategory([
          'labor_insurance_rate', 'labor_insurance_employee_share', 'labor_insurance_employer_share',
          'health_insurance_rate', 'health_insurance_employee_share', 'health_insurance_employer_share',
          'health_insurance_avg_dependents', 'labor_pension_employer_rate'
        ])}>
          儲存保險費率
        </Button>
      }>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
          <Input
            label="勞工保險總費率"
            type="number"
            step="0.001"
            value={formValues.labor_insurance_rate || ''}
            onChange={e => handleChange('labor_insurance_rate', e.target.value)}
          />
          <Input
            label="勞保費員工自付比例"
            type="number"
            step="0.01"
            value={formValues.labor_insurance_employee_share || ''}
            onChange={e => handleChange('labor_insurance_employee_share', e.target.value)}
          />
          <Input
            label="勞保費雇主負擔比例"
            type="number"
            step="0.01"
            value={formValues.labor_insurance_employer_share || ''}
            onChange={e => handleChange('labor_insurance_employer_share', e.target.value)}
          />
          <Input
            label="全民健康保險總費率"
            type="number"
            step="0.0001"
            value={formValues.health_insurance_rate || ''}
            onChange={e => handleChange('health_insurance_rate', e.target.value)}
          />
          <Input
            label="健保費員工自付比例"
            type="number"
            step="0.01"
            value={formValues.health_insurance_employee_share || ''}
            onChange={e => handleChange('health_insurance_employee_share', e.target.value)}
          />
          <Input
            label="健保費雇主負擔比例"
            type="number"
            step="0.01"
            value={formValues.health_insurance_employer_share || ''}
            onChange={e => handleChange('health_insurance_employer_share', e.target.value)}
          />
          <Input
            label="健保雇主負擔平均眷口數"
            type="number"
            step="0.01"
            value={formValues.health_insurance_avg_dependents || ''}
            onChange={e => handleChange('health_insurance_avg_dependents', e.target.value)}
          />
          <Input
            label="勞工退休金雇主強制提繳比例"
            type="number"
            step="0.01"
            value={formValues.labor_pension_employer_rate || ''}
            onChange={e => handleChange('labor_pension_employer_rate', e.target.value)}
          />
        </div>
      </Card>

      {/* 3. Tax settings */}
      <Card title="所得稅與免稅限額設定" footer={
        <Button variant="primary" loading={saving} onClick={() => handleSaveCategory(['tax_free_meal_allowance'])}>
          儲存稅務設定
        </Button>
      }>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
          <Input
            label="每月伙食津貼免稅額上限 (NT$)"
            type="number"
            value={formValues.tax_free_meal_allowance || ''}
            onChange={e => handleChange('tax_free_meal_allowance', e.target.value)}
          />
        </div>
      </Card>

      {/* 4. Leave Deduction settings */}
      <Card title="請假扣薪與假別規則設定" footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <Button variant="outline" onClick={handleAddLeaveRule}>新增假別規則</Button>
          <Button variant="primary" loading={saving} onClick={handleSaveLeaveRules}>儲存規則設定</Button>
        </div>
      }>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {leaveRules.map((rule, idx) => (
            <div key={idx} style={{ 
              display: 'flex', 
              alignItems: 'flex-end', 
              gap: 'var(--space-3)', 
              paddingBottom: 'var(--space-3)',
              borderBottom: '1px solid var(--color-neutral-100)'
            }}>
              <div style={{ flex: 2 }}>
                <Input
                  label={idx === 0 ? "假別關鍵字 (例如：生理)" : ""}
                  value={rule.leaveType}
                  placeholder="假別關鍵字"
                  onChange={e => handleUpdateLeaveRule(idx, 'leaveType', e.target.value)}
                  style={{ marginBottom: 0 }}
                />
              </div>
              <div style={{ flex: 2 }}>
                <Input
                  label={idx === 0 ? "顯示名稱" : ""}
                  value={rule.label}
                  placeholder="顯示名稱"
                  onChange={e => handleUpdateLeaveRule(idx, 'label', e.target.value)}
                  style={{ marginBottom: 0 }}
                />
              </div>
              <div style={{ flex: 2 }}>
                <Input
                  label={idx === 0 ? "扣薪類型" : ""}
                  type="select"
                  value={rule.deductionType}
                  options={[
                    { value: 'none', label: '不扣薪 (Paid)' },
                    { value: 'half', label: '扣半薪 (Half unpaid)' },
                    { value: 'full', label: '扣全薪 (Unpaid)' },
                    { value: 'custom', label: '自訂比例 (Custom)' }
                  ]}
                  onChange={e => {
                    const type = e.target.value;
                    let rate = 1.0;
                    if (type === 'none') rate = 0.0;
                    else if (type === 'half') rate = 0.5;
                    else if (type === 'full') rate = 1.0;
                    handleUpdateLeaveRule(idx, 'deductionType', type, rate);
                  }}
                  style={{ marginBottom: 0 }}
                />
              </div>
              <div style={{ flex: 1, minWidth: '80px' }}>
                <Input
                  label={idx === 0 ? "扣薪比例" : ""}
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={rule.rate}
                  disabled={rule.deductionType !== 'custom'}
                  onChange={e => handleUpdateLeaveRule(idx, 'rate', parseFloat(e.target.value) || 0)}
                  style={{ marginBottom: 0 }}
                />
              </div>
              <div style={{ paddingBottom: '2px' }}>
                <Button 
                  variant="outline" 
                  style={{ 
                    color: 'var(--color-error)', 
                    borderColor: 'var(--color-error)',
                    padding: '8px 12px'
                  }}
                  onClick={() => handleRemoveLeaveRule(idx)}
                >
                  刪除
                </Button>
              </div>
            </div>
          ))}
          {leaveRules.length === 0 && (
            <p style={{ color: 'var(--color-neutral-500)', fontSize: 'var(--text-sm)', textAlign: 'center', margin: 'var(--space-4) 0' }}>
              尚無自訂假別規則，未設定假別預設會以「扣全薪」計算。
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}

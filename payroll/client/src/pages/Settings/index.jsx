import React, { useState, useEffect } from 'react';
import settingService from '../../services/settingService';
import { Button, Card, Input, LoadingSpinner } from '../../components/common';

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Local form state for key-value inputs
  const [formValues, setFormValues] = useState({});

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
          if (cat !== 'grade_table') {
            initialValues[s.key] = s.value;
          }
        });
      });
      setFormValues(initialValues);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
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
    </div>
  );
}

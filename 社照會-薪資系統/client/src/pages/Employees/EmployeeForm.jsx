import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import employeeService from '../../services/employeeService';
import { Button, Input, Card, LoadingSpinner } from '../../components/common';

export default function EmployeeForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    employeeNo: '',
    name: '',
    idNumber: '',
    gender: 'M',
    birthDate: '',
    phone: '',
    address: '',
    email: '',
    department: '照護部',
    position: '',
    hireDate: new Date().toISOString().split('T')[0],
    salaryType: 'monthly',
    baseSalary: '',
    mealAllowance: '2400', // default meal allowance in settings
    transportAllowance: '1000',
    otherAllowance: '0',
    laborInsuranceGrade: '',
    healthInsuranceGrade: '',
    laborPensionGrade: '',
    voluntaryPensionRate: '0',
    dependents: '0',
    bankName: '',
    bankAccount: '',
    notes: '',
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isEdit) {
      loadEmployee();
    }
  }, [id]);

  const loadEmployee = async () => {
    setLoading(true);
    try {
      const res = await employeeService.getEmployee(id);
      const data = res.data;
      
      // format dates
      const formatted = {
        ...data,
        baseSalary: data.baseSalary.toString(),
        mealAllowance: data.mealAllowance.toString(),
        transportAllowance: data.transportAllowance.toString(),
        otherAllowance: data.otherAllowance.toString(),
        laborInsuranceGrade: data.laborInsuranceGrade.toString(),
        healthInsuranceGrade: data.healthInsuranceGrade.toString(),
        laborPensionGrade: data.laborPensionGrade.toString(),
        voluntaryPensionRate: data.voluntaryPensionRate.toString(),
        dependents: data.dependents.toString(),
      };
      setFormData(formatted);
    } catch (err) {
      console.error('Failed to load employee:', err);
      alert('載入員工資料失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, val) => {
    setFormData(prev => ({
      ...prev,
      [field]: val
    }));
    
    // Clear error
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Autocomplete grades based on baseSalary + allowances for convenience
  const handleBaseSalaryBlur = () => {
    const base = parseFloat(formData.baseSalary) || 0;
    const meal = parseFloat(formData.mealAllowance) || 0;
    const trans = parseFloat(formData.transportAllowance) || 0;
    const other = parseFloat(formData.otherAllowance) || 0;
    const total = base + meal + trans + other;

    if (total > 0 && (!formData.laborInsuranceGrade || !formData.healthInsuranceGrade || !formData.laborPensionGrade)) {
      setFormData(prev => ({
        ...prev,
        laborInsuranceGrade: prev.laborInsuranceGrade || total.toString(),
        healthInsuranceGrade: prev.healthInsuranceGrade || total.toString(),
        laborPensionGrade: prev.laborPensionGrade || total.toString(),
      }));
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.employeeNo) newErrors.employeeNo = '工號為必填項';
    if (!formData.name) newErrors.name = '姓名為必填項';
    if (!formData.department) newErrors.department = '部門為必填項';
    if (!formData.hireDate) newErrors.hireDate = '到職日為必填項';
    if (!formData.baseSalary || isNaN(formData.baseSalary) || parseFloat(formData.baseSalary) < 0) {
      newErrors.baseSalary = '請輸入大於或等於 0 的薪資額';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      if (isEdit) {
        await employeeService.updateEmployee(id, formData);
        alert('員工資料更新成功');
        navigate(`/employees/${id}`);
      } else {
        const res = await employeeService.createEmployee(formData);
        alert('員工建立成功');
        navigate(`/employees/${res.data.id}`);
      }
    } catch (err) {
      console.error(err);
      alert(err.message || '儲存失敗');
    } finally {
      setLoading(false);
    }
  };

  if (loading && isEdit) return <LoadingSpinner fullPage size="lg" />;

  return (
    <Card style={{ padding: 'var(--space-10)', textAlign: 'center', margin: 'var(--space-6) auto', maxWidth: '600px' }}>
      <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--color-warning)', marginBottom: 'var(--space-2)' }}>
        warning
      </span>
      <h3>無法新增或修改員工檔案</h3>
      <p style={{ margin: 'var(--space-3) 0 var(--space-6) 0', color: 'var(--color-neutral-600)' }}>
        員工基本資料由外部系統負責，此薪資系統僅供統計與計算。請由外部系統修改後自動同步。
      </p>
      <Button variant="primary" onClick={() => navigate('/employees')}>
        返回員工名冊
      </Button>
    </Card>
  );
}

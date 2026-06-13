import React, { useState, useEffect } from 'react';
import leaveService from '../../services/leaveService';
import employeeService from '../../services/employeeService';
import { Button, Card, DataTable, Input, Modal, LoadingSpinner, Badge } from '../../components/common';

export default function Leaves() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear().toString());
  const [month, setMonth] = useState((now.getMonth() + 1).toString());
  const [leaves, setLeaves] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending'); // pending, approved, rejected, '' (all)
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Leave form state
  const [form, setForm] = useState({
    employeeId: '',
    leaveType: 'annual',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    days: '1',
    reason: '',
  });

  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    loadLeaves();
  }, [statusFilter, year, month]);

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      const res = await employeeService.getEmployees({ pageSize: 100 });
      setEmployees(res.data || []);
      if (res.data && res.data.length > 0) {
        setForm(prev => ({ ...prev, employeeId: res.data[0].id.toString() }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadLeaves = async () => {
    setLoading(true);
    try {
      const monthStr = String(month).padStart(2, '0');
      // Calculate exact last day of the month
      const nextMonth = parseInt(month) === 12 ? 1 : parseInt(month) + 1;
      const nextYear = parseInt(month) === 12 ? parseInt(year) + 1 : parseInt(year);
      const lastDay = new Date(nextYear, nextMonth - 1, 0).getDate();
      
      const startDate = `${year}-${monthStr}-01`;
      const endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

      const res = await leaveService.getLeaves({ 
        status: statusFilter || undefined,
        startDate,
        endDate
      });
      setLeaves(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      await leaveService.createLeave({
        ...form,
        employeeId: parseInt(form.employeeId),
        days: parseFloat(form.days)
      });
      alert('請假申請提交成功');
      setIsModalOpen(false);
      loadLeaves();
    } catch (err) {
      console.error(err);
      alert(err.message || '提交失敗');
    } finally {
      setFormLoading(false);
    }
  };

  const handleApprove = async (id) => {
    if (window.confirm('確定要核准該筆請假申請嗎？')) {
      try {
        await leaveService.approveLeave(id);
        alert('請假申請已核准');
        loadLeaves();
      } catch (err) {
        console.error(err);
        alert(err.message || '核准失敗');
      }
    }
  };

  const handleReject = async (id) => {
    const reason = window.prompt('請輸入駁回原因：');
    if (reason === null) return; // cancelled
    
    try {
      await leaveService.rejectLeave(id, reason);
      alert('請假申請已駁回');
      loadLeaves();
    } catch (err) {
      console.error(err);
      alert(err.message || '駁回失敗');
    }
  };

  const columns = [
    { title: '部門', key: 'employee.department', bold: true, render: (_, row) => row.employee?.department },
    { title: '姓名', key: 'employee.name', bold: true, render: (_, row) => row.employee?.name },
    { 
      title: '假別', 
      key: 'leaveType',
      render: (val) => val
    },
    { title: '天數', key: 'days', render: (val) => `${val} 天` },
    { 
      title: '狀態', 
      key: 'status',
      render: (val) => <Badge status={val === 'approved' ? 'APPROVED' : val === 'rejected' ? 'REJECTED' : 'PENDING'} />
    },
    {
      title: '審核資訊',
      key: 'actions',
      align: 'center',
      render: (_, row) => {
        if (row.status === 'approved') {
          return (
            <span style={{ color: 'var(--color-success)', fontSize: 'var(--text-xs)', fontWeight: '500' }}>
              核准人: {row.approvedBy || '系統'}
            </span>
          );
        } else if (row.status === 'rejected') {
          return (
            <span style={{ color: 'var(--color-error)', fontSize: 'var(--text-xs)', fontWeight: '500' }}>
              已駁回 {row.notes ? `(${row.notes})` : ''}
            </span>
          );
        } else {
          return (
            <span style={{ color: 'var(--color-warning)', fontSize: 'var(--text-xs)', fontWeight: '500' }}>
              待外部審核
            </span>
          );
        }
      }
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Top Action Panel */}
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
          <Input 
            label="審核狀態" 
            type="select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: 'pending', label: '待審核 (Pending)' },
              { value: 'approved', label: '已核准 (Approved)' },
              { value: 'rejected', label: '已駁回 (Rejected)' },
              { value: '', label: '全部假單' }
            ]}
            style={{ marginBottom: 0, width: '180px' }}
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
          <span>請假申請由外部系統管理與審核，此處僅供檢視。</span>
        </div>
      </div>

      {/* Leave List */}
      <Card>
        <DataTable 
          columns={columns}
          data={leaves}
          loading={loading}
          emptyMessage="查無符合條件的請假單"
        />
      </Card>
    </div>
  );
}

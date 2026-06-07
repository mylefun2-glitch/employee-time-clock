import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import employeeService from '../../services/employeeService';
import { Button, Input, DataTable, Pagination, Card, LoadingSpinner, Badge } from '../../components/common';

export default function EmployeesList() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [isActive, setIsActive] = useState('true');
  const [departments, setDepartments] = useState([]);
  const [sortBy, setSortBy] = useState('department');
  const [sortOrder, setSortOrder] = useState('asc');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    loadDepartments();
  }, []);

  useEffect(() => {
    loadEmployees();
  }, [search, department, isActive, page, sortBy, sortOrder]);

  const loadDepartments = async () => {
    try {
      const res = await employeeService.getDepartments();
      setDepartments(res || []);
    } catch (err) {
      console.error('Failed to load departments:', err);
    }
  };

  const loadEmployees = async () => {
    setLoading(true);
    try {
      const res = await employeeService.getEmployees({
        page,
        pageSize,
        search,
        department,
        isActive,
        sortBy,
        sortOrder
      });
      setEmployees(res.data || []);
      setTotal(res.pagination?.total || 0);
    } catch (err) {
      console.error('Failed to load employees:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (row) => {
    navigate(`/employees/${row.id}`);
  };

  const handleSort = (key) => {
    if (sortBy === key) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const columns = [
    { title: '部門', key: 'department', bold: true },
    { title: '姓名', key: 'name', bold: true },
    { title: '職稱', key: 'position' },
    { 
      title: '薪資類型', 
      key: 'salaryType',
      render: (val) => val === 'monthly' ? '月薪制' : '時薪制'
    },
    { 
      title: '薪資/時薪', 
      key: 'baseSalary',
      align: 'right',
      render: (val, row) => {
        const amt = val || 0;
        return row.salaryType === 'monthly' 
          ? `NT$ ${Math.round(amt).toLocaleString('zh-TW')}`
          : `NT$ ${Math.round(amt)} /小時`;
      }
    },
    { 
      title: '狀態', 
      key: 'isActive',
      render: (val) => val ? <Badge status="PRESENT" text="在職" /> : <Badge status="REJECTED" text="離職" />
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Top action block */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>員工名冊管理</h3>
        
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
          <span>員工基本資料由外部系統管理，此處僅供檢視。</span>
        </div>
      </div>

      {/* Filter panel */}
      <Card>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr',
          gap: 'var(--space-4)',
          alignItems: 'end'
        }}>
          <Input 
            label="搜尋員工" 
            placeholder="請輸入姓名、Email或電話搜尋..." 
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <Input 
            label="部門篩選" 
            type="select"
            value={department}
            onChange={(e) => {
              setDepartment(e.target.value);
              setPage(1);
            }}
            options={[
              { value: '', label: '全部部門' },
              ...departments.map(d => ({ value: d, label: d }))
            ]}
          />
          <Input 
            label="在職狀態" 
            type="select"
            value={isActive}
            onChange={(e) => {
              setIsActive(e.target.value);
              setPage(1);
            }}
            options={[
              { value: 'true', label: '在職' },
              { value: 'false', label: '已離職' },
              { value: '', label: '全部狀態' }
            ]}
          />
        </div>
      </Card>

      {/* Table & Pagination */}
      <Card>
        <DataTable 
          columns={columns}
          data={employees}
          loading={loading}
          onRowClick={handleRowClick}
          onSort={handleSort}
          currentSortField={sortBy}
          currentSortDirection={sortOrder}
          emptyMessage="查無符合條件的員工"
        />
        <Pagination 
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
        />
      </Card>
    </div>
  );
}

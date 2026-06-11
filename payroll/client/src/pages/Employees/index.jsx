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

  const [syncing, setSyncing] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStatusText, setSyncStatusText] = useState('');

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

  const handleSyncEmployees = async () => {
    setSyncing(true);
    setShowSyncModal(true);
    setSyncProgress(0);
    setSyncStatusText('準備開始同步員工資料...');

    let progressTimer = null;
    let currentProgress = 0;

    const startProgressSimulation = () => {
      progressTimer = setInterval(() => {
        currentProgress += Math.random() * 8 + 3; // increment by 3% to 11%
        if (currentProgress >= 95) {
          currentProgress = 95; // cap it before API returns
          clearInterval(progressTimer);
        }

        // Update status text based on progress range
        if (currentProgress < 25) {
          setSyncStatusText('正在連結 Supabase 雲端資料庫...');
        } else if (currentProgress < 50) {
          setSyncStatusText('正在比對欄位與級距資料...');
        } else if (currentProgress < 75) {
          setSyncStatusText('正在寫入本地 SQLite 緩存與建置索引...');
        } else if (currentProgress < 90) {
          setSyncStatusText('正在完成最後同步確認...');
        }

        setSyncProgress(Math.round(currentProgress));
      }, 200);
    };

    startProgressSimulation();

    try {
      const res = await employeeService.syncEmployees();
      
      // Complete progress
      if (progressTimer) clearInterval(progressTimer);
      setSyncProgress(100);
      setSyncStatusText(res.message || `成功同步 ${res.count || 0} 筆員工資料！`);
      
      // Reload list and departments
      await loadEmployees();
      await loadDepartments();

      // Close modal after a short delay
      setTimeout(() => {
        setShowSyncModal(false);
        setSyncing(false);
      }, 1500);

    } catch (err) {
      if (progressTimer) clearInterval(progressTimer);
      console.error('Failed to sync employees:', err);
      alert(`同步員工資料失敗: ${err.message || err}`);
      setShowSyncModal(false);
      setSyncing(false);
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
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 'var(--space-2)'
      }}>
        <h3 style={{ margin: 0 }}>員工名冊管理</h3>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <Button
            variant="outline"
            icon="sync"
            onClick={handleSyncEmployees}
            disabled={syncing}
          >
            同步員工資料
          </Button>

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

      {/* Sync Progress Modal */}
      {showSyncModal && (
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
              backgroundColor: syncProgress === 100 ? 'var(--color-success-light)' : 'var(--color-primary-50)',
              color: syncProgress === 100 ? 'var(--color-success)' : 'var(--color-primary-500)',
              transition: 'all 0.3s ease'
            }}>
              <span className="material-symbols-outlined icon-lg" style={{ fontSize: '36px' }}>
                {syncProgress === 100 ? 'check_circle' : 'sync'}
              </span>
            </div>

            {/* Title & Info */}
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ margin: '0 0 var(--space-1) 0', fontSize: 'var(--text-lg)' }}>
                {syncProgress === 100 ? '同步完成' : '正在同步員工資料...'}
              </h3>
              <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-neutral-500)' }}>
                同步外部系統的員工名單與保險級距，預計需要數秒時間。
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
                width: `${syncProgress}%`,
                height: '100%',
                backgroundColor: syncProgress === 100 ? 'var(--color-success)' : 'var(--color-primary-500)',
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
              <span>{syncStatusText}</span>
              <span className="font-mono" style={{ fontWeight: '600' }}>{syncProgress}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

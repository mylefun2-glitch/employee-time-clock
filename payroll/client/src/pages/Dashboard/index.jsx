import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import reportService from '../../services/reportService';
import { SummaryCard, Card, LoadingSpinner, Button } from '../../components/common';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#00366b', '#2a5cc8', '#7199e6', '#c5d9f9', '#9aa1ad'];

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    async function loadStats() {
      try {
        const data = await reportService.getDashboardStats();
        setStats(data);
      } catch (err) {
        console.error('Failed to load dashboard stats:', err);
        setError('無法載入儀表板數據，請重試。');
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  if (loading) return <LoadingSpinner fullPage size="lg" />;

  if (error) {
    return (
      <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-error)' }}>{error}</p>
        <Button onClick={() => window.location.reload()}>重新載入</Button>
      </div>
    );
  }

  // Format currency helper
  const formatCurrency = (val) => `NT$ ${Math.round(val || 0).toLocaleString('zh-TW')}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* 4 Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 'var(--space-4)'
      }}>
        <SummaryCard
          title="在職員工總數"
          value={`${stats?.activeEmployeeCount || 0} 人`}
          icon="people"
          color="primary"
        />
        <SummaryCard
          title="本月薪資預估總額"
          value={formatCurrency(stats?.totalMonthlyGrossPay)}
          icon="payments"
          color="info"
        />
        <SummaryCard
          title="本月累計加班時數"
          value={`${stats?.totalMonthlyOvertimeHours || 0} 小時`}
          icon="schedule"
          color="warning"
        />
        <SummaryCard
          title="待審核請假申請"
          value={`${stats?.pendingLeavesCount || 0} 筆`}
          icon="event_busy"
          color="error"
          trend={stats?.pendingLeavesCount > 0 ? "急需處理" : null}
          trendDirection="down"
        />
      </div>

      {/* Charts section (Grid) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: 'var(--space-6)',
        alignItems: 'start'
      }}>
        {/* Trend Area Chart */}
        <Card title="近六個月發放薪資趨勢">
          <div style={{ width: '100%', height: '320px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={stats?.trends || []}
                margin={{ top: 10, right: 30, left: 20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary-500)" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="var(--color-primary-500)" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e5ec" />
                <XAxis dataKey="name" stroke="var(--color-neutral-500)" fontSize={11} />
                <YAxis 
                  stroke="var(--color-neutral-500)" 
                  fontSize={11} 
                  tickFormatter={(val) => `${val / 1000}k`}
                />
                <Tooltip 
                  formatter={(value) => [formatCurrency(value), '']}
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    border: '1px solid var(--color-neutral-200)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--text-sm)',
                    boxShadow: 'var(--shadow-md)'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="實發薪資" 
                  stroke="var(--color-primary-600)" 
                  fillOpacity={1} 
                  fill="url(#colorNet)" 
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Pie Chart Department Payroll */}
        <Card title="部門薪資佔比">
          <div style={{ width: '100%', height: '240px', display: 'flex', flexDirection: 'column', justifyItems: 'center', alignItems: 'center' }}>
            {stats?.departmentStats?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats?.departmentStats}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {stats?.departmentStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    iconSize={8}
                    iconType="circle"
                    formatter={(value) => <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-neutral-600)' }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--color-neutral-400)' }}>
                本月尚未結算薪資
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Quick Actions Panel */}
      <Card title="常用功能快捷鍵">
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 'var(--space-4)'
        }}>
          <Button 
            variant="outline" 
            icon="person_add" 
            onClick={() => navigate('/employees/new')}
            style={{ padding: 'var(--space-4)', height: '80px', flexDirection: 'column', fontSize: 'var(--text-sm)' }}
          >
            新增員工檔案
          </Button>
          <Button 
            variant="outline" 
            icon="upload_file" 
            onClick={() => navigate('/attendance')}
            style={{ padding: 'var(--space-4)', height: '80px', flexDirection: 'column', fontSize: 'var(--text-sm)' }}
          >
            匯入出勤資料
          </Button>
          <Button 
            variant="outline" 
            icon="calculate" 
            onClick={() => navigate('/payroll')}
            style={{ padding: 'var(--space-4)', height: '80px', flexDirection: 'column', fontSize: 'var(--text-sm)' }}
          >
            結算本月薪資
          </Button>
          <Button 
            variant="outline" 
            icon="description" 
            onClick={() => navigate('/reports')}
            style={{ padding: 'var(--space-4)', height: '80px', flexDirection: 'column', fontSize: 'var(--text-sm)' }}
          >
            產生財務報表
          </Button>
        </div>
      </Card>
    </div>
  );
}

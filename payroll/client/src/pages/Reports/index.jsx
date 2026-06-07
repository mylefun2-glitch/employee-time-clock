import React, { useState, useEffect } from 'react';
import reportService from '../../services/reportService';
import { Button, Card, DataTable, Input, LoadingSpinner } from '../../components/common';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line, AreaChart, Area } from 'recharts';

export default function Reports() {
  const now = new Date();
  const [activeTab, setActiveTab] = useState('monthly'); // monthly, department, yearly, insurance
  const [year, setYear] = useState(now.getFullYear().toString());
  const [month, setMonth] = useState((now.getMonth() + 1).toString());
  
  const [monthlyData, setMonthlyData] = useState(null);
  const [deptData, setDeptData] = useState([]);
  const [yearlyData, setYearlyData] = useState([]);
  const [insData, setInsData] = useState([]);
  const [insTotals, setInsTotals] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReportData();
  }, [activeTab, year, month]);

  const loadReportData = async () => {
    setLoading(true);
    try {
      const y = parseInt(year);
      const m = parseInt(month);

      if (activeTab === 'monthly') {
        const res = await reportService.getMonthlyReport({ year: y, month: m });
        setMonthlyData(res.data);
      } else if (activeTab === 'department') {
        const res = await reportService.getDepartmentReport({ year: y, month: m });
        setDeptData(res.data || []);
      } else if (activeTab === 'yearly') {
        const res = await reportService.getYearlyReport({ year: y });
        setYearlyData(res.data || []);
      } else if (activeTab === 'insurance') {
        const res = await reportService.getInsuranceReport({ year: y, month: m });
        setInsData(res.data || []);
        setInsTotals(res.totals);
      }
    } catch (err) {
      console.error('Failed to load report data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Client-side CSV exporter utility
  const exportToCSV = (filename, headers, rows) => {
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" // Add BOM for Excel Chinese display
      + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportMonthly = () => {
    if (!monthlyData) return;
    const headers = ['項目', '金額 (NT$)'];
    const rows = [
      ['總發放薪資 (Gross)', monthlyData.totalGrossPay],
      ['總扣除項目', monthlyData.totalDeductions],
      ['實發淨額 (Net Pay)', monthlyData.totalNetPay],
      ['員工自付勞保費', monthlyData.totalLaborInsEmployee],
      ['員工自付健保費', monthlyData.totalHealthInsEmployee],
      ['員工勞退自提金', monthlyData.totalPensionEmployee],
      ['預扣所得稅', monthlyData.totalTax],
      ['雇主負擔勞保費', monthlyData.totalLaborInsEmployer],
      ['雇主負擔健保費', monthlyData.totalHealthInsEmployer],
      ['雇主負擔勞退金', monthlyData.totalPensionEmployer],
      ['雇主總保險負擔成本', monthlyData.totalEmployerCost]
    ];
    exportToCSV(`payroll_monthly_summary_${year}_${month}`, headers, rows);
  };

  const handleExportDept = () => {
    if (deptData.length === 0) return;
    const headers = ['部門', '人數', '應發薪資總額', '實發薪資總額', '加班費總額', '雇主負擔總額'];
    const rows = deptData.map(d => [
      d.department,
      d.employeeCount,
      d.grossPay,
      d.netPay,
      d.overtimePay,
      d.employerCost
    ]);
    exportToCSV(`payroll_department_summary_${year}_${month}`, headers, rows);
  };

  const handleExportInsurance = () => {
    if (insData.length === 0) return;
    const headers = ['工號', '姓名', '部門', '勞保費(員工)', '勞保費(雇主)', '勞保總額', '健保費(員工)', '健保費(雇主)', '健保總額', '勞退自提(員工)', '勞退自提(雇主)', '勞退總額'];
    const rows = insData.map(d => [
      d.employeeNo,
      d.name,
      d.department,
      d.laborEmployee,
      d.laborEmployer,
      d.laborTotal,
      d.healthEmployee,
      d.healthEmployer,
      d.healthTotal,
      d.pensionEmployee,
      d.pensionEmployer,
      d.pensionTotal
    ]);
    exportToCSV(`payroll_insurance_contribution_${year}_${month}`, headers, rows);
  };

  const formatCurr = (v) => `NT$ ${Math.round(v || 0).toLocaleString('zh-TW')}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Top filter and tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {/* Navigation Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--color-neutral-200)',
          gap: 'var(--space-2)'
        }}>
          {[
            { id: 'monthly', label: '月發放彙總' },
            { id: 'department', label: '部門薪資統計' },
            { id: 'yearly', label: '年度薪資趨勢' },
            { id: 'insurance', label: '勞健保提繳明細' }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: 'var(--space-2) var(--space-4)',
                borderBottom: activeTab === t.id ? '3px solid var(--color-primary-600)' : '3px solid transparent',
                color: activeTab === t.id ? 'var(--color-primary-700)' : 'var(--color-neutral-500)',
                fontWeight: activeTab === t.id ? '600' : '400',
                cursor: 'pointer',
                background: 'none',
                border: 'none',
                fontSize: 'var(--text-base)'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Date Selector */}
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
          {activeTab !== 'yearly' && (
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
          )}
        </div>
      </div>

      {loading ? (
        <LoadingSpinner size="lg" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Tab 1: Monthly summary */}
          {activeTab === 'monthly' && monthlyData && (
            <>
              {/* Gross vs Net and Deductions Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
                <Card title="薪資發放規模">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>應發薪資總額 (Gross):</span>
                      <strong className="font-mono">{formatCurr(monthlyData.totalGrossPay)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>扣除額項目總額:</span>
                      <strong className="font-mono" style={{ color: 'var(--color-error)' }}>{formatCurr(monthlyData.totalDeductions)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--color-neutral-200)', paddingTop: 'var(--space-2)' }}>
                      <span>實發薪資淨額 (Net):</span>
                      <strong className="font-mono" style={{ color: 'var(--color-success)', fontSize: 'var(--text-lg)' }}>{formatCurr(monthlyData.totalNetPay)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>發放員工人數:</span>
                      <strong>{monthlyData.employeeCount} 人</strong>
                    </div>
                  </div>
                </Card>

                <Card title="員工自付代扣細項">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>勞保費自付額:</span>
                      <span className="font-mono">{formatCurr(monthlyData.totalLaborInsEmployee)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>健保費自付額:</span>
                      <span className="font-mono">{formatCurr(monthlyData.totalHealthInsEmployee)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>勞退金自提額:</span>
                      <span className="font-mono">{formatCurr(monthlyData.totalPensionEmployee)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>預扣綜合所得稅:</span>
                      <span className="font-mono">{formatCurr(monthlyData.totalTax)}</span>
                    </div>
                  </div>
                </Card>

                <Card title="雇主保險提繳成本">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>雇主勞保負擔額:</span>
                      <span className="font-mono">{formatCurr(monthlyData.totalLaborInsEmployer)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>雇主健保負擔額:</span>
                      <span className="font-mono">{formatCurr(monthlyData.totalHealthInsEmployer)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>雇主強制提繳勞退 (6%):</span>
                      <span className="font-mono">{formatCurr(monthlyData.totalPensionEmployer)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--color-neutral-200)', paddingTop: 'var(--space-2)' }}>
                      <span>雇主額外人事保險成本:</span>
                      <strong className="font-mono">{formatCurr(monthlyData.totalEmployerCost)}</strong>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button variant="outline" icon="download" onClick={handleExportMonthly}>匯出月報表 CSV</Button>
              </div>
            </>
          )}

          {/* Tab 2: Department breakdown */}
          {activeTab === 'department' && (
            <>
              {/* Visual chart */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)', alignItems: 'center' }}>
                <Card title="部門薪資發放規模對比">
                  <div style={{ width: '100%', height: '280px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={deptData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="department" stroke="var(--color-neutral-500)" />
                        <YAxis stroke="var(--color-neutral-500)" />
                        <Tooltip formatter={(v) => formatCurr(v)} />
                        <Legend />
                        <Bar dataKey="grossPay" name="應發薪資" fill="var(--color-primary-600)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="employerCost" name="雇主負擔保險" fill="var(--color-primary-300)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card title="部門員工人數分佈">
                  <div style={{ width: '100%', height: '280px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={deptData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="department" stroke="var(--color-neutral-500)" />
                        <YAxis stroke="var(--color-neutral-500)" />
                        <Tooltip />
                        <Bar dataKey="employeeCount" name="員工數 (人)" fill="var(--color-success)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>

              {/* Data Table */}
              <Card title="部門詳細明細" extra={<Button variant="outline" size="sm" icon="download" onClick={handleExportDept}>匯出部門報表 CSV</Button>}>
                <DataTable
                  columns={[
                    { title: '部門', key: 'department', bold: true },
                    { title: '發放人數', key: 'employeeCount', align: 'center', render: (val) => `${val} 人` },
                    { title: '應發薪資總額', key: 'grossPay', align: 'right', render: (val) => formatCurr(val) },
                    { title: '實發薪資總額', key: 'netPay', align: 'right', render: (val) => formatCurr(val) },
                    { title: '加班費總額', key: 'overtimePay', align: 'right', render: (val) => formatCurr(val) },
                    { title: '雇主負擔提繳總額', key: 'employerCost', align: 'right', render: (val) => formatCurr(val) }
                  ]}
                  data={deptData}
                  emptyMessage="該月份尚未發放任何部門薪資"
                />
              </Card>
            </>
          )}

          {/* Tab 3: Yearly report */}
          {activeTab === 'yearly' && (
            <>
              {/* Yearly trend chart */}
              <Card title={`${year} 年度薪資發放趨勢圖`}>
                <div style={{ width: '100%', height: '350px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={yearlyData} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorGross" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-primary-500)" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="var(--color-primary-500)" stopOpacity={0.1}/>
                        </linearGradient>
                        <linearGradient id="colorNetYear" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-success)" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="var(--color-success)" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" stroke="var(--color-neutral-500)" tickFormatter={(val) => `${val} 月`} />
                      <YAxis stroke="var(--color-neutral-500)" />
                      <Tooltip formatter={(v) => formatCurr(v)} />
                      <Legend />
                      <Area type="monotone" dataKey="grossPay" name="總應發薪資" stroke="var(--color-primary-600)" fillOpacity={1} fill="url(#colorGross)" strokeWidth={2} />
                      <Area type="monotone" dataKey="netPay" name="總實發淨額" stroke="var(--color-success)" fillOpacity={1} fill="url(#colorNetYear)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Data Table */}
              <Card title="年度月份發放數據表">
                <DataTable
                  columns={[
                    { title: '月份', key: 'month', bold: true, render: (val) => `${val} 月` },
                    { title: '發放總人數', key: 'employeeCount', align: 'center', render: (val) => val > 0 ? `${val} 人` : '—' },
                    { title: '總應發薪資', key: 'grossPay', align: 'right', render: (val) => val > 0 ? formatCurr(val) : '—' },
                    { title: '總實發淨額', key: 'netPay', align: 'right', render: (val) => val > 0 ? formatCurr(val) : '—' }
                  ]}
                  data={yearlyData}
                  emptyMessage="該年度尚無發放紀錄"
                />
              </Card>
            </>
          )}

          {/* Tab 4: Insurance report */}
          {activeTab === 'insurance' && (
            <Card title="員工勞健保提繳與自扣明細" extra={<Button variant="outline" size="sm" icon="download" onClick={handleExportInsurance}>匯出勞健保明細 CSV</Button>}>
              <DataTable
                columns={[
                  { title: '工號', key: 'employeeNo', bold: true },
                  { title: '姓名', key: 'name', bold: true },
                  { title: '部門', key: 'department' },
                  { title: '勞保(員工自付)', key: 'laborEmployee', align: 'right', render: (v) => formatCurr(v) },
                  { title: '勞保(雇主負擔)', key: 'laborEmployer', align: 'right', render: (v) => formatCurr(v) },
                  { title: '健保(員工自付)', key: 'healthEmployee', align: 'right', render: (v) => formatCurr(v) },
                  { title: '健保(雇主負擔)', key: 'healthEmployer', align: 'right', render: (v) => formatCurr(v) },
                  { title: '勞退(員工自提)', key: 'pensionEmployee', align: 'right', render: (v) => formatCurr(v) },
                  { title: '勞退(雇主提繳)', key: 'pensionEmployer', align: 'right', render: (v) => formatCurr(v) }
                ]}
                data={insData}
                emptyMessage="該月份尚無發放勞健保資料"
              />
              {insTotals && insData.length > 0 && (
                <div style={{
                  marginTop: 'var(--space-4)',
                  padding: 'var(--space-4)',
                  backgroundColor: 'var(--color-neutral-50)',
                  borderRadius: 'var(--radius-md)',
                  display: 'grid',
                  gridTemplateColumns: '1.2fr 1fr 1fr 1fr',
                  gap: 'var(--space-4)',
                  fontSize: 'var(--text-sm)'
                }}>
                  <div><strong>合計匯總：</strong></div>
                  <div>
                    <strong style={{ display: 'block', color: 'var(--color-neutral-500)', fontSize: 'var(--text-xs)' }}>總勞保金額</strong>
                    員工: {formatCurr(insTotals.laborEmployee)} <br />
                    雇主: {formatCurr(insTotals.laborEmployer)} <br />
                    <strong>合計: {formatCurr(insTotals.laborTotal)}</strong>
                  </div>
                  <div>
                    <strong style={{ display: 'block', color: 'var(--color-neutral-500)', fontSize: 'var(--text-xs)' }}>總健保金額</strong>
                    員工: {formatCurr(insTotals.healthEmployee)} <br />
                    雇主: {formatCurr(insTotals.healthEmployer)} <br />
                    <strong>合計: {formatCurr(insTotals.healthTotal)}</strong>
                  </div>
                  <div>
                    <strong style={{ display: 'block', color: 'var(--color-neutral-500)', fontSize: 'var(--text-xs)' }}>總勞退提繳</strong>
                    員工: {formatCurr(insTotals.pensionEmployee)} <br />
                    雇主: {formatCurr(insTotals.pensionEmployer)} <br />
                    <strong>合計: {formatCurr(insTotals.pensionTotal)}</strong>
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

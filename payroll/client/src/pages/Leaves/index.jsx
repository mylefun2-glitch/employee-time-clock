import React, { useState, useEffect } from 'react';
import leaveService from '../../services/leaveService';
import employeeService from '../../services/employeeService';
import settingService from '../../services/settingService';
import { Card, DataTable, Input, LoadingSpinner, Badge, Button } from '../../components/common';

export default function Leaves() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear().toString());
  const [month, setMonth] = useState((now.getMonth() + 1).toString());
  const [leaves, setLeaves] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [leaveRules, setLeaveRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('approved'); // Default to approved leaves for statistics
  const [activeTab, setActiveTab] = useState('summary'); // 'summary' or 'detail'

  useEffect(() => {
    loadLeaves();
  }, [statusFilter, year, month]);

  useEffect(() => {
    loadEmployees();
    loadLeaveRules();
  }, []);

  const loadLeaveRules = async () => {
    try {
      const res = await settingService.getSettings();
      const ruleSetting = res.data.leave_rules?.find(s => s.key === 'leave_deduction_rules');
      if (ruleSetting) {
        setLeaveRules(JSON.parse(ruleSetting.value));
      }
    } catch (err) {
      console.error('Failed to load leave rules:', err);
    }
  };

  const loadEmployees = async () => {
    try {
      const res = await employeeService.getEmployees({ pageSize: 10000 });
      setEmployees(res.data || []);
    } catch (err) {
      console.error('Failed to load employees:', err);
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
        endDate,
        pageSize: 10000
      });
      
      // Filter out business travel, overtime, and conversions from leaves view
      const filteredLeaves = (res.data || []).filter(l => {
        const type = (l.leaveType || '').toLowerCase();
        return !(
          type.includes('加班') || 
          type.includes('公出') || 
          type.includes('折算') || 
          type.includes('折現') || 
          type === 'co' || 
          type === 'alc' || 
          type === 'ob' || 
          type === 'ot'
        );
      });
      setLeaves(filteredLeaves);
    } catch (err) {
      console.error('Failed to load leaves:', err);
    } finally {
      setLoading(false);
    }
  };

  // Compile summary statistics of deductible leaves per employee in hours
  const getSummaryData = () => {
    const employeeLeavesMap = {};

    // Find rules that have deductions (rate > 0)
    const deductionRules = leaveRules.filter(r => parseFloat(r.rate) > 0);

    // Helper to find matching rule
    const findDeductionRule = (leaveType) => {
      const typeStr = (leaveType || '').trim().toLowerCase();
      return deductionRules.find(r => {
        const ruleType = (r.leaveType || '').trim().toLowerCase();
        const ruleLabel = (r.label || '').trim().toLowerCase();
        return typeStr === ruleType || typeStr === ruleLabel || typeStr.includes(ruleType) || ruleType.includes(typeStr);
      });
    };

    // Initialize with all active employees to ensure they are listed
    employees.forEach(emp => {
      const initObj = {
        employee: emp,
        rule_other: 0,
        totalDeductibleHours: 0
      };
      deductionRules.forEach(rule => {
        initObj[`rule_${rule.leaveType}`] = 0;
      });
      employeeLeavesMap[emp.id] = initObj;
    });

    // Aggregate leave records
    leaves.forEach(l => {
      const empId = l.employeeId;
      if (!employeeLeavesMap[empId]) {
        const initObj = {
          employee: l.employee || { name: '未知', department: '未知' },
          rule_other: 0,
          totalDeductibleHours: 0
        };
        deductionRules.forEach(rule => {
          initObj[`rule_${rule.leaveType}`] = 0;
        });
        employeeLeavesMap[empId] = initObj;
      }

      const hours = (parseFloat(l.days) || 0) * 8;
      const typeStr = (l.leaveType || '').trim().toLowerCase();

      // Check if it matches any rule (including rate = 0)
      const matchedRule = leaveRules.find(r => {
        const ruleType = (r.leaveType || '').trim().toLowerCase();
        const ruleLabel = (r.label || '').trim().toLowerCase();
        return typeStr === ruleType || typeStr === ruleLabel || typeStr.includes(ruleType) || ruleType.includes(typeStr);
      });

      if (matchedRule) {
        if (parseFloat(matchedRule.rate) > 0) {
          // It's a deductible leave
          // Does it have a specific column (in deductionRules)?
          const hasCol = deductionRules.some(r => r.leaveType === matchedRule.leaveType);
          if (hasCol) {
            employeeLeavesMap[empId][`rule_${matchedRule.leaveType}`] += hours;
          } else {
            employeeLeavesMap[empId].rule_other += hours;
          }
          employeeLeavesMap[empId].totalDeductibleHours += hours;
        }
      } else {
        // Completely unmatched leave type. By default, it's unpaid (deductible)
        employeeLeavesMap[empId].rule_other += hours;
        employeeLeavesMap[empId].totalDeductibleHours += hours;
      }
    });

    // Convert map to array, showing employees who have leaves or are in the employee directory
    return Object.values(employeeLeavesMap)
      .filter(item => item.totalDeductibleHours > 0 || leaves.some(l => l.employeeId === item.employee.id))
      .map((item, idx) => {
        const result = {
          id: item.employee.id || idx,
          department: item.employee.department,
          name: item.employee.name,
          rule_other: parseFloat(item.rule_other.toFixed(2)),
          totalDeductibleHours: parseFloat(item.totalDeductibleHours.toFixed(2))
        };
        deductionRules.forEach(rule => {
          result[`rule_${rule.leaveType}`] = parseFloat((item[`rule_${rule.leaveType}`] || 0).toFixed(2));
        });
        return result;
      })
      .sort((a, b) => b.totalDeductibleHours - a.totalDeductibleHours);
  };

  const getSummaryColumns = () => {
    const cols = [
      { title: '部門', key: 'department', bold: true },
      { title: '姓名', key: 'name', bold: true }
    ];

    // Find rules that have deductions (rate > 0)
    const deductionRules = leaveRules.filter(r => parseFloat(r.rate) > 0);
    
    deductionRules.forEach(rule => {
      cols.push({
        title: `${rule.label} (H)`,
        key: `rule_${rule.leaveType}`,
        align: 'center',
        render: (val) => val > 0 ? `${val} H` : '—'
      });
    });

    // Always append "其他扣薪假 (H)" for unmatched or other custom leaves
    cols.push({
      title: '其他扣薪假 (H)',
      key: 'rule_other',
      align: 'center',
      render: (val) => val > 0 ? `${val} H` : '—'
    });

    cols.push({
      title: '總扣薪時數 (H)',
      key: 'totalDeductibleHours',
      align: 'center',
      bold: true,
      render: (val) => val > 0 ? <span style={{ color: 'var(--color-error)', fontWeight: 'bold' }}>{val} H</span> : '0 H'
    });

    return cols;
  };

  const detailColumns = [
    { title: '部門', key: 'employee.department', bold: true, render: (_, row) => row.employee?.department },
    { title: '姓名', key: 'employee.name', bold: true, render: (_, row) => row.employee?.name },
    { title: '假別', key: 'leaveType', render: (val) => val },
    { title: '時數 (H)', key: 'days', render: (val) => `${parseFloat((val * 8).toFixed(2))} H` },
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
              { value: 'approved', label: '已核准 (Approved)' },
              { value: 'pending', label: '待審核 (Pending)' },
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
          <span>請假資料由外部系統同步，此處供扣薪與補貼統計。</span>
        </div>
      </div>

      {/* Tabs Layout */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '2px solid var(--color-neutral-200)' }}>
        <Button 
          variant={activeTab === 'summary' ? 'primary' : 'outline'} 
          style={{ 
            borderBottomLeftRadius: 0, 
            borderBottomRightRadius: 0, 
            borderBottom: activeTab === 'summary' ? '2px solid var(--color-primary-600)' : 'none',
            marginBottom: '-2px'
          }}
          onClick={() => setActiveTab('summary')}
        >
          請假扣薪統計
        </Button>
        <Button 
          variant={activeTab === 'detail' ? 'primary' : 'outline'}
          style={{ 
            borderBottomLeftRadius: 0, 
            borderBottomRightRadius: 0, 
            borderBottom: activeTab === 'detail' ? '2px solid var(--color-primary-600)' : 'none',
            marginBottom: '-2px'
          }}
          onClick={() => setActiveTab('detail')}
        >
          請假申請明細
        </Button>
      </div>

      {/* Leave List / Summary */}
      <Card>
        <DataTable 
          columns={activeTab === 'summary' ? getSummaryColumns() : detailColumns}
          data={activeTab === 'summary' ? getSummaryData() : leaves}
          loading={loading}
          emptyMessage={activeTab === 'summary' ? "該月份尚無任何會扣薪的請假統計資料" : "查無符合條件的請假申請明細"}
        />
      </Card>
    </div>
  );
}

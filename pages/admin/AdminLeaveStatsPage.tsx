import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { getEmployeeLeaveBalances } from '../../services/employee';
import { LeaveBalance, Employee } from '../../types';
import { Search, Download, FileText, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import LeaveBalanceDetailModal from '../../components/admin/LeaveBalanceDetailModal';
import { exportLeaveBalancePdf, LeaveDetailRecord } from '../../components/admin/LeaveBalancePdfExporter';

interface EmployeeLeaveStats extends Employee {
    leaveBalance: LeaveBalance | null;
}

const AdminLeaveStatsPage: React.FC = () => {
    const [employees, setEmployees] = useState<EmployeeLeaveStats[]>([]);
    const [filteredEmployees, setFilteredEmployees] = useState<EmployeeLeaveStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [departmentFilter, setDepartmentFilter] = useState('ALL');
    const [selectedEmployeeDetails, setSelectedEmployeeDetails] = useState<EmployeeLeaveStats | null>(null);
    const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        filterData();
    }, [searchTerm, departmentFilter, employees]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: userData, error } = await supabase
                .from('employees')
                .select('*')
                .eq('is_active', true)
                .order('department', { ascending: true });

            if (error) throw error;

            if (userData) {
                const statsPromises = userData.map(async (emp: any) => {
                    const balance = await getEmployeeLeaveBalances(emp.id);
                    return {
                        ...emp,
                        leaveBalance: balance
                    };
                });

                const results = await Promise.all(statsPromises);
                setEmployees(results);
            }
        } catch (error) {
            console.error('Error fetching admin leave stats:', error);
        } finally {
            setLoading(false);
        }
    };

    const filterData = () => {
        let result = employees;

        if (departmentFilter !== 'ALL') {
            result = result.filter(e => (e.department || '未分配') === departmentFilter);
        }

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(e =>
                e.name.toLowerCase().includes(term) ||
                (e.pin && e.pin.includes(term))
            );
        }

        setFilteredEmployees(result);
    };

    const handleExport = () => {
        const dataToExport = filteredEmployees.map(e => ({
            '部門': e.department || '未分配',
            '姓名': e.name,
            'PIN': e.pin,
            '特休總額': e.leaveBalance ? e.leaveBalance.annual.entitlement : 0,
            '特休已用': e.leaveBalance?.annual.used || 0,
            '特休折現': e.leaveBalance?.annual.cashout || 0,
            '特休剩餘': e.leaveBalance?.annual.remaining || 0,
            '補休總額': e.leaveBalance?.compensatory.entitlement || 0,
            '補休已用': e.leaveBalance?.compensatory.used || 0,
            '補休折現': e.leaveBalance?.compensatory.cashout || 0,
            '補休剩餘': e.leaveBalance?.compensatory.remaining || 0,
            '加班總額': e.leaveBalance?.compensatory.overtime_total || 0,
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "差勤統計");
        XLSX.writeFile(wb, "差勤統計報表.xlsx");
    };

    const handleIndividualExport = async (emp: EmployeeLeaveStats) => {
        try {
            // 1. 獲取所有差勤類型以利對照
            const { data: leaveTypes } = await supabase.from('leave_types').select('*');
            const typeMap = new Map((leaveTypes || []).map(t => [t.id, t]));
            const annualTypeId = (leaveTypes || []).find(t => t.code === 'ANNUAL')?.id;
            const otTypeId = (leaveTypes || []).find(t => t.code === 'OT')?.id;
            const toilTypeId = (leaveTypes || []).find(t => t.code === 'TOIL')?.id;
            const compTypeId = (leaveTypes || []).find(t => t.code === 'TOIL')?.id;
            const alcTypeId = (leaveTypes || []).find(t => t.code === 'ALC')?.id;

            // 2. 獲取申請紀錄
            const { data: requests } = await supabase
                .from('leave_requests')
                .select('*')
                .eq('employee_id', emp.id)
                .eq('status', 'APPROVED')
                .or('is_modified.eq.false,is_modified.is.null')
                .order('start_date', { ascending: false });

            // 3. 獲取調整/折現紀錄
            const { data: adjustments } = await supabase
                .from('leave_balance_adjustments')
                .select('*')
                .eq('employee_id', emp.id)
                .order('created_at', { ascending: false });

            // 4. 整合並格式化資料
            const records: any[] = [];

            // 處理申請紀錄
            (requests || []).forEach(req => {
                let category = '-';
                let detailType = '-';
                let amount = req.hours || 0;

                if (req.leave_type_id === annualTypeId) {
                    category = '特休';
                    detailType = '請假申請';
                    amount = -amount; // 請假扣除
                } else if (req.leave_type_id === otTypeId) {
                    category = '補休';
                    detailType = '加班紀錄';
                    amount = amount; // 加班增加
                } else if (typeMap.get(req.leave_type_id!)?.code === 'CO' || typeMap.get(req.leave_type_id!)?.name?.includes('折算')) {
                    category = '補休';
                    detailType = '加班折算';
                    amount = -amount; // 折算視為轉出/扣除
                } else if (req.leave_type_id === alcTypeId || typeMap.get(req.leave_type_id!)?.code === 'ALC' || typeMap.get(req.leave_type_id!)?.name?.includes('折現')) {
                    category = '特休';
                    detailType = '特休折現';
                    amount = -amount; // 折現視為使用/扣除
                } else if (req.leave_type_id === toilTypeId || req.leave_type_id === compTypeId) {
                    category = '補休';
                    detailType = '補休申請';
                    amount = -amount; // 使用扣除
                } else {
                    category = typeMap.get(req.leave_type_id!)?.name || '其他';
                    detailType = '請假申請';
                    amount = -amount;
                }

                records.push({
                    '日期': new Date(req.start_date).toLocaleDateString('zh-TW'),
                    '類別': category,
                    '明細類型': detailType,
                    '時數(小時)': amount,
                    '原因': req.reason || '-'
                });
            });

            // 處理調整紀錄
            (adjustments || []).forEach(adj => {
                const category = adj.leave_type_code === 'ANNUAL' ? '特休' : '補休';
                let detailType = '手動調整';
                let amount = adj.amount_hours;

                if (adj.adjustment_type === 'CASHOUT') {
                    detailType = '折現/折算';
                    amount = -amount; // 折現是扣除餘額
                } else if (adj.adjustment_type === 'GRANT') {
                    detailType = '手動加給';
                } else if (adj.adjustment_type === 'CORRECTION') {
                    detailType = '校正調整';
                }

                records.push({
                    '日期': new Date(adj.created_at).toLocaleDateString('zh-TW'),
                    '類別': category,
                    '明細類型': detailType,
                    '時數(小時)': amount,
                    '原因': adj.reason || '-'
                });
            });

            // 按日期倒序排列
            records.sort((a, b) => new Date(b['日期']).getTime() - new Date(a['日期']).getTime());

            // 5. 匯出 Excel
            const ws = XLSX.utils.json_to_sheet(records);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "差勤明細");
            XLSX.writeFile(wb, `${emp.name}_差勤明細紀錄.xlsx`);

        } catch (error) {
            console.error('Error exporting individual records:', error);
            alert('匯出失敗，請稍後再試');
        }
    };

    const handlePdfExport = async (emp: EmployeeLeaveStats) => {
        if (pdfLoadingId) return; // 防止重複點擊
        setPdfLoadingId(emp.id);
        try {
            // 1. 撈取假別對照表
            const { data: leaveTypes } = await supabase.from('leave_types').select('*');
            const typeMap = new Map((leaveTypes || []).map((t: any) => [t.id, t]));

            // 2. 撈取已核准的請假申請（含時間欄位）
            const { data: requests } = await supabase
                .from('leave_requests')
                .select('id, leave_type_id, start_date, end_date, reason, hours, status')
                .eq('employee_id', emp.id)
                .eq('status', 'APPROVED')
                .or('is_modified.eq.false,is_modified.is.null')
                .order('start_date', { ascending: true });

            // 3. 撈取折現/調整紀錄
            const { data: adjustments } = await supabase
                .from('leave_balance_adjustments')
                .select('*')
                .eq('employee_id', emp.id)
                .order('created_at', { ascending: true });

            const records: LeaveDetailRecord[] = [];

            // 處理請假申請
            (requests || []).forEach((req: any) => {
                const lt = typeMap.get(req.leave_type_id);
                const ltCode: string = lt?.code || 'OTHER';
                const ltName: string = lt?.name || '其他';

                // 解析起始/結束時間（資料庫通常存 date string，無時間欄位則預設班表）
                const startTime = '08:00';
                const endTime = '17:00';

                records.push({
                    leave_type_name: ltName,
                    leave_type_code: ltCode,
                    start_date: req.start_date,
                    start_time: startTime,
                    end_date: req.end_date,
                    end_time: endTime,
                    description: req.reason || '—',
                    hours: Math.abs(req.hours || 0),
                    record_type: 'request',
                });
            });

            // 處理折現/調整紀錄（ALC / CO 類型）
            (adjustments || []).forEach((adj: any) => {
                const isCashout = adj.adjustment_type === 'CASHOUT';
                const ltCode = adj.leave_type_code === 'ANNUAL' ? 'ALC' : 'CO';
                const ltName = adj.leave_type_code === 'ANNUAL' ? '特休折現' : '補休折算';

                if (!isCashout) return; // 只展示折現/折算記錄

                records.push({
                    leave_type_name: ltName,
                    leave_type_code: ltCode,
                    start_date: adj.created_at?.split('T')[0] || '',
                    start_time: '00:00',
                    end_date: adj.created_at?.split('T')[0] || '',
                    end_time: '00:00',
                    description: adj.reason || '—',
                    hours: Math.abs(adj.amount_hours || 0),
                    record_type: 'adjustment',
                });
            });

            await exportLeaveBalancePdf({
                employee: emp,
                records,
            });
        } catch (err) {
            console.error('PDF export error:', err);
            alert('PDF 匯出失敗，請稍後再試');
        } finally {
            setPdfLoadingId(null);
        }
    };

    const departments = ['ALL', ...Array.from(new Set(employees.map(e => e.department || '未分配')))];

    if (loading) return <div className="p-12 text-center text-slate-500 font-bold text-xl">數據加載中...</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">全會差勤額度統計</h1>
                    <p className="mt-1 text-sm text-slate-500 font-medium">
                        檢視所有員工的特休與補休使用狀況。
                    </p>
                </div>
                <button
                    onClick={handleExport}
                    className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
                >
                    <Download className="h-4 w-4 mr-2" />
                    匯出 Excel
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-3 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm items-stretch md:items-center">
                <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                        type="text"
                        className="block w-full pl-10 pr-4 py-2.5 border-slate-200 bg-slate-50/50 rounded-xl text-sm font-medium focus:ring-blue-500 focus:border-blue-500 border transition-all"
                        placeholder="搜尋姓名或 PIN..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <select
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                    className="block w-full sm:w-40 pl-3 pr-10 py-2.5 border-slate-200 bg-slate-50/50 rounded-xl text-sm font-bold text-slate-700 focus:ring-blue-500 focus:border-blue-500 border transition-all"
                >
                    {departments.map(dept => (
                        <option key={dept} value={dept}>{dept === 'ALL' ? '全部部門' : dept}</option>
                    ))}
                </select>
            </div>

            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="min-w-full divide-y divide-slate-100">
                        <thead className="bg-slate-50/50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest">姓名</th>
                                <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest">部門</th>
                                <th className="px-6 py-4 text-center text-xs font-black text-slate-400 uppercase tracking-widest text-blue-600">特休總額</th>
                                <th className="px-6 py-4 text-center text-xs font-black text-slate-400 uppercase tracking-widest text-blue-600">已用</th>
                                <th className="px-6 py-4 text-center text-xs font-black text-slate-400 uppercase tracking-widest text-blue-600">折現</th>
                                <th className="px-6 py-4 text-center text-xs font-black text-slate-400 uppercase tracking-widest text-blue-600">剩餘</th>
                                <th className="px-6 py-4 text-center text-xs font-black text-slate-400 uppercase tracking-widest text-purple-600 bg-slate-50">補休總額</th>
                                <th className="px-6 py-4 text-center text-xs font-black text-slate-400 uppercase tracking-widest text-purple-600 bg-slate-50">已用</th>
                                <th className="px-6 py-4 text-center text-xs font-black text-slate-400 uppercase tracking-widest text-purple-600 bg-slate-50">折算</th>
                                <th className="px-6 py-4 text-center text-xs font-black text-slate-400 uppercase tracking-widest text-purple-600 bg-slate-50">剩餘</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredEmployees.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-slate-400 font-bold">
                                        無符合資料
                                    </td>
                                </tr>
                            ) : (
                                filteredEmployees.map((emp) => (
                                    <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-900 flex items-center gap-3">
                                            <button 
                                                onClick={() => setSelectedEmployeeDetails(emp)}
                                                className="hover:text-blue-600 transition-colors flex items-center gap-1 group/name"
                                                title="查看差勤額度明細"
                                            >
                                                {emp.name}
                                                <span className="material-symbols-outlined text-[14px] opacity-0 group-hover/name:opacity-100 transition-opacity text-blue-500">visibility</span>
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleIndividualExport(emp); }}
                                                className="p-1 rounded bg-slate-100 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                                title="匯出個人明細 Excel"
                                            >
                                                <Download className="h-3.5 w-3.5" />
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handlePdfExport(emp); }}
                                                className="p-1 rounded bg-slate-100 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-40"
                                                title="匯出差勤額度統計明細 PDF"
                                                disabled={pdfLoadingId === emp.id}
                                            >
                                                {pdfLoadingId === emp.id
                                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    : <FileText className="h-3.5 w-3.5" />
                                                }
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-medium">
                                            {emp.department || '-'}
                                        </td>
                                        {/* Special Leave */}
                                        <td className="px-6 py-4 whitespace-nowrap text-center font-mono text-slate-600">
                                            {emp.leaveBalance ? emp.leaveBalance.annual.entitlement : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center font-mono text-orange-600">
                                            {emp.leaveBalance ? emp.leaveBalance.annual.used : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center font-mono text-rose-600">
                                            {emp.leaveBalance ? emp.leaveBalance.annual.cashout : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center font-mono font-bold text-emerald-600">
                                            {emp.leaveBalance ? emp.leaveBalance.annual.remaining : '-'}
                                        </td>
                                        {/* Compensatory Leave */}
                                        <td className="px-6 py-4 whitespace-nowrap text-center font-mono text-slate-600 bg-slate-50/30">
                                            {emp.leaveBalance ? emp.leaveBalance.compensatory.entitlement : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center font-mono text-orange-600 bg-slate-50/30">
                                            {emp.leaveBalance ? emp.leaveBalance.compensatory.used : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center font-mono text-rose-600 bg-slate-50/30">
                                            {emp.leaveBalance ? emp.leaveBalance.compensatory.cashout : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center font-mono font-bold text-purple-600 bg-slate-50/30">
                                            {emp.leaveBalance ? emp.leaveBalance.compensatory.remaining : '-'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedEmployeeDetails && (
                <LeaveBalanceDetailModal 
                    employee={selectedEmployeeDetails} 
                    onClose={() => setSelectedEmployeeDetails(null)} 
                />
            )}
        </div>
    );
};

export default AdminLeaveStatsPage;

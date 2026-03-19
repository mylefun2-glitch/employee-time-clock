import React, { useState, useEffect, useCallback } from 'react';
import { useEmployee } from '../../contexts/EmployeeContext';
import { supabase } from '../../lib/supabase';
import { getEmployeeMakeupRequests, getEmployeeLeaveBalances } from '../../services/employee';
import { getSubordinates } from '../../services/supervisorService';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import MakeupRequestForm from '../../components/MakeupRequestForm';
import { requestService } from '../../services/requestService';
import { LeaveBalance, LeaveRequest, RequestStatus } from '../../types';
import TableHeaderFilter from '../../components/ui/TableHeaderFilter';
import { useMemo } from 'react';
import { Employee } from '../../types';
import ModificationRequestForm from '../../components/ModificationRequestForm';
import { formatDateTimeRange } from '../../lib/hrUtils';

type TabType = 'overview' | 'records' | 'makeup' | 'leave';

const EmployeeAttendancePage: React.FC = () => {
    const { employee } = useEmployee();
    const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
    const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
    const [stats, setStats] = useState({
        totalDays: 0,
        checkIns: 0,
        checkOuts: 0,
        avgCheckInTime: '--:--'
    });
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [showMakeupForm, setShowMakeupForm] = useState(false);
    const [makeupRequests, setMakeupRequests] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [subordinates, setSubordinates] = useState<any[]>([]);
    const [viewingEmployeeId, setViewingEmployeeId] = useState<string | null>(employee?.id || null);
    const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);

    // --- Leave Balance States ---
    const [leaveBalance, setLeaveBalance] = useState<LeaveBalance | null>(null);
    const [selectedPeriod, setSelectedPeriod] = useState<any | null>(null);
    const [periodRecords, setPeriodRecords] = useState<{ requests: LeaveRequest[], adjustments: any[], overtimeRecords: LeaveRequest[] }>({ requests: [], adjustments: [], overtimeRecords: [] });
    const [loadingRecords, setLoadingRecords] = useState(false);
    const [actionMenuRecord, setActionMenuRecord] = useState<LeaveRequest | null>(null);
    const [showActionMenu, setShowActionMenu] = useState(false);
    const [withdrawingRecord, setWithdrawingRecord] = useState<LeaveRequest | null>(null);
    const [modifyingRecord, setModifyingRecord] = useState<LeaveRequest | null>(null);
    const [isWithdrawing, setIsWithdrawing] = useState(false);

    // --- Anniversary Table Filtering & Sorting States ---
    const [columnFilters, setColumnFilters] = useState<{
        milestone: string[];
    }>({
        milestone: []
    });
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({
        key: 'start_date',
        direction: 'desc'
    });

    // --- Compensatory Table Filtering & Sorting States ---
    const [compColumnFilters, setCompColumnFilters] = useState<{
        milestone: string[];
    }>({
        milestone: []
    });
    const [compSortConfig, setCompSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({
        key: 'start_date',
        direction: 'desc'
    });

    const handleSort = (key: string) => {
        setSortConfig(prev => {
            if (prev?.key === key) {
                return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
            }
            return { key, direction: 'desc' };
        });
    };

    const handleCompSort = (key: string) => {
        setCompSortConfig(prev => {
            if (prev?.key === key) {
                return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
            }
            return { key, direction: 'desc' };
        });
    };

    const filteredAndSortedCompPeriods = useMemo(() => {
        if (!leaveBalance?.compensatory?.periods) return [];

        let result = [...leaveBalance.compensatory.periods];

        if (compColumnFilters.milestone.length > 0) {
            result = result.filter(p =>
                compColumnFilters.milestone.map(v => v.trim()).includes(p.label.trim())
            );
        }

        if (compSortConfig) {
            result.sort((a: any, b: any) => {
                const aValue = a[compSortConfig.key];
                const bValue = b[compSortConfig.key];

                if (typeof aValue === 'number' && typeof bValue === 'number') {
                    return compSortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
                }

                const strA = String(aValue || '');
                const strB = String(bValue || '');
                return compSortConfig.direction === 'asc'
                    ? strA.localeCompare(strB, 'zh-TW')
                    : strB.localeCompare(strA, 'zh-TW');
            });
        }

        return result;
    }, [leaveBalance, compColumnFilters, compSortConfig]);

    const filteredAndSortedPeriods = useMemo(() => {
        if (!leaveBalance?.annual?.periods) return [];

        let result = [...leaveBalance.annual.periods];

        // 應用里程碑篩選
        if (columnFilters.milestone.length > 0) {
            result = result.filter(p =>
                columnFilters.milestone.map(v => v.trim()).includes(p.label.trim())
            );
        }

        // 應用排序
        if (sortConfig) {
            result.sort((a: any, b: any) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];

                if (typeof aValue === 'number' && typeof bValue === 'number') {
                    return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
                }

                const strA = String(aValue || '');
                const strB = String(bValue || '');
                return sortConfig.direction === 'asc'
                    ? strA.localeCompare(strB, 'zh-TW')
                    : strB.localeCompare(strA, 'zh-TW');
            });
        }

        return result;
    }, [leaveBalance, columnFilters, sortConfig]);

    useEffect(() => {
        if (employee?.id && !viewingEmployeeId) {
            setViewingEmployeeId(employee.id);
        }
    }, [employee?.id, viewingEmployeeId]);

    // Fetch leave balance and employee data when viewingEmployeeId changes
    useEffect(() => {
        const targetId = viewingEmployeeId === 'all' ? employee?.id : viewingEmployeeId;
        if (targetId) {
            getEmployeeLeaveBalances(targetId).then(setLeaveBalance);
            // Fetch viewing employee details to get standard_daily_hours
            supabase.from('employees').select('*').eq('id', targetId).single().then(({ data }) => {
                if (data) setViewingEmployee(data);
            });
        }
    }, [viewingEmployeeId, employee?.id]);

    const fetchPeriodDetails = async (period: any, leaveType: 'ANNUAL' | 'TOIL' = 'ANNUAL') => {
        const targetId = viewingEmployeeId === 'all' ? employee?.id : viewingEmployeeId;
        if (!targetId) return;
        setSelectedPeriod({ ...period, leaveType }); // Store leaveType in selectedPeriod for title display
        try {
            const codes = [leaveType];
            const promises: Promise<any>[] = [
                requestService.getLeaveRequestsByRange(targetId, period.start_date, period.end_date, codes),
                requestService.getAdjustmentsByRange(targetId, period.start_date, period.end_date, leaveType)
            ];

            // 如果是補休,額外查詢加班紀錄
            if (leaveType === 'TOIL') {
                promises.push(requestService.getOvertimeRequestsByRange(targetId, period.start_date, period.end_date));
            }

            const results = await Promise.all(promises);
            let [requests, adjustments, overtimeRecords = []] = results;

            // --- 將加班折算移出 overtimeRecords 並加入 requests ---
            if (leaveType === 'TOIL' && overtimeRecords.length > 0) {
                // 識別折算紀錄 (ALC 或名稱包含折算)
                const conversionRecords = overtimeRecords.filter((req: LeaveRequest) =>
                    req.leave_type?.code === 'ALC' || req.leave_type?.name?.includes('折算')
                );

                // 剩下的才是純加班 (OT)
                const pureOvertime = overtimeRecords.filter((req: LeaveRequest) =>
                    !(req.leave_type?.code === 'ALC' || req.leave_type?.name?.includes('折算'))
                );

                // 合併並排序 (由新到舊)
                requests = [...requests, ...conversionRecords].sort((a: any, b: any) =>
                    new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
                );

                overtimeRecords = pureOvertime;
            }

            setPeriodRecords({ requests, adjustments, overtimeRecords });
        } catch (error) {
            console.error('Error fetching period details:', error);
        } finally {
            setLoadingRecords(false);
        }
    };

    const handleWithdraw = async () => {
        if (!employee || !withdrawingRecord) return;
        setIsWithdrawing(true);
        try {
            const result = await requestService.withdrawRequest(withdrawingRecord.id, employee.id);
            if (result.success) {
                setWithdrawingRecord(null);
                // Refresh data
                if (selectedPeriod) {
                    fetchPeriodDetails(selectedPeriod, selectedPeriod.leaveType);
                }
                getEmployeeLeaveBalances(viewingEmployeeId === 'all' ? (employee?.id || '') : viewingEmployeeId!).then(setLeaveBalance);
            } else {
                alert('撤回失敗：' + (result.error || '未知錯誤'));
            }
        } catch (error) {
            console.error('Error withdrawing request:', error);
            alert('系統錯誤，請稍後再試');
        } finally {
            setIsWithdrawing(false);
        }
    };

    const fetchSubordinates = useCallback(async () => {
        if (!employee?.is_supervisor) return;
        const data = await getSubordinates(employee.id);
        setSubordinates(data);
    }, [employee]);

    useEffect(() => {
        fetchSubordinates();
    }, [fetchSubordinates]);

    const fetchAttendance = useCallback(async (isSilent = false) => {
        if (!employee) return;

        if (!isSilent) setLoading(true);
        try {
            const startOfMonth = new Date(selectedMonth + '-01');
            const endOfMonth = new Date(startOfMonth);
            endOfMonth.setMonth(endOfMonth.getMonth() + 1);

            const isAllMode = viewingEmployeeId === 'all';
            const targetIds = isAllMode
                ? [employee.id, ...subordinates.map(s => s.id)]
                : [viewingEmployeeId || employee.id];

            // 獲取打卡記錄
            const { data: attendanceData, error: attendanceError } = await supabase
                .from('attendance_logs')
                .select(`
                    *,
                    employee:employees(name, department)
                `)
                .in('employee_id', targetIds)
                .gte('timestamp', startOfMonth.toISOString())
                .lt('timestamp', endOfMonth.toISOString())
                .order('timestamp', { ascending: false });

            if (attendanceError) throw attendanceError;

            // 獲取請假記錄
            const { data: leaveData, error: leaveError } = await supabase
                .from('leave_requests')
                .select(`
                    *,
                    employee:employees!leave_requests_employee_id_fkey(name, department),
                    leave_type:leave_types(*),
                    deputy:employees!leave_requests_deputy_id_fkey(id, name, department)
                `)
                .in('employee_id', targetIds)
                .eq('status', 'APPROVED')
                .gte('start_date', startOfMonth.toISOString())
                .lt('start_date', endOfMonth.toISOString())
                .order('start_date', { ascending: false });

            if (leaveError) throw leaveError;

            const logs = attendanceData || [];
            setAttendanceLogs(logs);
            setLeaveRequests(leaveData || []);

            // 計算統計
            const uniqueDays = new Set(logs.map(log => new Date(log.timestamp).toDateString()));
            const checkIns = logs.filter(log => log.check_type === 'IN');
            const checkOuts = logs.filter(log => log.check_type === 'OUT');

            // 計算平均上班時間
            let avgTime = '--:--';
            if (checkIns.length > 0) {
                const totalMinutes = checkIns.reduce((sum, log) => {
                    const time = new Date(log.timestamp);
                    return sum + time.getHours() * 60 + time.getMinutes();
                }, 0);
                const avgMinutes = Math.round(totalMinutes / checkIns.length);
                const hours = Math.floor(avgMinutes / 60);
                const minutes = avgMinutes % 60;
                avgTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
            }

            setStats({
                totalDays: uniqueDays.size,
                checkIns: checkIns.length,
                checkOuts: checkOuts.length,
                avgCheckInTime: avgTime
            });

            // 獲取補登申請記錄
            let makeupData = [];
            if (isAllMode) {
                const { data, error } = await supabase
                    .from('makeup_attendance_requests')
                    .select(`
                        *,
                        employee:employees(name, department)
                    `)
                    .in('employee_id', targetIds)
                    .order('created_at', { ascending: false });
                if (error) throw error;
                makeupData = data || [];
            } else {
                makeupData = await getEmployeeMakeupRequests(targetIds[0]);
            }
            setMakeupRequests(makeupData);
        } catch (error) {
            console.error('Error fetching attendance:', error);
        } finally {
            if (!isSilent) setLoading(false);
        }
    }, [employee, selectedMonth, viewingEmployeeId, subordinates]);

    useEffect(() => {
        if (employee) {
            fetchAttendance();
        }
    }, [fetchAttendance, employee]);

    const { pullDistance, isRefreshing } = usePullToRefresh({
        onRefresh: () => fetchAttendance(true),
    });

    const groupByDateAndEmployee = (logs: any[], leaves: any[]) => {
        const grouped: {
            [key: string]: {
                [key: string]: {
                    employeeName: string,
                    department: string,
                    punches: any[],
                    leaves: any[]
                }
            }
        } = {};

        // 分組打卡記錄
        logs.forEach(log => {
            const date = new Date(log.timestamp).toLocaleDateString('en-CA');
            const empId = log.employee_id;

            if (!grouped[date]) grouped[date] = {};
            if (!grouped[date][empId]) {
                grouped[date][empId] = {
                    employeeName: log.employee?.name || '未知',
                    department: log.employee?.department || '未知',
                    punches: [],
                    leaves: []
                };
            }
            grouped[date][empId].punches.push(log);
        });

        // 分組請假記錄
        leaves.forEach(leave => {
            const startDate = new Date(leave.start_date);
            const endDate = new Date(leave.end_date);
            const empId = leave.employee_id;

            for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                const dateStr = d.toLocaleDateString('en-CA');
                if (!grouped[dateStr]) grouped[dateStr] = {};
                if (!grouped[dateStr][empId]) {
                    grouped[dateStr][empId] = {
                        employeeName: leave.employee?.name || '未知',
                        department: leave.employee?.department || '未知',
                        punches: [],
                        leaves: []
                    };
                }
                grouped[dateStr][empId].leaves.push(leave);
            }
        });

        // 對每個人的打卡按時間排序
        Object.values(grouped).forEach(dateGroup => {
            Object.values(dateGroup).forEach(empGroup => {
                empGroup.punches.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            });
        });

        return grouped;
    };

    const groupedData = groupByDateAndEmployee(attendanceLogs, leaveRequests);

    if (loading) {
        return <div className="p-4">載入中...</div>;
    }

    const statCards = [
        { name: '出勤天數', value: stats.totalDays, icon: 'calendar_month', color: 'bg-blue-500' },
        { name: '上班打卡', value: stats.checkIns, icon: 'login', color: 'bg-emerald-500' },
        { name: '下班打卡', value: stats.checkOuts, icon: 'logout', color: 'bg-orange-500' },
        { name: '平均上班', value: stats.avgCheckInTime, icon: 'schedule', color: 'bg-indigo-500' },
    ];

    const tabs = [
        { id: 'overview' as TabType, label: '統計概覽', icon: 'analytics' },
        { id: 'records' as TabType, label: '詳細記錄', icon: 'list_alt' },
        { id: 'leave' as TabType, label: '差勤額度', icon: 'event_available' },
        { id: 'makeup' as TabType, label: '補登記錄', icon: 'edit_calendar', badge: makeupRequests.length },
    ];

    const LeaveCard = ({ title, entitlement, used, remaining, cashout = 0, unit = '小時' }: { title: string, entitlement: number, used: number, remaining: number, cashout?: number, unit?: string }) => {
        // 補休卡片使用特殊格式：只顯示時數、折算、剩餘
        const isCompensatory = title === '補休';

        return (
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                <h4 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-600">event_note</span>
                    {title}
                </h4>
                {isCompensatory ? (
                    // 補休卡片：顯示時數、已使用、折算、剩餘
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="text-center p-3 bg-slate-50 rounded-xl">
                            <div className="text-xs text-slate-500 font-bold mb-1">時數</div>
                            <div className="text-xl font-black text-slate-900">{entitlement} <span className="text-xs text-slate-400">{unit}</span></div>
                        </div>
                        <div className="text-center p-3 bg-orange-50 rounded-xl">
                            <div className="text-xs text-orange-600 font-bold mb-1">已使用</div>
                            <div className="text-xl font-black text-orange-700">{used} <span className="text-xs text-orange-400">{unit}</span></div>
                        </div>
                        <div className="text-center p-3 bg-rose-50 rounded-xl">
                            <div className="text-xs text-rose-600 font-bold mb-1">折算</div>
                            <div className="text-xl font-black text-rose-700">{cashout} <span className="text-xs text-rose-400">{unit}</span></div>
                        </div>
                        <div className="text-center p-3 bg-emerald-50 rounded-xl">
                            <div className="text-xs text-emerald-600 font-bold mb-1">剩餘</div>
                            <div className="text-xl font-black text-emerald-700">{remaining} <span className="text-xs text-emerald-400">{unit}</span></div>
                        </div>
                    </div>
                ) : (
                    // 特別休假卡片：顯示總額度、已使用、折現、剩餘
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="text-center p-3 bg-slate-50 rounded-xl">
                            <div className="text-xs text-slate-500 font-bold mb-1">總額度</div>
                            <div className="text-xl font-black text-slate-900">{entitlement} <span className="text-xs text-slate-400">{unit}</span></div>
                        </div>
                        <div className="text-center p-3 bg-orange-50 rounded-xl">
                            <div className="text-xs text-orange-600 font-bold mb-1">已使用</div>
                            <div className="text-xl font-black text-orange-700">{used} <span className="text-xs text-orange-400">{unit}</span></div>
                        </div>
                        <div className="text-center p-3 bg-rose-50 rounded-xl">
                            <div className="text-xs text-rose-600 font-bold mb-1">折現</div>
                            <div className="text-xl font-black text-rose-700">{cashout} <span className="text-xs text-rose-400">{unit}</span></div>
                        </div>
                        <div className="text-center p-3 bg-emerald-50 rounded-xl">
                            <div className="text-xs text-emerald-600 font-bold mb-1">剩餘</div>
                            <div className="text-xl font-black text-emerald-700">{remaining} <span className="text-xs text-emerald-400">{unit}</span></div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-6 relative">
            {/* Pull to Refresh Indicator */}
            <div
                className="absolute left-0 right-0 flex justify-center pointer-events-none z-50 transition-transform duration-200"
                style={{
                    transform: `translateY(${pullDistance}px)`,
                    top: '-40px',
                    opacity: pullDistance > 20 ? 1 : 0
                }}
            >
                <div className="bg-white rounded-full p-2 shadow-lg border border-slate-100 flex items-center justify-center">
                    <span className={`material-symbols-outlined text-blue-600 ${isRefreshing ? 'animate-spin' : ''}`}>
                        {isRefreshing ? 'sync' : 'arrow_downward'}
                    </span>
                </div>
            </div>

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-900">差勤統計</h1>
                    <p className="text-slate-500 text-sm font-medium mt-1">追蹤您的出勤記錄與表現</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="pl-5 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm appearance-none min-w-[180px]"
                        />
                        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">calendar_view_month</span>
                    </div>
                </div>
            </div>

            {/* Employee Selector (Only for Supervisors) */}
            {employee?.is_supervisor && subordinates.length > 0 && (
                <div className="bg-white rounded-2xl border border-blue-100 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in slide-in-from-top-4 duration-500">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                            <span className="material-symbols-outlined">group</span>
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">正在查看</p>
                            <h4 className="text-sm font-black text-slate-900">
                                {viewingEmployeeId === 'all'
                                    ? '全部屬員的合併記錄'
                                    : (viewingEmployeeId === employee.id ? '我自己的記錄' : `${subordinates.find(s => s.id === viewingEmployeeId)?.name || '未知名'} 的記錄`)}
                            </h4>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-slate-500 whitespace-nowrap">切換人員：</label>
                        <select
                            value={viewingEmployeeId || employee.id}
                            onChange={(e) => setViewingEmployeeId(e.target.value)}
                            className="bg-slate-50 border-none rounded-xl px-4 py-2 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 cursor-pointer min-w-[140px]"
                        >
                            <option value={employee.id}> Myself ({employee.name}) </option>
                            <option value="all" className="text-blue-600 font-black"> 全部屬員 (Consolidated) </option>
                            <optgroup label="屬員列表">
                                {subordinates.map(sub => (
                                    <option key={sub.id} value={sub.id}>
                                        {sub.name} ({sub.department})
                                    </option>
                                ))}
                            </optgroup>
                        </select>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                {/* Tab Headers */}
                <div className="flex border-b border-slate-100 overflow-x-auto">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-6 py-4 font-bold text-sm transition-all border-b-2 whitespace-nowrap relative ${activeTab === tab.id
                                ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                                }`}
                        >
                            <span className="material-symbols-outlined text-xl">{tab.icon}</span>
                            {tab.label}
                            {tab.badge !== undefined && tab.badge > 0 && (
                                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">
                                    {tab.badge}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="p-6">
                    {/* 統計概覽 */}
                    {activeTab === 'overview' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <h3 className="text-lg font-black text-slate-900">本月統計</h3>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                {statCards.map((item) => (
                                    <div key={item.name} className="bg-gradient-to-br from-white to-slate-50 p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
                                        <div className="flex flex-col items-center text-center gap-3">
                                            <div className={`${item.color} w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg`}>
                                                <span className="material-symbols-outlined text-white text-2xl">{item.icon}</span>
                                            </div>
                                            <div>
                                                <p className="text-3xl font-black text-slate-900 leading-none mb-1">{item.value}</p>
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{item.name}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                        </div>
                    )}

                    {/* 詳細記錄 (表格視圖) */}
                    {activeTab === 'records' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="overflow-x-auto -mx-6">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-100">
                                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">日期</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">員工姓名</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">部門</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">打卡歷程時間軸 (Location)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {Object.keys(groupedData).length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="py-20 text-center">
                                                    <span className="material-symbols-outlined text-slate-200 text-6xl">event_busy</span>
                                                    <p className="text-slate-400 mt-4 font-bold">本月尚無打卡記錄</p>
                                                </td>
                                            </tr>
                                        ) : (
                                            Object.entries(groupedData)
                                                .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
                                                .map(([date, empData]) => (
                                                    Object.entries(empData).map(([empId, data]) => {
                                                        // 配對打卡紀錄 (IN/OUT)
                                                        const pairs: any[][] = [];
                                                        let currentPair: any[] = [];

                                                        data.punches.forEach(p => {
                                                            if (p.check_type === 'IN') {
                                                                if (currentPair.length > 0) pairs.push(currentPair);
                                                                currentPair = [p];
                                                            } else {
                                                                currentPair.push(p);
                                                                pairs.push(currentPair);
                                                                currentPair = [];
                                                            }
                                                        });
                                                        if (currentPair.length > 0) pairs.push(currentPair);

                                                        return (
                                                            <tr key={`${date}-${empId}`} className="hover:bg-slate-50/50 transition-colors">
                                                                <td className="px-6 py-5 align-top">
                                                                    <span className="text-sm font-bold text-slate-400 font-mono tracking-tighter">{date}</span>
                                                                </td>
                                                                <td className="px-6 py-5 align-top">
                                                                    <span className="text-base font-black text-slate-900">{data.employeeName}</span>
                                                                </td>
                                                                <td className="px-6 py-5 align-top">
                                                                    <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-black uppercase">
                                                                        {data.department}
                                                                    </span>
                                                                </td>
                                                                <td className="px-6 py-5">
                                                                    <div className="flex flex-wrap items-center gap-4">
                                                                        {data.leaves.length > 0 && (
                                                                            <div className="px-4 py-2 bg-purple-50 border border-purple-100 rounded-xl flex items-center gap-2">
                                                                                <span className="material-symbols-outlined text-purple-600 text-lg">event_available</span>
                                                                                <span className="text-sm font-black text-purple-700">{data.leaves[0].leave_type?.name}</span>
                                                                            </div>
                                                                        )}

                                                                        {pairs.map((pair, pIdx) => (
                                                                            <React.Fragment key={pIdx}>
                                                                                <div className="flex items-center gap-3">
                                                                                    {pair.map((p, idx) => (
                                                                                        <div key={p.id} className={`flex items-center gap-3 p-3 rounded-2xl border ${p.check_type === 'IN'
                                                                                            ? 'bg-emerald-50/50 border-emerald-100'
                                                                                            : 'bg-orange-50/50 border-orange-100'
                                                                                            }`}>
                                                                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${p.check_type === 'IN' ? 'bg-emerald-500' : 'bg-orange-500'
                                                                                                }`}>
                                                                                                <span className="material-symbols-outlined text-white text-sm">
                                                                                                    {p.check_type === 'IN' ? 'login' : 'logout'}
                                                                                                </span>
                                                                                            </div>
                                                                                            <div>
                                                                                                <div className="flex items-center gap-2">
                                                                                                    <span className={`text-lg font-black font-mono leading-none ${p.check_type === 'IN' ? 'text-emerald-900' : 'text-orange-900'
                                                                                                        }`}>
                                                                                                        {new Date(p.timestamp).toLocaleTimeString('zh-TW', {
                                                                                                            hour: '2-digit',
                                                                                                            minute: '2-digit',
                                                                                                            hour12: false
                                                                                                        })}
                                                                                                    </span>
                                                                                                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                                                                                                        {p.check_type === 'IN' ? '上班' : '下班'}
                                                                                                    </span>
                                                                                                </div>
                                                                                                {p.latitude ? (
                                                                                                    <a
                                                                                                        href={`https://www.google.com/maps?q=${p.latitude},${p.longitude}`}
                                                                                                        target="_blank"
                                                                                                        rel="noopener noreferrer"
                                                                                                        className="flex items-center gap-1 mt-1 text-[10px] font-bold text-slate-400 hover:text-blue-500 transition-colors border-b border-dotted border-slate-300"
                                                                                                    >
                                                                                                        <span className="material-symbols-outlined text-[12px]">location_on</span>
                                                                                                        {Number(p.latitude).toFixed(4)}, {Number(p.longitude).toFixed(4)}
                                                                                                    </a>
                                                                                                ) : (
                                                                                                    <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-rose-500">
                                                                                                        <span className="material-symbols-outlined text-[12px]">location_off</span>
                                                                                                        無法取得定位
                                                                                                    </div>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                                {pIdx < pairs.length - 1 && (
                                                                                    <span className="material-symbols-outlined text-slate-200 font-black">double_arrow</span>
                                                                                )}
                                                                            </React.Fragment>
                                                                        ))}

                                                                        {data.punches.length === 0 && data.leaves.length === 0 && (
                                                                            <span className="text-xs font-bold text-slate-300 italic">無紀錄</span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* 差勤額度 */}
                    {activeTab === 'leave' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-black text-slate-900">特休與補休額度總覽</h3>
                                <div className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full uppercase tracking-widest">
                                    Base Date: {new Date().toLocaleDateString()}
                                </div>
                            </div>

                            {leaveBalance ? (
                                <div className="space-y-8">
                                    {/* Summary Cards */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <LeaveCard
                                            title="特別休假"
                                            entitlement={leaveBalance.annual.entitlement}
                                            used={leaveBalance.annual.used}
                                            cashout={leaveBalance.annual.cashout}
                                            remaining={leaveBalance.annual.remaining}
                                        />
                                        <LeaveCard
                                            title="補休"
                                            entitlement={leaveBalance.compensatory.entitlement}
                                            used={leaveBalance.compensatory.used}
                                            cashout={leaveBalance.compensatory.cashout}
                                            remaining={leaveBalance.compensatory.remaining}
                                        />
                                    </div>


                                    {/* Balance Adjustment Tool has been moved to Admin Employee Management */}

                                    {/* Anniversary Breakdown List */}
                                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden mb-8">
                                        <div className="bg-slate-50/50 px-8 py-5 border-b border-slate-100 flex items-center gap-3">
                                            <span className="material-symbols-outlined text-blue-600 text-2xl">list_alt</span>
                                            <h4 className="font-black text-slate-900 text-lg">特休年資明細</h4>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full divide-y divide-slate-100">
                                                <thead className="bg-slate-50/30">
                                                    <tr>
                                                        <TableHeaderFilter
                                                            columnKey="label"
                                                            label="里程碑"
                                                            values={leaveBalance.annual?.periods?.map(p => p.label) || []}
                                                            selectedValues={columnFilters.milestone}
                                                            onChange={(vals) => setColumnFilters({ ...columnFilters, milestone: vals })}
                                                            sortable
                                                            sortConfig={sortConfig}
                                                            onSort={() => handleSort('label')}
                                                            className="px-8 py-5"
                                                        />
                                                        <TableHeaderFilter
                                                            columnKey="start_date"
                                                            label="有效期間"
                                                            values={[]}
                                                            selectedValues={[]}
                                                            onChange={() => { }}
                                                            sortable
                                                            sortConfig={sortConfig}
                                                            onSort={() => handleSort('start_date')}
                                                            className="px-8 py-5"
                                                        />
                                                        <TableHeaderFilter
                                                            columnKey="entitlement"
                                                            label="應得時數"
                                                            values={[]}
                                                            selectedValues={[]}
                                                            onChange={() => { }}
                                                            sortable
                                                            sortConfig={sortConfig}
                                                            onSort={() => handleSort('entitlement')}
                                                            className="px-8 py-5"
                                                        />
                                                        <TableHeaderFilter
                                                            columnKey="used"
                                                            label="已用"
                                                            values={[]}
                                                            selectedValues={[]}
                                                            onChange={() => { }}
                                                            sortable
                                                            sortConfig={sortConfig}
                                                            onSort={() => handleSort('used')}
                                                            className="px-8 py-5"
                                                        />
                                                        <TableHeaderFilter
                                                            columnKey="cashout"
                                                            label="折現"
                                                            values={[]}
                                                            selectedValues={[]}
                                                            onChange={() => { }}
                                                            sortable
                                                            sortConfig={sortConfig}
                                                            onSort={() => handleSort('cashout')}
                                                            className="px-8 py-5"
                                                        />
                                                        <TableHeaderFilter
                                                            columnKey="remaining"
                                                            label="剩餘"
                                                            values={[]}
                                                            selectedValues={[]}
                                                            onChange={() => { }}
                                                            sortable
                                                            sortConfig={sortConfig}
                                                            onSort={() => handleSort('remaining')}
                                                            className="px-8 py-5 text-emerald-600"
                                                        />
                                                        <th className="px-8 py-5 text-right text-xs font-black text-slate-400 uppercase tracking-widest">操作</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50">
                                                    {filteredAndSortedPeriods.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={7} className="px-8 py-12 text-center text-slate-400 font-bold italic">
                                                                {columnFilters.milestone.length > 0 ? '沒有符合篩選條件的資料' : '尚無年資里程碑資料'}
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        filteredAndSortedPeriods.map((period, idx) => (
                                                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                                                                <td className="px-8 py-5 whitespace-nowrap">
                                                                    <span className="font-black text-slate-900">{period.label}</span>
                                                                </td>
                                                                <td className="px-8 py-5 whitespace-nowrap">
                                                                    <div className="text-sm text-slate-500 font-bold bg-slate-100 px-3 py-1 rounded-lg inline-block">
                                                                        {period.start_date} <span className="text-slate-300 mx-1">~</span> {period.end_date}
                                                                    </div>
                                                                    {period.date_formula && (
                                                                        <div className="text-[10px] text-slate-400 font-bold mt-1 ml-1 opacity-70 italic">
                                                                            {period.date_formula}
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                <td className="px-8 py-5 whitespace-nowrap text-center font-mono font-black text-slate-600">
                                                                    <div className="font-mono font-black text-slate-600 leading-none">{period.entitlement}</div>
                                                                    {period.formula && (
                                                                        <div className="text-[10px] text-slate-400 font-bold mt-1 opacity-70">
                                                                            {period.formula}
                                                                        </div>
                                                                    )}

                                                                </td>
                                                                <td className="px-8 py-5 whitespace-nowrap text-center font-mono font-black text-orange-600">
                                                                    {period.used}
                                                                </td>
                                                                <td className="px-8 py-5 whitespace-nowrap text-center font-mono font-black text-rose-600">
                                                                    {period.cashout}
                                                                </td>
                                                                <td className="px-8 py-5 whitespace-nowrap text-center font-mono font-black text-emerald-600">
                                                                    {period.remaining}
                                                                </td>
                                                                <td className="px-8 py-5 whitespace-nowrap text-right">
                                                                    <button
                                                                        onClick={() => fetchPeriodDetails(period, 'ANNUAL')}
                                                                        className="inline-flex items-center gap-2 text-xs font-black text-blue-600 hover:text-white hover:bg-blue-600 px-4 py-2 rounded-xl transition-all border border-blue-100 group-hover:border-blue-600 shadow-sm"
                                                                    >
                                                                        <span className="material-symbols-outlined text-sm">history</span>
                                                                        查看詳細
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Compensatory Breakdown List */}
                                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                                        <div className="bg-slate-50/50 px-8 py-5 border-b border-slate-100 flex items-center gap-3">
                                            <span className="material-symbols-outlined text-orange-600 text-2xl">list_alt</span>
                                            <h4 className="font-black text-slate-900 text-lg">補休年度明細</h4>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full divide-y divide-slate-100">
                                                <thead className="bg-slate-50/30">
                                                    <tr>
                                                        <TableHeaderFilter
                                                            columnKey="label"
                                                            label="年度"
                                                            values={leaveBalance.compensatory?.periods?.map(p => p.label) || []}
                                                            selectedValues={compColumnFilters.milestone}
                                                            onChange={(vals) => setCompColumnFilters({ ...compColumnFilters, milestone: vals })}
                                                            sortable
                                                            sortConfig={compSortConfig}
                                                            onSort={() => handleCompSort('label')}
                                                            className="px-8 py-5"
                                                        />
                                                        <TableHeaderFilter
                                                            columnKey="start_date"
                                                            label="有效期間"
                                                            values={[]}
                                                            selectedValues={[]}
                                                            onChange={() => { }}
                                                            sortable
                                                            sortConfig={compSortConfig}
                                                            onSort={() => handleCompSort('start_date')}
                                                            className="px-8 py-5"
                                                        />
                                                        <TableHeaderFilter
                                                            columnKey="entitlement"
                                                            label="合計生成"
                                                            values={[]}
                                                            selectedValues={[]}
                                                            onChange={() => { }}
                                                            sortable
                                                            sortConfig={compSortConfig}
                                                            onSort={() => handleCompSort('entitlement')}
                                                            className="px-8 py-5"
                                                        />
                                                        <TableHeaderFilter
                                                            columnKey="used"
                                                            label="合計已用"
                                                            values={[]}
                                                            selectedValues={[]}
                                                            onChange={() => { }}
                                                            sortable
                                                            sortConfig={compSortConfig}
                                                            onSort={() => handleCompSort('used')}
                                                            className="px-8 py-5"
                                                        />
                                                        <TableHeaderFilter
                                                            columnKey="cashout"
                                                            label="折算"
                                                            values={[]}
                                                            selectedValues={[]}
                                                            onChange={() => { }}
                                                            sortable
                                                            sortConfig={compSortConfig}
                                                            onSort={() => handleCompSort('cashout')}
                                                            className="px-8 py-5"
                                                        />
                                                        <TableHeaderFilter
                                                            columnKey="remaining"
                                                            label="剩餘"
                                                            values={[]}
                                                            selectedValues={[]}
                                                            onChange={() => { }}
                                                            sortable
                                                            sortConfig={compSortConfig}
                                                            onSort={() => handleCompSort('remaining')}
                                                            className="px-8 py-5 text-emerald-600"
                                                        />
                                                        <th className="px-8 py-5 text-right text-xs font-black text-slate-400 uppercase tracking-widest">操作</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50">
                                                    {filteredAndSortedCompPeriods.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={7} className="px-8 py-12 text-center text-slate-400 font-bold italic">
                                                                {compColumnFilters.milestone.length > 0 ? '沒有符合篩選條件的資料' : '尚無補休年度資料'}
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        filteredAndSortedCompPeriods.map((period, idx) => (
                                                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                                                                <td className="px-8 py-5 whitespace-nowrap">
                                                                    <span className="font-black text-slate-900">{period.label}</span>
                                                                </td>
                                                                <td className="px-8 py-5 whitespace-nowrap">
                                                                    <div className="text-sm text-slate-500 font-bold bg-slate-100 px-3 py-1 rounded-lg inline-block">
                                                                        {period.start_date} <span className="text-slate-300 mx-1">~</span> {period.end_date}
                                                                    </div>
                                                                </td>
                                                                <td className="px-8 py-5 whitespace-nowrap text-center font-mono font-black text-slate-600">
                                                                    <div className="font-mono font-black text-slate-600 leading-none">{period.entitlement}</div>
                                                                    {period.formula && (
                                                                        <div className="text-[10px] text-slate-400 font-bold mt-1 opacity-70">
                                                                            {period.formula}
                                                                        </div>
                                                                    )}

                                                                </td>
                                                                <td className="px-8 py-5 whitespace-nowrap text-center font-mono font-black text-orange-600">
                                                                    {period.used}
                                                                </td>
                                                                <td className="px-8 py-5 whitespace-nowrap text-center font-mono font-black text-rose-600">
                                                                    {period.cashout}
                                                                </td>
                                                                <td className="px-8 py-5 whitespace-nowrap text-center font-mono font-black text-emerald-600">
                                                                    {period.remaining}
                                                                </td>
                                                                <td className="px-8 py-5 whitespace-nowrap text-right">
                                                                    <button
                                                                        onClick={() => fetchPeriodDetails(period, 'TOIL')}
                                                                        className="inline-flex items-center gap-2 text-xs font-black text-blue-600 hover:text-white hover:bg-blue-600 px-4 py-2 rounded-xl transition-all border border-blue-100 group-hover:border-blue-600 shadow-sm"
                                                                    >
                                                                        <span className="material-symbols-outlined text-sm">history</span>
                                                                        查看詳細
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-12 text-slate-400">
                                    載入中...
                                </div>
                            )}
                            <div className="bg-blue-50 p-6 rounded-3xl text-sm text-blue-800 border border-blue-100">
                                <p className="font-black mb-2 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-base">info</span>
                                    計薪與特休核給說明：
                                </p>
                                <ul className="list-disc list-inside space-y-2 font-bold ml-1 opacity-80">
                                    <li>特休額度依據勞基法週年制計算，系統會自動在每個年資里程碑抵達時核給。</li>
                                    <li>「期間」代表該里程碑核給時數的有效使用限制（通常為一年）。</li>
                                    <li>點擊「查看詳細」可展開檢視該時段內所有的請假申請紀錄與折現異動。</li>
                                </ul>
                            </div>
                        </div>
                    )}
                    {/* 補登記錄 */}
                    {activeTab === 'makeup' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <h3 className="text-lg font-black text-slate-900 mb-6">補登申請記錄</h3>
                            {makeupRequests.length === 0 ? (
                                <div className="py-20 text-center">
                                    <span className="material-symbols-outlined text-slate-200 text-6xl">edit_calendar</span>
                                    <p className="text-slate-400 mt-4 font-bold">尚無補登申請記錄</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto -mx-6">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-slate-100">
                                                {viewingEmployeeId === 'all' && (
                                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">員工</th>
                                                )}
                                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">類型</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">日期時間</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">申請原因</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">狀態</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">申請時間</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {makeupRequests.map((request) => {
                                                const statusBadge = {
                                                    PENDING: { text: '待審核', class: 'bg-amber-50 text-amber-700 border-amber-200' },
                                                    APPROVED: { text: '已核准', class: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                                                    REJECTED: { text: '已拒絕', class: 'bg-rose-50 text-rose-700 border-rose-200' }
                                                }[request.status] || { text: '未知', class: 'bg-slate-50 text-slate-700 border-slate-200' };

                                                return (
                                                    <tr key={request.id} className="hover:bg-slate-50/50 transition-colors">
                                                        {viewingEmployeeId === 'all' && (
                                                            <td className="px-6 py-4 align-top">
                                                                <div>
                                                                    <p className="text-sm font-black text-slate-900">{request.employee?.name || '未知'}</p>
                                                                    <p className="text-xs text-slate-400">{request.employee?.department || ''}</p>
                                                                </div>
                                                            </td>
                                                        )}
                                                        <td className="px-6 py-4 align-top">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`material-symbols-outlined text-lg ${request.check_type === 'IN' ? 'text-emerald-600' : 'text-orange-600'}`}>
                                                                    {request.check_type === 'IN' ? 'login' : 'logout'}
                                                                </span>
                                                                <span className="text-sm font-bold text-slate-700">
                                                                    {request.check_type === 'IN' ? '上班打卡' : '下班打卡'}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 align-top">
                                                            <p className="text-sm font-bold text-slate-900 font-mono">
                                                                {new Date(request.request_date).toLocaleDateString('zh-TW')}
                                                            </p>
                                                            <p className="text-xs text-slate-500 font-mono">
                                                                {request.request_time}
                                                            </p>
                                                        </td>
                                                        <td className="px-6 py-4 align-top">
                                                            <p className="text-sm text-slate-700 max-w-xs">{request.reason}</p>
                                                            {request.review_comment && (
                                                                <p className="text-xs text-amber-600 mt-1 italic">備註：{request.review_comment}</p>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 align-top">
                                                            <span className={`px-3 py-1 text-xs font-black rounded-lg border whitespace-nowrap ${statusBadge.class}`}>
                                                                {statusBadge.text}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 align-top">
                                                            <p className="text-xs text-slate-400 font-mono whitespace-nowrap">
                                                                {new Date(request.created_at).toLocaleString('zh-TW', {
                                                                    year: 'numeric',
                                                                    month: '2-digit',
                                                                    day: '2-digit',
                                                                    hour: '2-digit',
                                                                    minute: '2-digit'
                                                                })}
                                                            </p>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Makeup Request Form Modal */}
            {showMakeupForm && employee && (
                <MakeupRequestForm
                    employeeId={employee.id}
                    onClose={() => setShowMakeupForm(false)}
                    onSuccess={() => {
                        setShowMakeupForm(false);
                        fetchAttendance();
                    }}
                />
            )}

            {/* Leave Details Modal */}
            {selectedPeriod && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedPeriod(null)}></div>
                    <div className="relative bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-300">
                        {/* Modal Header */}
                        <div className="bg-slate-50 px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-black text-slate-900">{selectedPeriod.label} {selectedPeriod.leaveType === 'TOIL' ? '補休明細' : '特休明細'}</h3>
                                <p className="text-xs text-slate-500 font-bold mt-1">期間：{selectedPeriod.start_date} ~ {selectedPeriod.end_date}</p>
                            </div>
                            <button onClick={() => setSelectedPeriod(null)} className="w-10 h-10 flex items-center justify-center rounded-2xl hover:bg-slate-200 text-slate-400 transition-all">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
                            {loadingRecords ? (
                                <div className="text-center py-12 text-slate-400 font-bold">載入中...</div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Requests */}
                                    <div>
                                        <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <span className="material-symbols-outlined text-orange-500 text-lg">event</span>
                                            請假紀錄
                                        </h4>
                                        {periodRecords.requests.length === 0 ? (
                                            <p className="text-slate-400 font-bold italic text-center py-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-sm">此期間尚無請假紀錄</p>
                                        ) : (
                                            <div className="bg-slate-50 rounded-2xl overflow-hidden border border-slate-100">
                                                <div className="divide-y divide-slate-100">
                                                    {periodRecords.requests.map((req) => {
                                                        const isConversion = req.leave_type?.code === 'ALC' || req.leave_type?.name?.includes('折算');
                                                        return (
                                                            <div key={req.id} className="flex items-center justify-between p-4 hover:bg-slate-100/50 transition-colors cursor-pointer group/item" onClick={() => {
                                                                setActionMenuRecord(req);
                                                                setShowActionMenu(true);
                                                            }}>
                                                                <div className="flex items-center gap-4">
                                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isConversion ? 'bg-blue-100' : 'bg-orange-100'} group-hover/item:bg-slate-200 transition-colors`}>
                                                                        <span className={`material-symbols-outlined ${isConversion ? 'text-blue-600' : 'text-orange-600'} text-xl`}>
                                                                            {isConversion ? 'schedule' : 'event_available'}
                                                                        </span>
                                                                    </div>
                                                                    <div>
                                                                        <div className="font-black text-slate-900">{req.leave_type?.name || (isConversion ? '加班折算' : '特休')}</div>
                                                                        <div className="text-xs text-slate-500 font-bold">
                                                                            {new Date(req.start_date).toLocaleDateString('zh-TW')} {new Date(req.start_date).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="text-right">
                                                                    <div className={`font-mono font-black ${isConversion ? 'text-blue-600' : 'text-orange-600'}`}>
                                                                        {isConversion ? '+' : '-'}{req.hours} 小時
                                                                    </div>
                                                                    {req.reason && <div className="text-[10px] text-slate-400 font-bold truncate max-w-[150px]">{req.reason}</div>}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Adjustments (Cashout) */}
                                    <div>
                                        <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <span className="material-symbols-outlined text-rose-500 text-lg">payments</span>
                                            折現/額度調整
                                        </h4>
                                        {periodRecords.adjustments.length === 0 ? (
                                            <p className="text-slate-400 font-bold italic text-center py-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-sm">此期間尚無折現或調整紀錄</p>
                                        ) : (
                                            <div className="bg-slate-50 rounded-2xl overflow-hidden border border-slate-100">
                                                <div className="divide-y divide-slate-100">
                                                    {periodRecords.adjustments.map((adj) => (
                                                        <div key={adj.id} className="flex items-center justify-between p-4 hover:bg-slate-100/50 transition-colors">
                                                            <div className="flex items-center gap-4">
                                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${adj.adjustment_type === 'CASHOUT' ? 'bg-rose-100' : 'bg-blue-100'}`}>
                                                                    <span className={`material-symbols-outlined text-xl ${adj.adjustment_type === 'CASHOUT' ? 'text-rose-600' : 'text-blue-600'}`}>
                                                                        {adj.adjustment_type === 'CASHOUT' ? 'payments' : adj.adjustment_type === 'GRANT' ? 'add_circle' : 'edit_calendar'}
                                                                    </span>
                                                                </div>
                                                                <div>
                                                                    <div className="font-black text-slate-900">
                                                                        {adj.adjustment_type === 'CASHOUT' ? '額度折現' : adj.adjustment_type === 'GRANT' ? '額度核給' : '額度修正'}
                                                                    </div>
                                                                    <div className="text-xs text-slate-500 font-bold">
                                                                        {new Date(adj.created_at).toLocaleDateString('zh-TW')} {new Date(adj.created_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className={`font-mono font-black ${adj.adjustment_type === 'CASHOUT' ? 'text-rose-600' : 'text-blue-600'}`}>
                                                                    {adj.adjustment_type === 'CASHOUT' ? '-' : '+'}{adj.amount_hours} 小時
                                                                </div>
                                                                {adj.reason && <div className="text-[10px] text-slate-400 font-bold truncate max-w-[150px]">{adj.reason}</div>}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Overtime Records (僅補休明細顯示) */}
                                    {selectedPeriod.leaveType === 'TOIL' && (
                                        <div>
                                            <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                <span className="material-symbols-outlined text-blue-500 text-lg">schedule</span>
                                                加班紀錄
                                            </h4>
                                            {periodRecords.overtimeRecords.length === 0 ? (
                                                <p className="text-slate-400 font-bold italic text-center py-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-sm">此期間尚無加班紀錄</p>
                                            ) : (
                                                <div className="bg-slate-50 rounded-2xl overflow-hidden border border-slate-100">
                                                    <div className="divide-y divide-slate-100">
                                                        {periodRecords.overtimeRecords.map((req) => (
                                                            <div key={req.id} className="flex items-center justify-between p-4 hover:bg-slate-100/50 transition-colors cursor-pointer group/item" onClick={() => {
                                                                setActionMenuRecord(req);
                                                                setShowActionMenu(true);
                                                            }}>
                                                                <div className="flex items-center gap-4">
                                                                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center group-hover/item:bg-blue-200 transition-colors">
                                                                        <span className="material-symbols-outlined text-blue-600 text-xl">schedule</span>
                                                                    </div>
                                                                    <div>
                                                                        <div className="font-black text-slate-900">{req.leave_type?.name || '加班'}</div>
                                                                        <div className="text-xs text-slate-500 font-bold">
                                                                            {new Date(req.start_date).toLocaleDateString('zh-TW')} {new Date(req.start_date).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}
                                                                            {' ~ '}
                                                                            {new Date(req.end_date).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="text-right">
                                                                    <div className="font-mono font-black text-blue-600">
                                                                        +{req.hours} 小時
                                                                    </div>
                                                                    {req.reason && <div className="text-[10px] text-slate-400 font-bold truncate max-w-[150px]">{req.reason}</div>}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Action Menu Modal */}
            {showActionMenu && actionMenuRecord && (
                <div
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4 animate-in fade-in duration-300"
                    onClick={() => setShowActionMenu(false)}
                >
                    <div
                        className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm p-8 animate-in zoom-in-95 duration-300 text-center"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* 紀錄資訊 */}
                        <div className="mb-8 items-center flex flex-col">
                            <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center text-blue-600 border border-blue-100 mb-6 font-light">
                                <span className="material-symbols-outlined text-4xl">fact_check</span>
                            </div>
                            <h2 className="text-2xl font-black text-slate-900 mb-2">紀錄操作</h2>
                            <div className="flex flex-col gap-2 items-center">
                                <span className="font-bold text-blue-600 bg-blue-50 px-4 py-1 rounded-full text-xs">
                                    {actionMenuRecord.leave_type?.name || '差勤紀錄'}
                                </span>
                                <div className="text-xs text-slate-500 font-medium bg-slate-50 px-4 py-2 rounded-full mt-1">
                                    {formatDateTimeRange(actionMenuRecord.start_date, actionMenuRecord.end_date)}
                                </div>
                            </div>
                        </div>

                        {/* 操作按鈕 */}
                        <div className="flex flex-col gap-4">
                            <button
                                onClick={() => {
                                    setModifyingRecord(actionMenuRecord);
                                    setShowActionMenu(false);
                                }}
                                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black shadow-lg shadow-slate-200 transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined text-lg">edit</span>
                                申請變更
                            </button>
                            <button
                                onClick={() => {
                                    setWithdrawingRecord(actionMenuRecord);
                                    setShowActionMenu(false);
                                }}
                                className="w-full py-4 bg-white text-rose-600 border-2 border-rose-200 rounded-2xl font-black hover:bg-rose-50 transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined text-lg">undo</span>
                                撤回紀錄
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Withdraw Confirmation Dialog */}
            {withdrawingRecord && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[120] p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-sm w-full p-8 animate-in zoom-in-95 duration-300 text-center">
                        <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
                            <span className="material-symbols-outlined text-4xl">help</span>
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 mb-2">確認撤回？</h2>
                        <p className="text-slate-500 font-bold mb-8 px-4">
                            您確定要撤回此紀錄嗎？撤回後額度將會重新計算。
                        </p>
                        <div className="flex gap-4">
                            <button
                                onClick={() => setWithdrawingRecord(null)}
                                className="flex-1 py-4 bg-slate-50 text-slate-500 rounded-2xl font-black transition-all hover:bg-slate-100"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleWithdraw}
                                disabled={isWithdrawing}
                                className="flex-1 py-4 rounded-2xl font-black text-white bg-rose-600 shadow-xl shadow-rose-100 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {isWithdrawing ? '處理中...' : '確定撤回'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modification Form Modal */}
            {modifyingRecord && employee && (
                <ModificationRequestForm
                    originalRequest={modifyingRecord}
                    employeeId={employee.id}
                    onClose={() => setModifyingRecord(null)}
                    onSuccess={() => {
                        setModifyingRecord(null);
                        if (selectedPeriod) {
                            fetchPeriodDetails(selectedPeriod, selectedPeriod.leaveType);
                        }
                        const targetId = viewingEmployeeId === 'all' ? (employee?.id || '') : viewingEmployeeId;
                        if (targetId) {
                            getEmployeeLeaveBalances(targetId).then(setLeaveBalance);
                        }
                    }}
                />
            )}
        </div>
    );
};

export default EmployeeAttendancePage;

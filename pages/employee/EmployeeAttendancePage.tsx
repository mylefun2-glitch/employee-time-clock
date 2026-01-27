import React, { useEffect, useState, useCallback } from 'react';
import { useEmployee } from '../../contexts/EmployeeContext';
import { supabase } from '../../lib/supabase';
import MakeupRequestForm from '../../components/MakeupRequestForm';
import { getEmployeeMakeupRequests } from '../../services/employee';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { getSubordinates } from '../../services/supervisorService';

type TabType = 'overview' | 'records' | 'makeup';

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

    useEffect(() => {
        if (employee?.id && !viewingEmployeeId) {
            setViewingEmployeeId(employee.id);
        }
    }, [employee?.id, viewingEmployeeId]);

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
                    employee:employees(name, department),
                    leave_type:leave_types(*)
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
        { id: 'makeup' as TabType, label: '補登記錄', icon: 'edit_calendar', badge: makeupRequests.length },
    ];

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
                    <button
                        onClick={() => setShowMakeupForm(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-xl font-bold shadow-md hover:bg-purple-700 transition-all"
                    >
                        <span className="material-symbols-outlined text-lg">edit_calendar</span>
                        <span className="hidden sm:inline">申請補卡</span>
                    </button>
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
                                                                                                {p.latitude && (
                                                                                                    <a
                                                                                                        href={`https://www.google.com/maps?q=${p.latitude},${p.longitude}`}
                                                                                                        target="_blank"
                                                                                                        rel="noopener noreferrer"
                                                                                                        className="flex items-center gap-1 mt-1 text-[10px] font-bold text-slate-400 hover:text-blue-500 transition-colors border-b border-dotted border-slate-300"
                                                                                                    >
                                                                                                        <span className="material-symbols-outlined text-[12px]">location_on</span>
                                                                                                        {Number(p.latitude).toFixed(4)}, {Number(p.longitude).toFixed(4)}
                                                                                                    </a>
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
                                <div className="space-y-4">
                                    {makeupRequests.map((request) => {
                                        const statusBadge = {
                                            PENDING: { text: '待審核', class: 'bg-amber-50 text-amber-700 border-amber-200' },
                                            APPROVED: { text: '已核准', class: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                                            REJECTED: { text: '已拒絕', class: 'bg-rose-50 text-rose-700 border-rose-200' }
                                        }[request.status] || { text: '未知', class: 'bg-slate-50 text-slate-700 border-slate-200' };

                                        return (
                                            <div key={request.id} className="bg-white rounded-2xl border border-slate-100 p-6 hover:shadow-md transition-all">
                                                <div className="flex items-start justify-between gap-4 mb-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${request.check_type === 'IN' ? 'bg-emerald-100' : 'bg-orange-100'
                                                            }`}>
                                                            <span className={`material-symbols-outlined text-2xl ${request.check_type === 'IN' ? 'text-emerald-600' : 'text-orange-600'
                                                                }`}>
                                                                {request.check_type === 'IN' ? 'login' : 'logout'}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            {viewingEmployeeId === 'all' && (
                                                                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">
                                                                    {request.employee?.name || '未知人員'}
                                                                </p>
                                                            )}
                                                            <p className="font-black text-slate-900">
                                                                {request.check_type === 'IN' ? '上班打卡' : '下班打卡'}
                                                            </p>
                                                            <p className="text-sm text-slate-500 font-medium">
                                                                {new Date(request.request_date).toLocaleDateString('zh-TW')} {request.request_time}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <span className={`px-3 py-1 text-xs font-black rounded-lg border ${statusBadge.class}`}>
                                                        {statusBadge.text}
                                                    </span>
                                                </div>

                                                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                                    <p className="text-xs font-bold text-slate-400 mb-1">申請原因</p>
                                                    <p className="text-sm text-slate-700">{request.reason}</p>
                                                </div>

                                                {request.review_comment && (
                                                    <div className="mt-3 bg-amber-50 rounded-xl p-4 border border-amber-200">
                                                        <p className="text-xs font-bold text-amber-600 mb-1">審核備註</p>
                                                        <p className="text-sm text-amber-700">{request.review_comment}</p>
                                                    </div>
                                                )}

                                                <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                                                    <span>申請時間：{new Date(request.created_at).toLocaleString('zh-TW')}</span>
                                                    {request.reviewed_at && (
                                                        <span>審核時間：{new Date(request.reviewed_at).toLocaleString('zh-TW')}</span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
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
        </div>
    );
};

export default EmployeeAttendancePage;

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useEmployee } from '../../contexts/EmployeeContext';
import { supabase } from '../../lib/supabase';
import { getPendingApprovalsForSupervisor } from '../../services/supervisorService';
import { requestService } from '../../services/requestService';
import { RequestStatus } from '../../types';

const EmployeeDashboardPage: React.FC = () => {
    const { employee } = useEmployee();
    const [stats, setStats] = useState({
        attendanceDays: 0,
        leaveDays: 0,
        pendingRequests: 0,
        pendingApprovals: 0
    });
    const [recentRequests, setRecentRequests] = useState<any[]>([]);
    const [todayLeaveEmployees, setTodayLeaveEmployees] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    // 分頁狀態
    const [currentDeptPage, setCurrentDeptPage] = useState(1);
    const [currentRecentPage, setCurrentRecentPage] = useState(1);
    
    // 版本更新紀錄對話框狀態
    const [showChangelog, setShowChangelog] = useState(false);

    // 審核對話框狀態
    const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
    const [processing, setProcessing] = useState(false);
    const [resultDialog, setResultDialog] = useState<{
        show: boolean;
        success: boolean;
        message: string;
    }>({ show: false, success: false, message: '' });

    const renderLeaveTime = (startDate: string, endDate: string) => {
        const start = new Date(startDate);
        const end = new Date(endDate);

        const startPeriod = start.toLocaleDateString('zh-TW');
        const endPeriod = end.toLocaleDateString('zh-TW');

        const startTimeStr = start.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
        const endTimeStr = end.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });

        const diffMs = end.getTime() - start.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        const roundedHours = Math.round(diffHours * 10) / 10;

        if (startPeriod === endPeriod) {
            return (
                <>
                    {startPeriod} {startTimeStr} <span className="text-slate-300 mx-2">→</span> {endTimeStr} <span className="text-slate-400 font-bold ml-1">共{roundedHours}H</span>
                </>
            );
        } else {
            return (
                <>
                    {startPeriod} {startTimeStr} <span className="text-slate-300 mx-2">→</span> {endPeriod} {endTimeStr} <span className="text-slate-400 font-bold ml-1">共{roundedHours}H</span>
                </>
            );
        }
    };

    useEffect(() => {
        if (employee) {
            fetchData();
        }
    }, [employee]);

    const fetchData = async () => {
        if (!employee) return;

        try {
            // 獲取本月統計
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);

            // 出勤天數
            const { data: attendanceData } = await supabase
                .from('attendance_logs')
                .select('timestamp')
                .eq('employee_id', employee.id)
                .gte('timestamp', startOfMonth.toISOString());

            const uniqueDays = new Set(
                (attendanceData || []).map(log => new Date(log.timestamp).toDateString())
            );

            // 請假記錄
            const { data: leaveData } = await supabase
                .from('leave_requests')
                .select(`
                    *,
                    leave_type:leave_types(*)
                `)
                .eq('employee_id', employee.id)
                .order('created_at', { ascending: false })
                .limit(5);

            const pendingCount = (leaveData || []).filter(r => r.status === 'PENDING').length;


            // 主管待審核
            let pendingApprovals = 0;
            let pendingApprovalsList: any[] = [];
            if (employee.is_supervisor) {
                const { count, requests } = await getPendingApprovalsForSupervisor(employee.id);
                pendingApprovals = count;
                pendingApprovalsList = requests || [];
            }
            if (employee.is_chairman) {
                const chairmanPending = await requestService.getChairmanPendingRequests();
                const existingIds = new Set(pendingApprovalsList.map(r => r.id));
                const uniqueChairmanPending = (chairmanPending || []).filter(r => !existingIds.has(r.id));
                pendingApprovalsList = [...pendingApprovalsList, ...uniqueChairmanPending];
                pendingApprovals = pendingApprovalsList.length;
            }

            // 獲取當天請假的同部門員工(所有人都能看到)
            const { data: departmentColleagues } = await supabase
                .from('employees')
                .select('id')
                .eq('department', employee.department)
                .neq('id', employee.id); // 排除自己

            console.log('當前部門:', employee.department);
            console.log('同部門人數:', departmentColleagues?.length || 0);

            if (departmentColleagues && departmentColleagues.length > 0) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);

                const colleagueIds = departmentColleagues.map(c => c.id);

                const { data: todayLeaves, error } = await supabase
                    .from('leave_requests')
                    .select(`
                        *,
                        employee:employees!leave_requests_employee_id_fkey(id, name, department),
                        leave_type:leave_types(*)
                    `)
                    .eq('status', 'APPROVED')
                    .lte('start_date', tomorrow.toISOString())
                    .gte('end_date', today.toISOString())
                    .in('employee_id', colleagueIds);

                console.log('今日請假查詢錯誤:', error);

                // 依請假開始時間進行降序排序 (從晚到早，時間遞減)
                const sortedLeaves = (todayLeaves || []).sort((a: any, b: any) => {
                    return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
                });
                console.log('今日請假人數 (已降序排序):', sortedLeaves.length);

                setTodayLeaveEmployees(sortedLeaves);
                setCurrentDeptPage(1); // 重新獲取資料時重設頁碼
            } else {
                console.log('沒有找到同部門員工');
                setTodayLeaveEmployees([]);
                setCurrentDeptPage(1);
            }

            setStats({
                attendanceDays: uniqueDays.size,
                leaveDays: (leaveData || []).filter(r => r.status === 'APPROVED').length,
                pendingRequests: pendingCount,
                pendingApprovals
            });

            // 合併自己申請的與下屬待審核的
            const combinedRequests = [
                ...(leaveData || []).filter(r => r.status !== 'WITHDRAWN'),
                ...pendingApprovalsList
            ];

            // 去除重複 ID
            const uniqueRequests = Array.from(new Map(combinedRequests.map(r => [r.id, r])).values());

            // 依建立時間或開始時間進行降序排序 (最近在最上面)
            const sortedRequests = uniqueRequests.sort((a: any, b: any) => {
                const dateA = new Date(a.created_at || a.start_date).getTime();
                const dateB = new Date(b.created_at || b.start_date).getTime();
                return dateB - dateA;
            });

            setRecentRequests(sortedRequests);
            setCurrentRecentPage(1); // 重新獲取資料時重設頁碼
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="p-4 text-center font-bold text-slate-400 py-20">載入中...</div>;
    }

    const ITEMS_PER_PAGE = 5;

    // 今日部門動態分頁計算
    const totalDeptPages = Math.ceil(todayLeaveEmployees.length / ITEMS_PER_PAGE);
    const paginatedDeptLeaves = todayLeaveEmployees.slice(
        (currentDeptPage - 1) * ITEMS_PER_PAGE,
        currentDeptPage * ITEMS_PER_PAGE
    );

    // 最近申請動態分頁計算
    const totalRecentPages = Math.ceil(recentRequests.length / ITEMS_PER_PAGE);
    const paginatedRecentRequests = recentRequests.slice(
        (currentRecentPage - 1) * ITEMS_PER_PAGE,
        currentRecentPage * ITEMS_PER_PAGE
    );

    interface StatCard {
        name: string;
        value: number;
        unit: string;
        icon: string;
        color: string;
        highlight?: boolean;
    }

    const statCards: StatCard[] = [
        { name: '本月出勤', value: stats.attendanceDays, unit: '天', icon: 'today', color: 'from-blue-600 to-blue-700' },
        { name: '本月請假', value: stats.leaveDays, unit: '天', icon: 'description', color: 'from-emerald-500 to-emerald-600' },
        { name: '待審核申請', value: stats.pendingRequests, unit: '件', icon: 'pending_actions', color: 'from-amber-500 to-amber-600' },
    ];

    if (employee?.is_supervisor) {
        statCards.push({
            name: '待我審核',
            value: stats.pendingApprovals,
            unit: '件',
            icon: 'rule',
            color: 'from-rose-500 to-rose-600',
            highlight: stats.pendingApprovals > 0
        });
    }

    const getStatusBadge = (status: string) => {
        const badges = {
            PENDING: { text: '待審核', class: 'bg-amber-50 text-amber-700 border-amber-200' },
            APPROVED: { text: '已核准', class: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
            REJECTED: { text: '已拒絕', class: 'bg-rose-50 text-rose-700 border-rose-200' },
            WITHDRAWN: { text: '已撤回', class: 'bg-slate-50 text-slate-600 border-slate-200' }
        };
        return badges[status as keyof typeof badges] || badges.PENDING;
    };

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
            {/* Greeting Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                        早安，<span className="text-blue-600">{employee?.name}</span>
                    </h1>
                    <p className="text-slate-500 font-bold mt-1 text-base">今天是 {new Date().toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', weekday: 'long' })}</p>
                </div>
                <div className="hidden md:flex items-center gap-3">
                    {/* 版本更新紀錄按鈕 */}
                    <button
                        onClick={() => setShowChangelog(true)}
                        className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-100 text-slate-500 px-4 py-2.5 rounded-2xl text-xs font-black transition-all active:scale-95 cursor-pointer shadow-sm"
                    >
                        <span className="material-symbols-outlined text-sm">info</span>
                        v1.3.2
                    </button>
                    {/* 簡化後的系統狀態呼吸燈 (僅有圖示，不須文字) */}
                    <div className="flex items-center justify-center bg-white w-11 h-11 rounded-2xl border border-slate-100 shadow-sm relative group cursor-pointer" title="系統連線正常">
                        <span className="material-symbols-outlined text-slate-500 text-lg">wifi</span>
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse absolute top-2.5 right-2.5"></span>
                    </div>
                </div>
            </div>

            {/* Premium Stats Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {statCards.map((item) => {
                    const isApprovalCard = item.name === '待我審核';
                    const CardWrapper = isApprovalCard ? 'a' : 'div';
                    const cardProps = isApprovalCard
                        ? { href: '/employee/approvals', className: `group relative bg-white p-4 rounded-3xl border transition-all duration-300 hover:shadow-xl hover:shadow-rose-200/50 hover:-translate-y-1 cursor-pointer ${item.highlight ? 'border-rose-200 bg-rose-50/20' : 'border-slate-100'}` }
                        : { className: `group relative bg-white p-4 rounded-3xl border transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/50 hover:-translate-y-0.5 ${item.highlight ? 'border-rose-200 bg-rose-50/20' : 'border-slate-100'}` };

                    return (
                        <CardWrapper
                            key={item.name}
                            {...cardProps}
                        >
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 shrink-0 bg-gradient-to-br ${item.color} rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200/20 group-hover:scale-105 transition-transform`}>
                                    <span className="material-symbols-outlined text-white text-2xl">
                                        {item.icon}
                                    </span>
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-0.5 truncate">{item.name}</p>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-2xl font-black text-slate-900 tracking-tight">{item.value}</span>
                                        <span className="text-xs font-bold text-slate-400 ml-0.5">{item.unit}</span>
                                    </div>
                                </div>
                            </div>
                            {item.highlight && (
                                <div className="absolute top-3 right-3 px-2 py-0.5 bg-rose-100 text-rose-600 text-[9px] font-black rounded-full uppercase tracking-tighter flex items-center gap-1">
                                    {isApprovalCard && <span className="material-symbols-outlined text-[10px]">arrow_forward</span>}
                                    需處理
                                </div>
                            )}
                        </CardWrapper>
                    );
                })}
            </div>

            {/* Today's Department Activity - All Employees */}
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">今日部門動態</h3>
                    <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-xl border border-blue-100">
                        <span className="material-symbols-outlined text-blue-600 text-lg">groups</span>
                        <span className="text-sm font-black text-blue-700">{todayLeaveEmployees.length} 人</span>
                    </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
                    {todayLeaveEmployees.length === 0 ? (
                        <div className="px-8 py-20 text-center">
                            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <span className="material-symbols-outlined text-emerald-300 text-4xl font-light">check_circle</span>
                            </div>
                            <p className="text-slate-400 font-black tracking-widest text-sm uppercase">今日無人請假</p>
                            <p className="text-slate-400 text-xs mt-2">您的部門同事今天都在崗位上</p>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-100 bg-slate-50/50">
                                            <th className="px-6 py-4 text-sm font-bold text-slate-500 whitespace-nowrap w-[18%]">姓名</th>
                                            <th className="px-6 py-4 text-sm font-bold text-slate-500 whitespace-nowrap w-[12%]">假別</th>
                                            <th className="px-6 py-4 text-sm font-bold text-slate-500 whitespace-nowrap w-[40%]">請假時間</th>
                                            <th className="px-6 py-4 text-sm font-bold text-slate-500 whitespace-nowrap w-[30%]">請假事由</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {paginatedDeptLeaves.map((leave) => (
                                            <tr key={leave.id} className="hover:bg-slate-50/50 transition-all group">
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-slate-900">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center border border-blue-100 group-hover:bg-blue-100 transition-colors shrink-0">
                                                            <span className="material-symbols-outlined text-blue-600 text-base">person</span>
                                                        </div>
                                                        {leave.employee?.name}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="px-2.5 py-1.5 text-xs font-black rounded-md" style={{ backgroundColor: leave.leave_type?.color + '20', color: leave.leave_type?.color }}>
                                                        {leave.leave_type?.name || '請假'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-bold">
                                                    {renderLeaveTime(leave.start_date, leave.end_date)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-medium">
                                                    {leave.reason || '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {/* 今日部門動態分頁元件 */}
                            {totalDeptPages > 1 && (
                                <div className="flex items-center justify-between px-6 py-4 bg-slate-50/30 border-t border-slate-100">
                                    <span className="text-xs font-bold text-slate-400">
                                        第 {currentDeptPage} / {totalDeptPages} 頁 (共 {todayLeaveEmployees.length} 筆)
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setCurrentDeptPage(p => Math.max(1, p - 1))}
                                            disabled={currentDeptPage === 1}
                                            className="p-1.5 rounded-xl border border-slate-100 bg-white text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors active:scale-95 flex items-center justify-center w-8 h-8"
                                        >
                                            <span className="material-symbols-outlined text-base">chevron_left</span>
                                        </button>
                                        <button
                                            onClick={() => setCurrentDeptPage(p => Math.min(totalDeptPages, p + 1))}
                                            disabled={currentDeptPage === totalDeptPages}
                                            className="p-1.5 rounded-xl border border-slate-100 bg-white text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors active:scale-95 flex items-center justify-center w-8 h-8"
                                        >
                                            <span className="material-symbols-outlined text-base">chevron_right</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Recent Activity List - Full Width */}
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">最近申請動態</h3>
                    <Link to="/employee/requests" className="text-sm font-bold text-blue-600 hover:underline flex items-center gap-1">
                        查看全部
                        <span className="material-symbols-outlined text-base">arrow_forward</span>
                    </Link>
                </div>

                <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
                    {recentRequests.length === 0 ? (
                        <div className="px-8 py-20 text-center">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <span className="material-symbols-outlined text-slate-200 text-4xl font-light">inbox</span>
                            </div>
                            <p className="text-slate-400 font-black tracking-widest text-sm uppercase">目前沒有最近的申請記錄</p>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-100 bg-slate-50/50">
                                            <th className="px-6 py-4 text-sm font-bold text-slate-500 whitespace-nowrap w-[20%]">假別/類型</th>
                                            <th className="px-6 py-4 text-sm font-bold text-slate-500 whitespace-nowrap w-[15%]">狀態</th>
                                            <th className="px-6 py-4 text-sm font-bold text-slate-500 whitespace-nowrap w-[50%]">請假時間</th>
                                            <th className="px-6 py-4 text-sm font-bold text-slate-500 whitespace-nowrap w-[15%]">申請日期</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {paginatedRecentRequests.map((request) => {
                                            const badge = getStatusBadge(request.status);
                                            const isPendingApproval = (request.status === 'PENDING' || request.status === 'WITHDRAW_PENDING') && request.employee_id !== employee?.id;
                                            return (
                                                <tr 
                                                    key={request.id} 
                                                    onClick={() => {
                                                        if (isPendingApproval) {
                                                            setSelectedRequest(request);
                                                        }
                                                    }}
                                                    className={`transition-all group ${
                                                        isPendingApproval 
                                                            ? 'hover:bg-slate-100/85 cursor-pointer bg-amber-50/10' 
                                                            : 'hover:bg-slate-50/50'
                                                    }`}
                                                >
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-slate-900">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center border border-slate-100 group-hover:bg-white transition-colors shrink-0">
                                                                <span className="material-symbols-outlined text-slate-400 text-base">description</span>
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span>{request.leave_type?.name || '請假申請'}</span>
                                                                {request.employee_id !== employee?.id && (
                                                                    <span className="text-[10px] text-slate-400 font-bold mt-0.5">申請人: {request.employee?.name}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className={`px-2.5 py-1 text-xs font-black rounded-lg border ${badge.class}`}>
                                                                {badge.text}
                                                            </span>
                                                            {isPendingApproval && (
                                                                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[9px] font-black rounded-full uppercase tracking-tighter animate-pulse shrink-0">
                                                                    待處理
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-bold">
                                                        {renderLeaveTime(request.start_date, request.end_date)}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400 font-medium">
                                                        {new Date(request.created_at).toLocaleDateString('zh-TW')}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            {/* 最近申請動態分頁元件 */}
                            {totalRecentPages > 1 && (
                                <div className="flex items-center justify-between px-6 py-4 bg-slate-50/30 border-t border-slate-100">
                                    <span className="text-xs font-bold text-slate-400">
                                        第 {currentRecentPage} / {totalRecentPages} 頁 (共 {recentRequests.length} 筆)
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setCurrentRecentPage(p => Math.max(1, p - 1))}
                                            disabled={currentRecentPage === 1}
                                            className="p-1.5 rounded-xl border border-slate-100 bg-white text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors active:scale-95 flex items-center justify-center w-8 h-8"
                                        >
                                            <span className="material-symbols-outlined text-base">chevron_left</span>
                                        </button>
                                        <button
                                            onClick={() => setCurrentRecentPage(p => Math.min(totalRecentPages, p + 1))}
                                            disabled={currentRecentPage === totalRecentPages}
                                            className="p-1.5 rounded-xl border border-slate-100 bg-white text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors active:scale-95 flex items-center justify-center w-8 h-8"
                                        >
                                            <span className="material-symbols-outlined text-base">chevron_right</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* 系統更新紀錄對話框 */}
            {showChangelog && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95 duration-300 relative max-h-[85vh] flex flex-col">
                        {/* 頂部 Header */}
                        <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                                    <span className="material-symbols-outlined text-xl">history</span>
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-900">系統更新紀錄</h2>
                                    <p className="text-xs text-slate-400 font-bold">查看 YAcc 平台的版本迭代歷程</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowChangelog(false)}
                                className="w-8 h-8 rounded-full hover:bg-slate-50 text-slate-400 flex items-center justify-center transition-colors"
                            >
                                <span className="material-symbols-outlined text-lg">close</span>
                            </button>
                        </div>

                        {/* 更新歷史時間軸內容 */}
                        <div className="flex-1 overflow-y-auto py-6 pr-2 space-y-8 scrollbar-thin">
                            {/* v1.3.2 */}
                            <div className="relative pl-6 border-l-2 border-blue-500/20 last:border-l-0">
                                <span className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-blue-500 border-2 border-white ring-4 ring-blue-50"></span>
                                <div className="space-y-2">
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-sm font-black text-slate-900">v1.3.2</span>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">2026-06-02</span>
                                    </div>
                                    <ul className="text-xs text-slate-500 font-bold space-y-1.5 list-disc pl-4 leading-relaxed">
                                        <li>📊 <b>介面大改版</b>：今日部門動態、最近申請動態重構為精美表格，新增前置個人 icon 與假別背景色塊。</li>
                                        <li>📑 <b>極簡分頁功能</b>：為兩大動態表格實裝前端分頁（每頁 5 筆），總頁數 &gt; 1 時自動顯示分頁器。</li>
                                        <li>⏳ <b>智慧時間格式</b>：同日請假自動簡化，並顯示精算請假時數（如：共1.3H）。</li>
                                        <li>👑 <b>主任級差勤規則</b>：天數 &lt; 5 日自動核准，&gt;= 5 日直簽理事長林文明審批。</li>
                                        <li>🧹 <b>版面細節優化</b>：移除今日部門動態中多餘重複的「部門」欄位，提升頁面極簡美感。</li>
                                    </ul>
                                </div>
                            </div>

                            {/* v1.2.0 */}
                            <div className="relative pl-6 border-l-2 border-blue-500/20 last:border-l-0">
                                <span className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-slate-300 border-2 border-white ring-4 ring-slate-50"></span>
                                <div className="space-y-2">
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-sm font-bold text-slate-800">v1.2.0</span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">2026-05-09</span>
                                    </div>
                                    <ul className="text-xs text-slate-500 font-medium space-y-1.5 list-disc pl-4 leading-relaxed">
                                        <li>🛠 <b>加班時數異常修正</b>：解決日曆介面與資料庫（Supabase）因非同步更新導致加班時數顯示不一致的問題。</li>
                                    </ul>
                                </div>
                            </div>

                            {/* v1.1.0 */}
                            <div className="relative pl-6 border-l-2 border-blue-500/20 last:border-l-0">
                                <span className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-slate-300 border-2 border-white ring-4 ring-slate-50"></span>
                                <div className="space-y-2">
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-sm font-bold text-slate-800">v1.1.0</span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">2026-01-18</span>
                                    </div>
                                    <ul className="text-xs text-slate-500 font-medium space-y-1.5 list-disc pl-4 leading-relaxed">
                                        <li>👥 <b>多層級審核</b>：新增多層級審核機制，支援「普通主管 ➡️ 理事長」的流暢行政簽核。</li>
                                    </ul>
                                </div>
                            </div>

                            {/* v1.0.0 */}
                            <div className="relative pl-6 border-l-2 border-blue-500/20 last:border-l-0">
                                <span className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-slate-300 border-2 border-white ring-4 ring-slate-50"></span>
                                <div className="space-y-2">
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-sm font-bold text-slate-800">v1.0.0</span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">2026-01-01</span>
                                    </div>
                                    <ul className="text-xs text-slate-500 font-medium space-y-1.5 list-disc pl-4 leading-relaxed">
                                        <li>🚀 <b>服務上線</b>：YAcc 員工服務打卡與差勤系統正式發布，啟用行動GPS打卡、補卡與請假模組。</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* 底部按鈕 */}
                        <div className="pt-4 border-t border-slate-100 shrink-0">
                            <button
                                onClick={() => setShowChangelog(false)}
                                className="w-full py-3.5 bg-slate-900 text-white rounded-2xl font-black text-sm transition-all hover:bg-slate-800 active:scale-[0.98]"
                            >
                                關閉更新紀錄
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* 快速審核對話框 */}
            {selectedRequest && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95 duration-300 relative flex flex-col">
                        
                        {/* Header */}
                        <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                                    <span className="material-symbols-outlined text-xl">fact_check</span>
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-900">審核申請</h2>
                                    <p className="text-xs text-slate-400 font-bold">快速核准或拒絕此差勤申請</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedRequest(null)}
                                className="w-8 h-8 rounded-full hover:bg-slate-50 text-slate-400 flex items-center justify-center transition-colors"
                            >
                                <span className="material-symbols-outlined text-lg">close</span>
                            </button>
                        </div>

                        {/* Content */}
                        <div className="my-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">申請人</p>
                                    <p className="text-sm font-black text-slate-950">{selectedRequest.employee?.name || '同仁'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">部門</p>
                                    <p className="text-sm font-bold text-slate-600">{selectedRequest.employee?.department || '未分配'}</p>
                                </div>
                            </div>

                            <div className="bg-slate-50 p-4 rounded-2xl space-y-3">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">假別/類型</p>
                                    <span className="inline-block px-2.5 py-1 text-xs font-black rounded-md" style={{ backgroundColor: selectedRequest.leave_type?.color + '20', color: selectedRequest.leave_type?.color }}>
                                        {selectedRequest.leave_type?.name || '請假'}
                                    </span>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">請假時間</p>
                                    <p className="text-xs font-bold text-slate-700 leading-relaxed">
                                        {renderLeaveTime(selectedRequest.start_date, selectedRequest.end_date)}
                                    </p>
                                </div>
                                {selectedRequest.reason && (
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">請假事由</p>
                                        <p className="text-xs text-slate-600 font-medium italic">"{selectedRequest.reason}"</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-4 pt-4 border-t border-slate-100 shrink-0">
                            <button
                                onClick={async () => {
                                    if (processing) return;
                                    setProcessing(true);
                                    try {
                                        const result = await requestService.updateRequestStatus(selectedRequest.id, RequestStatus.REJECTED, employee?.id);
                                        if (result.success) {
                                            setResultDialog({ show: true, success: true, message: '已成功拒絕該筆申請' });
                                            setSelectedRequest(null);
                                            fetchData();
                                        } else {
                                            setResultDialog({ show: true, success: false, message: `拒絕失敗: ${result.error || '未知錯誤'}` });
                                        }
                                    } catch (err: any) {
                                        setResultDialog({ show: true, success: false, message: `操作失敗: ${err.message || '未知錯誤'}` });
                                    } finally {
                                        setProcessing(false);
                                    }
                                }}
                                disabled={processing}
                                className="flex-1 py-4 bg-white text-rose-600 border-2 border-rose-200 rounded-2xl font-black hover:bg-rose-50 transition-all active:scale-95 disabled:opacity-50"
                            >
                                拒絕申請
                            </button>
                            <button
                                onClick={async () => {
                                    if (processing) return;
                                    setProcessing(true);
                                    try {
                                        const result = await requestService.updateRequestStatus(selectedRequest.id, RequestStatus.APPROVED, employee?.id);
                                        if (result.success) {
                                            setResultDialog({ show: true, success: true, message: '該筆請假申請已核准成功' });
                                            setSelectedRequest(null);
                                            fetchData();
                                        } else {
                                            setResultDialog({ show: true, success: false, message: `核准失敗: ${result.error || '未知錯誤'}` });
                                        }
                                    } catch (err: any) {
                                        setResultDialog({ show: true, success: false, message: `操作失敗: ${err.message || '未知錯誤'}` });
                                    } finally {
                                        setProcessing(false);
                                    }
                                }}
                                disabled={processing}
                                className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50"
                            >
                                核准申請
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 結果提示對話框 */}
            {resultDialog.show && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-sm w-full p-8 animate-in zoom-in-95 duration-300 text-center">
                        <div className={`w-20 h-20 ${resultDialog.success ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'} rounded-3xl flex items-center justify-center mx-auto mb-6`}>
                            <span className="material-symbols-outlined text-4xl">
                                {resultDialog.success ? 'check_circle' : 'error'}
                            </span>
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 mb-2">
                            {resultDialog.success ? '處理成功' : '操作失敗'}
                        </h2>
                        <p className="text-slate-500 font-bold mb-8 px-4">{resultDialog.message}</p>
                        <button
                            onClick={() => setResultDialog({ show: false, success: false, message: '' })}
                            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black shadow-xl shadow-slate-200 transition-all active:scale-95"
                        >
                            我了解了
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmployeeDashboardPage;

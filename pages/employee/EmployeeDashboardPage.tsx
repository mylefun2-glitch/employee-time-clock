import React, { useEffect, useState } from 'react';
import { useEmployee } from '../../contexts/EmployeeContext';
import { supabase } from '../../lib/supabase';
import { getPendingApprovalsForSupervisor } from '../../services/supervisorService';

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
            if (employee.is_supervisor) {
                const { count } = await getPendingApprovalsForSupervisor(employee.id);
                pendingApprovals = count;
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
                console.log('今日請假人數:', todayLeaves?.length || 0);

                setTodayLeaveEmployees(todayLeaves || []);
            } else {
                console.log('沒有找到同部門員工');
                setTodayLeaveEmployees([]);
            }

            setStats({
                attendanceDays: uniqueDays.size,
                leaveDays: (leaveData || []).filter(r => r.status === 'APPROVED').length,
                pendingRequests: pendingCount,
                pendingApprovals
            });

            setRecentRequests(leaveData || []);
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="p-4 text-center font-bold text-slate-400 py-20">載入中...</div>;
    }

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
                <div className="hidden md:flex items-center gap-3 bg-white px-5 py-2.5 rounded-2xl border border-slate-100 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-sm font-black text-slate-700 tracking-wide uppercase">系統連線正常</span>
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
                        <ul className="divide-y divide-slate-50">
                            {todayLeaveEmployees.map((leave) => (
                                <li key={leave.id} className="px-6 py-5 hover:bg-slate-50/50 transition-all group">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-4 flex-1 min-w-0">
                                            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center border border-blue-100 group-hover:bg-blue-100 transition-colors shrink-0">
                                                <span className="material-symbols-outlined text-blue-600 text-xl">person</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-base font-black text-slate-900 tracking-tight">
                                                        {leave.employee?.name}
                                                    </p>
                                                    <span className="text-xs text-slate-400 font-medium">
                                                        {leave.employee?.department}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className={`px-2 py-0.5 text-xs font-black rounded-md`} style={{ backgroundColor: leave.leave_type?.color + '20', color: leave.leave_type?.color }}>
                                                        {leave.leave_type?.name || '請假'}
                                                    </span>
                                                    <span className="text-xs text-slate-400 font-bold">
                                                        {new Date(leave.start_date).toLocaleDateString('zh-TW')} {new Date(leave.start_date).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}
                                                        <span className="text-slate-300 mx-1">→</span>
                                                        {new Date(leave.end_date).toLocaleDateString('zh-TW')} {new Date(leave.end_date).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        {leave.reason && (
                                            <div className="hidden md:block max-w-xs">
                                                <p className="text-xs text-slate-500 truncate" title={leave.reason}>
                                                    {leave.reason}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            {/* Recent Activity List - Full Width */}
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">最近申請動態</h3>
                    <a href="/employee/requests" className="text-sm font-bold text-blue-600 hover:underline flex items-center gap-1">
                        查看全部
                        <span className="material-symbols-outlined text-base">arrow_forward</span>
                    </a>
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
                        <ul className="divide-y divide-slate-50">
                            {recentRequests.map((request) => {
                                const badge = getStatusBadge(request.status);
                                return (
                                    <li key={request.id} className="px-6 py-5 hover:bg-slate-50/50 transition-all group">
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                                <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100 group-hover:bg-white transition-colors shrink-0">
                                                    <span className="material-symbols-outlined text-slate-400 text-xl">description</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-base font-black text-slate-900 tracking-tight truncate">
                                                        {request.leave_type?.name || '請假申請'}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-1 text-slate-400 text-xs font-bold">
                                                        <span>{new Date(request.start_date).toLocaleDateString('zh-TW')}</span>
                                                        <span className="text-slate-300">→</span>
                                                        <span>{new Date(request.end_date).toLocaleDateString('zh-TW')}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4 shrink-0">
                                                <span className={`px-3 py-1.5 text-xs font-black rounded-lg border ${badge.class} whitespace-nowrap`}>
                                                    {badge.text}
                                                </span>
                                                <span className="text-xs text-slate-300 font-medium hidden sm:block whitespace-nowrap">
                                                    {new Date(request.created_at).toLocaleDateString('zh-TW')}
                                                </span>
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EmployeeDashboardPage;

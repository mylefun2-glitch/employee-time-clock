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
            REJECTED: { text: '已拒絕', class: 'bg-rose-50 text-rose-700 border-rose-200' }
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
                {statCards.map((item) => (
                    <div
                        key={item.name}
                        className={`group relative bg-white p-4 rounded-3xl border transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/50 hover:-translate-y-0.5 ${item.highlight ? 'border-rose-200 bg-rose-50/20' : 'border-slate-100'
                            }`}
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
                            <div className="absolute top-3 right-3 px-2 py-0.5 bg-rose-100 text-rose-600 text-[9px] font-black rounded-full uppercase tracking-tighter">
                                需處理
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Quick Actions & Recent Activity Container */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Recent Activity List */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between px-4">
                        <h3 className="text-xl font-black text-slate-900 tracking-tight">最近申請動態</h3>
                        <a href="/employee/requests" className="text-sm font-bold text-blue-600 hover:underline">查看全部</a>
                    </div>

                    <div className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm">
                        <ul className="divide-y divide-slate-50">
                            {recentRequests.map((request) => {
                                const badge = getStatusBadge(request.status);
                                return (
                                    <li key={request.id} className="px-8 py-6 hover:bg-slate-50/50 transition-all group">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-5">
                                                <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 group-hover:bg-white transition-colors">
                                                    <span className="material-symbols-outlined text-slate-400 text-2xl font-light tracking-tighter">description</span>
                                                </div>
                                                <div>
                                                    <p className="text-lg font-black text-slate-900 tracking-tight">
                                                        {request.leave_type?.name || '請假申請'}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-1 text-slate-400 text-sm font-bold font-mono">
                                                        <span>{new Date(request.start_date).toLocaleDateString('zh-TW')}</span>
                                                        <span className="text-slate-200 font-sans tracking-widest text-[10px]">至</span>
                                                        <span>{new Date(request.end_date).toLocaleDateString('zh-TW')}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-2">
                                                <span className={`px-4 py-1.5 text-[10px] font-black rounded-xl border-2 uppercase tracking-widest ${badge.class}`}>
                                                    {badge.text}
                                                </span>
                                                <span className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">
                                                    {new Date(request.created_at).toLocaleDateString('zh-TW')}
                                                </span>
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                            {recentRequests.length === 0 && (
                                <li className="px-8 py-20 text-center">
                                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <span className="material-symbols-outlined text-slate-200 text-4xl font-light tracking-tighter">inbox</span>
                                    </div>
                                    <p className="text-slate-400 font-black tracking-widest text-sm uppercase">目前沒有最近的申請記錄</p>
                                </li>
                            )}
                        </ul>
                    </div>
                </div>

                {/* Sidebar Cards */}
                <div className="space-y-6">
                    <h3 className="text-xl font-black text-slate-900 tracking-tight px-2">常用操作</h3>


                    {/* Announcement Card or Similar */}
                    <div className="bg-blue-50 rounded-[2.5rem] p-8 border border-blue-100">
                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-6">
                            <span className="material-symbols-outlined text-blue-600">notification_important</span>
                        </div>
                        <h4 className="text-blue-900 font-black text-lg mb-3 tracking-tight">系統通知</h4>
                        <p className="text-blue-700/70 text-sm font-bold leading-relaxed mb-6">
                            請務必定期確認您的個人資訊與緊急聯絡人是否正確。如有變更，請立即告知 HR 部門。
                        </p>
                        <div className="w-full h-1 bg-blue-100 rounded-full overflow-hidden">
                            <div className="w-1/3 h-full bg-blue-600"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EmployeeDashboardPage;

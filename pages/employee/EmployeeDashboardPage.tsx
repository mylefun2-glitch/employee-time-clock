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
        return <div className="p-4">載入中...</div>;
    }

    interface StatCard {
        name: string;
        value: any;
        icon: string;
        color: string;
        highlight?: boolean;
    }

    const statCards: StatCard[] = [
        { name: '本月出勤', value: stats.attendanceDays, icon: 'today', color: 'bg-blue-500' },
        { name: '本月請假', value: stats.leaveDays, icon: 'description', color: 'bg-emerald-500' },
        { name: '待審核申請', value: stats.pendingRequests, icon: 'pending_actions', color: 'bg-orange-500' },
    ];

    if (employee?.is_supervisor) {
        statCards.push({
            name: '待我審核',
            value: stats.pendingApprovals,
            icon: 'rule',
            color: 'bg-rose-500',
            highlight: stats.pendingApprovals > 0
        });
    }

    const getStatusBadge = (status: string) => {
        const badges = {
            PENDING: { text: '待審核', class: 'bg-amber-50 text-amber-600 border-amber-100' },
            APPROVED: { text: '已核准', class: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
            REJECTED: { text: '已拒絕', class: 'bg-rose-50 text-rose-600 border-rose-100' }
        };
        return badges[status as keyof typeof badges] || badges.PENDING;
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">歡迎回來，{employee?.name}</h1>
                <p className="text-slate-500 mt-1">這是您的個人工作台</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {statCards.map((item) => (
                    <div
                        key={item.name}
                        className={`bg-white overflow-hidden shadow-sm rounded-xl border ${item.highlight
                            ? 'border-rose-300 ring-2 ring-rose-50'
                            : 'border-slate-100'
                            }`}
                    >
                        <div className="p-5">
                            <div className="flex items-center">
                                <div className="flex-shrink-0">
                                    <div className={`${item.color} rounded-xl p-3 shadow-md shadow-slate-100`}>
                                        <span className="material-symbols-outlined text-white text-2xl" aria-hidden="true">
                                            {item.icon}
                                        </span>
                                    </div>
                                </div>
                                <div className="ml-5 w-0 flex-1">
                                    <dl>
                                        <dt className="text-sm font-medium text-slate-500 truncate">{item.name}</dt>
                                        <dd className="flex items-baseline">
                                            <div className="text-2xl font-bold text-slate-900">{item.value}</div>
                                            {item.highlight && (
                                                <span className="ml-2 text-xs text-rose-600 font-semibold px-2 py-0.5 bg-rose-50 rounded-full">需處理</span>
                                            )}
                                        </dd>
                                    </dl>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Recent Activity */}
            <div className="bg-white shadow-sm rounded-xl border border-slate-100">
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-lg leading-6 font-bold text-slate-900">
                        最近請假申請
                    </h3>
                    <span className="text-xs font-medium text-slate-400">顯示最近 5 筆</span>
                </div>
                <ul className="divide-y divide-slate-100">
                    {recentRequests.map((request) => {
                        const badge = getStatusBadge(request.status);
                        return (
                            <li key={request.id} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center">
                                            <span className="material-symbols-outlined text-slate-400">description</span>
                                        </div>
                                        <div className="ml-4">
                                            <p className="text-sm font-bold text-slate-900">
                                                {request.leave_type?.name || '請假'}
                                            </p>
                                            <p className="text-xs text-slate-500 mt-0.5">
                                                {new Date(request.start_date).toLocaleDateString('zh-TW')} - {new Date(request.end_date).toLocaleDateString('zh-TW')}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="ml-2 flex flex-col items-end">
                                        <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${badge.class}`}>
                                            {badge.text}
                                        </span>
                                        <span className="mt-1 text-[10px] text-slate-400">
                                            {new Date(request.created_at).toLocaleString('zh-TW', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                    {recentRequests.length === 0 && (
                        <li className="px-6 py-12 text-center text-slate-400 text-sm">
                            尚無申請記錄
                        </li>
                    )}
                </ul>
            </div>
        </div>
    );
};

export default EmployeeDashboardPage;


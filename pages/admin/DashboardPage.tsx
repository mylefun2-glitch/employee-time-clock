import React, { useEffect, useState } from 'react';
import { Users, UserCheck, Clock } from 'lucide-react';
import { getDashboardStats, getRecentActivity, DashboardStats } from '../../services/admin';

const DashboardPage: React.FC = () => {
    const [stats, setStats] = useState<DashboardStats>({ totalEmployees: 0, activeEmployees: 0, todayAttendance: 0 });
    const [recentActivity, setRecentActivity] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            const [statsData, activityData] = await Promise.all([
                getDashboardStats(),
                getRecentActivity()
            ]);
            setStats(statsData);
            setRecentActivity(activityData);
            setLoading(false);
        };
        fetchData();
    }, []);

    const statCards = [
        { name: '總員工數', value: stats.totalEmployees, icon: Users, color: 'bg-blue-500' },
        { name: '在此員工', value: stats.activeEmployees, icon: UserCheck, color: 'bg-emerald-500' },
        { name: '今日打卡數', value: stats.todayAttendance, icon: Clock, color: 'bg-orange-500' },
    ];

    if (loading) {
        return <div className="p-4">載入中...</div>;
    }

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-slate-900">儀表板</h1>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {statCards.map((item) => (
                    <div key={item.name} className="bg-white overflow-hidden shadow rounded-lg border border-slate-100">
                        <div className="p-5">
                            <div className="flex items-center">
                                <div className="flex-shrink-0">
                                    <div className={`${item.color} rounded-md p-3`}>
                                        <item.icon className="h-6 w-6 text-white" aria-hidden="true" />
                                    </div>
                                </div>
                                <div className="ml-5 w-0 flex-1">
                                    <dl>
                                        <dt className="text-sm font-medium text-slate-500 truncate">{item.name}</dt>
                                        <dd>
                                            <div className="text-lg font-medium text-slate-900">{item.value}</div>
                                        </dd>
                                    </dl>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Recent Activity */}
            <div className="bg-white shadow rounded-lg border border-slate-100">
                <div className="px-4 py-5 sm:px-6 border-b border-slate-100">
                    <h3 className="text-lg leading-6 font-medium text-slate-900">
                        近期打卡紀錄
                    </h3>
                </div>
                <ul className="divide-y divide-slate-100">
                    {recentActivity.map((log) => (
                        <li key={log.id} className="px-4 py-4 sm:px-6 hover:bg-slate-50 transition-colors">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0">
                                        <span className={`inline-flex items-center justify-center h-8 w-8 rounded-full ${log.check_type === 'IN' ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-orange-600'
                                            }`}>
                                            {log.check_type === 'IN' ? 'In' : 'Out'}
                                        </span>
                                    </div>
                                    <div className="ml-4">
                                        <p className="text-sm font-medium text-blue-600 truncate">{log.employees?.name || 'Unknown'}</p>
                                        <p className="text-sm text-slate-500">{log.employees?.department}</p>
                                    </div>
                                </div>
                                <div className="ml-2 flex-shrink-0 flex flex-col items-end">
                                    <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-slate-100 text-slate-800">
                                        {log.check_type === 'IN' ? '上班' : '下班'}
                                    </p>
                                    <p className="mt-1 text-sm text-slate-500">
                                        {new Date(log.timestamp).toLocaleString('zh-TW')}
                                    </p>
                                </div>
                            </div>
                        </li>
                    ))}
                    {recentActivity.length === 0 && (
                        <li className="px-4 py-8 text-center text-slate-500 text-sm">
                            尚無打卡紀錄
                        </li>
                    )}
                </ul>
            </div>
        </div>
    );
};

export default DashboardPage;

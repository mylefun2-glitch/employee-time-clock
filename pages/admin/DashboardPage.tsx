import React, { useEffect, useState } from 'react';
import { Users, UserCheck, Clock, AlertCircle } from 'lucide-react';
import { getDashboardStats, getRecentActivity, DashboardStats } from '../../services/admin';
import { getPendingApprovalsForSupervisor } from '../../services/supervisorService';
import { useAuth } from '../../contexts/AuthContext';

const DashboardPage: React.FC = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState<DashboardStats>({ totalEmployees: 0, activeEmployees: 0, todayAttendance: 0 });
    const [recentActivity, setRecentActivity] = useState<any[]>([]);
    const [pendingCount, setPendingCount] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            const [statsData, activityData] = await Promise.all([
                getDashboardStats(),
                getRecentActivity()
            ]);
            setStats(statsData);
            setRecentActivity(activityData);

            // 獲取待審核數量（假設使用 user email 查詢員工）
            // 注意：這需要員工資料表有 email 欄位
            if (user?.email) {
                try {
                    // 簡化版本：直接使用固定的員工ID進行測試
                    // 實際使用時需要根據登入使用者查詢對應的員工ID
                    const { count } = await getPendingApprovalsForSupervisor('test-supervisor-id');
                    setPendingCount(count);
                } catch (error) {
                    console.error('Error fetching pending approvals:', error);
                }
            }

            setLoading(false);
        };
        fetchData();
    }, [user]);

    const statCards = [
        { name: '總員工數', value: stats.totalEmployees, icon: Users, color: 'bg-blue-500' },
        { name: '在職員工', value: stats.activeEmployees, icon: UserCheck, color: 'bg-emerald-500' },
        { name: '今日打卡數', value: stats.todayAttendance, icon: Clock, color: 'bg-orange-500' },
        { name: '待審核申請', value: pendingCount, icon: AlertCircle, color: 'bg-red-500', highlight: pendingCount > 0 },
    ];

    // 將打卡紀錄按日期與員工整併
    const groupedActivity = React.useMemo(() => {
        const groups: { [key: string]: any } = {};

        recentActivity.forEach(log => {
            const dateObj = new Date(log.timestamp);
            const dateKey = dateObj.toLocaleDateString('zh-TW');
            const empId = log.employee_id;
            const key = `${dateKey}-${empId}`;

            if (!groups[key]) {
                groups[key] = {
                    key,
                    dateKey,
                    timestamp: dateObj.getTime(), // 用於排序
                    employee: log.employees,
                    logs: []
                };
            }

            groups[key].logs.push({
                type: log.check_type,
                time: dateObj.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                fullTime: dateObj.getTime()
            });
        });

        // 轉換為陣列並排序（日期由新到舊，時間由早到晚）
        return Object.values(groups)
            .sort((a: any, b: any) => b.timestamp - a.timestamp)
            .map((group: any) => ({
                ...group,
                logs: group.logs.sort((a: any, b: any) => a.fullTime - b.fullTime)
            }));
    }, [recentActivity]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">管理儀表板</h1>
                    <p className="text-slate-500 font-medium">概覽系統狀態與近期營運數據。</p>
                </div>
                <div className="text-right hidden sm:block">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">最後更新時間</p>
                    <p className="text-sm font-bold text-slate-700">{new Date().toLocaleString('zh-TW')}</p>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {statCards.map((item) => (
                    <div
                        key={item.name}
                        className={`bg-white rounded-3xl p-6 border transition-all hover:shadow-lg hover:shadow-slate-100 ${item.highlight
                            ? 'border-red-200 bg-red-50/30'
                            : 'border-slate-100 shadow-sm'
                            }`}
                    >
                        <div className="flex items-center gap-4">
                            <div className={`${item.color} h-12 w-12 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-100`}>
                                <item.icon className="h-6 w-6 text-white" />
                            </div>
                            <div className="flex-1">
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{item.name}</p>
                                <div className="flex items-baseline gap-2">
                                    <p className="text-2xl font-black text-slate-900">{item.value}</p>
                                    {item.highlight && (
                                        <span className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-full font-bold animate-pulse">
                                            需處理
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
                    <h3 className="text-lg font-black text-slate-900 tracking-tight">
                        近期打卡紀錄點
                    </h3>
                    <span className="text-xs font-black text-blue-500 bg-blue-50 px-3 py-1.5 rounded-full uppercase tracking-wider">
                        系統即時更新
                    </span>
                </div>
                <div className="overflow-hidden">
                    <table className="min-w-full divide-y divide-slate-100">
                        <thead className="bg-slate-50/50">
                            <tr>
                                <th className="px-8 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest">日期</th>
                                <th className="px-8 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest">員工資訊</th>
                                <th className="px-8 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest">打卡歷程 (上班 → 下班)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {groupedActivity.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="px-8 py-20 text-center text-slate-400 font-bold">
                                        尚無打卡紀錄
                                    </td>
                                </tr>
                            ) : (
                                groupedActivity.map((group) => (
                                    <tr key={group.key} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-8 py-5 whitespace-nowrap">
                                            <div className="text-sm font-black text-slate-400 font-mono tracking-tighter">
                                                {group.dateKey.split('/').map((s: string, i: number) => i === 0 ? s : s.padStart(2, '0')).join('/')}
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 whitespace-nowrap">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 font-black text-lg">
                                                    {group.employee?.name?.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-black text-slate-900">{group.employee?.name}</div>
                                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-tight">{group.employee?.department}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex flex-wrap gap-2 items-center">
                                                {group.logs.map((log: any, idx: number) => (
                                                    <React.Fragment key={idx}>
                                                        <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${log.type === 'IN'
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                                            : 'bg-orange-50 text-orange-700 border-orange-100'
                                                            }`}>
                                                            <span className="material-symbols-outlined text-[16px]">
                                                                {log.type === 'IN' ? 'login' : 'logout'}
                                                            </span>
                                                            <span className="text-xs font-black font-mono">{log.time}</span>
                                                            <span className="text-[10px] font-black opacity-60">
                                                                {log.type === 'IN' ? '上班' : '下班'}
                                                            </span>
                                                        </div>
                                                        {idx < group.logs.length - 1 && (
                                                            <span className="material-symbols-outlined text-slate-300 text-sm">arrow_forward</span>
                                                        )}
                                                    </React.Fragment>
                                                ))}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default DashboardPage;

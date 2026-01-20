import React, { useEffect, useState } from 'react';
import { useEmployee } from '../../contexts/EmployeeContext';
import { supabase } from '../../lib/supabase';
import MakeupRequestForm from '../../components/MakeupRequestForm';
import { getEmployeeMakeupRequests } from '../../services/employee';

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

    useEffect(() => {
        if (employee) {
            fetchAttendance();
        }
    }, [employee, selectedMonth]);

    const fetchAttendance = async () => {
        if (!employee) return;

        try {
            const startOfMonth = new Date(selectedMonth + '-01');
            const endOfMonth = new Date(startOfMonth);
            endOfMonth.setMonth(endOfMonth.getMonth() + 1);

            // 獲取打卡記錄
            const { data: attendanceData, error: attendanceError } = await supabase
                .from('attendance_logs')
                .select('*')
                .eq('employee_id', employee.id)
                .gte('timestamp', startOfMonth.toISOString())
                .lt('timestamp', endOfMonth.toISOString())
                .order('timestamp', { ascending: false });

            if (attendanceError) throw attendanceError;

            // 獲取請假記錄
            const { data: leaveData, error: leaveError } = await supabase
                .from('leave_requests')
                .select(`
                    *,
                    leave_type:leave_types(*)
                `)
                .eq('employee_id', employee.id)
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
            const makeupData = await getEmployeeMakeupRequests(employee.id);
            setMakeupRequests(makeupData);
        } catch (error) {
            console.error('Error fetching attendance:', error);
        } finally {
            setLoading(false);
        }
    };

    const groupByDate = (logs: any[], leaves: any[]) => {
        const grouped: { [key: string]: { attendance: any[], leaves: any[] } } = {};

        // 分組打卡記錄
        logs.forEach(log => {
            const date = new Date(log.timestamp).toLocaleDateString('zh-TW');
            if (!grouped[date]) {
                grouped[date] = { attendance: [], leaves: [] };
            }
            grouped[date].attendance.push(log);
        });

        // 分組請假記錄
        leaves.forEach(leave => {
            const startDate = new Date(leave.start_date);
            const endDate = new Date(leave.end_date);

            // 為請假期間的每一天添加記錄
            for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                const dateStr = d.toLocaleDateString('zh-TW');
                if (!grouped[dateStr]) {
                    grouped[dateStr] = { attendance: [], leaves: [] };
                }
                grouped[dateStr].leaves.push(leave);
            }
        });

        return grouped;
    };

    const groupedLogs = groupByDate(attendanceLogs, leaveRequests);

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
        <div className="space-y-6">
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
                        <span className="hidden sm:inline">申請補登</span>
                    </button>
                </div>
            </div>

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

                            {/* 快速摘要 */}
                            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center shrink-0">
                                        <span className="material-symbols-outlined text-white text-2xl">info</span>
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-black text-blue-900 mb-2">本月出勤摘要</h4>
                                        <div className="space-y-1 text-sm text-blue-700">
                                            <p>• 共出勤 <span className="font-bold">{stats.totalDays}</span> 天</p>
                                            <p>• 上班打卡 <span className="font-bold">{stats.checkIns}</span> 次，下班打卡 <span className="font-bold">{stats.checkOuts}</span> 次</p>
                                            <p>• 平均上班時間為 <span className="font-bold font-mono">{stats.avgCheckInTime}</span></p>
                                            {leaveRequests.length > 0 && (
                                                <p>• 本月請假 <span className="font-bold">{leaveRequests.length}</span> 次</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 詳細記錄 */}
                    {activeTab === 'records' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <h3 className="text-lg font-black text-slate-900 mb-6">每日打卡記錄</h3>
                            {Object.keys(groupedLogs).length === 0 ? (
                                <div className="py-20 text-center">
                                    <span className="material-symbols-outlined text-slate-200 text-6xl">event_busy</span>
                                    <p className="text-slate-400 mt-4 font-bold">本月尚無打卡記錄</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {Object.entries(groupedLogs).map(([date, data]) => {
                                        const { attendance, leaves } = data;
                                        const inLog = attendance.find((l: any) => l.check_type === 'IN');
                                        const outLog = attendance.find((l: any) => l.check_type === 'OUT');
                                        const leaveInfo = leaves.length > 0 ? leaves[0] : null;

                                        return (
                                            <div key={date} className="bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-md transition-all">
                                                {/* Date Header */}
                                                <div className="bg-slate-50 px-6 py-3 border-b border-slate-100">
                                                    <h4 className="text-sm font-black text-slate-700">{date}</h4>
                                                </div>

                                                {/* Records */}
                                                <div className="p-4">
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                        {/* 上班打卡 */}
                                                        <div className={`p-4 rounded-xl border-2 transition-all ${inLog
                                                            ? 'bg-emerald-50 border-emerald-200'
                                                            : 'bg-slate-50 border-slate-200 border-dashed'
                                                            }`}>
                                                            {inLog ? (
                                                                <div className="text-center">
                                                                    <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-md">
                                                                        <span className="material-symbols-outlined text-white text-2xl">login</span>
                                                                    </div>
                                                                    <p className="text-xs font-black text-emerald-700 mb-1">上班打卡</p>
                                                                    <p className="text-2xl font-black text-emerald-900 font-mono">
                                                                        {new Date(inLog.timestamp).toLocaleTimeString('zh-TW', {
                                                                            hour: '2-digit',
                                                                            minute: '2-digit',
                                                                            hour12: false
                                                                        })}
                                                                    </p>
                                                                    {inLog.location_accuracy && (
                                                                        <p className="text-xs text-emerald-600 mt-1">±{Math.round(inLog.location_accuracy)}M</p>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div className="text-center py-4">
                                                                    <span className="material-symbols-outlined text-slate-300 text-3xl">login</span>
                                                                    <p className="text-xs font-bold text-slate-400 mt-2">未打卡</p>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* 下班打卡 */}
                                                        <div className={`p-4 rounded-xl border-2 transition-all ${outLog
                                                            ? 'bg-orange-50 border-orange-200'
                                                            : 'bg-slate-50 border-slate-200 border-dashed'
                                                            }`}>
                                                            {outLog ? (
                                                                <div className="text-center">
                                                                    <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-md">
                                                                        <span className="material-symbols-outlined text-white text-2xl">logout</span>
                                                                    </div>
                                                                    <p className="text-xs font-black text-orange-700 mb-1">下班打卡</p>
                                                                    <p className="text-2xl font-black text-orange-900 font-mono">
                                                                        {new Date(outLog.timestamp).toLocaleTimeString('zh-TW', {
                                                                            hour: '2-digit',
                                                                            minute: '2-digit',
                                                                            hour12: false
                                                                        })}
                                                                    </p>
                                                                    {outLog.location_accuracy && (
                                                                        <p className="text-xs text-orange-600 mt-1">±{Math.round(outLog.location_accuracy)}M</p>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div className="text-center py-4">
                                                                    <span className="material-symbols-outlined text-slate-300 text-3xl">logout</span>
                                                                    <p className="text-xs font-bold text-slate-400 mt-2">未打卡</p>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* 請假資訊 */}
                                                        <div className={`p-4 rounded-xl border-2 transition-all ${leaveInfo
                                                            ? 'border-purple-200'
                                                            : 'bg-slate-50 border-slate-200 border-dashed'
                                                            }`} style={leaveInfo ? {
                                                                backgroundColor: `${leaveInfo.leave_type?.color}15`
                                                            } : {}}>
                                                            {leaveInfo ? (
                                                                <div className="text-center">
                                                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-md" style={{
                                                                        backgroundColor: leaveInfo.leave_type?.color || '#9333EA'
                                                                    }}>
                                                                        <span className="material-symbols-outlined text-white text-2xl">event_available</span>
                                                                    </div>
                                                                    <p className="text-xs font-black mb-1" style={{
                                                                        color: leaveInfo.leave_type?.color || '#9333EA'
                                                                    }}>
                                                                        {leaveInfo.leave_type?.name || '請假'}
                                                                    </p>
                                                                    <p className="text-sm text-slate-600 line-clamp-2">
                                                                        {leaveInfo.reason || '無事由'}
                                                                    </p>
                                                                </div>
                                                            ) : (
                                                                <div className="text-center py-4">
                                                                    <span className="material-symbols-outlined text-slate-300 text-3xl">event_available</span>
                                                                    <p className="text-xs font-bold text-slate-400 mt-2">正常上班</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
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

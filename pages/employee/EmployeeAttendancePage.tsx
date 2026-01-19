import React, { useEffect, useState } from 'react';
import { useEmployee } from '../../contexts/EmployeeContext';
import { supabase } from '../../lib/supabase';
import MakeupRequestForm from '../../components/MakeupRequestForm';
import { getEmployeeMakeupRequests } from '../../services/employee';

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

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">差勤統計</h1>
                    <p className="text-slate-500 mt-1">追蹤您的出勤記錄與表現</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="pl-5 pr-10 py-2.5 bg-white border border-slate-100 rounded-xl font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm appearance-none min-w-[180px]"
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

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {statCards.map((item) => (
                    <div key={item.name} className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
                        <div className="flex items-center gap-4">
                            <div className={`${item.color} w-10 h-10 rounded-xl flex items-center justify-center shadow-md shadow-slate-100`}>
                                <span className="material-symbols-outlined text-white text-xl">{item.icon}</span>
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-900 leading-none">{item.value}</p>
                                <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">{item.name}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* 補登申請記錄 */}
            {makeupRequests.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/30">
                        <h2 className="text-lg font-bold text-slate-900">補登申請記錄</h2>
                    </div>
                    <div className="divide-y divide-slate-50">
                        {makeupRequests.map((request) => {
                            const statusBadge = {
                                PENDING: { text: '待審核', class: 'bg-amber-50 text-amber-700 border-amber-200' },
                                APPROVED: { text: '已核准', class: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                                REJECTED: { text: '已拒絕', class: 'bg-rose-50 text-rose-700 border-rose-200' }
                            }[request.status] || { text: '未知', class: 'bg-slate-50 text-slate-700 border-slate-200' };

                            return (
                                <div key={request.id} className="p-4 hover:bg-slate-50/50 transition-colors">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className={`px-2 py-0.5 text-[10px] font-black rounded border ${statusBadge.class}`}>
                                                    {statusBadge.text}
                                                </span>
                                                <span className="text-xs text-slate-500 font-medium">
                                                    {new Date(request.request_date).toLocaleDateString('zh-TW')} {request.request_time}
                                                </span>
                                                <span className="text-xs font-bold text-slate-700">
                                                    {request.check_type === 'IN' ? '上班打卡' : '下班打卡'}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-600">{request.reason}</p>
                                            {request.review_comment && (
                                                <div className="mt-2 bg-amber-50 rounded-lg px-3 py-2 border-l-2 border-amber-300">
                                                    <p className="text-[10px] font-bold text-amber-600 mb-0.5">審核備註</p>
                                                    <p className="text-xs text-amber-700">{request.review_comment}</p>
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[9px] text-slate-400 font-bold">
                                                {new Date(request.created_at).toLocaleDateString('zh-TW')} 申請
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* List */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/30">
                    <h2 className="text-lg font-bold text-slate-900">詳細記錄</h2>
                </div>

                {Object.keys(groupedLogs).length === 0 ? (
                    <div className="px-6 py-20 text-center">
                        <span className="material-symbols-outlined text-slate-200 text-6xl">event_busy</span>
                        <p className="text-slate-400 mt-4 font-bold">本月尚無打卡記錄</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {Object.entries(groupedLogs).map(([date, data]) => {
                            const { attendance, leaves } = data;
                            const totalRecords = attendance.length + leaves.length;

                            return (
                                <div key={date} className="relative">
                                    {/* Date Header */}
                                    <div className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm px-6 py-2.5 border-y border-slate-100 flex items-center justify-between">
                                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">{date}</h3>
                                        <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">
                                            {totalRecords} RECORDS
                                        </span>
                                    </div>

                                    {/* Logs List - Side by Side Layout */}
                                    <div className="px-4 py-3">
                                        {(() => {
                                            const inLog = attendance.find((l: any) => l.check_type === 'IN');
                                            const outLog = attendance.find((l: any) => l.check_type === 'OUT');
                                            const leaveInfo = leaves.length > 0 ? leaves[0] : null;

                                            return (
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                    {/* 上班打卡 (左側) */}
                                                    <div className={`group p-3 rounded-xl border transition-all ${inLog
                                                        ? 'bg-emerald-50/50 border-emerald-100 hover:bg-emerald-50 hover:shadow-md'
                                                        : 'bg-slate-50/30 border-slate-100 border-dashed'
                                                        }`}>
                                                        {inLog ? (
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-sm">
                                                                        <span className="material-symbols-outlined text-white text-base">login</span>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-xs font-black text-emerald-700">上班打卡</p>
                                                                        {inLog.location_accuracy && (
                                                                            <p className="text-[9px] text-emerald-600 font-medium">±{Math.round(inLog.location_accuracy)}M</p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <span className="text-xl font-black text-emerald-900 tracking-tight font-mono">
                                                                    {new Date(inLog.timestamp).toLocaleTimeString('zh-TW', {
                                                                        hour: '2-digit',
                                                                        minute: '2-digit',
                                                                        hour12: false
                                                                    })}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center justify-center py-2">
                                                                <div className="text-center">
                                                                    <span className="material-symbols-outlined text-slate-300 text-xl">login</span>
                                                                    <p className="text-[10px] font-bold text-slate-400 mt-1">未打卡</p>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* 下班打卡 (中間) */}
                                                    <div className={`group p-3 rounded-xl border transition-all ${outLog
                                                        ? 'bg-orange-50/50 border-orange-100 hover:bg-orange-50 hover:shadow-md'
                                                        : 'bg-slate-50/30 border-slate-100 border-dashed'
                                                        }`}>
                                                        {outLog ? (
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center shadow-sm">
                                                                        <span className="material-symbols-outlined text-white text-base">logout</span>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-xs font-black text-orange-700">下班打卡</p>
                                                                        {outLog.location_accuracy && (
                                                                            <p className="text-[9px] text-orange-600 font-medium">±{Math.round(outLog.location_accuracy)}M</p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <span className="text-xl font-black text-orange-900 tracking-tight font-mono">
                                                                    {new Date(outLog.timestamp).toLocaleTimeString('zh-TW', {
                                                                        hour: '2-digit',
                                                                        minute: '2-digit',
                                                                        hour12: false
                                                                    })}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center justify-center py-2">
                                                                <div className="text-center">
                                                                    <span className="material-symbols-outlined text-slate-300 text-xl">logout</span>
                                                                    <p className="text-[10px] font-bold text-slate-400 mt-1">未打卡</p>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* 請假資訊 (右側) */}
                                                    <div className={`group p-3 rounded-xl border transition-all ${leaveInfo
                                                        ? `bg-${leaveInfo.leave_type?.color || 'purple'}-50/50 border-${leaveInfo.leave_type?.color || 'purple'}-100`
                                                        : 'bg-slate-50/30 border-slate-100 border-dashed'
                                                        }`} style={leaveInfo ? {
                                                            backgroundColor: `${leaveInfo.leave_type?.color}15`,
                                                            borderColor: `${leaveInfo.leave_type?.color}40`
                                                        } : {}}>
                                                        {leaveInfo ? (
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm" style={{
                                                                    backgroundColor: leaveInfo.leave_type?.color || '#9333EA'
                                                                }}>
                                                                    <span className="material-symbols-outlined text-white text-base">event_available</span>
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-xs font-black truncate" style={{
                                                                        color: leaveInfo.leave_type?.color || '#9333EA'
                                                                    }}>
                                                                        {leaveInfo.leave_type?.name || '請假'}
                                                                    </p>
                                                                    <p className="text-[9px] font-medium text-slate-500 truncate">
                                                                        {leaveInfo.reason || '無事由'}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center justify-center py-2">
                                                                <div className="text-center">
                                                                    <span className="material-symbols-outlined text-slate-300 text-xl">event_available</span>
                                                                    <p className="text-[10px] font-bold text-slate-400 mt-1">正常上班</p>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
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

import React, { useEffect, useState } from 'react';
import { useEmployee } from '../../contexts/EmployeeContext';
import { supabase } from '../../lib/supabase';

const EmployeeAttendancePage: React.FC = () => {
    const { employee } = useEmployee();
    const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
    const [stats, setStats] = useState({
        totalDays: 0,
        checkIns: 0,
        checkOuts: 0,
        avgCheckInTime: '--:--'
    });
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

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

            const { data, error } = await supabase
                .from('attendance_logs')
                .select('*')
                .eq('employee_id', employee.id)
                .gte('timestamp', startOfMonth.toISOString())
                .lt('timestamp', endOfMonth.toISOString())
                .order('timestamp', { ascending: false });

            if (error) throw error;

            const logs = data || [];
            setAttendanceLogs(logs);

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
        } catch (error) {
            console.error('Error fetching attendance:', error);
        } finally {
            setLoading(false);
        }
    };

    const groupByDate = (logs: any[]) => {
        const grouped: { [key: string]: any[] } = {};
        logs.forEach(log => {
            const date = new Date(log.timestamp).toLocaleDateString('zh-TW');
            if (!grouped[date]) {
                grouped[date] = [];
            }
            grouped[date].push(log);
        });
        return grouped;
    };

    const groupedLogs = groupByDate(attendanceLogs);

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
                <div className="relative">
                    <input
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="pl-5 pr-10 py-2.5 bg-white border border-slate-100 rounded-xl font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm appearance-none min-w-[180px]"
                    />
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">calendar_view_month</span>
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
                        {Object.entries(groupedLogs).map(([date, logs]) => (
                            <div key={date} className="relative">
                                {/* Date Header */}
                                <div className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm px-6 py-2.5 border-y border-slate-100 flex items-center justify-between">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">{date}</h3>
                                    <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">
                                        {logs.length} RECORDS
                                    </span>
                                </div>

                                {/* Logs List */}
                                <div className="divide-y divide-slate-50">
                                    {logs.map((log) => (
                                        <div
                                            key={log.id}
                                            className="group px-6 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-all"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border shadow-sm transition-transform group-hover:scale-110 ${log.check_type === 'IN'
                                                    ? 'bg-emerald-50 border-emerald-100 text-emerald-600'
                                                    : 'bg-orange-50 border-orange-100 text-orange-600'
                                                    }`}>
                                                    <span className="material-symbols-outlined text-xl">
                                                        {log.check_type === 'IN' ? 'login' : 'logout'}
                                                    </span>
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className={`text-sm font-bold ${log.check_type === 'IN' ? 'text-emerald-700' : 'text-orange-700'
                                                            }`}>
                                                            {log.check_type === 'IN' ? '上班打卡' : '下班打卡'}
                                                        </p>
                                                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-tighter">
                                                            ID: {log.id.slice(0, 4)}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="material-symbols-outlined text-[12px] text-slate-300">location_on</span>
                                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                                                            {log.location_accuracy ? `ACCURACY: ±${Math.round(log.location_accuracy)}M` : 'LOCATION RECORDED'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="text-right">
                                                <span className="text-2xl font-black text-slate-900 tracking-tighter font-mono group-hover:text-blue-600 transition-colors">
                                                    {new Date(log.timestamp).toLocaleTimeString('zh-TW', {
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                        hour12: false
                                                    })}
                                                </span>
                                                <p className="text-[9px] font-bold text-slate-300 mt-0.5 uppercase tracking-widest leading-none">CHECKED AT</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default EmployeeAttendancePage;


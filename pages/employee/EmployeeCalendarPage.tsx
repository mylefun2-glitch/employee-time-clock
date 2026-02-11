import React, { useEffect, useState, useMemo } from 'react';
import { useEmployee } from '../../contexts/EmployeeContext';
import { supabase } from '../../lib/supabase';
import { format, startOfMonth, endOfMonth, isSameDay, parseISO, addMonths, subMonths, startOfWeek, getDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, FileText, Download, Plus } from 'lucide-react';
import { isNationalHoliday } from '../../lib/holidays';
import { CheckType } from '../../types';
import MakeupRequestForm from '../../components/MakeupRequestForm';

interface AttendanceLog {
    id: string;
    employee_id: string;
    check_type: CheckType;
    timestamp: string;
}

interface LeaveRequest {
    id: string;
    employee_id: string;
    start_date: string;
    end_date: string;
    reason: string;
    status: string;
    hours?: number;
    leave_type?: {
        name: string;
        color: string;
    };
}

const EmployeeCalendarPage: React.FC = () => {
    const { employee } = useEmployee();
    const [currentDate, setCurrentDate] = useState<Date>(new Date());
    const [logs, setLogs] = useState<AttendanceLog[]>([]);
    const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
    const [loading, setLoading] = useState(false);
    const [showMakeupForm, setShowMakeupForm] = useState(false);
    const [selectedDateStr, setSelectedDateStr] = useState<string>('');

    const rocYear = currentDate.getFullYear() - 1911;
    const monthStr = format(currentDate, 'M');

    useEffect(() => {
        if (employee?.id) {
            fetchData();
        }
    }, [employee?.id, currentDate]);

    const fetchData = async () => {
        if (!employee?.id) return;
        setLoading(true);
        const start = startOfMonth(currentDate).toISOString();
        const end = endOfMonth(currentDate).toISOString();

        try {
            const { data: logsData } = await supabase
                .from('attendance_logs')
                .select('*')
                .eq('employee_id', employee.id)
                .gte('timestamp', start)
                .lte('timestamp', end);

            const { data: leavesData } = await supabase
                .from('leave_requests')
                .select(`
                    *,
                    leave_type:leave_types(name, color)
                `)
                .eq('employee_id', employee.id)
                .eq('status', 'APPROVED')
                .or(`start_date.lte.${end},end_date.gte.${start}`);

            setLogs(logsData || []);
            setLeaves(leavesData || []);
        } catch (err) {
            console.error('Error fetching calendar data:', err);
        } finally {
            setLoading(false);
        }
    };

    const weeks = useMemo(() => {
        const start = startOfMonth(currentDate);
        const end = endOfMonth(currentDate);
        const calendarStart = startOfWeek(start, { weekStartsOn: 1 });

        const weeksArray: Date[][] = [];
        let currentWeek: Date[] = [];
        let tempDate = new Date(calendarStart);

        for (let i = 0; i < 42; i++) {
            currentWeek.push(new Date(tempDate));
            if (currentWeek.length === 7) {
                weeksArray.push(currentWeek);
                currentWeek = [];
            }
            tempDate.setDate(tempDate.getDate() + 1);
            if (tempDate > end && currentWeek.length === 0) break;
        }
        return weeksArray;
    }, [currentDate]);

    const days = useMemo(() => {
        return weeks.flat().filter(d => d >= startOfMonth(currentDate) && d <= endOfMonth(currentDate));
    }, [weeks, currentDate]);

    const monthData = useMemo(() => {
        const data: { [key: string]: { logs: AttendanceLog[], leaves: LeaveRequest[], hours: number, holidayName?: string } } = {};

        days.forEach(day => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const holidayName = isNationalHoliday(day);
            const dayLogs = logs.filter(log => isSameDay(parseISO(log.timestamp), day))
                .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

            const dayLeaves = leaves.filter(leave => {
                const s = parseISO(leave.start_date);
                const e = parseISO(leave.end_date);
                const startOfDay = new Date(day);
                startOfDay.setHours(0, 0, 0, 0);
                const endOfDay = new Date(day);
                endOfDay.setHours(23, 59, 59, 999);
                return s <= endOfDay && e >= startOfDay;
            });

            let dayHours = 0;
            if (dayLogs.length >= 2) {
                const checkInLog = dayLogs.find(l => l.check_type === CheckType.IN);
                const checkOutLog = [...dayLogs].reverse().find(l => l.check_type === CheckType.OUT);

                if (checkInLog && checkOutLog && employee) {
                    const scheduleStart = employee.work_start_time || '08:00';
                    const scheduleEnd = employee.work_end_time || '17:00';
                    const breakStart = employee.break_start_time || '12:00';
                    const breakEnd = employee.break_end_time || '13:00';

                    const actualIn = new Date(checkInLog.timestamp);
                    const actualOut = new Date(checkOutLog.timestamp);

                    const getDayTime = (timeStr: string) => {
                        const [hours, minutes] = timeStr.split(':').map(Number);
                        const d = new Date(actualIn);
                        d.setHours(hours, minutes, 0, 0);
                        return d;
                    };

                    const scheduledInDate = getDayTime(scheduleStart);
                    const scheduledOutDate = getDayTime(scheduleEnd);
                    const thirtyMins = 30 * 60 * 1000;

                    let effectiveIn = actualIn;
                    if (Math.abs(actualIn.getTime() - scheduledInDate.getTime()) <= thirtyMins) {
                        effectiveIn = scheduledInDate;
                    }

                    let effectiveOut = actualOut;
                    if (Math.abs(actualOut.getTime() - scheduledOutDate.getTime()) <= thirtyMins) {
                        effectiveOut = scheduledOutDate;
                    }

                    let durationMs = effectiveOut.getTime() - effectiveIn.getTime();
                    if (durationMs < 0) durationMs = 0;

                    const breaks = [
                        { start: breakStart, end: breakEnd },
                        { start: employee.break2_start_time, end: employee.break2_end_time },
                        { start: employee.break3_start_time, end: employee.break3_end_time }
                    ].filter(b => b.start && b.end);

                    let totalBreakOverlapMs = 0;
                    breaks.forEach(b => {
                        const bStartDate = getDayTime(b.start!);
                        const bEndDate = getDayTime(b.end!);
                        const overlapStart = new Date(Math.max(effectiveIn.getTime(), bStartDate.getTime()));
                        const overlapEnd = new Date(Math.min(effectiveOut.getTime(), bEndDate.getTime()));
                        if (overlapStart < overlapEnd) {
                            totalBreakOverlapMs += overlapEnd.getTime() - overlapStart.getTime();
                        }
                    });

                    dayHours = (durationMs - totalBreakOverlapMs) / (1000 * 60 * 60);
                }
            }

            data[dateKey] = { logs: dayLogs, leaves: dayLeaves, hours: parseFloat(dayHours.toFixed(2)), holidayName };
        });

        return data;
    }, [days, logs, leaves, employee]);

    const totalMonthlyHours = Object.values(monthData).reduce((acc, curr) => acc + curr.hours, 0);
    const weekDays = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'];

    const handleDateClick = (day: Date) => {
        setSelectedDateStr(format(day, 'yyyy-MM-dd'));
        setShowMakeupForm(true);
    };

    return (
        <div className="space-y-6 print:space-y-4 print:p-0">
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm print:shadow-none print:border-none print:p-0">
                <div className="flex flex-row items-center justify-between w-full gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center print:hidden">
                            <CalendarIcon className="text-blue-600 h-5 w-5" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-slate-900 tracking-tight">個人出勤月曆</h1>
                            <div className="hidden print:block text-sm font-bold text-slate-600">
                                {rocYear} 年 {monthStr} 月 | {employee?.name}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 print:hidden">
                        <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-100">
                            <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-600">
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <div className="px-2 py-1 text-xs font-black text-slate-700 font-mono whitespace-nowrap">
                                {rocYear} / {monthStr}
                            </div>
                            <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-600">
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-xl shadow-md shadow-blue-100 whitespace-nowrap">
                            <FileText className="h-3.5 w-3.5" />
                            <span className="text-xs font-black">工時: {totalMonthlyHours.toFixed(1)}</span>
                        </div>

                        <button
                            onClick={() => window.print()}
                            className="inline-flex items-center px-3 py-2 bg-slate-900 text-white rounded-xl text-xs font-black hover:bg-slate-800 transition-all shadow-md shadow-slate-200"
                        >
                            <Download className="h-3.5 w-3.5 mr-1" />
                            PDF
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-lg overflow-hidden">
                <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/50">
                    {weekDays.map(day => (
                        <div key={day} className="py-4 text-center text-xs font-black text-slate-400 uppercase tracking-widest border-r last:border-r-0 border-slate-100">
                            {day}
                        </div>
                    ))}
                </div>
                <div className="divide-y divide-slate-100">
                    {weeks.map((week, weekIndex) => (
                        <div key={`week-${weekIndex}`} className="grid grid-cols-7">
                            {week.map(day => {
                                const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                                if (!isCurrentMonth) {
                                    return (
                                        <div key={day.toISOString()} className="min-h-[80px] bg-slate-50/20 border-r last:border-r-0 border-slate-100" />
                                    );
                                }

                                const dateKey = format(day, 'yyyy-MM-dd');
                                const dayInfo = monthData[dateKey];
                                const isToday = isSameDay(day, new Date());
                                const holidayName = dayInfo?.holidayName;
                                const isSaturday = getDay(day) === 6;
                                const isSunday = getDay(day) === 0;

                                return (
                                    <div
                                        key={dateKey}
                                        onClick={() => handleDateClick(day)}
                                        className={`min-h-[80px] p-3 border-r last:border-r-0 border-slate-100 flex flex-col transition-colors relative cursor-pointer group hover:bg-slate-50
                                            ${holidayName ? 'bg-rose-50/30' : ''} 
                                            ${isSaturday && !holidayName ? 'bg-amber-50/30' : ''} 
                                            ${isSunday && !holidayName ? 'bg-slate-100/40' : ''}`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex flex-col gap-0.5">
                                                <span className={`w-7 h-7 flex items-center justify-center text-sm font-black rounded-lg 
                                                    ${isToday ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' :
                                                        holidayName ? 'text-rose-600' :
                                                            isSunday ? 'text-slate-400' :
                                                                'text-slate-600'
                                                    }`}>
                                                    {format(day, 'd')}
                                                </span>
                                                {holidayName && (
                                                    <span className="text-[10px] font-bold text-rose-500 truncate max-w-[60px]" title={holidayName}>
                                                        {holidayName}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex gap-2 items-center">
                                                <button
                                                    className="opacity-0 group-hover:opacity-100 p-1 rounded-lg transition-all text-blue-500 hover:bg-blue-50"
                                                    title="申請補登打卡"
                                                >
                                                    <Plus className="h-4 w-4" />
                                                </button>
                                                {dayInfo?.hours > 0 && (
                                                    <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                                        {dayInfo.hours}H
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex-1 space-y-1.5">
                                            {dayInfo?.logs?.map(log => (
                                                <div
                                                    key={log.id}
                                                    className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-black border transition-all ${log.check_type === CheckType.IN
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                                        : 'bg-orange-50 text-orange-700 border-orange-100'
                                                        }`}
                                                >
                                                    <span className="material-symbols-outlined text-[12px]">
                                                        {log.check_type === CheckType.IN ? 'login' : 'logout'}
                                                    </span>
                                                    {format(parseISO(log.timestamp), 'HH:mm')}
                                                </div>
                                            ))}

                                            {dayInfo?.leaves?.map(leave => (
                                                <div
                                                    key={leave.id}
                                                    className="px-2 py-1 rounded-md text-[10px] font-black text-white shadow-sm"
                                                    style={{ backgroundColor: leave.leave_type?.color || '#3b82f6' }}
                                                    title={leave.reason}
                                                >
                                                    {leave.leave_type?.name} {leave.hours ? `${leave.hours}H` : ''}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>

            <div className="text-center text-slate-400 text-xs font-medium pb-8 print:hidden">
                * 工時計算僅供參考，系統自動扣除超過 5 小時工時中之 1 小時休息時間。
            </div>

            {/* Makeup Request Form Modal */}
            {showMakeupForm && employee && (
                <MakeupRequestForm
                    employeeId={employee.id}
                    initialDate={selectedDateStr}
                    onClose={() => setShowMakeupForm(false)}
                    onSuccess={() => {
                        setShowMakeupForm(false);
                        fetchData();
                    }}
                />
            )}
        </div>
    );
};

export default EmployeeCalendarPage;

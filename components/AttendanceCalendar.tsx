import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { format, startOfMonth, endOfMonth, isSameDay, parseISO, addMonths, subMonths, startOfWeek, getDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, FileText, Download, Plus } from 'lucide-react';
import { isNationalHoliday } from '../lib/holidays';
import MakeupRequestForm from './MakeupRequestForm';
import LeaveRequestForm from './LeaveRequestForm';
import ModificationRequestForm from './ModificationRequestForm';
import { requestService } from '../services/requestService';
import { getEmployeeInfo } from '../services/employee';
import { calculateLeaveHoursDetailed, calculateOTHours } from '../lib/leaveUtils';
import { formatDateTimeRange } from '../lib/hrUtils';
import { getEmployeeSchedules } from '../services/admin';
import { CheckType, Employee, EmployeeSchedule } from '../types';

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
    dayHours?: number;
    leave_type?: {
        name: string;
        color: string;
    };
}

interface AttendanceCalendarProps {
    targetEmployeeId: string;
    readOnly?: boolean;
}

const AttendanceCalendar: React.FC<AttendanceCalendarProps> = ({ targetEmployeeId, readOnly = false }) => {
    const [targetEmployee, setTargetEmployee] = useState<Employee | null>(null);
    const [currentDate, setCurrentDate] = useState<Date>(new Date());
    const [logs, setLogs] = useState<AttendanceLog[]>([]);
    const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
    const [historicalSchedules, setHistoricalSchedules] = useState<EmployeeSchedule[]>([]);
    const [loading, setLoading] = useState(false);
    const [showMakeupForm, setShowMakeupForm] = useState(false);
    const [selectedDateStr, setSelectedDateStr] = useState<string>('');
    const [showActionMenu, setShowActionMenu] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
    const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
    const [showModificationForm, setShowModificationForm] = useState(false);
    const [isWithdrawing, setIsWithdrawing] = useState(false);
    const [showDayMenu, setShowDayMenu] = useState(false);
    const [showLeaveForm, setShowLeaveForm] = useState(false);

    const rocYear = currentDate.getFullYear() - 1911;
    const monthStr = format(currentDate, 'M');

    useEffect(() => {
        if (targetEmployeeId) {
            fetchEmployeeInfo();
        }
    }, [targetEmployeeId]);

    useEffect(() => {
        if (targetEmployeeId) {
            fetchData();
        }
    }, [targetEmployeeId, currentDate]);

    const fetchEmployeeInfo = async () => {
        const info = await getEmployeeInfo(targetEmployeeId);
        setTargetEmployee(info as Employee);
    };

    const fetchData = async () => {
        if (!targetEmployeeId) return;
        setLoading(true);
        const start = startOfMonth(currentDate).toISOString();
        const end = endOfMonth(currentDate).toISOString();

        try {
            const { data: logsData } = await supabase
                .from('attendance_logs')
                .select('*')
                .eq('employee_id', targetEmployeeId)
                .gte('timestamp', start)
                .lte('timestamp', end);

            const { data: leavesData } = await supabase
                .from('leave_requests')
                .select(`
                    *,
                    leave_type:leave_types(name, color)
                `)
                .eq('employee_id', targetEmployeeId)
                .neq('status', 'WITHDRAWN')
                .or('is_modified.is.null,is_modified.eq.false')
                .or(`start_date.lte.${end},end_date.gte.${start}`);

            setLogs(logsData || []);
            setLeaves(leavesData || []);

            // Fetch historical schedules for accurate calculation
            const schedules = await getEmployeeSchedules(targetEmployeeId);
            setHistoricalSchedules(schedules || []);
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
            }).map(leave => {
                const s = parseISO(leave.start_date);
                const e = parseISO(leave.end_date);
                const startOfDay = new Date(day);
                startOfDay.setHours(0, 0, 0, 0);
                const endOfDay = new Date(day);
                endOfDay.setHours(23, 59, 59, 999);
                const overlapStart = new Date(Math.max(s.getTime(), startOfDay.getTime()));
                const overlapEnd = new Date(Math.min(e.getTime(), endOfDay.getTime()));
                
                let dayHours = 0;
                if (overlapStart < overlapEnd && targetEmployee) {
                    const typeName = leave.leave_type?.name || '';
                    const isOvertimeApplication = typeName.includes('加班') || typeName.includes('折現') || typeName.includes('折算');
                    
                    if (isOvertimeApplication) {
                        dayHours = calculateOTHours(
                            overlapStart,
                            overlapEnd,
                            targetEmployee,
                            historicalSchedules
                        );
                    } else {
                        const detailed = calculateLeaveHoursDetailed(
                            overlapStart,
                            overlapEnd,
                            targetEmployee,
                            false,
                            true,
                            historicalSchedules
                        );
                        dayHours = detailed.finalHours;
                    }
                }
                return { ...leave, dayHours };
            });

            let dayHours = 0;
            // -------------------------------------------------------------------------
            // 採用「區間聯集法 (Interval Union)」計算總工時
            // -------------------------------------------------------------------------
            const workIntervals: { start: Date, end: Date }[] = [];
            
            // 取得班表基準
            const getDayTime = (timeStr: string, baseDate: Date) => {
                if (!timeStr) return null;
                const [h, m] = timeStr.split(':').map(Number);
                const d = new Date(baseDate);
                d.setHours(h, m, 0, 0);
                return d;
            };

            const schedIn = getDayTime(targetEmployee?.work_start_time || '08:00', day)!;
            const schedOut = getDayTime(targetEmployee?.work_end_time || '17:00', day)!;

            // 1. 收集打卡區間
            if (dayLogs.length >= 2 && targetEmployee) {
                const checkInLog = dayLogs.find(l => l.check_type === CheckType.IN);
                const checkOutLog = [...dayLogs].reverse().find(l => l.check_type === CheckType.OUT);
                if (checkInLog && checkOutLog) {
                    const actualIn = new Date(checkInLog.timestamp);
                    const actualOut = new Date(checkOutLog.timestamp);
                    
                    // 應用彈性時間位移補償
                    let effectiveIn = actualIn;
                    let lateMs = 0;
                    if (actualIn > schedIn) {
                        lateMs = Math.min(actualIn.getTime() - schedIn.getTime(), 30 * 60 * 1000);
                        effectiveIn = new Date(actualIn.getTime() - lateMs);
                    }
                    
                    workIntervals.push({ start: effectiveIn, end: actualOut });
                    
                    // 暫存供 UI 使用
                    (day as any)._effectiveIn = effectiveIn;
                    (day as any)._effectiveOut = actualOut;
                }
            }

            // 2. 收集公務/加班申請區間 (僅 APPROVED)
            dayLeaves.forEach(leave => {
                if (leave.status?.toUpperCase() !== 'APPROVED') return;
                
                const typeName = leave.leave_type?.name || '';
                const workKeywords = /公出|家訪|出差|會議|加班|訓練|培訓|Official|Business|Visit|Meeting|Training|OT/i;
                const leaveKeywords = /請假|特休|事假|病假|補休|折現|折算|Holiday|Annual|Leave|Sick|Personal/i;
                const isWorkRelated = workKeywords.test(typeName) && !leaveKeywords.test(typeName);

                if (isWorkRelated) {
                    const s = parseISO(leave.start_date);
                    const e = parseISO(leave.end_date);
                    const startOfDay = new Date(day); startOfDay.setHours(0, 0, 0, 0);
                    const endOfDay = new Date(day); endOfDay.setHours(23, 59, 59, 999);
                    
                    const overlapStart = new Date(Math.max(s.getTime(), startOfDay.getTime()));
                    const overlapEnd = new Date(Math.min(e.getTime(), endOfDay.getTime()));
                    
                    if (overlapStart < overlapEnd) {
                        workIntervals.push({ start: overlapStart, end: overlapEnd });
                    }
                }
            });

            // 3. 執行聯集合併
            workIntervals.sort((a, b) => a.start.getTime() - b.start.getTime());
            const mergedIntervals: { start: Date, end: Date }[] = [];
            workIntervals.forEach(interval => {
                if (mergedIntervals.length === 0) {
                    mergedIntervals.push({ ...interval });
                } else {
                    const last = mergedIntervals[mergedIntervals.length - 1];
                    if (interval.start <= last.end) {
                        last.end = new Date(Math.max(last.end.getTime(), interval.end.getTime()));
                    } else {
                        mergedIntervals.push({ ...interval });
                    }
                }
            });

            // 4. 計算總時數並扣除休息時間
            let netTotalMs = 0;
            const breakWindows = [
                { s: getDayTime(targetEmployee?.break_start_time || '12:00', day), e: getDayTime(targetEmployee?.break_end_time || '13:00', day) },
                { s: getDayTime(targetEmployee?.break2_start_time || '', day), e: getDayTime(targetEmployee?.break2_end_time || '', day) },
                { s: getDayTime(targetEmployee?.break3_start_time || '', day), e: getDayTime(targetEmployee?.break3_end_time || '', day) }
            ].filter(b => b.s && b.e);

            mergedIntervals.forEach(m => {
                let segmentMs = m.end.getTime() - m.start.getTime();
                let breakOverlapMs = 0;
                breakWindows.forEach(b => {
                    const overlapS = Math.max(m.start.getTime(), b.s!.getTime());
                    const overlapE = Math.min(m.end.getTime(), b.e!.getTime());
                    if (overlapS < overlapE) {
                        breakOverlapMs += (overlapE - overlapS);
                    }
                });
                netTotalMs += (segmentMs - breakOverlapMs);
            });

            let finalHours = netTotalMs / (1000 * 60 * 60);

            // 5. 特殊規則：溢出容換與自動補齊
            // 計算班表約定工時 (例如 17:00 - 08:00 - 1H = 8.0)
            const schedDurationMs = schedOut.getTime() - schedIn.getTime();
            let schedBreakMs = 0;
            breakWindows.forEach(b => {
                const overlapS = Math.max(schedIn.getTime(), b.s!.getTime());
                const overlapE = Math.min(schedOut.getTime(), b.e!.getTime());
                if (overlapS < overlapE) schedBreakMs += (overlapE - overlapS);
            });
            const targetAgreedHours = (schedDurationMs - schedBreakMs) / (1000 * 60 * 60);

            // A. 低於標竿但接近：若在容放範圍 (如 7.6H~8.0H) 且工作區間確實涵蓋了主要班表，補齊至約定工時
            const coversCore = mergedIntervals.some(m => m.start <= schedIn && m.end >= schedOut);
            if (finalHours >= targetAgreedHours - 0.4 && finalHours < targetAgreedHours && coversCore) {
                finalHours = targetAgreedHours;
            }

            // B. 高於標竿但未滿 30 分鐘：若溢出部分 <= 0.5H，直接以約定工時計算
            if (finalHours > targetAgreedHours && finalHours <= targetAgreedHours + 0.5) {
                finalHours = targetAgreedHours;
            }

            dayHours = parseFloat(finalHours.toFixed(2));
            data[dateKey] = { logs: dayLogs, leaves: dayLeaves, hours: parseFloat(dayHours.toFixed(2)), holidayName };
        });

        return data;
    }, [days, logs, leaves, targetEmployee]);

    const totalMonthlyHours = Object.values(monthData).reduce((acc, curr) => acc + curr.hours, 0);
    const weekDays = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'];

    const handleDateClick = (day: Date) => {
        if (readOnly) return;
        setSelectedDateStr(format(day, 'yyyy-MM-dd'));
        setShowDayMenu(true);
    };

    const handleRequestClick = (e: React.MouseEvent, request: any) => {
        if (readOnly) return;
        e.stopPropagation();
        setSelectedRequest(request);
        setShowActionMenu(true);
    };

    const handleWithdraw = async () => {
        if (!targetEmployeeId || !selectedRequest) return;
        setIsWithdrawing(true);
        try {
            const result = await requestService.withdrawRequest(selectedRequest.id, targetEmployeeId);
            if (result.success) {
                alert('已送出撤回申請，請等待主管審核');
                setShowWithdrawConfirm(false);
                setShowActionMenu(false);
                fetchData();
            } else {
                alert(result.error || '撤回失敗');
            }
        } catch (error) {
            alert('系統錯誤');
        } finally {
            setIsWithdrawing(false);
        }
    };

    const getStatusBadge = (status: string) => {
        const statuses: { [key: string]: { text: string, class: string } } = {
            PENDING: { text: '待審核', class: 'bg-amber-100 text-amber-700 border-amber-200' },
            APPROVED: { text: '已核准', class: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
            REJECTED: { text: '已拒絕', class: 'bg-rose-100 text-rose-700 border-rose-200' },
            WITHDRAW_PENDING: { text: '撤回待審', class: 'bg-orange-100 text-orange-700 border-orange-200' }
        };
        const info = statuses[status] || statuses.PENDING;
        return <span className={`px-2 py-0.5 rounded text-[8px] font-black border ${info.class}`}>{info.text}</span>;
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
                            <h1 className="text-xl font-black text-slate-900 tracking-tight">
                                {readOnly ? `${targetEmployee?.name} 的出勤月曆` : '個人出勤月曆'}
                            </h1>
                            <div className="hidden print:block text-sm font-bold text-slate-600">
                                {rocYear} 年 {monthStr} 月 | {targetEmployee?.name}
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

                        {!readOnly && (
                            <button
                                onClick={() => setShowMakeupForm(true)}
                                className="inline-flex items-center px-3 py-2 bg-purple-600 text-white rounded-xl text-xs font-black hover:bg-purple-700 transition-all shadow-md shadow-purple-100"
                            >
                                <span className="material-symbols-outlined text-[16px] mr-1">edit_calendar</span>
                                <span className="hidden sm:inline">申請補卡</span>
                            </button>
                        )}

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
                                        className={`min-h-[80px] p-3 border-r last:border-r-0 border-slate-100 flex flex-col transition-colors relative group 
                                            ${!readOnly ? 'cursor-pointer hover:bg-slate-50' : ''}
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
                                                {!readOnly && (
                                                    <button
                                                        className="opacity-0 group-hover:opacity-100 p-1 rounded-lg transition-all text-blue-500 hover:bg-blue-50"
                                                        title="申請補登打卡"
                                                    >
                                                        <Plus className="h-4 w-4" />
                                                    </button>
                                                )}
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
                                                    onClick={(e) => handleRequestClick(e, leave)}
                                                    className={`px-2 py-1 rounded-md text-[10px] font-black text-white shadow-sm flex items-center justify-between gap-1 group/item transition-all
                                                        ${!readOnly ? 'hover:brightness-110 active:scale-[0.98] cursor-pointer' : ''}`}
                                                    style={{ backgroundColor: leave.leave_type?.color || '#3b82f6' }}
                                                    title={leave.reason}
                                                >
                                                    <span className="truncate flex-1">
                                                        {leave.leave_type?.name} {leave.dayHours ? `${parseFloat(String(leave.dayHours)).toFixed(1)}H` : leave.hours ? `${leave.hours}H` : ''}
                                                        {leave.dayHours && leave.hours && Math.abs(leave.dayHours - leave.hours) > 0.01 ? ` (總計 ${leave.hours}H)` : ''}
                                                    </span>
                                                    {leave.status !== 'APPROVED' && (
                                                        <span className="shrink-0 bg-white/20 px-1 rounded-[4px] text-[8px]">
                                                            {leave.status === 'PENDING' ? '待審' :
                                                                leave.status === 'REJECTED' ? '駁回' :
                                                                    leave.status === 'WITHDRAW_PENDING' ? '撤回中' : ''}
                                                        </span>
                                                    )}
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
            {showMakeupForm && targetEmployeeId && !readOnly && (
                <MakeupRequestForm
                    employeeId={targetEmployeeId}
                    initialDate={selectedDateStr}
                    onClose={() => setShowMakeupForm(false)}
                    onSuccess={() => {
                        setShowMakeupForm(false);
                        fetchData();
                    }}
                />
            )}

            {/* Day Action Menu Modal (快速申請選單) */}
            {showDayMenu && !readOnly && (
                <div
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300"
                    onClick={() => setShowDayMenu(false)}
                >
                    <div
                        className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm p-8 animate-in zoom-in-95 duration-300 text-center"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="mb-6 items-center flex flex-col">
                            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-4 font-black">
                                <span className="material-symbols-outlined text-4xl">add_circle</span>
                            </div>
                            <h2 className="text-xl font-black text-slate-900 mb-1">選擇操作</h2>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{selectedDateStr}</p>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                            <button
                                onClick={() => {
                                    setShowDayMenu(false);
                                    setShowMakeupForm(true);
                                }}
                                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-slate-800 transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined text-lg">edit_calendar</span>
                                申請補登打卡
                            </button>

                            <button
                                onClick={() => {
                                    setShowDayMenu(false);
                                    setShowLeaveForm(true);
                                }}
                                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined text-lg">event_note</span>
                                發起差勤申請
                            </button>

                            <button
                                onClick={() => setShowDayMenu(false)}
                                className="w-full py-4 bg-slate-100 text-slate-500 rounded-2xl font-black hover:bg-slate-200 transition-all active:scale-95"
                            >
                                取消
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Leave Request Form Modal */}
            {showLeaveForm && targetEmployeeId && !readOnly && (
                <LeaveRequestForm
                    employeeId={targetEmployeeId}
                    initialDate={selectedDateStr}
                    onClose={() => setShowLeaveForm(false)}
                    onSuccess={() => {
                        setShowLeaveForm(false);
                        fetchData();
                    }}
                />
            )}

            {/* Action Menu Modal */}
            {showActionMenu && selectedRequest && !readOnly && (
                <div
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300"
                    onClick={() => setShowActionMenu(false)}
                >
                    <div
                        className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm p-8 animate-in zoom-in-95 duration-300 text-center"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="mb-8 items-center flex flex-col">
                            <div
                                className="w-20 h-20 rounded-3xl flex items-center justify-center text-white border-4 border-white shadow-xl mb-6"
                                style={{ backgroundColor: selectedRequest.leave_type?.color || '#3b82f6' }}
                            >
                                <span className="material-symbols-outlined text-4xl">edit_calendar</span>
                            </div>
                            <div className="mb-2 uppercase tracking-widest text-[10px] font-black text-slate-400">
                                申請詳情
                            </div>
                            <h2 className="text-2xl font-black text-slate-900 mb-2">{selectedRequest.leave_type?.name || '差勤申請'}</h2>
                            <div className="flex items-center gap-2 mb-4">
                                {getStatusBadge(selectedRequest.status)}
                                {selectedRequest.hours && (
                                    <span className="px-2 py-0.5 rounded text-[8px] font-black border bg-slate-50 text-slate-600 border-slate-200">
                                        共 {selectedRequest.hours} 小時
                                    </span>
                                )}
                            </div>
                            <div className="text-xs text-slate-500 font-medium bg-slate-50 px-4 py-2 rounded-full">
                                {formatDateTimeRange(selectedRequest.start_date, selectedRequest.end_date)}
                            </div>
                            {selectedRequest.reason && (
                                <div className="text-sm text-slate-600 mt-4 px-4 line-clamp-3 italic">
                                    "{selectedRequest.reason}"
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                            {(selectedRequest.status === 'PENDING' || selectedRequest.status === 'APPROVED') && (
                                <button
                                    onClick={() => setShowWithdrawConfirm(true)}
                                    className="w-full py-4 bg-rose-50 text-rose-600 rounded-2xl font-black hover:bg-rose-100 transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-lg">cancel</span>
                                    撤回申請
                                </button>
                            )}

                            {(selectedRequest.status === 'APPROVED' || selectedRequest.status === 'REJECTED') && (
                                <button
                                    onClick={() => setShowModificationForm(true)}
                                    className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-lg">edit</span>
                                    申請變更
                                </button>
                            )}

                            <button
                                onClick={() => setShowActionMenu(false)}
                                className="w-full py-4 bg-slate-100 text-slate-500 rounded-2xl font-black hover:bg-slate-200 transition-all active:scale-95"
                            >
                                關閉選單
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Withdraw Confirmation Dialog */}
            {showWithdrawConfirm && !readOnly && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center">
                                <span className="material-symbols-outlined text-amber-600 text-2xl">warning</span>
                            </div>
                            <h3 className="text-xl font-black text-slate-900">確認撤回申請</h3>
                        </div>
                        <p className="text-slate-600 mb-6 font-medium">確定要撤回此申請嗎？撤回後將待主管審核，通過後將無法復原。</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowWithdrawConfirm(false)}
                                className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-black hover:bg-slate-200 transition-colors"
                                disabled={isWithdrawing}
                            >
                                取消
                            </button>
                            <button
                                onClick={handleWithdraw}
                                disabled={isWithdrawing}
                                className="flex-1 px-6 py-3 bg-rose-600 text-white rounded-xl font-black hover:bg-rose-700 transition-colors flex items-center justify-center gap-2"
                            >
                                {isWithdrawing && <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>}
                                確認撤回
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modification Request Form Modal */}
            {showModificationForm && targetEmployeeId && selectedRequest && !readOnly && (
                <ModificationRequestForm
                    originalRequest={selectedRequest}
                    employeeId={targetEmployeeId}
                    onClose={() => {
                        setShowModificationForm(false);
                    }}
                    onSuccess={() => {
                        setShowModificationForm(false);
                        setShowActionMenu(false);
                        fetchData();
                    }}
                />
            )}
        </div>
    );
};

export default AttendanceCalendar;

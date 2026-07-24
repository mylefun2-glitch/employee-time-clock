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
import { shiftService } from '../services/shiftService';
import { CheckType, Employee, EmployeeSchedule, EmployeeDayOverride, ShiftRequest } from '../types';

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
    const [shiftRequests, setShiftRequests] = useState<ShiftRequest[]>([]);
    const [historicalSchedules, setHistoricalSchedules] = useState<EmployeeSchedule[]>([]);
    const [dayOverrides, setDayOverrides] = useState<EmployeeDayOverride[]>([]);
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

            // 獲取挪移申請 (顯示標籤用)
            const shifts = await shiftService.getEmployeeShiftRequests(targetEmployeeId);
            setShiftRequests(shifts || []);

            // 獲取生效的挪移紀錄 (影響底色/計算用)
            const overrides = await shiftService.getEmployeeDayOverrides(
                targetEmployeeId, 
                format(startOfMonth(currentDate), 'yyyy-MM-dd'),
                format(endOfMonth(currentDate), 'yyyy-MM-dd')
            );
            setDayOverrides(overrides || []);

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
        const data: { [key: string]: { 
            logs: AttendanceLog[], 
            leaves: LeaveRequest[], 
            shifts: ShiftRequest[],
            override?: EmployeeDayOverride,
            hours: number, 
            holidayName?: string 
        } } = {};

        days.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dateKey = dateStr;
            const holidayName = isNationalHoliday(day);
            const dayOverride = dayOverrides.find(o => o.override_date === dateStr);
            
            const dayLogs = logs.filter(log => isSameDay(parseISO(log.timestamp), day))
                .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

            // 顯示該日相關的挪移申請
            const dayShifts = shiftRequests.filter(s => 
                s.original_rest_date === dateStr || 
                s.new_rest_date === dateStr || 
                s.target_date === dateStr
            );

            const rawDayLeaves = leaves.filter(leave => {
                const s = parseISO(leave.start_date);
                const e = parseISO(leave.end_date);
                const startOfDay = new Date(day);
                startOfDay.setHours(0, 0, 0, 0);
                const endOfDay = new Date(day);
                endOfDay.setHours(23, 59, 59, 999);
                return s <= endOfDay && e >= startOfDay;
            });

            // -------------------------------------------------------------------------
            // 採用「區間聯集法 (Interval Union)」計算總工時
            // -------------------------------------------------------------------------
            const workIntervals: { start: Date, end: Date }[] = [];
            const startOfDay = new Date(day); startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(day); endOfDay.setHours(23, 59, 59, 999);

            // 1. 收集公務/出差等工作區間 (用作最早起點計算 flexOffsetMs)
            rawDayLeaves.forEach(leave => {
                if (leave.status?.toUpperCase() !== 'APPROVED') return;
                const typeName = leave.leave_type?.name || '';
                const workKeywords = /公出|家訪|出差|會議|加班|訓練|培訓|派案|個督|Official|Business|Visit|Meeting|Training|OT/i;
                const leaveKeywords = /請假|特休|事假|病假|補休|Holiday|Annual|Leave|Sick|Personal/i;
                const isWorkRelated = workKeywords.test(typeName) && !leaveKeywords.test(typeName);

                if (isWorkRelated) {
                    const s = parseISO(leave.start_date);
                    const e = parseISO(leave.end_date);
                    const overlapStart = new Date(Math.max(s.getTime(), startOfDay.getTime()));
                    const overlapEnd = new Date(Math.min(e.getTime(), endOfDay.getTime()));
                    if (overlapStart < overlapEnd) {
                        workIntervals.push({ start: overlapStart, end: overlapEnd });
                    }
                }
            });

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

            // 2. 收集打卡區間並計算當天的彈性偏移量 flexOffsetMs
            let flexOffsetMs = 0;
            let effectiveIn: Date | null = null;
            let effectiveOut: Date | null = null;

            if (dayLogs.length >= 2 && targetEmployee) {
                const checkInLog = dayLogs.find(l => l.check_type === CheckType.IN);
                const checkOutLog = [...dayLogs].reverse().find(l => l.check_type === CheckType.OUT);
                if (checkInLog && checkOutLog) {
                    const actualIn = new Date(checkInLog.timestamp);
                    const actualOut = new Date(checkOutLog.timestamp);
                    
                    effectiveIn = actualIn;
                    const flexWindowMs = 30 * 60 * 1000;
                    
                    // A. 動態位移判定：以「全日最早起點」為基準
                    const allStarts = workIntervals.map(iv => iv.start.getTime());
                    allStarts.push(actualIn.getTime());
                    const overallStartMs = Math.min(...allStarts);
                    const diffInMs = overallStartMs - schedIn.getTime();

                    // 檢查打卡時間是否被假單覆蓋
                    const coveredByLeave = rawDayLeaves.some(l => {
                        if (l.status?.toUpperCase() !== 'APPROVED') return false;
                        const leaveStart = parseISO(l.start_date);
                        const leaveEnd = parseISO(l.end_date);
                        return (leaveStart <= actualIn && leaveEnd >= actualIn) || (leaveEnd.getHours() === 12 && actualIn.getHours() <= 13);
                    });

                    if (coveredByLeave || diffInMs <= 0) {
                        // 早上有假單覆蓋，或起始時間早於準點
                        flexOffsetMs = 0;
                        effectiveIn = (diffInMs <= 0 && diffInMs >= -flexWindowMs) ? schedIn : actualIn;
                    } else {
                        // 起時時間在準點後（且無公務覆蓋）
                        if (diffInMs <= flexWindowMs) {
                            flexOffsetMs = diffInMs;
                            effectiveIn = actualIn;
                        } else {
                            flexOffsetMs = flexWindowMs;
                            effectiveIn = new Date(actualIn.getTime() - flexWindowMs);
                        }
                    }
                    
                    // B. 動態標竿對齊：結束端 (17:00 + 位移) 與 30 分鐘單位化
                    const expectedOut = new Date(schedOut.getTime() + flexOffsetMs);
                    const diffOutMs = actualOut.getTime() - expectedOut.getTime();

                    // 加班對齊規則：以 30 分鐘為一單位，不足一單位的「去尾」至標竿或最近的 30 分鐘點
                    if (diffOutMs >= 0) {
                        const blocks = Math.floor(diffOutMs / flexWindowMs);
                        effectiveOut = new Date(expectedOut.getTime() + blocks * flexWindowMs);
                    } else {
                        // 早退情況：保留實際簽退
                        effectiveOut = actualOut;
                    }
                }
            }

            // 3. 結合算出的 flexOffsetMs，動態且精確地計算請假時數
            const dayLeaves = rawDayLeaves.map(leave => {
                const s = parseISO(leave.start_date);
                const e = parseISO(leave.end_date);
                const overlapStart = new Date(Math.max(s.getTime(), startOfDay.getTime()));
                const overlapEnd = new Date(Math.min(e.getTime(), endOfDay.getTime()));
                
                let dayHours = 0;
                if (overlapStart < overlapEnd && targetEmployee) {
                    const typeName = leave.leave_type?.name || '';
                    const isOvertimeApplication = typeName.includes('加班') || typeName.includes('折現') || typeName.includes('折算');
                    
                    if (isOvertimeApplication) {
                        const useStoredHours = leave.status === 'APPROVED' && leave.hours != null;
                        if (useStoredHours) {
                            // 判斷是否跨天：若不跨天直接用 hours，跨天時按天分配
                            const leaveStart = parseISO(leave.start_date);
                            const leaveEnd = parseISO(leave.end_date);
                            const leaveStartDay = new Date(leaveStart); leaveStartDay.setHours(0,0,0,0);
                            const leaveEndDay = new Date(leaveEnd); leaveEndDay.setHours(0,0,0,0);
                            if (leaveStartDay.getTime() === leaveEndDay.getTime()) {
                                // 單天：直接使用已存的 hours
                                dayHours = leave.hours;
                            } else {
                                // 跨天：按 overlap 比例分配
                                const totalMs = leaveEnd.getTime() - leaveStart.getTime();
                                const overlapMs = overlapEnd.getTime() - overlapStart.getTime();
                                dayHours = totalMs > 0 ? parseFloat((leave.hours * overlapMs / totalMs).toFixed(1)) : 0;
                            }
                        } else {
                            dayHours = calculateOTHours(
                                overlapStart,
                                overlapEnd,
                                targetEmployee,
                                historicalSchedules
                            );
                        }
                    } else {
                        const detailed = calculateLeaveHoursDetailed(
                            overlapStart,
                            overlapEnd,
                            targetEmployee,
                            false,
                            true,
                            historicalSchedules,
                            0,
                            false,
                            false,
                            undefined, // dayOverrides
                            flexOffsetMs // 帶入當天算出的彈性偏移量！
                        );
                        dayHours = detailed.finalHours;
                    }
                }
                return { ...leave, dayHours };
            });

            let dayHours = 0;
            // 4. 收集私假/扣除區間
            const nonWorkIntervals: { start: Date, end: Date }[] = [];
            let totalNonWorkLeaveHours = 0;

            dayLeaves.forEach(leave => {
                if (leave.status?.toUpperCase() !== 'APPROVED') return;
                
                const typeName = leave.leave_type?.name || '';
                const workKeywords = /公出|家訪|出差|會議|加班|訓練|培訓|派案|個督|Official|Business|Visit|Meeting|Training|OT/i;
                const leaveKeywords = /請假|特休|事假|病假|補休|Holiday|Annual|Leave|Sick|Personal/i;
                const isWorkRelated = workKeywords.test(typeName) && !leaveKeywords.test(typeName);

                const s = parseISO(leave.start_date);
                const e = parseISO(leave.end_date);
                const overlapStart = new Date(Math.max(s.getTime(), startOfDay.getTime()));
                const overlapEnd = new Date(Math.min(e.getTime(), endOfDay.getTime()));

                if (overlapStart < overlapEnd) {
                    if (!isWorkRelated) {
                        // 私假/補休區間：待從總工時中扣除
                        nonWorkIntervals.push({ start: overlapStart, end: overlapEnd });
                        totalNonWorkLeaveHours += (leave.dayHours || 0);
                    }
                }
            });

            // 5. 如果有打卡記錄，將打卡區間加入 workIntervals
            if (effectiveIn && effectiveOut) {
                workIntervals.push({ start: effectiveIn, end: effectiveOut });
                (day as any)._effectiveIn = effectiveIn;
                (day as any)._effectiveOut = effectiveOut;
            }

            // 3. 執行聯集合併
            const merge = (ivs: { start: Date, end: Date }[]) => {
                if (ivs.length === 0) return [];
                const sorted = [...ivs].sort((a, b) => a.start.getTime() - b.start.getTime());
                const result = [{ ...sorted[0] }];
                for (let i = 1; i < sorted.length; i++) {
                    const last = result[result.length - 1];
                    if (sorted[i].start <= last.end) {
                        last.end = new Date(Math.max(last.end.getTime(), sorted[i].end.getTime()));
                    } else {
                        result.push({ ...sorted[i] });
                    }
                }
                return result;
            };

            const mergedWork = merge(workIntervals);

            // 準備扣除區間 (休息時間 + 私假區間)
            const subtractiveIvs: { start: Date, end: Date }[] = [
                { start: getDayTime(targetEmployee?.break_start_time || '12:00', day)!, end: getDayTime(targetEmployee?.break_end_time || '13:00', day)! },
                { start: getDayTime(targetEmployee?.break2_start_time || '', day)!, end: getDayTime(targetEmployee?.break2_end_time || '', day)! },
                { start: getDayTime(targetEmployee?.break3_start_time || '', day)!, end: getDayTime(targetEmployee?.break3_end_time || '', day)! },
                ...nonWorkIntervals
            ].filter(iv => iv.start && iv.end);
            const mergedSubtractive = merge(subtractiveIvs);

            // 4. 計算淨工時
            let netTotalMs = 0;
            mergedWork.forEach(w => {
                let segmentMs = w.end.getTime() - w.start.getTime();
                let overlapMs = 0;
                mergedSubtractive.forEach(s => {
                    const overlapS = Math.max(w.start.getTime(), s.start.getTime());
                    const overlapE = Math.min(w.end.getTime(), s.end.getTime());
                    if (overlapS < overlapE) {
                        overlapMs += (overlapE - overlapS);
                    }
                });
                netTotalMs += (segmentMs - overlapMs);
            });

            let finalHours = netTotalMs / (1000 * 60 * 60);

            // 5. 特殊規則：溢出容換與動態標竿對齊
            const fullDaySchedMs = schedOut.getTime() - schedIn.getTime();
            let fullDayBreakMs = 0;
            const mergedBreaks = merge([
                { start: getDayTime(targetEmployee?.break_start_time || '12:00', day)!, end: getDayTime(targetEmployee?.break_end_time || '13:00', day)! },
                { start: getDayTime(targetEmployee?.break2_start_time || '', day)!, end: getDayTime(targetEmployee?.break2_end_time || '', day)! },
                { start: getDayTime(targetEmployee?.break3_start_time || '', day)!, end: getDayTime(targetEmployee?.break3_end_time || '', day)! }
            ].filter(iv => iv.start && iv.end));

            mergedBreaks.forEach(b => {
                const overlapS = Math.max(schedIn.getTime(), b.start.getTime());
                const overlapE = Math.min(schedOut.getTime(), b.end.getTime());
                if (overlapS < overlapE) fullDayBreakMs += (overlapE - overlapS);
            });

            const baseAgreedHours = (fullDaySchedMs - fullDayBreakMs) / (1000 * 60 * 60);
            const targetAgreedHours = Math.max(0, baseAgreedHours - totalNonWorkLeaveHours);

            if (targetAgreedHours > 0) {
                if (finalHours >= targetAgreedHours - 0.5 && finalHours < targetAgreedHours) {
                    finalHours = targetAgreedHours;
                }
                if (finalHours > targetAgreedHours && finalHours <= targetAgreedHours + 0.5) {
                    finalHours = targetAgreedHours;
                }
            } else if (totalNonWorkLeaveHours >= baseAgreedHours) {
                if (finalHours > 0 && finalHours <= 0.5) finalHours = 0;
            }

            dayHours = parseFloat(finalHours.toFixed(2));
            data[dateKey] = { 
                logs: dayLogs, 
                leaves: dayLeaves, 
                shifts: dayShifts || [],
                override: dayOverride,
                hours: parseFloat(dayHours.toFixed(2)), 
                holidayName 
            };
        });

        return data;
    }, [days, logs, leaves, targetEmployee, dayOverrides, shiftRequests, historicalSchedules]);

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
        <div className="w-full space-y-6 print:space-y-4 print:p-0">
            <div className="w-full bg-white p-4 sm:p-6 rounded-[2rem] border border-slate-100 shadow-sm print:shadow-none print:border-none print:p-0">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full gap-3 sm:gap-4">
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

                    <div className="flex flex-wrap items-center gap-2 print:hidden w-full sm:w-auto">
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

            <div className="w-full bg-white rounded-[1.5rem] sm:rounded-[2.5rem] border border-slate-100 shadow-lg overflow-x-auto">
                <div className="min-w-[560px] grid grid-cols-7 border-b border-slate-100 bg-slate-50/50">
                    {weekDays.map(day => (
                        <div key={day} className="py-2 sm:py-4 text-center text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest border-r last:border-r-0 border-slate-100">
                            {day}
                        </div>
                    ))}
                </div>
                <div className="min-w-[560px] divide-y divide-slate-100">
                    {weeks.map((week, weekIndex) => (
                        <div key={`week-${weekIndex}`} className="grid grid-cols-7">
                            {week.map(day => {
                                const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                                if (!isCurrentMonth) {
                                    return (
                                        <div key={day.toISOString()} className="min-h-[60px] sm:min-h-[80px] bg-slate-50/20 border-r last:border-r-0 border-slate-100" />
                                    );
                                }

                                const dateKey = format(day, 'yyyy-MM-dd');
                                const dayInfo = monthData[dateKey];
                                const isToday = isSameDay(day, new Date());
                                const holidayName = dayInfo?.holidayName;
                                const override = dayInfo?.override;
                                
                                // 判斷是否為工作日/休息日 (考慮挪移 override)
                                const isSaturday = getDay(day) === 6;
                                const isSunday = getDay(day) === 0;
                                const isNaturalWeekend = isSaturday || isSunday;
                                const isNaturalHoliday = !!holidayName;
                                const isNaturalRestDay = isNaturalWeekend || isNaturalHoliday;
                                
                                let isWorkDay = !isNaturalRestDay;
                                let isRestDay = isNaturalRestDay;
                                let overrideLabel = '';
                                
                                if (override) {
                                    if (override.work_start_time) {
                                        isWorkDay = true;
                                        isRestDay = false;
                                        overrideLabel = '挪移：上班';
                                    } else {
                                        isWorkDay = false;
                                        isRestDay = true;
                                        overrideLabel = '挪移：休息';
                                    }
                                }

                                return (
                                    <div
                                        key={dateKey}
                                        onClick={() => handleDateClick(day)}
                                        className={`min-h-[90px] sm:min-h-[120px] p-1.5 sm:p-3 border-r last:border-r-0 border-slate-100 flex flex-col transition-colors relative group 
                                            ${!readOnly ? 'cursor-pointer hover:bg-slate-50' : ''}
                                            ${isRestDay ? (holidayName || (override && !override.work_start_time) ? 'bg-rose-50/40' : isSaturday ? 'bg-amber-50/40' : 'bg-slate-50/60') : ''}
                                            ${override?.work_start_time ? 'bg-blue-50/30' : ''}`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex flex-col gap-0.5">
                                                <span className={`w-7 h-7 flex items-center justify-center text-sm font-black rounded-lg 
                                                    ${isToday ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' :
                                                        (holidayName || (override && !override.work_start_time)) ? 'text-rose-600' :
                                                            isSunday ? 'text-slate-400' :
                                                            isSaturday ? 'text-amber-600' :
                                                                'text-slate-600'
                                                    }`}>
                                                    {format(day, 'd')}
                                                </span>
                                                {(holidayName || overrideLabel) && (
                                                    <div className="flex flex-col">
                                                        {holidayName && (
                                                            <span className="text-[10px] font-bold text-rose-500 truncate max-w-[60px]" title={holidayName}>
                                                                {holidayName}
                                                            </span>
                                                        )}
                                                        {overrideLabel && (
                                                            <span className={`text-[10px] font-black ${override?.work_start_time ? 'text-blue-600' : 'text-rose-500'} truncate max-w-[60px]`}>
                                                                {overrideLabel}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex gap-2 items-center text-nowrap">
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

                                        <div className="flex-1 space-y-1.5 overflow-hidden">
                                            {/* 打卡紀錄 */}
                                            <div className="flex flex-col gap-1">
                                                {dayInfo?.logs?.map(log => (
                                                    <div
                                                        key={log.id}
                                                        className={`flex items-center justify-center px-2 py-0.5 rounded-md text-xs font-black border ${log.check_type === CheckType.IN
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                                            : 'bg-orange-50 text-orange-700 border-orange-100'
                                                            }`}
                                                    >
                                                        {format(parseISO(log.timestamp), 'HH:mm')}
                                                    </div>
                                                ))}
                                            </div>

                                            {/* 請假申請 */}
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

                                            {/* 挪移申請樣式 */}
                                            {dayInfo?.shifts?.map(shift => (
                                                <div
                                                    key={shift.id}
                                                    className={`px-2 py-1 rounded-md text-[10px] font-black text-white shadow-sm flex flex-col gap-0.5
                                                        ${shift.status === 'APPROVED' ? 'bg-indigo-600' : 'bg-slate-500/80'}`}
                                                    title={shift.reason}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className="flex items-center gap-1">
                                                            <span className="material-symbols-outlined text-[12px]">swap_horiz</span>
                                                            挪移
                                                        </span>
                                                        {shift.status !== 'APPROVED' && (
                                                            <span className="bg-white/20 px-1 rounded text-[8px]">{shift.status === 'PENDING' ? '待審' : '駁回'}</span>
                                                        )}
                                                    </div>
                                                    <div className="text-[8px] opacity-90 truncate leading-tight">
                                                        {shift.type === 'SWAP_REST_DAY' ? 
                                                            (shift.original_rest_date === dateKey ? `休➜工(${shift.new_rest_date})` : `工➜休(${shift.original_rest_date})`) :
                                                            `${shift.new_work_start_time}-${shift.new_work_end_time}`
                                                        }
                                                    </div>
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

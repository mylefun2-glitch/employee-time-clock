import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, parseISO, addMonths, subMonths, startOfWeek } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, User, Download, FileText, Trash2, X, CheckSquare, Square, Info } from 'lucide-react';
import { deleteAttendanceLog, deleteAttendanceLogs } from '../../services/admin';
import { Employee, CheckType } from '../../types';
import { isNationalHoliday } from '../../lib/holidays';

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
    hours?: number; // 新增時數欄位
    leave_type?: {
        name: string;
        color: string;
    };
}

const AttendanceCalendarPage: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    const [employees, setEmployees] = useState<Employee[]>([]);
    const [selectedDepartment, setSelectedDepartment] = useState<string>('ALL');
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(searchParams.get('employeeId') || '');
    const [currentDate, setCurrentDate] = useState<Date>(
        searchParams.get('year') && searchParams.get('month')
            ? new Date(parseInt(searchParams.get('year')!), parseInt(searchParams.get('month')!) - 1)
            : new Date()
    );

    const [logs, setLogs] = useState<AttendanceLog[]>([]);
    const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
    const [loading, setLoading] = useState(false);

    // Deletion State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deletingLogId, setDeletingLogId] = useState<string | null>(null);
    const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set());
    const [isDeleting, setIsDeleting] = useState(false);

    // 民國年度轉換
    const rocYear = currentDate.getFullYear() - 1911;
    const monthStr = format(currentDate, 'M');

    useEffect(() => {
        fetchEmployees();
    }, []);

    useEffect(() => {
        if (selectedEmployeeId) {
            fetchData();
            // Update URL
            setSearchParams({
                employeeId: selectedEmployeeId,
                year: currentDate.getFullYear().toString(),
                month: (currentDate.getMonth() + 1).toString()
            });
        }
    }, [selectedEmployeeId, currentDate]);

    const fetchEmployees = async () => {
        const { data, error } = await supabase
            .from('employees')
            .select('*')
            .eq('is_active', true)
            .order('name');
        if (data) {
            setEmployees(data);
            if (!selectedEmployeeId && data.length > 0) {
                setSelectedEmployeeId(data[0].id);
            }
        }
    };

    const fetchData = async () => {
        setLoading(true);
        const start = startOfMonth(currentDate).toISOString();
        const end = endOfMonth(currentDate).toISOString();

        try {
            // Fetch attendance logs
            const { data: logsData } = await supabase
                .from('attendance_logs')
                .select('*')
                .eq('employee_id', selectedEmployeeId)
                .gte('timestamp', start)
                .lte('timestamp', end);

            // Fetch leave requests (approved only)
            const { data: leavesData } = await supabase
                .from('leave_requests')
                .select(`
          *,
          leave_type:leave_types(name, color)
        `)
                .eq('employee_id', selectedEmployeeId)
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

    const days = useMemo(() => {
        const start = startOfMonth(currentDate);
        const end = endOfMonth(currentDate);
        return eachDayOfInterval({ start, end });
    }, [currentDate]);

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

            // Calculate advanced work hours
            let hours = 0;
            if (dayLogs.length >= 2) {
                const checkInLog = dayLogs.find(l => l.check_type === CheckType.IN);
                const checkOutLog = [...dayLogs].reverse().find(l => l.check_type === CheckType.OUT);

                if (checkInLog && checkOutLog) {
                    const employee = employees.find(e => e.id === selectedEmployeeId);

                    // 1. Get schedule times (prioritize individual settings)
                    const scheduleStart = employee?.work_start_time || '08:00';
                    const scheduleEnd = employee?.work_end_time || '17:00';
                    const breakStart = employee?.break_start_time || '12:00';
                    const breakEnd = employee?.break_end_time || '13:00';

                    const actualIn = new Date(checkInLog.timestamp);
                    const actualOut = new Date(checkOutLog.timestamp);

                    // Utility to create a Date object for a specific time on the day
                    const getDayTime = (timeStr: string) => {
                        const [hours, minutes] = timeStr.split(':').map(Number);
                        const d = new Date(actualIn);
                        d.setHours(hours, minutes, 0, 0);
                        return d;
                    };

                    const scheduledInDate = getDayTime(scheduleStart);
                    const scheduledOutDate = getDayTime(scheduleEnd);

                    // 2. Apply 30-minute grace period logic
                    let effectiveIn = actualIn;
                    const thirtyMins = 30 * 60 * 1000;

                    if (Math.abs(actualIn.getTime() - scheduledInDate.getTime()) <= thirtyMins) {
                        effectiveIn = scheduledInDate;
                    }

                    let effectiveOut = actualOut;
                    if (Math.abs(actualOut.getTime() - scheduledOutDate.getTime()) <= thirtyMins) {
                        effectiveOut = scheduledOutDate;
                    }

                    // 3. Calculate gross duration
                    let durationMs = effectiveOut.getTime() - effectiveIn.getTime();
                    if (durationMs < 0) durationMs = 0;

                    // 4. Precise break deduction (Support multiple breaks)
                    const breaks = [
                        { start: breakStart, end: breakEnd },
                        { start: employee?.break2_start_time, end: employee?.break2_end_time },
                        { start: employee?.break3_start_time, end: employee?.break3_end_time }
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

                    hours = (durationMs - totalBreakOverlapMs) / (1000 * 60 * 60);
                }
            }

            data[dateKey] = { logs: dayLogs, leaves: dayLeaves, hours: parseFloat(hours.toFixed(2)), holidayName };
        });

        return data;
    }, [days, logs, leaves]);

    const departments = useMemo(() => {
        const deps = Array.from(new Set(employees.map(emp => emp.department))).sort();
        return ['ALL', ...deps];
    }, [employees]);

    const filteredEmployees = useMemo(() => {
        if (selectedDepartment === 'ALL') return employees;
        return employees.filter(emp => emp.department === selectedDepartment);
    }, [employees, selectedDepartment]);

    useEffect(() => {
        if (filteredEmployees.length > 0 && !filteredEmployees.find(e => e.id === selectedEmployeeId)) {
            setSelectedEmployeeId(filteredEmployees[0].id);
        }
    }, [filteredEmployees]);

    const totalMonthlyHours = Object.values(monthData).reduce((acc, curr) => acc + curr.hours, 0);

    const weekDays = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'];

    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));

    const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);

    const handlePrint = () => {
        window.print();
    };

    const handleDeleteClick = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setDeletingLogId(id);
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!deletingLogId && selectedLogIds.size === 0) return;

        setIsDeleting(true);
        try {
            if (deletingLogId) {
                const success = await deleteAttendanceLog(deletingLogId);
                if (success) {
                    await fetchData();
                    setIsDeleteModalOpen(false);
                    setDeletingLogId(null);
                } else {
                    alert('刪除失敗，請稍後再試');
                }
            } else if (selectedLogIds.size > 0) {
                const result = await deleteAttendanceLogs(Array.from(selectedLogIds));
                if (result.success) {
                    await fetchData();
                    setSelectedLogIds(new Set());
                    setIsDeleteModalOpen(false);
                } else {
                    alert('批量刪除失敗，請稍後再試');
                }
            }
        } catch (error) {
            console.error('Error deleting log:', error);
            alert('系統錯誤');
        } finally {
            setIsDeleting(false);
        }
    };

    const toggleSelectLog = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const newSelected = new Set(selectedLogIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedLogIds(newSelected);
    };

    const selectAllLogsInDay = (dayLogs: AttendanceLog[], e: React.MouseEvent) => {
        e.stopPropagation();
        const newSelected = new Set(selectedLogIds);
        const dayIds = dayLogs.map(l => l.id);
        const allSelected = dayIds.every(id => newSelected.has(id));

        if (allSelected) {
            dayIds.forEach(id => newSelected.delete(id));
        } else {
            dayIds.forEach(id => newSelected.add(id));
        }
        setSelectedLogIds(newSelected);
    };

    return (
        <div className="space-y-6 print:space-y-4 print:p-0">
            {/* Header & Filters */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm print:shadow-none print:border-none print:p-0">
                <div className="flex flex-row items-center justify-between w-full gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center print:hidden">
                            <CalendarIcon className="text-blue-600 h-5 w-5" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-slate-900 tracking-tight">出勤月曆</h1>
                            <div className="hidden print:block text-sm font-bold text-slate-600">
                                {rocYear} 年 {monthStr} 月 | {selectedEmployee?.name}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 print:hidden">
                        <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-100">
                            <button onClick={prevMonth} className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-600">
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <div className="px-2 py-1 text-xs font-black text-slate-700 font-mono whitespace-nowrap">
                                {rocYear} / {monthStr}
                            </div>
                            <button onClick={nextMonth} className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-600">
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-100">
                            <Info className="ml-1.5 text-slate-400 h-3.5 w-3.5" />
                            <select
                                value={selectedDepartment}
                                onChange={(e) => setSelectedDepartment(e.target.value)}
                                className="bg-transparent border-none text-xs font-black text-slate-700 focus:ring-0 py-1.5 pr-6 outline-none"
                            >
                                {departments.map(dep => (
                                    <option key={dep} value={dep}>{dep === 'ALL' ? '所有單位' : dep}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-100">
                            <User className="ml-1.5 text-slate-400 h-3.5 w-3.5" />
                            <select
                                value={selectedEmployeeId}
                                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                                className="bg-transparent border-none text-xs font-black text-slate-700 focus:ring-0 py-1.5 pr-6 outline-none"
                            >
                                {filteredEmployees.map(emp => (
                                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                                ))}
                            </select>
                        </div>

                        {selectedLogIds.size > 0 && (
                            <button
                                onClick={() => {
                                    setDeletingLogId(null);
                                    setIsDeleteModalOpen(true);
                                }}
                                className="px-3 py-2 bg-rose-500 text-white rounded-xl text-xs font-black hover:bg-rose-600 transition-all shadow-md shadow-rose-100"
                            >
                                刪除 ({selectedLogIds.size})
                            </button>
                        )}

                        <div className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-xl shadow-md shadow-blue-100 whitespace-nowrap">
                            <FileText className="h-3.5 w-3.5" />
                            <span className="text-xs font-black">工時: {totalMonthlyHours.toFixed(1)}</span>
                        </div>

                        <button
                            onClick={handlePrint}
                            className="inline-flex items-center px-3 py-2 bg-slate-900 text-white rounded-xl text-xs font-black hover:bg-slate-800 transition-all shadow-md shadow-slate-200"
                        >
                            <Download className="h-3.5 w-3.5 mr-1" />
                            PDF
                        </button>
                    </div>
                </div>
            </div>


            {/* Calendar Grid */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-lg overflow-hidden">
                <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/50">
                    {weekDays.map(day => (
                        <div key={day} className="py-4 text-center text-xs font-black text-slate-400 uppercase tracking-widest border-r last:border-r-0 border-slate-100">
                            {day}
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-7">
                    {/* Calendar Padding for start of month (Adjusted for Monday start) */}
                    {Array.from({ length: (getDay(startOfMonth(currentDate)) + 6) % 7 }).map((_, i) => (
                        <div key={`pad-${i}`} className="min-h-[140px] bg-slate-50/20 border-r border-b border-slate-100" />
                    ))}

                    {days.map(day => {
                        const dateKey = format(day, 'yyyy-MM-dd');
                        const dayInfo = monthData[dateKey];
                        const isToday = isSameDay(day, new Date());
                        const holidayName = dayInfo.holidayName;
                        const isSaturday = getDay(day) === 6;
                        const isSunday = getDay(day) === 0;

                        return (
                            <div
                                key={dateKey}
                                className={`min-h-[140px] p-3 border-r border-b border-slate-100 flex flex-col group hover:bg-slate-50/50 transition-colors 
                                    ${holidayName ? 'bg-rose-50/30' : ''} 
                                    ${isSaturday && !holidayName ? 'bg-amber-50/30' : ''} 
                                    ${isSunday && !holidayName ? 'bg-slate-100/40' : ''} 
                                    ${!holidayName && !isSaturday && !isSunday ? '' : ''}`}
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
                                        {dayInfo.logs.length > 1 && (
                                            <button
                                                onClick={(e) => selectAllLogsInDay(dayInfo.logs, e)}
                                                className={`p-1 rounded-lg transition-all ${dayInfo.logs.every(l => selectedLogIds.has(l.id))
                                                    ? 'bg-rose-50 text-rose-600 shadow-sm'
                                                    : 'text-slate-400 hover:bg-slate-100'
                                                    }`}
                                                title={dayInfo.logs.every(l => selectedLogIds.has(l.id)) ? '取消全選' : '選取今日所有紀錄'}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        )}
                                        {dayInfo.hours > 0 && (
                                            <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                                {dayInfo.hours}H
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex-1 space-y-1.5 overflow-y-auto max-h-[100px] scrollbar-hide">
                                    {/* Logs */}
                                    {dayInfo.logs.length > 0 && (
                                        <div className="space-y-1">
                                            {dayInfo.logs.map(log => (
                                                <div
                                                    key={log.id}
                                                    onClick={(e) => toggleSelectLog(log.id, e)}
                                                    className={`flex items-center justify-between gap-1.5 px-2 py-1 rounded-md text-[10px] font-black border group/log cursor-pointer transition-all ${selectedLogIds.has(log.id)
                                                        ? 'bg-blue-600 text-white border-blue-600 shadow-md transform scale-105 z-10'
                                                        : log.check_type === CheckType.IN
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                                            : 'bg-orange-50 text-orange-700 border-orange-100'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-1.5">
                                                        {selectedLogIds.has(log.id) ? (
                                                            <CheckSquare className="h-3 w-3" />
                                                        ) : (
                                                            <span className="material-symbols-outlined text-[12px]">
                                                                {log.check_type === CheckType.IN ? 'login' : 'logout'}
                                                            </span>
                                                        )}
                                                        {format(parseISO(log.timestamp), 'HH:mm')}
                                                    </div>
                                                    <button
                                                        onClick={(e) => handleDeleteClick(log.id, e)}
                                                        className={`opacity-0 group-hover/log:opacity-100 p-0.5 rounded transition-all ${selectedLogIds.has(log.id)
                                                            ? 'hover:bg-white/20 text-white/70 hover:text-white'
                                                            : 'hover:bg-white text-slate-400 hover:text-rose-500'
                                                            }`}
                                                        title="刪除紀錄"
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Leaves */}
                                    {dayInfo.leaves.map(leave => (
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

                    {/* Fill the rest of the grid */}
                    {Array.from({ length: (7 - ((getDay(endOfMonth(currentDate)) + 6) % 7 + 1)) % 7 }).map((_, i) => (
                        <div key={`pad-end-${i}`} className="min-h-[140px] bg-slate-50/20 border-b border-slate-100 last:border-r-0" />
                    ))}
                </div>
            </div>

            {/* Footer Info */}
            <div className="text-center text-slate-400 text-xs font-medium pb-8 print:hidden">
                * 工時計算僅供參考，系統自動扣除超過 5 小時工時中之 1 小時休息時間。
            </div>

            {/* Delete Confirmation Modal */}
            {isDeleteModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
                        <div className="p-8 text-center">
                            <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Trash2 className="h-10 w-10 text-rose-500" />
                            </div>
                            <h3 className="text-xl font-black text-slate-900 mb-2">確定要刪除這筆紀錄？</h3>
                            <p className="text-slate-500 font-medium leading-relaxed">
                                刪除後將無法恢復，且會直接影響本月的工時統計。
                            </p>
                        </div>
                        <div className="flex border-t border-slate-100">
                            <button
                                onClick={() => setIsDeleteModalOpen(false)}
                                disabled={isDeleting}
                                className="flex-1 py-5 text-sm font-black text-slate-400 hover:bg-slate-50 transition-colors border-r border-slate-100"
                            >
                                取消
                            </button>
                            <button
                                onClick={confirmDelete}
                                disabled={isDeleting}
                                className="flex-1 py-5 text-sm font-black text-rose-500 hover:bg-rose-50 transition-colors"
                            >
                                {isDeleting ? '處理中...' : '確定刪除'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AttendanceCalendarPage;

import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, parseISO, addMonths, subMonths } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, User, Download, FileText, Trash2, X } from 'lucide-react';
import { deleteAttendanceLog } from '../../services/admin';
import { Employee, CheckType } from '../../types';

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
    leave_type?: {
        name: string;
        color: string;
    };
}

const AttendanceCalendarPage: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    const [employees, setEmployees] = useState<Employee[]>([]);
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
        const data: { [key: string]: { logs: AttendanceLog[], leaves: LeaveRequest[], hours: number } } = {};

        days.forEach(day => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayLogs = logs.filter(log => isSameDay(parseISO(log.timestamp), day))
                .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

            const dayLeaves = leaves.filter(leave => {
                const s = parseISO(leave.start_date);
                const e = parseISO(leave.end_date);
                return day >= s && day <= e;
            });

            // Calculate simple work hours (IN to OUT)
            let hours = 0;
            if (dayLogs.length >= 2) {
                const checkIn = dayLogs.find(l => l.check_type === CheckType.IN);
                const checkOut = [...dayLogs].reverse().find(l => l.check_type === CheckType.OUT);
                if (checkIn && checkOut) {
                    const diff = new Date(checkOut.timestamp).getTime() - new Date(checkIn.timestamp).getTime();
                    hours = Math.max(0, diff / (1000 * 60 * 60));
                    // Subtract 1 hour for lunch break if worked more than 5 hours (simple heuristic)
                    if (hours > 5) hours -= 1;
                }
            } else if (dayLogs.length === 0 && dayLeaves.some(l => l.leave_type?.name === '出差' || l.leave_type?.name === '公假')) {
                hours = 8; // Business trip / official leave count as 8 hours
            }

            data[dateKey] = { logs: dayLogs, leaves: dayLeaves, hours: parseFloat(hours.toFixed(2)) };
        });

        return data;
    }, [days, logs, leaves]);

    const totalMonthlyHours = Object.values(monthData).reduce((acc, curr) => acc + curr.hours, 0);

    const weekDays = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];

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
        if (!deletingLogId) return;

        setIsDeleting(true);
        try {
            const success = await deleteAttendanceLog(deletingLogId);
            if (success) {
                // Refresh data
                await fetchData();
                setIsDeleteModalOpen(false);
                setDeletingLogId(null);
            } else {
                alert('刪除失敗，請稍後再試');
            }
        } catch (error) {
            console.error('Error deleting log:', error);
            alert('系統錯誤');
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="space-y-6 print:space-y-4 print:p-0">
            {/* Header & Filters */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm print:shadow-none print:border-none print:p-0">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center print:hidden">
                            <CalendarIcon className="text-blue-600 h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight">出勤月曆檢視</h1>
                            <p className="text-sm text-slate-500 font-medium print:hidden">查看員工每月詳細出勤、差勤與工時統計</p>
                            <div className="hidden print:block text-sm font-bold text-slate-600 mt-1">
                                年度：{rocYear} | 月份：{monthStr} | 姓名：{selectedEmployee?.name}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 print:hidden">
                        <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-100">
                            <button
                                onClick={prevMonth}
                                className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-600"
                            >
                                <ChevronLeft className="h-5 w-5" />
                            </button>
                            <div className="px-4 py-1 text-sm font-black text-slate-700 font-mono">
                                {rocYear} 年 {monthStr} 月
                            </div>
                            <button
                                onClick={nextMonth}
                                className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-600"
                            >
                                <ChevronRight className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-100">
                            <User className="ml-2 text-slate-400 h-4 w-4" />
                            <select
                                value={selectedEmployeeId}
                                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                                className="bg-transparent border-none text-sm font-black text-slate-700 focus:ring-0 py-2 pr-8"
                            >
                                {employees.map(emp => (
                                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.department})</option>
                                ))}
                            </select>
                        </div>

                        <button
                            onClick={handlePrint}
                            className="inline-flex items-center px-4 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-black hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
                        >
                            <Download className="h-4 w-4 mr-2" />
                            匯出 PDF
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">目前員工</p>
                        <p className="text-xl font-black text-slate-900 mt-1">{selectedEmployee?.name || '未選擇'}</p>
                    </div>
                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400">
                        <User className="h-6 w-6" />
                    </div>
                </div>
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">年度 / 月份</p>
                        <p className="text-xl font-black text-slate-900 mt-1">{rocYear} / {monthStr}</p>
                    </div>
                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400">
                        <CalendarIcon className="h-6 w-6" />
                    </div>
                </div>
                <div className="bg-blue-600 p-5 rounded-3xl shadow-xl shadow-blue-100 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest">本月工時總計</p>
                        <p className="text-3xl font-black text-white mt-1">{totalMonthlyHours.toFixed(1)} <span className="text-sm font-bold opacity-80">hrs</span></p>
                    </div>
                    <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white">
                        <FileText className="h-6 w-6" />
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
                    {/* Calendar Padding for start of month */}
                    {Array.from({ length: getDay(startOfMonth(currentDate)) }).map((_, i) => (
                        <div key={`pad-${i}`} className="min-h-[140px] bg-slate-50/20 border-r border-b border-slate-100" />
                    ))}

                    {days.map(day => {
                        const dateKey = format(day, 'yyyy-MM-dd');
                        const dayInfo = monthData[dateKey];
                        const isToday = isSameDay(day, new Date());
                        const isWeekend = getDay(day) === 0 || getDay(day) === 6;

                        return (
                            <div
                                key={dateKey}
                                className={`min-h-[140px] p-3 border-r border-b border-slate-100 flex flex-col group hover:bg-slate-50/50 transition-colors ${isWeekend ? 'bg-slate-50/30' : ''}`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className={`w-7 h-7 flex items-center justify-center text-sm font-black rounded-lg ${isToday ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-slate-400'
                                        }`}>
                                        {format(day, 'd')}
                                    </span>
                                    {dayInfo.hours > 0 && (
                                        <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                            {dayInfo.hours}H
                                        </span>
                                    )}
                                </div>

                                <div className="flex-1 space-y-1.5 overflow-y-auto max-h-[100px] scrollbar-hide">
                                    {/* Logs */}
                                    {dayInfo.logs.length > 0 && (
                                        <div className="space-y-1">
                                            {dayInfo.logs.map(log => (
                                                <div key={log.id} className={`flex items-center justify-between gap-1.5 px-2 py-1 rounded-md text-[10px] font-black border group/log ${log.check_type === CheckType.IN
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                                    : 'bg-orange-50 text-orange-700 border-orange-100'
                                                    }`}>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="material-symbols-outlined text-[12px]">
                                                            {log.check_type === CheckType.IN ? 'login' : 'logout'}
                                                        </span>
                                                        {format(parseISO(log.timestamp), 'HH:mm')}
                                                    </div>
                                                    <button
                                                        onClick={(e) => handleDeleteClick(log.id, e)}
                                                        className="opacity-0 group-hover/log:opacity-100 p-0.5 hover:bg-white rounded transition-all text-slate-400 hover:text-rose-500"
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
                                            {leave.leave_type?.name}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}

                    {/* Fill the rest of the grid */}
                    {Array.from({ length: (7 - (getDay(endOfMonth(currentDate)) + 1)) % 7 }).map((_, i) => (
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

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, parseISO, addMonths, subMonths, startOfWeek } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, User, Download, FileText, Trash2, X, CheckSquare, Square, Info, Search, Plus, Pencil } from 'lucide-react';
import TimeInput24h from '../../components/ui/TimeInput24h';
import { sortByNameStroke } from '../../lib/nameStrokeSort';
import { deleteAttendanceLog, deleteAttendanceLogs, createAttendanceLog, updateAttendanceLog, importAttendanceLogs, getEmployeeSchedules, getMonthlySalarySchedules, importMonthlySalarySchedules, MonthlySalarySchedule, updateMonthlySalarySchedule, deleteMonthlySalarySchedule } from '../../services/admin';
import { isNationalHoliday } from '../../lib/holidays';
import ModificationRequestForm from '../../components/ModificationRequestForm';
import LeaveRequestForm from '../../components/LeaveRequestForm';
import { calculateLeaveHoursDetailed, calculateOTHours } from '../../lib/leaveUtils';
import { formatDateTimeRange } from '../../lib/hrUtils';
import { shiftService } from '../../services/shiftService';
import { Employee, CheckType, EmployeeSchedule, ShiftRequest, EmployeeDayOverride, DayOverrideType } from '../../types';

interface AttendanceLog {
    id: string;
    employee_id: string;
    check_type: CheckType;
    timestamp: string;
    note?: string;
}

interface LeaveRequest {
    id: string;
    employee_id: string;
    start_date: string;
    end_date: string;
    reason: string;
    status: string;
    type?: string; 
    leave_type_id?: string;
    is_makeup_workday?: boolean;
    is_makeup_holiday?: boolean;
    manual_break_hours?: number;
    hours?: number;
    leave_type?: {
        name: string;
        color: string;
        code?: string;
    };
    dayHours?: number;
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
    const [shiftRequests, setShiftRequests] = useState<ShiftRequest[]>([]);
    const [dayOverrides, setDayOverrides] = useState<EmployeeDayOverride[]>([]);
    const [historicalSchedules, setHistoricalSchedules] = useState<EmployeeSchedule[]>([]);
    const [loading, setLoading] = useState(false);

    // Deletion State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deletingLogId, setDeletingLogId] = useState<string | null>(null);
    const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set());
    const [isDeleting, setIsDeleting] = useState(false);
    const [importing, setImporting] = useState(false);
    const [importingSchedule, setImportingSchedule] = useState(false);
    const [salarySchedules, setSalarySchedules] = useState<MonthlySalarySchedule[]>([]);

    // Employee Search State
    const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');
    const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false);
    const employeeDropdownRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const scheduleFileInputRef = useRef<HTMLInputElement>(null);

    // Add Log State
    const [isAddLogModalOpen, setIsAddLogModalOpen] = useState(false);
    const [isEditLogModalOpen, setIsEditLogModalOpen] = useState(false);
    const [editingLog, setEditingLog] = useState<AttendanceLog | null>(null);
    const [editingSalarySchedule, setEditingSalarySchedule] = useState<MonthlySalarySchedule | null>(null);
    const [isEditSalaryScheduleModalOpen, setIsEditSalaryScheduleModalOpen] = useState(false);
    const [salaryScheduleForm, setSalaryScheduleForm] = useState({
        shift_type: '',
        case_name: '',
        service_mins: 0,
        note: ''
    });
    const [isSubmittingSalarySchedule, setIsSubmittingSalarySchedule] = useState(false);
    const [selectedLeaveForModification, setSelectedLeaveForModification] = useState<LeaveRequest | null>(null);
    const [selectedLeaveForAction, setSelectedLeaveForAction] = useState<LeaveRequest | null>(null);
    const [showActionMenu, setShowActionMenu] = useState(false);
    const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
    const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
    const [isWithdrawing, setIsWithdrawing] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [newLogCheckType, setNewLogCheckType] = useState<CheckType>(CheckType.IN);
    const [newLogTime, setNewLogTime] = useState('08:00');
    const [newLogNote, setNewLogNote] = useState('漏卡補登');
    const [isSubmittingLog, setIsSubmittingLog] = useState(false);
    const [showQuickActionMenu, setShowQuickActionMenu] = useState(false);
    const [isLeaveRequestModalOpen, setIsLeaveRequestModalOpen] = useState(false);

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
          leave_type:leave_types(name, color, code)
        `)
                .eq('employee_id', selectedEmployeeId)
                .neq('status', 'WITHDRAWN')
                .or('is_modified.is.null,is_modified.eq.false')
                .or(`start_date.lte.${end},end_date.gte.${start}`);

            setLogs(logsData || []);
            setLeaves(leavesData || []);

            // Fetch shift requests
            const shifts = await shiftService.getEmployeeShiftRequests(selectedEmployeeId);
            setShiftRequests(shifts || []);

            // Fetch day overrides
            const overrides = await shiftService.getEmployeeDayOverrides(
                selectedEmployeeId,
                format(startOfMonth(currentDate), 'yyyy-MM-dd'),
                format(endOfMonth(currentDate), 'yyyy-MM-dd')
            );
            setDayOverrides(overrides || []);

            // Fetch historical schedules
            const schedules = await getEmployeeSchedules(selectedEmployeeId);
            setHistoricalSchedules(schedules);

            // Fetch monthly salary schedules（薪制班表）
            const startDateStr = format(startOfMonth(currentDate), 'yyyy-MM-dd');
            const endDateStr = format(endOfMonth(currentDate), 'yyyy-MM-dd');
            const salaryScheds = await getMonthlySalarySchedules(selectedEmployeeId, startDateStr, endDateStr);
            setSalarySchedules(salaryScheds);
        } catch (err) {
            console.error('Error fetching calendar data:', err);
        } finally {
            setLoading(false);
        }
    };

    // 健壯的 CSV 解析器
    const parseCSV = (text: string) => {
        const rows: string[][] = [];
        let currentRow: string[] = [];
        let currentField = '';
        let inQuotes = false;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const nextChar = text[i + 1];

            if (inQuotes) {
                if (char === '"') {
                    if (nextChar === '"') {
                        currentField += '"';
                        i++;
                    } else {
                        inQuotes = false;
                    }
                } else {
                    currentField += char;
                }
            } else {
                if (char === '"') {
                    inQuotes = true;
                } else if (char === ',') {
                    currentRow.push(currentField.trim());
                    currentField = '';
                } else if (char === '\r' || char === '\n') {
                    currentRow.push(currentField.trim());
                    if (currentRow.length > 0 && currentRow.some(f => f !== '')) {
                        rows.push(currentRow);
                    }
                    currentRow = [];
                    currentField = '';
                    if (char === '\r' && nextChar === '\n') i++;
                } else {
                    currentField += char;
                }
            }
        }

        if (currentField || currentRow.length > 0) {
            currentRow.push(currentField.trim());
            rows.push(currentRow);
        }

        return rows;
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!file.name.endsWith('.csv')) {
            alert('請選擇 CSV 檔案');
            return;
        }

        setImporting(true);
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target?.result as string;
                const rows = parseCSV(text);

                if (rows.length <= 1) {
                    alert('檔案中沒有資料');
                    return;
                }

                // 標題 mapping: 姓名,PIN碼,打卡類型,日期,時間,備註
                const importLogs = [];
                for (let i = 1; i < rows.length; i++) {
                    const [name, pin, check_type, date, time, note] = rows[i];
                    if ((!name && !pin) || !check_type || !date || !time) {
                        continue;
                    }

                    importLogs.push({
                        name,
                        pin,
                        check_type, // 'IN' 或 'OUT'
                        date,       // YYYY-MM-DD
                        time,       // HH:mm
                        note
                    });
                }

                if (importLogs.length === 0) {
                    alert('找不到有效的打卡紀錄');
                    return;
                }

                const res = await importAttendanceLogs(importLogs);
                if (res.success) {
                    let msg = `匯入完成！成功：${res.succeeded} 筆`;
                    if (res.skipped > 0) msg += `，跳過重複：${res.skipped} 筆`;
                    if (res.failed > 0) msg += `，失敗：${res.failed} 筆`;

                    if (res.errors.length > 0) {
                        msg += `\n\n失敗原因：\n` + res.errors.map(err => `第 ${err.line} 行: ${err.error}`).join('\n');
                    }
                    alert(msg);
                    fetchData();
                } else {
                    alert(`匯入失敗：${res.errors[0]?.error || '未知錯誤'}`);
                }
            } catch (error: any) {
                alert(`匯入執行錯誤：${error.message}`);
            } finally {
                setImporting(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsText(file, 'UTF-8');
    };

    const handleDownloadTemplate = () => {
        const headers = ['姓名', 'PIN碼', '打卡類型(IN/OUT)', '日期(YYYY-MM-DD)', '時間(HH:mm)', '備註'];
        const example = ['王小明', '123456', 'IN', format(new Date(), 'yyyy-MM-dd'), '08:00', '補登'];
        const csvContent = [headers, example].map(r => r.join(',')).join('\n');

        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', '出勤打卡匯入範本.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // ============================================================
    // 薪制班表匯入 handlers
    // ============================================================

    const handleSalaryScheduleImportClick = () => {
        scheduleFileInputRef.current?.click();
    };

    const handleSalaryScheduleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!file.name.endsWith('.csv')) {
            alert('請選擇 CSV 檔案');
            return;
        }

        setImportingSchedule(true);
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target?.result as string;
                const rows = parseCSV(text);

                if (rows.length <= 1) {
                    alert('檔案中沒有資料');
                    return;
                }

                // 標題列: 姓名, 服務日期, 班別, 個案, 服務時間, 備註
                const importRows = [];
                for (let i = 1; i < rows.length; i++) {
                    const [name, service_date, shift_type, case_name, service_mins_str, note] = rows[i];
                    if (!name && !service_date) continue;

                    importRows.push({
                        name: name || '',
                        service_date: service_date || '',
                        shift_type: shift_type || '',
                        case_name: case_name || '',
                        service_mins_str: service_mins_str || '0',
                        note: note || ''
                    });
                }

                if (importRows.length === 0) {
                    alert('找不到有效的班表資料');
                    return;
                }

                const res = await importMonthlySalarySchedules(importRows);
                if (res.success) {
                    let msg = `班表匯入完成！成功：${res.succeeded} 筆`;
                    if (res.skipped > 0) msg += `，跳過重複：${res.skipped} 筆`;
                    if (res.failed > 0) msg += `，失敗：${res.failed} 筆`;
                    if (res.errors.length > 0) {
                        msg += `\n\n失敗原因：\n` + res.errors.map(err => `第 ${err.line} 行（${err.name}）: ${err.error}`).join('\n');
                    }
                    alert(msg);
                    fetchData();
                } else {
                    alert(`匯入失敗：${res.errors[0]?.error || '未知錯誤'}`);
                }
            } catch (error: any) {
                alert(`匯入執行錯誤：${error.message}`);
            } finally {
                setImportingSchedule(false);
                if (scheduleFileInputRef.current) scheduleFileInputRef.current.value = '';
            }
        };
        reader.readAsText(file, 'UTF-8');
    };

    const handleDownloadSalaryScheduleTemplate = () => {
        const headers = ['姓名', '服務日期(yyyy-MM-dd)', '班別', '個案', '服務時間(分鐘)', '備註'];
        const examples = [
            ['王小明', format(new Date(), 'yyyy-MM-dd'), '正常班', '陳大華', '240', '居家服務'],
            ['李美玲', format(new Date(), 'yyyy-MM-dd'), '休息日班', '林小花', '180', ''],
            ['張志明', format(new Date(), 'yyyy-MM-dd'), '增-轉場', '自訂個案', '120', '交通時間已含'],
            ['陳惠君', format(new Date(), 'yyyy-MM-dd'), '國定假日', '王大同', '300', '加班補登'],
        ];
        const csvContent = [headers, ...examples].map(r => r.join(',')).join('\n');

        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', '薪制班表匯入範本.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };


    const weeks = useMemo(() => {
        const start = startOfMonth(currentDate);
        const end = endOfMonth(currentDate);

        // 取得月曆開始的第一天(週一開始)
        const calendarStart = startOfWeek(start, { weekStartsOn: 1 });

        const weeksArray: Date[][] = [];
        let currentWeek: Date[] = [];

        // 計算需要顯示的總天數 (包含填補的天數)
        const diffDays = Math.ceil((end.getTime() - calendarStart.getTime()) / (1000 * 60 * 60 * 24));
        const totalDaysToShow = Math.ceil((diffDays + (7 - (getDay(end) || 7) % 7 || 0)) / 7) * 7 + 7; // 多算一點確保覆蓋

        // 我們直接跑 6 週通常足夠, 或者精確計算
        let tempDate = new Date(calendarStart);
        for (let i = 0; i < 42; i++) { // 最多 6 週
            currentWeek.push(new Date(tempDate));
            if (currentWeek.length === 7) {
                weeksArray.push(currentWeek);
                currentWeek = [];
            }
            tempDate.setDate(tempDate.getDate() + 1);

            // 如果已經超過月底且剛好滿一週就停止
            if (tempDate > end && currentWeek.length === 0) break;
        }

        // 確保最後一週如果不滿 7 天則不加入(雖然上面的邏輯應該會滿 7 天)
        return weeksArray.filter(w => w.length === 7);
    }, [currentDate]);

    const days = useMemo(() => {
        return weeks.flat().filter(d => d >= startOfMonth(currentDate) && d <= endOfMonth(currentDate));
    }, [weeks, currentDate]);

    const monthData = useMemo(() => {
        const data: { [key: string]: { logs: AttendanceLog[], leaves: LeaveRequest[], shifts: ShiftRequest[], override?: EmployeeDayOverride, hours: number, grossHours: number, breakHours: number, holidayName?: string } } = {};

        days.forEach(day => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const holidayName = isNationalHoliday(day);
            const dayOverride = dayOverrides.find(o => o.override_date === dateKey);

            const dayLogs = logs.filter(log => isSameDay(parseISO(log.timestamp), day))
                .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

            // 顯示該日相關的挪移申請
            const dayShifts = shiftRequests.filter(s => 
                s.original_rest_date === dateKey || 
                s.new_rest_date === dateKey || 
                s.target_date === dateKey
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

            // Calculate advanced work hours
            let hours = 0;
            // -------------------------------------------------------------------------
            // 採用「區間聯集法 (Interval Union)」計算總工時
            // -------------------------------------------------------------------------
            const workIntervals: { start: Date, end: Date }[] = [];
            const employee = employees.find(e => e.id === selectedEmployeeId);
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

            // 取得班表與工具函數
            const getEffectiveSchedule = () => {
                const dateStr = format(day, 'yyyy-MM-dd');
                
                // 1. 優先考慮挪移覆蓋
                if (dayOverride) {
                    return {
                        work_start_time: dayOverride.work_start_time || employee?.work_start_time || '08:00',
                        work_end_time: dayOverride.work_end_time || employee?.work_end_time || '17:00',
                        break_start_time: dayOverride.break_start_time || employee?.break_start_time || '12:00',
                        break_end_time: dayOverride.break_end_time || employee?.break_end_time || '13:00',
                        break2_start_time: employee?.break2_start_time,
                        break2_end_time: employee?.break2_end_time,
                        break3_start_time: employee?.break3_start_time,
                        break3_end_time: employee?.break3_end_time,
                        rest_days: employee?.rest_days || [0, 6],
                        is_override: true,
                        override_type: dayOverride.day_type
                    } as any;
                }

                // 2. 歷史班表
                const schedule = historicalSchedules
                    .filter(s => s.effective_date <= dateStr)
                    .sort((a, b) => b.effective_date.localeCompare(a.effective_date))[0];

                if (schedule) return schedule;
                return {
                    work_start_time: employee?.work_start_time || '08:00',
                    work_end_time: employee?.work_end_time || '17:00',
                    break_start_time: employee?.break_start_time || '12:00',
                    break_end_time: employee?.break_end_time || '13:00',
                    break2_start_time: employee?.break2_start_time,
                    break2_end_time: employee?.break2_end_time,
                    break3_start_time: employee?.break3_start_time,
                    break3_end_time: employee?.break3_end_time,
                    rest_days: employee?.rest_days || [0, 6]
                };
            };
            const schedule = getEffectiveSchedule();
            const getDayTime = (timeStr: string, baseDate: Date) => {
                if (!timeStr) return null;
                const [h, m] = timeStr.split(':').map(Number);
                const d = new Date(baseDate);
                d.setHours(h, m, 0, 0);
                return d;
            };

            const schedIn = getDayTime(schedule.work_start_time, day)!;
            const schedOut = getDayTime(schedule.work_end_time, day)!;

            // 2. 收集打卡區間並計算當天的彈性偏移量 flexOffsetMs
            let flexOffsetMs = 0;
            let effectiveIn: Date | null = null;
            let effectiveOut: Date | null = null;

            if (dayLogs.length >= 2) {
                const checkInLog = dayLogs.find(l => l.check_type === CheckType.IN);
                const checkOutLog = [...dayLogs].reverse().find(l => l.check_type === CheckType.OUT);
                if (checkInLog && checkOutLog) {
                    const actualIn = new Date(checkInLog.timestamp);
                    const actualOut = new Date(checkOutLog.timestamp);
                    
                    effectiveIn = actualIn;
                    const flexWindowMs = 30 * 60 * 1000;
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
                if (overlapStart < overlapEnd) {
                    const isOvertimeApplication = leave.leave_type?.code === 'OT' || leave.leave_type?.code === 'CO' || leave.leave_type?.code === 'ALC' || (leave.leave_type?.name?.includes('加班') && !leave.leave_type?.name?.includes('補休餘額')) || leave.leave_type?.name?.includes('折現') || leave.leave_type?.name?.includes('折算');
                    if (isOvertimeApplication) {
                        // 加班折算 (CO/ALC) 等已核准紀錄：直接使用資料庫中已計算好的 hours
                        // 避免因 calculateOTHours 的國定假日邏輯重算導致時數偏差
                        const isConversionType = leave.leave_type?.code === 'CO' || leave.leave_type?.code === 'ALC' || leave.leave_type?.name?.includes('折算') || leave.leave_type?.name?.includes('折現');
                        const useStoredHours = (isConversionType || leave.status === 'APPROVED') && leave.hours != null;
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
                                employee || {},
                                historicalSchedules,
                                leave.manual_break_hours || 0,
                                !!leave.is_makeup_holiday,
                                dayOverrides
                            );
                        }
                    } else {
                        const detailed = calculateLeaveHoursDetailed(
                            overlapStart,
                            overlapEnd,
                            employee || {},
                            false, // ignoreWorkWindow
                            true, // deductBreaks
                            historicalSchedules,
                            leave.manual_break_hours || 0,
                            !!leave.is_makeup_workday,
                            !!leave.is_makeup_holiday,
                            dayOverrides,
                            flexOffsetMs // 這裡傳入算好的偏移量！
                        );
                        dayHours = detailed.finalHours;
                    }
                }
                return { ...leave, dayHours };
            });

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
                { start: getDayTime(schedule.break_start_time, day)!, end: getDayTime(schedule.break_end_time, day)! },
                { start: getDayTime(schedule.break2_start_time, day)!, end: getDayTime(schedule.break2_end_time, day)! },
                { start: getDayTime(schedule.break3_start_time, day)!, end: getDayTime(schedule.break3_end_time, day)! },
                ...nonWorkIntervals
            ].filter(iv => iv.start && iv.end);
            const mergedSubtractive = merge(subtractiveIvs);

            // 4. 計算淨工時 (工作區間減去扣除區間的重疊)
            let netTotalMs = 0;
            let grossTotalMs = 0;
            let breakTotalMs = 0;

            const breakOnlyIvs = [
                { start: getDayTime(schedule.break_start_time, day)!, end: getDayTime(schedule.break_end_time, day)! },
                { start: getDayTime(schedule.break2_start_time, day)!, end: getDayTime(schedule.break2_end_time, day)! },
                { start: getDayTime(schedule.break3_start_time, day)!, end: getDayTime(schedule.break3_end_time, day)! }
            ].filter(iv => iv.start && iv.end);
            const mergedBreaksOnly = merge(breakOnlyIvs);

            mergedWork.forEach(w => {
                let segmentMs = w.end.getTime() - w.start.getTime();
                grossTotalMs += segmentMs;

                let overlapMs = 0;
                mergedSubtractive.forEach(s => {
                    const overlapS = Math.max(w.start.getTime(), s.start.getTime());
                    const overlapE = Math.min(w.end.getTime(), s.end.getTime());
                    if (overlapS < overlapE) {
                        overlapMs += (overlapE - overlapS);
                    }
                });

                // 專門計算休息時間
                mergedBreaksOnly.forEach(b => {
                    const overlapS = Math.max(w.start.getTime(), b.start.getTime());
                    const overlapE = Math.min(w.end.getTime(), b.end.getTime());
                    if (overlapS < overlapE) {
                        breakTotalMs += (overlapE - overlapS);
                    }
                });

                netTotalMs += (segmentMs - overlapMs);
            });

            let finalHours = netTotalMs / (1000 * 60 * 60);

            // 5. 特殊規則：溢出容換與動態標竿對齊
            const fullDaySchedMs = schedOut.getTime() - schedIn.getTime();
            let fullDayBreakMs = 0;
            const mergedBreaks = merge([
                { start: getDayTime(schedule.break_start_time, day)!, end: getDayTime(schedule.break_end_time, day)! },
                { start: getDayTime(schedule.break2_start_time, day)!, end: getDayTime(schedule.break2_end_time, day)! },
                { start: getDayTime(schedule.break3_start_time, day)!, end: getDayTime(schedule.break3_end_time, day)! }
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

            hours = parseFloat(finalHours.toFixed(2));

            data[dateKey] = { 
                logs: dayLogs, 
                leaves: dayLeaves, 
                hours: parseFloat(hours.toFixed(2)), 
                grossHours: parseFloat((grossTotalMs / (1000 * 60 * 60)).toFixed(2)),
                breakHours: parseFloat((breakTotalMs / (1000 * 60 * 60)).toFixed(2)),
                shifts: dayShifts || [],
                override: dayOverride,
                holidayName 
            };
        });

        return data;
    }, [days, logs, leaves, shiftRequests, dayOverrides, historicalSchedules]);

    const departments = useMemo(() => {
        const deps = Array.from(new Set(employees.map(emp => emp.department))).sort();
        return ['ALL', ...deps];
    }, [employees]);

    const filteredEmployees = useMemo(() => {
        let filtered = selectedDepartment === 'ALL' ? employees : employees.filter(emp => emp.department === selectedDepartment);

        // 套用姓氏筆劃排序
        filtered = sortByNameStroke(filtered);

        // 套用搜尋過濾
        if (employeeSearchQuery.trim()) {
            const query = employeeSearchQuery.toLowerCase();
            filtered = filtered.filter(emp => emp.name.toLowerCase().includes(query));
        }

        return filtered;
    }, [employees, selectedDepartment, employeeSearchQuery]);

    useEffect(() => {
        if (filteredEmployees.length > 0 && !filteredEmployees.find(e => e.id === selectedEmployeeId)) {
            setSelectedEmployeeId(filteredEmployees[0].id);
        }
    }, [filteredEmployees]);

    // 點擊外部關閉下拉選單
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (employeeDropdownRef.current && !employeeDropdownRef.current.contains(event.target as Node)) {
                setIsEmployeeDropdownOpen(false);
                setEmployeeSearchQuery('');
            }
        };

        if (isEmployeeDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isEmployeeDropdownOpen]);

    const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);

    const breakTimesString = useMemo(() => {
        if (!selectedEmployee) return '';
        const breaks = [
            { start: selectedEmployee.break_start_time, end: selectedEmployee.break_end_time },
            { start: selectedEmployee.break2_start_time, end: selectedEmployee.break2_end_time },
            { start: selectedEmployee.break3_start_time, end: selectedEmployee.break3_end_time }
        ].filter(b => b.start && b.end);
        
        return breaks.map(b => `${b.start}～${b.end}`).join('、');
    }, [selectedEmployee]);

    const monthlySchedulesList = useMemo(() => {
        if (!selectedEmployee || days.length === 0) return [];

        const schedMap = new Map<string, { 
            work_start_time: string, 
            work_end_time: string, 
            break_start_time: string, 
            break_end_time: string, 
            break2_start_time?: string | null, 
            break2_end_time?: string | null, 
            break3_start_time?: string | null, 
            break3_end_time?: string | null,
            days: Date[]
        }>();

        days.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayOverride = dayOverrides.find(o => o.override_date === dateStr);

            let sched;
            if (dayOverride) {
                sched = {
                    work_start_time: dayOverride.work_start_time || selectedEmployee.work_start_time || '08:00',
                    work_end_time: dayOverride.work_end_time || selectedEmployee.work_end_time || '17:00',
                    break_start_time: dayOverride.break_start_time || selectedEmployee.break_start_time || '12:00',
                    break_end_time: dayOverride.break_end_time || selectedEmployee.break_end_time || '13:00',
                    break2_start_time: selectedEmployee.break2_start_time,
                    break2_end_time: selectedEmployee.break2_end_time,
                    break3_start_time: selectedEmployee.break3_start_time,
                    break3_end_time: selectedEmployee.break3_end_time,
                };
            } else {
                const hist = historicalSchedules
                    .filter(s => s.effective_date <= dateStr)
                    .sort((a, b) => b.effective_date.localeCompare(a.effective_date))[0];

                if (hist) {
                    sched = {
                        work_start_time: hist.work_start_time,
                        work_end_time: hist.work_end_time,
                        break_start_time: hist.break_start_time,
                        break_end_time: hist.break_end_time,
                        break2_start_time: hist.break2_start_time,
                        break2_end_time: hist.break2_end_time,
                        break3_start_time: hist.break3_start_time,
                        break3_end_time: hist.break3_end_time,
                    };
                } else {
                    sched = {
                        work_start_time: selectedEmployee.work_start_time || '08:00',
                        work_end_time: selectedEmployee.work_end_time || '17:00',
                        break_start_time: selectedEmployee.break_start_time || '12:00',
                        break_end_time: selectedEmployee.break_end_time || '13:00',
                        break2_start_time: selectedEmployee.break2_start_time,
                        break2_end_time: selectedEmployee.break2_end_time,
                        break3_start_time: selectedEmployee.break3_start_time,
                        break3_end_time: selectedEmployee.break3_end_time,
                    };
                }
            }

            const key = `${sched.work_start_time}-${sched.work_end_time}_${sched.break_start_time}-${sched.break_end_time}_${sched.break2_start_time || ''}-${sched.break2_end_time || ''}_${sched.break3_start_time || ''}-${sched.break3_end_time || ''}`;

            if (!schedMap.has(key)) {
                schedMap.set(key, { ...sched, days: [day] });
            } else {
                schedMap.get(key)!.days.push(day);
            }
        });

        const result = Array.from(schedMap.values()).map(item => {
            const sortedDays = [...item.days].sort((a, b) => a.getTime() - b.getTime());
            const ranges: string[] = [];
            let startRange = sortedDays[0];
            let prev = sortedDays[0];

            for (let i = 1; i < sortedDays.length; i++) {
                const current = sortedDays[i];
                const diffTime = Math.abs(current.getTime() - prev.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays > 1) {
                    if (format(startRange, 'yyyy-MM-dd') === format(prev, 'yyyy-MM-dd')) {
                        ranges.push(`${format(startRange, 'M/d')}`);
                    } else {
                        ranges.push(`${format(startRange, 'M/d')}～${format(prev, 'M/d')}`);
                    }
                    startRange = current;
                }
                prev = current;
            }

            if (format(startRange, 'yyyy-MM-dd') === format(prev, 'yyyy-MM-dd')) {
                ranges.push(`${format(startRange, 'M/d')}`);
            } else {
                ranges.push(`${format(startRange, 'M/d')}～${format(prev, 'M/d')}`);
            }

            const breakTimes = [
                { start: item.break_start_time, end: item.break_end_time },
                { start: item.break2_start_time, end: item.break2_end_time },
                { start: item.break3_start_time, end: item.break3_end_time }
            ].filter(b => b.start && b.end);

            return {
                work_start_time: item.work_start_time,
                work_end_time: item.work_end_time,
                breakTimesString: breakTimes.map(b => `${b.start}～${b.end}`).join('、'),
                rangeString: ranges.join('、'),
                minDate: sortedDays[0]
            };
        });

        return result.sort((a, b) => a.minDate.getTime() - b.minDate.getTime());
    }, [selectedEmployee, days, dayOverrides, historicalSchedules]);

    const workTimesDisplay = useMemo(() => {
        if (monthlySchedulesList.length === 0) {
            return selectedEmployee ? `${selectedEmployee.work_start_time}～${selectedEmployee.work_end_time}` : '';
        }
        if (monthlySchedulesList.length === 1) {
            const item = monthlySchedulesList[0];
            return `${item.work_start_time}～${item.work_end_time}`;
        }
        return monthlySchedulesList.map(item => `${item.work_start_time}～${item.work_end_time} (${item.rangeString})`).join('、');
    }, [monthlySchedulesList, selectedEmployee]);

    const breakTimesDisplay = useMemo(() => {
        if (monthlySchedulesList.length === 0) {
            return breakTimesString;
        }
        if (monthlySchedulesList.length === 1) {
            return monthlySchedulesList[0].breakTimesString;
        }
        return monthlySchedulesList.map(item => `${item.breakTimesString || '無'} (${item.rangeString})`).join('、');
    }, [monthlySchedulesList, breakTimesString]);

    const totalMonthlyHours = Object.values(monthData).reduce((acc, curr) => acc + curr.hours, 0);

    const weekDays = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'];

    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));

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

    const handleDateClick = (day: Date, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedDate(day);
        setShowQuickActionMenu(true);
    };

    const handleSubmitNewLog = async () => {
        if (!selectedDate || !selectedEmployeeId) return;

        setIsSubmittingLog(true);
        try {
            // 組合日期和時間
            const [hours, minutes] = newLogTime.split(':');
            const timestamp = new Date(selectedDate);
            timestamp.setHours(parseInt(hours), parseInt(minutes), 0, 0);

            const result = await createAttendanceLog(
                selectedEmployeeId,
                newLogCheckType,
                timestamp.toISOString(),
                newLogNote || undefined
            );

            if (result.success) {
                await fetchData();
                setIsAddLogModalOpen(false);
                setSelectedDate(null);
                setNewLogNote('漏卡補登');
            } else {
                alert(`新增失敗: ${result.error || '未知錯誤'}`);
            }
        } catch (error) {
            console.error('Error submitting new log:', error);
            alert('系統錯誤');
        } finally {
            setIsSubmittingLog(false);
        }
    };

    const handleEditClick = (log: AttendanceLog, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingLog(log);
        setNewLogCheckType(log.check_type);
        setNewLogTime(format(parseISO(log.timestamp), 'HH:mm'));
        setNewLogNote(log.note || '');
        setIsEditLogModalOpen(true);
    };

    const handleSubmitEditLog = async () => {
        if (!editingLog) return;

        setIsSubmittingLog(true);
        try {
            // 組合日期和時間 (維持原本的日期)
            const [hours, minutes] = newLogTime.split(':');
            const timestamp = new Date(editingLog.timestamp);
            timestamp.setHours(parseInt(hours), parseInt(minutes), 0, 0);

            const result = await updateAttendanceLog(
                editingLog.id,
                newLogCheckType,
                timestamp.toISOString(),
                newLogNote || undefined
            );

            if (result.success) {
                await fetchData();
                setIsEditLogModalOpen(false);
                setEditingLog(null);
            } else {
                console.error('Edit attendace log error details:', result.error);
                alert(`修正失敗: ${result.error || '可能是資料庫政策 (RLS) 限制，請執行 RLS 修復腳本'}`);
            }
        } catch (error) {
            console.error('Error submitting edit log:', error);
            alert('系統錯誤');
        } finally {
            setIsSubmittingLog(false);
        }
    };

    const handleSalaryScheduleClick = (sched: MonthlySalarySchedule, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingSalarySchedule(sched);
        setSalaryScheduleForm({
            shift_type: sched.shift_type,
            case_name: sched.case_name || '',
            service_mins: sched.service_mins,
            note: sched.note || ''
        });
        setIsEditSalaryScheduleModalOpen(true);
    };

    const submitEditSalarySchedule = async () => {
        if (!editingSalarySchedule) return;
        setIsSubmittingSalarySchedule(true);
        try {
            const result = await updateMonthlySalarySchedule(editingSalarySchedule.id, {
                shift_type: salaryScheduleForm.shift_type,
                case_name: salaryScheduleForm.case_name,
                service_mins: salaryScheduleForm.service_mins,
                note: salaryScheduleForm.note
            });
            if (result.success) {
                await fetchData();
                setIsEditSalaryScheduleModalOpen(false);
                setEditingSalarySchedule(null);
            } else {
                alert(`更新失敗: ${result.error}`);
            }
        } catch (error) {
            console.error('Error submitting edit salary schedule:', error);
            alert('系統錯誤');
        } finally {
            setIsSubmittingSalarySchedule(false);
        }
    };

    const handleDeleteSalarySchedule = async () => {
        if (!editingSalarySchedule) return;
        if (!window.confirm('確定要刪除這筆班表紀錄嗎？')) return;
        
        setIsSubmittingSalarySchedule(true);
        try {
            const result = await deleteMonthlySalarySchedule(editingSalarySchedule.id);
            if (result.success) {
                await fetchData();
                setIsEditSalaryScheduleModalOpen(false);
                setEditingSalarySchedule(null);
            } else {
                alert(`刪除失敗: ${result.error}`);
            }
        } catch (error) {
            console.error('Error deleting salary schedule:', error);
            alert('系統錯誤');
        } finally {
            setIsSubmittingSalarySchedule(false);
        }
    };

    const handleWithdrawRequest = async () => {
        if (!withdrawingId) return;

        setIsWithdrawing(true);
        try {
            const { requestService } = await import('../../services/requestService');
            const result = await requestService.withdrawRequest(withdrawingId, selectedEmployeeId);
            
            if (result.success) {
                alert('已成功發起撤回申請，請等待主管審核。');
                await fetchData();
                setShowWithdrawConfirm(false);
                setWithdrawingId(null);
            } else {
                alert(`撤回失敗: ${result.error || '未知錯誤'}`);
            }
        } catch (error) {
            console.error('Error withdrawing request:', error);
            alert('系統錯誤');
        } finally {
            setIsWithdrawing(false);
        }
    };

    return (
        <div className="space-y-6 print:space-y-4 print:p-0">
            {/* 隱藏瀏覽器預設的列印頁首頁尾 (如網址、日期) 並自動縮放 */}
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    @page { 
                        size: landscape; 
                        margin: 0.5cm; 
                    }
                    body { 
                        margin: 0; 
                        padding: 0;
                        background: white;
                    }
                    .print-shrink {
                        zoom: 0.82;
                        width: 100% !important;
                    }
                    /* 移除陰影與圓角以利列印 */
                    .print-no-shadow {
                        box-shadow: none !important;
                        border: 1px solid #e2e8f0 !important;
                        border-radius: 0.5rem !important;
                    }
                    /* 讓月曆格子更緊湊 */
                    .print-compact-grid {
                        min-height: auto !important;
                    }
                }
            ` }} />
            {/* Header & Filters */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm print:shadow-none print:border-none print:p-0 print-no-shadow print-shrink">
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
                            {/* PDF Summary Stats */}
                            <div className="hidden print:flex items-center gap-4 mt-1">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                    工作時間: <span className="text-slate-900">{workTimesDisplay}</span>
                                </span>
                                {breakTimesDisplay && (
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider border-l border-slate-200 pl-4">
                                        休息時間: <span className="text-slate-900">{breakTimesDisplay}</span>
                                    </span>
                                )}
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider border-l border-slate-200 pl-4">
                                    當月工作合計: <span className="text-slate-900 text-blue-600">{totalMonthlyHours.toFixed(1)}H</span>
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 print:flex-row print:items-center print:gap-4">
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

                        {/* 可搜尋的員工選擇器 */}
                        <div className="relative" ref={employeeDropdownRef}>
                            <div
                                className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors"
                                onClick={() => setIsEmployeeDropdownOpen(!isEmployeeDropdownOpen)}
                            >
                                <User className="ml-1.5 text-slate-400 h-3.5 w-3.5" />
                                <span className="text-xs font-black text-slate-700 py-1.5 pr-2">
                                    {selectedEmployee?.name || '選擇員工'}
                                </span>
                            </div>

                            {isEmployeeDropdownOpen && (
                                <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden">
                                    {/* 搜尋框 */}
                                    <div className="p-3 border-b border-slate-100">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                            <input
                                                type="text"
                                                value={employeeSearchQuery}
                                                onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                                                placeholder="搜尋員工姓名..."
                                                className="w-full pl-10 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                                autoFocus
                                            />
                                        </div>
                                    </div>

                                    {/* 員工列表 */}
                                    <div className="max-h-64 overflow-y-auto">
                                        {filteredEmployees.length === 0 ? (
                                            <div className="px-4 py-8 text-center text-sm text-slate-400">
                                                找不到符合的員工
                                            </div>
                                        ) : (
                                            filteredEmployees.map(emp => (
                                                <button
                                                    key={emp.id}
                                                    onClick={() => {
                                                        setSelectedEmployeeId(emp.id);
                                                        setIsEmployeeDropdownOpen(false);
                                                        setEmployeeSearchQuery('');
                                                    }}
                                                    className={`w-full px-4 py-2.5 text-left text-sm font-bold hover:bg-slate-50 transition-colors ${emp.id === selectedEmployeeId ? 'bg-blue-50 text-blue-700' : 'text-slate-700'
                                                        }`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span>{emp.name}</span>
                                                        {emp.department && (
                                                            <span className="text-xs text-slate-400">{emp.department}</span>
                                                        )}
                                                    </div>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
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

                        <div className="flex items-center gap-1">
                            <button
                                onClick={handleImportClick}
                                disabled={importing}
                                className={`inline-flex items-center px-3 py-2 ${importing ? 'bg-slate-400' : 'bg-emerald-600 hover:bg-emerald-700'} text-white rounded-xl text-xs font-black transition-all shadow-md shadow-emerald-100 whitespace-nowrap`}
                            >
                                <Plus className="h-3.5 w-3.5 mr-1" />
                                {importing ? '處理中...' : '匯入打卡'}
                            </button>
                            <button
                                onClick={handleDownloadTemplate}
                                className="p-2 bg-white text-emerald-600 border border-emerald-100 rounded-xl hover:bg-emerald-50 transition-all shadow-sm"
                                title="下載匯入範本"
                            >
                                <Download className="h-4 w-4" />
                            </button>
                            <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
                        </div>

                        {/* 薪制班表匯入 */}
                        <div className="flex items-center gap-1">
                            <button
                                onClick={handleSalaryScheduleImportClick}
                                disabled={importingSchedule}
                                className={`inline-flex items-center px-3 py-2 ${importingSchedule ? 'bg-slate-400' : 'bg-violet-600 hover:bg-violet-700'} text-white rounded-xl text-xs font-black transition-all shadow-md shadow-violet-100 whitespace-nowrap`}
                            >
                                <Plus className="h-3.5 w-3.5 mr-1" />
                                {importingSchedule ? '處理中...' : '匯入班表'}
                            </button>
                            <button
                                onClick={handleDownloadSalaryScheduleTemplate}
                                className="p-2 bg-white text-violet-600 border border-violet-100 rounded-xl hover:bg-violet-50 transition-all shadow-sm"
                                title="下載薪制班表匯入範本"
                            >
                                <Download className="h-4 w-4" />
                            </button>
                            <input ref={scheduleFileInputRef} type="file" accept=".csv" onChange={handleSalaryScheduleFileChange} className="hidden" />
                        </div>
                    </div>
                </div>
            </div>
        </div>


            {/* Calendar Grid */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-lg overflow-hidden print:shadow-none print:border-slate-200 print-shrink mt-4 print:mt-2">
                <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/50 print:bg-white">
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
                                 const override = dayInfo?.override;

                                 const isSaturday = getDay(day) === 6;
                                 const isSunday = getDay(day) === 0;

                                 const isNaturalRestDay = isSaturday || isSunday || !!holidayName;
                                 let isRestDay = isNaturalRestDay;
                                 let overrideLabel = '';

                                 if (override) {
                                     if (override.work_start_time) {
                                         isRestDay = false;
                                         overrideLabel = '挪移：上班';
                                     } else {
                                         isRestDay = true;
                                         overrideLabel = '挪移：休息';
                                     }
                                 }

                                 const daySchedules = salarySchedules.filter(s => s.service_date === dateKey);
                                 const totalServiceMins = daySchedules.reduce((sum, s) => sum + s.service_mins, 0);
                                 const totalServiceHours = totalServiceMins > 0 ? (totalServiceMins / 60).toFixed(1) : '0';

                                return (
                                    <div
                                        key={dateKey}
                                        onClick={(e) => handleDateClick(day, e)}
                                     className={`min-h-[80px] print:min-h-[60px] p-3 print:p-1.5 border-r last:border-r-0 border-slate-100 flex flex-col group hover:bg-slate-50/50 transition-colors cursor-pointer relative
                                            ${isRestDay ? (holidayName || (override && !override.work_start_time) ? 'bg-rose-50/30' : isSaturday ? 'bg-amber-50/30' : 'bg-slate-100/40') : ''} 
                                            ${override?.work_start_time ? 'bg-blue-50/30' : ''}`}
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
                                            <div className="flex gap-2 items-center">
                                                <button
                                                    onClick={(e) => handleDateClick(day, e)}
                                                    className="opacity-0 group-hover:opacity-100 p-1 rounded-lg transition-all text-blue-500 hover:bg-blue-50"
                                                    title="新增打卡紀錄"
                                                >
                                                    <Plus className="h-4 w-4" />
                                                </button>
                                                {dayInfo?.logs?.length > 1 && (
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
                                                {dayInfo?.hours > 0 && (
                                                    <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 whitespace-nowrap">
                                                        {dayInfo.hours}H
                                                    </span>
                                                )}
                                                {Number(totalServiceHours) > 0 && (
                                                    <span className="text-[10px] font-black text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-100 whitespace-nowrap">
                                                        合計 {totalServiceHours}H
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex-1 space-y-1.5">
                                            {/* Logs */}
                                            {dayInfo?.logs?.length > 0 && (
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
                                                                <div className="flex items-center">
                                                                    <button
                                                                        onClick={(e) => handleEditClick(log, e)}
                                                                        className={`opacity-0 group-hover/log:opacity-100 p-0.5 rounded transition-all mr-0.5 ${selectedLogIds.has(log.id)
                                                                            ? 'hover:bg-white/20 text-white/70 hover:text-white'
                                                                            : 'hover:bg-white text-slate-400 hover:text-blue-500'
                                                                            }`}
                                                                        title="編輯紀錄"
                                                                    >
                                                                        <Pencil className="h-3 w-3" />
                                                                    </button>
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
                                                            </div>
                                                        ))}
                                                </div>
                                            )}

                                            {/* Leaves */}
                                            {dayInfo?.leaves?.map(leave => (
                                                <div
                                                    key={leave.id}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedLeaveForAction(leave);
                                                        setShowActionMenu(true);
                                                    }}
                                                    className="px-2 py-1 rounded-md text-[10px] font-black text-white shadow-sm cursor-pointer hover:opacity-90 transition-opacity flex items-center justify-between gap-1"
                                                    style={{ backgroundColor: leave.leave_type?.color || '#3b82f6' }}
                                                    title={leave.reason}
                                                >
                                                    <span className="truncate flex-1">
                                                        {leave.leave_type?.name} {leave.dayHours !== undefined ? `${parseFloat(String(leave.dayHours)).toFixed(1)}H` : (leave.hours ? `${leave.hours}H` : '')}
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

                                             {/* Shift Requests */}
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

                                             {/* 薪制班表 */}
                                             {(() => {
                                                 if (daySchedules.length === 0) return null;

                                                 const SHIFT_COLORS: Record<string, string> = {
                                                     '正常班': 'bg-blue-100 text-blue-700 border-blue-200',
                                                     '休息日班': 'bg-amber-100 text-amber-700 border-amber-200',
                                                     '國定假日': 'bg-rose-100 text-rose-700 border-rose-200',
                                                     '增-轉場': 'bg-violet-100 text-violet-700 border-violet-200',
                                                 };

                                                 return (
                                                     <div className="space-y-1 mt-1">
                                                         {daySchedules.map(sched => (
                                                             <div
                                                                 key={sched.id}
                                                                 className={`px-1.5 py-1 rounded-md text-[10px] font-black border flex items-center justify-between gap-1 overflow-hidden whitespace-nowrap cursor-pointer hover:opacity-80 transition-opacity ${SHIFT_COLORS[sched.shift_type] || 'bg-slate-100 text-slate-700 border-slate-200'}`}
                                                                 title={[sched.case_name && `個案：${sched.case_name}`, `服務時間：${sched.service_mins} 分鐘`, sched.note && `備註：${sched.note}`].filter(Boolean).join('\n')}
                                                                 onClick={(e) => handleSalaryScheduleClick(sched, e)}
                                                             >
                                                                 <div className="flex items-center gap-1 overflow-hidden">
                                                                     <span className="shrink-0">{sched.shift_type}</span>
                                                                     {sched.case_name && (
                                                                         <span className="text-[9px] opacity-75 truncate" title={sched.case_name}>
                                                                             👤{sched.case_name}
                                                                         </span>
                                                                     )}
                                                                 </div>
                                                                 <span className="shrink-0 opacity-80">{sched.service_mins}分</span>
                                                             </div>
                                                         ))}
                                                     </div>
                                                 );
                                             })()}
                                         </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                 </div>
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

            {/* Add Log Modal */}
            {isAddLogModalOpen && selectedDate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                                        <Plus className="h-5 w-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-slate-900">新增打卡紀錄</h3>
                                        <p className="text-xs text-slate-500 font-medium">
                                            {format(selectedDate, 'yyyy年MM月dd日', { locale: zhTW })}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsAddLogModalOpen(false)}
                                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    <X className="h-5 w-5 text-slate-400" />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* 員工資訊 */}
                            <div className="bg-slate-50 rounded-xl p-4">
                                <div className="text-xs font-bold text-slate-500 mb-1">員工</div>
                                <div className="text-sm font-black text-slate-900">{selectedEmployee?.name}</div>
                                {selectedEmployee?.department && (
                                    <div className="text-xs text-slate-500 font-medium">{selectedEmployee.department}</div>
                                )}
                            </div>

                            {/* 打卡類型 */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-2">打卡類型</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => {
                                            setNewLogCheckType(CheckType.IN);
                                            setNewLogTime('08:00');
                                        }}
                                        className={`py-3 px-4 rounded-xl text-sm font-black transition-all ${newLogCheckType === CheckType.IN
                                            ? 'bg-emerald-500 text-white shadow-md shadow-emerald-100'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            }`}
                                    >
                                        上班
                                    </button>
                                    <button
                                        onClick={() => {
                                            setNewLogCheckType(CheckType.OUT);
                                            setNewLogTime('17:00');
                                        }}
                                        className={`py-3 px-4 rounded-xl text-sm font-black transition-all ${newLogCheckType === CheckType.OUT
                                            ? 'bg-orange-500 text-white shadow-md shadow-orange-100'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            }`}
                                    >
                                        下班
                                    </button>
                                </div>
                            </div>

                            {/* 時間 */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-2">時間</label>
                                <TimeInput24h
                                    value={newLogTime}
                                    onChange={setNewLogTime}
                                    required
                                />
                            </div>

                            {/* 備註 */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-2">備註 (選填)</label>
                                <textarea
                                    value={newLogNote}
                                    onChange={(e) => setNewLogNote(e.target.value)}
                                    placeholder="例如:補登漏卡"
                                    rows={3}
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                                />
                            </div>
                        </div>

                        <div className="flex border-t border-slate-100">
                            <button
                                onClick={() => setIsAddLogModalOpen(false)}
                                disabled={isSubmittingLog}
                                className="flex-1 py-5 text-sm font-black text-slate-400 hover:bg-slate-50 transition-colors border-r border-slate-100"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleSubmitNewLog}
                                disabled={isSubmittingLog}
                                className="flex-1 py-5 text-sm font-black text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
                            >
                                {isSubmittingLog ? '處理中...' : '確定新增'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Salary Schedule Modal */}
            {isEditSalaryScheduleModalOpen && editingSalarySchedule && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                <Pencil className="h-5 w-5 text-blue-500" />
                                編輯薪制班表
                            </h3>
                            <button
                                onClick={() => setIsEditSalaryScheduleModalOpen(false)}
                                className="p-2 hover:bg-white rounded-xl transition-all text-slate-400 hover:text-slate-600 hover:shadow-sm"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">班別</label>
                                <select
                                    value={salaryScheduleForm.shift_type}
                                    onChange={(e) => setSalaryScheduleForm({ ...salaryScheduleForm, shift_type: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                >
                                    <option value="正常班">正常班</option>
                                    <option value="休息日班">休息日班</option>
                                    <option value="國定假日">國定假日</option>
                                    <option value="增-轉場">增-轉場</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">個案姓名 (選填)</label>
                                <input
                                    type="text"
                                    value={salaryScheduleForm.case_name}
                                    onChange={(e) => setSalaryScheduleForm({ ...salaryScheduleForm, case_name: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    placeholder="請輸入個案姓名..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">服務時間 (分鐘)</label>
                                <input
                                    type="number"
                                    value={salaryScheduleForm.service_mins}
                                    onChange={(e) => setSalaryScheduleForm({ ...salaryScheduleForm, service_mins: parseInt(e.target.value) || 0 })}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    min="0"
                                    step="1"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">備註 (選填)</label>
                                <input
                                    type="text"
                                    value={salaryScheduleForm.note}
                                    onChange={(e) => setSalaryScheduleForm({ ...salaryScheduleForm, note: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    placeholder="補充說明..."
                                />
                            </div>
                        </div>
                        <div className="flex border-t border-slate-100 bg-slate-50/50">
                            <button
                                onClick={handleDeleteSalarySchedule}
                                disabled={isSubmittingSalarySchedule}
                                className="flex-1 py-5 text-sm font-black text-rose-500 hover:bg-rose-50 border-r border-slate-100 transition-colors disabled:opacity-50"
                            >
                                刪除紀錄
                            </button>
                            <button
                                onClick={submitEditSalarySchedule}
                                disabled={isSubmittingSalarySchedule}
                                className="flex-1 py-5 text-sm font-black text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
                            >
                                {isSubmittingSalarySchedule ? '處理中...' : '儲存變更'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Log Modal */}
            {isEditLogModalOpen && editingLog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                                        <Pencil className="h-5 w-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-slate-900">修正打卡紀錄</h3>
                                        <p className="text-xs text-slate-500 font-medium">
                                            {format(parseISO(editingLog.timestamp), 'yyyy年MM月dd日', { locale: zhTW })}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setIsEditLogModalOpen(false);
                                        setEditingLog(null);
                                    }}
                                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    <X className="h-5 w-5 text-slate-400" />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* 員工資訊 */}
                            <div className="bg-slate-50 rounded-xl p-4">
                                <div className="text-xs font-bold text-slate-500 mb-1">員工</div>
                                <div className="text-sm font-black text-slate-900">{selectedEmployee?.name}</div>
                            </div>

                            {/* 打卡類型 */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-2">打卡類型</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => setNewLogCheckType(CheckType.IN)}
                                        className={`py-3 px-4 rounded-xl text-sm font-black transition-all ${newLogCheckType === CheckType.IN
                                            ? 'bg-emerald-500 text-white shadow-md shadow-emerald-100'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            }`}
                                    >
                                        上班
                                    </button>
                                    <button
                                        onClick={() => setNewLogCheckType(CheckType.OUT)}
                                        className={`py-3 px-4 rounded-xl text-sm font-black transition-all ${newLogCheckType === CheckType.OUT
                                            ? 'bg-orange-500 text-white shadow-md shadow-orange-100'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            }`}
                                    >
                                        下班
                                    </button>
                                </div>
                            </div>

                            {/* 時間 */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-2">時間</label>
                                <TimeInput24h
                                    value={newLogTime}
                                    onChange={setNewLogTime}
                                    required
                                />
                            </div>

                            {/* 備註 */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-2">備註</label>
                                <textarea
                                    value={newLogNote}
                                    onChange={(e) => setNewLogNote(e.target.value)}
                                    placeholder="修改原因..."
                                    rows={3}
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                                />
                            </div>
                        </div>

                        <div className="flex border-t border-slate-100">
                            <button
                                onClick={() => {
                                    setIsEditLogModalOpen(false);
                                    setEditingLog(null);
                                }}
                                disabled={isSubmittingLog}
                                className="flex-1 py-5 text-sm font-black text-slate-400 hover:bg-slate-50 transition-colors border-r border-slate-100"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleSubmitEditLog}
                                disabled={isSubmittingLog}
                                className="flex-1 py-5 text-sm font-black text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
                            >
                                {isSubmittingLog ? '處理中...' : '儲存修改'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modification Modal */}
            {selectedLeaveForModification && (
                <ModificationRequestForm
                    originalRequest={selectedLeaveForModification as any}
                    employeeId={selectedEmployeeId}
                    onClose={() => setSelectedLeaveForModification(null)}
                    onSuccess={() => {
                        setSelectedLeaveForModification(null);
                        fetchData();
                    }}
                />
            )}

            {/* Quick Action Selection Modal */}
            {showQuickActionMenu && selectedDate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
                        <div className="p-8 text-center">
                            <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center mx-auto mb-6 text-blue-600">
                                <CalendarIcon className="h-10 w-10" />
                            </div>
                            <h3 className="text-xl font-black text-slate-900 mb-2">選擇操作項目</h3>
                            <p className="text-slate-500 font-medium mb-8">
                                您想為 {selectedEmployee?.name} 在 {format(selectedDate, 'MM/dd')} 執行哪項操作？
                            </p>
                            
                            <div className="grid grid-cols-1 gap-3">
                                <button
                                    onClick={() => {
                                        setShowQuickActionMenu(false);
                                        setNewLogCheckType(CheckType.IN);
                                        setNewLogTime('08:00');
                                        setNewLogNote('漏卡補登');
                                        setIsAddLogModalOpen(true);
                                    }}
                                    className="w-full py-4 bg-blue-50 text-blue-700 rounded-2xl font-black hover:bg-blue-100 transition-all flex items-center justify-center gap-3"
                                >
                                    <Plus className="h-5 w-5" />
                                    補登打卡紀錄
                                </button>
                                <button
                                    onClick={() => {
                                        setShowQuickActionMenu(false);
                                        setIsLeaveRequestModalOpen(true);
                                    }}
                                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-3"
                                >
                                    <FileText className="h-5 w-5" />
                                    代理申請差勤 (請假/公出/加班)
                                </button>
                                <button
                                    onClick={() => {
                                        setShowQuickActionMenu(false);
                                        setSelectedDate(null);
                                    }}
                                    className="w-full py-4 text-slate-400 font-black hover:text-slate-600 transition-all"
                                >
                                    取消
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Agent Leave Request Modal */}
            {isLeaveRequestModalOpen && selectedDate && selectedEmployeeId && (
                <LeaveRequestForm
                    employeeId={selectedEmployeeId}
                    initialDate={format(selectedDate, 'yyyy-MM-dd')}
                    isAdmin={true}
                    onClose={() => {
                        setIsLeaveRequestModalOpen(false);
                        setSelectedDate(null);
                    }}
                    onSuccess={() => {
                        setIsLeaveRequestModalOpen(false);
                        setSelectedDate(null);
                        fetchData();
                    }}
                />
            )}

            {/* Action Menu Modal */}
            {showActionMenu && selectedLeaveForAction && (
                <div
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300"
                    onClick={() => setShowActionMenu(false)}
                >
                    <div
                        className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm p-8 animate-in zoom-in-95 duration-300 text-center"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* 紀錄資訊 */}
                        <div className="mb-8 items-center flex flex-col">
                            <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center text-blue-600 border border-blue-100 mb-6 font-black uppercase tracking-widest text-xs">
                                {selectedLeaveForAction.leave_type?.name?.charAt(0) || '差'}
                            </div>
                            <h2 className="text-2xl font-black text-slate-900 mb-2">{selectedLeaveForAction.leave_type?.name || '差勤申請'}</h2>
                            <div className="text-[10px] text-slate-500 font-black bg-slate-50 px-4 py-2 rounded-full uppercase tracking-widest">
                                {formatDateTimeRange(selectedLeaveForAction.start_date, selectedLeaveForAction.end_date)}
                            </div>
                            {selectedLeaveForAction.reason && (
                                <div className="text-sm text-slate-600 mt-4 px-4 line-clamp-2 italic">
                                    "{selectedLeaveForAction.reason}"
                                </div>
                            )}
                        </div>

                        {/* 操作按鈕 */}
                        <div className="flex flex-col gap-4 mt-8">
                            <button
                                onClick={() => {
                                    setWithdrawingId(selectedLeaveForAction.id);
                                    setShowWithdrawConfirm(true);
                                    setShowActionMenu(false);
                                }}
                                className="w-full py-4 bg-rose-50 text-rose-600 rounded-2xl font-black hover:bg-rose-100 transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined text-lg">cancel</span>
                                協助撤回本申請
                            </button>

                            <button
                                onClick={() => {
                                    setSelectedLeaveForModification(selectedLeaveForAction);
                                    setShowActionMenu(false);
                                }}
                                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined text-lg">edit</span>
                                協助變更內容
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Withdraw Confirmation Dialog */}
            {showWithdrawConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 px-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center">
                                <span className="material-symbols-outlined text-amber-600 text-2xl">warning</span>
                            </div>
                            <h3 className="text-xl font-black text-slate-900">確認發起撤回？</h3>
                        </div>
                        <p className="text-slate-500 font-medium leading-relaxed mb-6">
                            您正以管理員身分協助員工發起撤回申請。撤回後需由主管審核生效，且無法復原。
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowWithdrawConfirm(false);
                                    setWithdrawingId(null);
                                }}
                                className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-black hover:bg-slate-200 transition-colors"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleWithdrawRequest}
                                disabled={isWithdrawing}
                                className="flex-1 px-6 py-3 bg-rose-600 text-white rounded-xl font-black hover:bg-rose-700 transition-colors disabled:opacity-50"
                            >
                                {isWithdrawing ? '處理中...' : '確認撤回'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AttendanceCalendarPage;

import { Employee, EmployeeSchedule, EmployeeDayOverride, DayOverrideType } from '../types';
import { isNationalHoliday } from './holidays';
import { format } from 'date-fns';

/**
 * 計算請假/出差時數詳情
 */
export interface DetailedLeaveHours {
    totalHours: number;
    rawHours: number;
    breakHours: number;
    finalHours: number;
}

/**
 * 計算請假/出差時數
 * @param startDate 開始時間
 * @param endDate 結束時間
 * @param employee 員工資料
 * @param ignoreWorkWindow 是否忽略工作時間限制
 * @param deductBreaks 是否扣除休息時間
 * @param historicalSchedules 歷史班表紀錄
 * @param manualBreak 手動扣除休息
 * @param isMakeupWorkday 補班標記 (舊)
 * @param isMakeupHoliday 補假標記 (舊)
 * @param dayOverrides 挪移覆蓋紀錄
 */
export const calculateLeaveHoursDetailed = (
    startDate: Date,
    endDate: Date,
    employee: Partial<Employee>,
    ignoreWorkWindow: boolean = false,
    deductBreaks: boolean = true,
    historicalSchedules?: EmployeeSchedule[],
    manualBreak: number = 0,
    isMakeupWorkday: boolean = false,
    isMakeupHoliday: boolean = false,
    dayOverrides?: EmployeeDayOverride[]
): DetailedLeaveHours => {
    if (endDate <= startDate) return { totalHours: 0, rawHours: 0, breakHours: 0, finalHours: 0 };

    let totalMinutes = 0;
    let totalRawMinutes = 0;
    let totalBreakMinutes = 0;

    const getEffectiveSchedule = (date: Date) => {
        if (!date || isNaN(date.getTime())) {
            return {
                work_start_time: '08:00',
                work_end_time: '17:00',
                break_start_time: '12:00',
                break_end_time: '13:00',
                rest_days: employee.rest_days || [0, 6],
                salary_type: employee.salary_type || 'MONTHLY',
                standard_daily_hours: employee.standard_daily_hours || 8.0,
                is_override: false
            } as any;
        }

        const dateStr = format(date, 'yyyy-MM-dd');

        // 1. 優先檢查挪移覆蓋
        if (dayOverrides && dayOverrides.length > 0) {
            const override = dayOverrides.find(o => o.override_date === dateStr);
            if (override) {
                return {
                    work_start_time: override.work_start_time || employee.work_start_time || '08:00',
                    work_end_time: override.work_end_time || employee.work_end_time || '17:00',
                    break_start_time: override.break_start_time || employee.break_start_time || '12:00',
                    break_end_time: override.break_end_time || employee.break_end_time || '13:00',
                    rest_days: employee.rest_days || [0, 6],
                    salary_type: employee.salary_type || 'MONTHLY',
                    standard_daily_hours: employee.standard_daily_hours || 8.0,
                    is_override: true,
                    override_type: override.day_type
                } as any;
            }
        }

        // 2. 檢查歷史班表
        if (historicalSchedules && historicalSchedules.length > 0) {
            const schedule = historicalSchedules
                .filter(s => s.effective_date <= dateStr)
                .sort((a, b) => b.effective_date.localeCompare(a.effective_date))[0];
            if (schedule) return { ...schedule, is_override: false };
        }

        // 3. 使用預設班表
        return {
            work_start_time: employee.work_start_time || '08:00',
            work_end_time: employee.work_end_time || '17:00',
            break_start_time: employee.break_start_time || '12:00',
            break_end_time: employee.break_end_time || '13:00',
            rest_days: employee.rest_days || [0, 6],
            salary_type: employee.salary_type || 'MONTHLY',
            standard_daily_hours: employee.standard_daily_hours || 8.0,
            is_override: false
        } as any;
    };

    let currentDayHead = new Date(startDate);
    currentDayHead.setHours(0, 0, 0, 0);

    const endDayHead = new Date(endDate);
    endDayHead.setHours(0, 0, 0, 0);

    while (currentDayHead <= endDayHead) {
        const schedule = getEffectiveSchedule(currentDayHead);
        const holidayName = isNationalHoliday(currentDayHead);
        const dayOfWeek = currentDayHead.getDay();
        
        let isActuallyRestDay = false;
        if (schedule.is_override) {
            isActuallyRestDay = schedule.override_type === DayOverrideType.REST_DAY;
        } else {
            const isBaseRestDay = schedule.rest_days.includes(dayOfWeek);
            isActuallyRestDay = !!holidayName || isMakeupHoliday || (isBaseRestDay && !isMakeupWorkday);
        }

        if (!ignoreWorkWindow && isActuallyRestDay) {
            currentDayHead.setDate(currentDayHead.getDate() + 1);
            continue;
        }

        const [workStartH, workStartM] = schedule.work_start_time.split(':').map(Number);
        const [workEndH, workEndM] = schedule.work_end_time.split(':').map(Number);

        const rawBreaks = [
            { start: schedule.break_start_time, end: schedule.break_end_time },
            { start: schedule.break2_start_time, end: schedule.break2_end_time },
            { start: schedule.break3_start_time, end: schedule.break3_end_time }
        ].filter(b => b.start && b.end) as { start: string; end: string }[];

        const mergedBreaks: { startMinutes: number; endMinutes: number }[] = [];
        rawBreaks
            .map(b => {
                const [sh, sm] = b.start.split(':').map(Number);
                const [eh, em] = b.end.split(':').map(Number);
                return { start: sh * 60 + sm, end: eh * 60 + em };
            })
            .sort((a, b) => a.start - b.start)
            .forEach(b => {
                const last = mergedBreaks[mergedBreaks.length - 1];
                if (!last || b.start > last.endMinutes) {
                    mergedBreaks.push({ startMinutes: b.start, endMinutes: b.end });
                } else {
                    last.endMinutes = Math.max(last.endMinutes, b.end);
                }
            });

        const dayWorkStart = new Date(currentDayHead);
        dayWorkStart.setHours(workStartH, workStartM, 0, 0);

        const dayWorkEnd = new Date(currentDayHead);
        dayWorkEnd.setHours(workEndH, workEndM, 0, 0);

        const actualStart = ignoreWorkWindow
            ? new Date(Math.max(startDate.getTime(), currentDayHead.getTime()))
            : new Date(Math.max(startDate.getTime(), dayWorkStart.getTime()));

        const nextDayHead = new Date(currentDayHead);
        nextDayHead.setDate(nextDayHead.getDate() + 1);

        const actualEnd = ignoreWorkWindow
            ? new Date(Math.min(endDate.getTime(), nextDayHead.getTime()))
            : new Date(Math.min(endDate.getTime(), dayWorkEnd.getTime()));

        if (actualStart < actualEnd) {
            let dayRawMinutes = Math.floor((actualEnd.getTime() - actualStart.getTime()) / (1000 * 60));
            let dayBreakMinutes = 0;

            if (deductBreaks) {
                mergedBreaks.forEach(b => {
                    const bStartDate = new Date(currentDayHead);
                    bStartDate.setHours(Math.floor(b.startMinutes / 60), b.startMinutes % 60, 0, 0);
                    const bEndDate = new Date(currentDayHead);
                    bEndDate.setHours(Math.floor(b.endMinutes / 60), b.endMinutes % 60, 0, 0);

                    const overlapStart = new Date(Math.max(actualStart.getTime(), bStartDate.getTime()));
                    const overlapEnd = new Date(Math.min(actualEnd.getTime(), bEndDate.getTime()));

                    if (overlapStart < overlapEnd) {
                        const overlapMinutes = Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60));
                        dayBreakMinutes += overlapMinutes;
                    }
                });
            }

            totalRawMinutes += dayRawMinutes;
            totalBreakMinutes += dayBreakMinutes;
            totalMinutes += Math.max(0, dayRawMinutes - dayBreakMinutes);
        }

        currentDayHead.setDate(currentDayHead.getDate() + 1);
    }

    const rawHours = totalRawMinutes / 60;
    const breakHours = (totalBreakMinutes / 60) + manualBreak;
    const finalHours = Math.max(0, (totalMinutes / 60) - manualBreak);

    return {
        totalHours: finalHours,
        rawHours: parseFloat(rawHours.toFixed(1)),
        breakHours: parseFloat(breakHours.toFixed(1)),
        finalHours: parseFloat(finalHours.toFixed(1))
    };
};

/**
 * 計算請假/出差時數 (舊介面，回傳單一數值)
 */
export const calculateLeaveHours = (
    startDate: Date,
    endDate: Date,
    employee: Partial<Employee>,
    ignoreWorkWindow: boolean = false,
    deductBreaks: boolean = true,
    historicalSchedules?: EmployeeSchedule[],
    manualBreak: number = 0,
    isMakeupWorkday: boolean = false,
    isMakeupHoliday: boolean = false,
    dayOverrides?: EmployeeDayOverride[]
): number => {
    const result = calculateLeaveHoursDetailed(
        startDate,
        endDate,
        employee,
        ignoreWorkWindow,
        deductBreaks,
        historicalSchedules,
        manualBreak,
        isMakeupWorkday,
        isMakeupHoliday,
        dayOverrides
    );
    return result.finalHours;
};

/**
 * 檢查指定日期是否為休息日
 */
export const isRestDay = (date: Date, restDays: number[] = [0, 6], dayOverrides?: EmployeeDayOverride[]): boolean => {
    if (dayOverrides && dayOverrides.length > 0) {
        const dateStr = format(date, 'yyyy-MM-dd');
        const override = dayOverrides.find(o => o.override_date === dateStr);
        if (override) {
            return override.day_type === DayOverrideType.REST_DAY;
        }
    }

    const dayOfWeek = date.getDay();
    const holidayName = isNationalHoliday(date);
    return restDays.includes(dayOfWeek) || !!holidayName;
};

/**
 * 計算指定日期範圍內的工作日天數
 */
export const countWorkdays = (
    startDate: Date,
    endDate: Date,
    employee: Partial<Employee>,
    dayOverrides?: EmployeeDayOverride[]
): number => {
    if (endDate < startDate) return 0;
    
    let count = 0;
    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);
    
    while (current <= end) {
        if (!isRestDay(current, employee.rest_days || [0, 6], dayOverrides)) {
            count++;
        }
        current.setDate(current.getDate() + 1);
    }
    
    return count;
};

export interface OTValidationResult {
    isValid: boolean;
    error?: string;
    adjustedHours?: number;
    originalHours?: number;
    breakDeducted?: number;
}

/**
 * 驗證加班時數
 */
export const validateOTHours = (
    startDate: Date,
    endDate: Date,
    employee: Partial<Employee>,
    historicalSchedules?: EmployeeSchedule[],
    manualBreak: number = 0,
    isMakeupHoliday: boolean = false,
    dayOverrides?: EmployeeDayOverride[]
): OTValidationResult => {
    const getEffectiveSchedule = (date: Date) => {
        if (!date || isNaN(date.getTime())) {
            return {
                work_start_time: '08:00',
                work_end_time: '17:00',
                break_start_time: '12:00',
                break_end_time: '13:00',
                rest_days: [0, 6],
                standard_daily_hours: 8.0,
                is_override: false
            } as any;
        }

        const dateStr = format(date, 'yyyy-MM-dd');
        if (dayOverrides && dayOverrides.length > 0) {
            const override = dayOverrides.find(o => o.override_date === dateStr);
            if (override) {
                return {
                    work_start_time: override.work_start_time || employee.work_start_time || '08:00',
                    work_end_time: override.work_end_time || employee.work_end_time || '17:00',
                    break_start_time: override.break_start_time || employee.break_start_time || '12:00',
                    break_end_time: override.break_end_time || override.work_end_time || '13:00',
                    rest_days: employee.rest_days || [0, 6],
                    standard_daily_hours: employee.standard_daily_hours || 8.0,
                    is_override: true,
                    override_type: override.day_type
                } as any;
            }
        }

        if (historicalSchedules && historicalSchedules.length > 0) {
            const schedule = historicalSchedules
                .filter(s => s.effective_date <= dateStr)
                .sort((a, b) => b.effective_date.localeCompare(a.effective_date))[0];
            if (schedule) return { ...schedule, is_override: false };
        }

        return {
            work_start_time: employee.work_start_time || '08:00',
            work_end_time: employee.work_end_time || '17:00',
            break_start_time: employee.break_start_time || '12:00',
            break_end_time: employee.break_end_time || '13:00',
            rest_days: employee.rest_days || [0, 6],
            standard_daily_hours: employee.standard_daily_hours || 8.0,
            is_override: false
        } as any;
    };

    const schedule = getEffectiveSchedule(startDate);
    const standardDailyHours = schedule.standard_daily_hours || 8.0;

    const originalHours = calculateLeaveHours(
        startDate,
        endDate,
        employee,
        true, // ignoreWorkWindow
        false, // deductBreaks
        historicalSchedules,
        0,
        false,
        isMakeupHoliday,
        dayOverrides
    );

    if (originalHours === 0) {
        return { isValid: false, error: '加班時數不得為 0' };
    }

    let isRest = false;
    if (schedule.is_override) {
        isRest = schedule.override_type === DayOverrideType.REST_DAY;
    } else {
        const holidayName = isNationalHoliday(startDate);
        const dayOfWeek = startDate.getDay();
        const restDays = schedule.rest_days || [0, 6];
        isRest = restDays.includes(dayOfWeek) || !!holidayName;
    }

    const dayOfWeek = startDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const breakDeducted = Math.floor(originalHours / 4.0001) * 0.5;
    let baseAdjustedHours = parseFloat((originalHours - breakDeducted - manualBreak).toFixed(1));
    if (baseAdjustedHours < 0) baseAdjustedHours = 0;

    const holidayName = isNationalHoliday(startDate);
    const isHolidayLogic = isMakeupHoliday || (!!holidayName && (!isWeekend || holidayName.includes('補假')));

    if (isHolidayLogic) {
        return {
            isValid: true,
            adjustedHours: Math.max(standardDailyHours, baseAdjustedHours),
            originalHours,
            breakDeducted
        };
    }

    const maxHours = isRest ? 12.0 : 4.0;
    const dayType = isRest ? '休息日' : '平日';
    const adjustedHours = Math.min(baseAdjustedHours, maxHours);

    return {
        isValid: true,
        adjustedHours,
        originalHours,
        breakDeducted,
        error: baseAdjustedHours > maxHours
            ? `注意：${dayType}加班時數已達上限 ${maxHours} 小時（原始計算為 ${baseAdjustedHours} 小時已自動修正）`
            : undefined
    };
};

/**
 * 計算加班時數
 */
export const calculateOTHours = (
    startDate: Date,
    endDate: Date,
    employee: Partial<Employee>,
    historicalSchedules?: EmployeeSchedule[],
    manualBreak: number = 0,
    isMakeupHoliday: boolean = false,
    dayOverrides?: EmployeeDayOverride[]
): number => {
    const result = validateOTHours(startDate, endDate, employee, historicalSchedules, manualBreak, isMakeupHoliday, dayOverrides);
    return result.adjustedHours || 0;
};

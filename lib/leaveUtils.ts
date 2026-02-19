import { Employee, EmployeeSchedule } from '../types';
import { isNationalHoliday } from './holidays';
import { format } from 'date-fns';

/**
 * 計算請假/出差時數
 * @param startDate 開始時間
 * @param endDate 結束時間
 * @param employee 員工資料 (包含預設班表)
 * @param ignoreWorkWindow 是否忽略工作時間限制 (通常用於加班)
 * @param deductBreaks 是否扣除休息時間
 * @param historicalSchedules 歷史班表紀錄 (若提供，則依日期查找有效班表)
 * @returns 總時數 (1 位小數)
 */
/**
 * 計算請假/出差時數詳情
 */
export interface DetailedLeaveHours {
    totalHours: number;
    rawHours: number;
    breakHours: number;
    finalHours: number;
}

export const calculateLeaveHoursDetailed = (
    startDate: Date,
    endDate: Date,
    employee: Partial<Employee>,
    ignoreWorkWindow: boolean = false,
    deductBreaks: boolean = true,
    historicalSchedules?: EmployeeSchedule[],
    manualBreak: number = 0,
    isMakeupWorkday: boolean = false
): DetailedLeaveHours => {
    if (endDate <= startDate) return { totalHours: 0, rawHours: 0, breakHours: 0, finalHours: 0 };

    let totalMinutes = 0;
    let totalRawMinutes = 0;
    let totalBreakMinutes = 0;

    // 取得指定日期的有效班表設定
    const getEffectiveSchedule = (date: Date) => {
        if (historicalSchedules && historicalSchedules.length > 0) {
            const dateStr = format(date, 'yyyy-MM-dd');
            const schedule = historicalSchedules
                .filter(s => s.effective_date <= dateStr)
                .sort((a, b) => b.effective_date.localeCompare(a.effective_date))[0];
            if (schedule) return schedule;
        }

        return {
            work_start_time: employee.work_start_time || '08:00',
            work_end_time: employee.work_end_time || '17:00',
            break_start_time: employee.break_start_time || '12:00',
            break_end_time: employee.break_end_time || '13:00',
            break2_start_time: employee.break2_start_time,
            break2_end_time: employee.break2_end_time,
            break3_start_time: employee.break3_start_time,
            break3_end_time: employee.break3_end_time,
            rest_days: employee.rest_days || [0, 6],
            salary_type: employee.salary_type || 'MONTHLY',
            standard_daily_hours: employee.standard_daily_hours || 8.0
        };
    };

    let currentDayHead = new Date(startDate);
    currentDayHead.setHours(0, 0, 0, 0);

    const endDayHead = new Date(endDate);
    endDayHead.setHours(0, 0, 0, 0);

    while (currentDayHead <= endDayHead) {
        const schedule = getEffectiveSchedule(currentDayHead);
        const holidayName = isNationalHoliday(currentDayHead);
        const dayOfWeek = currentDayHead.getDay();
        const isRestDay = schedule.rest_days.includes(dayOfWeek);

        // 如果不是忽略工作時間(ignoreWorkWindow=true，通常是加班)，
        // 則檢查是否為休息日。
        // 如果標記為補行上班日(isMakeupWorkday=true)，則不視為休息日。
        if (!ignoreWorkWindow && (holidayName || (isRestDay && !isMakeupWorkday))) {
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
        totalHours: finalHours, // For compatibility
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
    isMakeupWorkday: boolean = false
): number => {
    const result = calculateLeaveHoursDetailed(
        startDate,
        endDate,
        employee,
        ignoreWorkWindow,
        deductBreaks,
        historicalSchedules,
        manualBreak,
        isMakeupWorkday
    );
    return result.finalHours;
};

/**
 * 檢查指定日期是否為休息日（週末或國定假日）
 * @param date 日期
 * @param restDays 休息日陣列 (0=週日, 6=週六)
 * @returns 是否為休息日
 */
export const isRestDay = (date: Date, restDays: number[] = [0, 6]): boolean => {
    const dayOfWeek = date.getDay();
    const holidayName = isNationalHoliday(date);
    return restDays.includes(dayOfWeek) || !!holidayName;
};

/**
 * 驗證加班時數是否符合勞基法規定
 * @param startDate 開始時間
 * @param endDate 結束時間
 * @param employee 員工資料
 * @param historicalSchedules 歷史班表紀錄
 * @param manualBreak 手動扣除的休息時數
 * @returns 驗證結果
 */
export interface OTValidationResult {
    isValid: boolean;
    error?: string;
    adjustedHours?: number;
    originalHours?: number;
    breakDeducted?: number;
}

export const validateOTHours = (
    startDate: Date,
    endDate: Date,
    employee: Partial<Employee>,
    historicalSchedules?: EmployeeSchedule[],
    manualBreak: number = 0
): OTValidationResult => {
    // 計算原始時數（不扣除休息時間）
    const originalHours = calculateLeaveHours(
        startDate,
        endDate,
        employee,
        true, // ignoreWorkWindow = true (加班可以在工作時間外)
        false, // deductBreaks = false (先不扣除休息時間)
        historicalSchedules
    );

    if (originalHours === 0) {
        return {
            isValid: false,
            error: '加班時數不得為 0'
        };
    }

    // 檢查是否為休息日
    const restDays = employee.rest_days || [0, 6];
    const isRest = isRestDay(startDate, restDays);

    // 檢查是否為國定假日
    const holidayName = isNationalHoliday(startDate);

    // 計算需要扣除的休息時間
    // 依據勞基法規定：每工作 4 小時應有 30 分鐘休息。
    // 自動扣除邏輯：每 4.5 小時（4h 工時 + 0.5h 休息）扣除 0.5 小時。
    // 例如：4.5 小時扣 0.5 小時，9 小時扣 1.0 小時。
    // 註：若為國定假日，則不在此處計算扣除，後面會統一給予 8 小時。
    let breakDeducted = holidayName ? 0 : Math.floor(originalHours / 4.5) * 0.5;

    let adjustedHours = parseFloat((originalHours - breakDeducted - manualBreak).toFixed(1));
    if (adjustedHours < 0) adjustedHours = 0;

    // 依據用戶需求：國定假日加班不論工時統一以 1 日 (8 小時) 計
    if (holidayName) {
        adjustedHours = 8.0;
    }

    // 檢查時數限制（使用調整後的時數）
    const maxHours = isRest ? 12 : 4;
    const dayType = isRest ? '休息日' : '平日';

    if (adjustedHours > maxHours) {
        return {
            isValid: false,
            error: `${dayType}加班不得超過 ${maxHours} 小時（原始時數 ${originalHours} 小時，扣除休息 ${breakDeducted} 小時後為 ${adjustedHours} 小時）`,
            originalHours,
            adjustedHours,
            breakDeducted
        };
    }

    return {
        isValid: true,
        adjustedHours,
        originalHours,
        breakDeducted
    };
};

/**
 * 計算加班時數（自動扣除休息時間）
 * @param startDate 開始時間
 * @param endDate 結束時間
 * @param employee 員工資料
 * @param historicalSchedules 歷史班表紀錄
 * @param manualBreak 手動扣除的休息時數
 * @returns 加班時數（已扣除休息時間）
 */
export const calculateOTHours = (
    startDate: Date,
    endDate: Date,
    employee: Partial<Employee>,
    historicalSchedules?: EmployeeSchedule[],
    manualBreak: number = 0
): number => {
    const result = validateOTHours(startDate, endDate, employee, historicalSchedules, manualBreak);
    return result.adjustedHours || 0;
};

import { supabase } from '../lib/supabase';
import { parseISO, format, subDays, addDays } from 'date-fns';
import { getDefaultHolidays } from '../lib/holidays';

const taipeiClock = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});

export const taipeiPunch = (timestamp: string) => {
    const parts = Object.fromEntries(taipeiClock.formatToParts(new Date(timestamp)).map(part => [part.type, part.value]));
    return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
};

// Supabase may cap each response at 1000 rows even if a larger limit is requested.
async function allRows(query: any): Promise<any[]> {
    const result: any[] = [];
    for (let from = 0; ; from += 500) {
        const { data, error } = await query.range(from, from + 499);
        if (error) throw error;
        if (!Array.isArray(data)) throw new Error('差勤異常偵測資料讀取未回傳有效列表');
        result.push(...data);
        if (data.length < 500) return result;
    }
}

export interface AnomalyRecord {
    id: string; // pseudo id
    employeeId: string;
    employeeName: string;
    department: string;
    date: string;
    type: 'LATE' | 'EARLY_LEAVE' | 'MISSING_CHECK' | 'ABSENT' | 'OVERTIME';
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    description: string;
    actualTime?: string;
    expectedTime?: string;
    status: 'PENDING' | 'RESOLVED';
}

// 按員工分組後的結構
export interface EmployeeAnomalySummary {
    employeeId: string;
    employeeName: string;
    department: string;
    highestSeverity: 'HIGH' | 'MEDIUM' | 'LOW';
    anomalies: AnomalyRecord[];
    // 快速統計
    lateCount: number;
    earlyLeaveCount: number;
    missingCheckCount: number;
    absentCount: number;
}

export const anomalyDetectionService = {
    /**
     * 偵測指定日期範圍內的差勤異常
     * excludeToday: 預設 true，排除當日（因為當天尚未結束）
     */
    async detectAnomalies(startDate: string, endDate: string, excludeToday = true, employeeId?: string): Promise<AnomalyRecord[]> {
        const anomalies: AnomalyRecord[] = [];
        const todayStr = format(new Date(), 'yyyy-MM-dd');

        // 如果 excludeToday 為 true，將 endDate 調整為昨天（最多）
        let effectiveEndDate = endDate;
        if (excludeToday && endDate >= todayStr) {
            effectiveEndDate = format(subDays(new Date(), 1), 'yyyy-MM-dd');
        }

        // 若調整後 startDate > effectiveEndDate，直接回傳空陣列
        if (startDate > effectiveEndDate) {
            return [];
        }
        
        try {
            // 1. 取得所有在職人員（含個人休假日設定）
            let employeeQuery = supabase
                .from('employees')
                .select('id, name, department, work_start_time, work_end_time, rest_days, salary_type')
                .eq('is_active', true)
                .order('id', { ascending: true });
            if (employeeId) employeeQuery = employeeQuery.eq('id', employeeId);
            const employees = await allRows(employeeQuery);

            // 2. 取得打卡紀錄
            let logQuery = supabase
                .from('attendance_logs')
                .select('*')
                .gte('timestamp', `${startDate}T00:00:00+08:00`)
                .lt('timestamp', `${format(addDays(parseISO(effectiveEndDate), 1), 'yyyy-MM-dd')}T00:00:00+08:00`)
                .order('timestamp', { ascending: true }).order('id', { ascending: true });
            if (employeeId) logQuery = logQuery.eq('employee_id', employeeId);
            const logs = await allRows(logQuery);

            let scheduleQuery = supabase.from('employee_schedules')
                .select('employee_id,effective_date,work_start_time,work_end_time,rest_days,salary_type')
                .lte('effective_date', effectiveEndDate)
                .order('effective_date', { ascending: false }).order('id', { ascending: true });
            if (employeeId) scheduleQuery = scheduleQuery.eq('employee_id', employeeId);
            const schedules = await allRows(scheduleQuery);
            let overrideQuery = supabase.from('employee_day_overrides')
                .select('employee_id,override_date,work_start_time,work_end_time,day_type')
                .gte('override_date', startDate).lte('override_date', effectiveEndDate)
                .order('override_date', { ascending: true }).order('id', { ascending: true });
            if (employeeId) overrideQuery = overrideQuery.eq('employee_id', employeeId);
            const overrides = await allRows(overrideQuery);
            const logsByDay = new Map<string, any[]>();
            for (const log of logs) {
                const clock = taipeiPunch(log.timestamp);
                const key = `${log.employee_id}:${clock.date}`;
                if (!logsByDay.has(key)) logsByDay.set(key, []);
                logsByDay.get(key)!.push({ ...log, localTime: clock.time });
            }

            // 3. 取得請假紀錄（已核准）
            let leaveQuery = supabase
                .from('leave_requests')
                .select('*')
                .eq('status', 'APPROVED')
                .gte('end_date', `${startDate}T00:00:00+08:00`)
                .lt('start_date', `${format(addDays(parseISO(effectiveEndDate), 1), 'yyyy-MM-dd')}T00:00:00+08:00`)
                .order('start_date', { ascending: true }).order('id', { ascending: true });
            if (employeeId) leaveQuery = leaveQuery.eq('employee_id', employeeId);
            const leaves = await allRows(leaveQuery);

            // 4. 取得補登紀錄（已核准）- 排除已有補登的缺卡異常
            let makeupQuery = supabase
                .from('makeup_attendance_requests')
                .select('employee_id, request_date, check_type')
                .eq('status', 'APPROVED')
                .gte('request_date', startDate)
                .lte('request_date', effectiveEndDate)
                .order('request_date', { ascending: true }).order('id', { ascending: true });
            if (employeeId) makeupQuery = makeupQuery.eq('employee_id', employeeId);
            const makeups = await allRows(makeupQuery);

            // Await range-bounded reads rather than relying on the holiday module's
            // non-blocking cache. Defaults supplement an empty DB, not a failed read.
            const holidays = await allRows(supabase.from('holidays')
                .select('date,type').gte('date', startDate).lte('date', effectiveEndDate)
                .order('date', { ascending: true }).order('id', { ascending: true }));
            // company_holidays has an organization-wide date and is_active flag;
            // there are no employee/department recipient fields in its read contract.
            const companyHolidays = await allRows(supabase.from('company_holidays')
                .select('holiday_date,is_active').eq('is_active', true)
                .gte('holiday_date', startDate).lte('holiday_date', effectiveEndDate)
                .order('holiday_date', { ascending: true }).order('id', { ascending: true }));
            const holidayTypes = new Map(getDefaultHolidays()
                .filter(h => h.date >= startDate && h.date <= effectiveEndDate)
                .map(h => [h.date, h.type]));
            for (const h of holidays) holidayTypes.set(h.date.slice(0, 10), h.type || 'custom');
            const companyClosureDates = new Set(companyHolidays.map(h => h.holiday_date.slice(0, 10)));
            // Attendance exemptions only: none of these branches grants paid hours.
            // A typhoon or active organization-wide shutdown requires no attendance
            // for either salary type. Ordinary national/custom holidays exempt MONTHLY
            // only; explicit WORKDAY below still takes priority over every reason.
            const exemptionReason = (date: string, salaryType?: string): string | undefined => {
                if (companyClosureDates.has(date)) return 'COMPANY_SHUTDOWN';
                const type = holidayTypes.get(date);
                if (type === 'typhoon') return 'TYPHOON_SHUTDOWN';
                if (salaryType === 'MONTHLY' && type) return type === 'national_holiday' ? 'NATIONAL_HOLIDAY' : 'CUSTOM_HOLIDAY';
                return undefined;
            };

            // 分析每一天、每位員工
            const startD = parseISO(startDate);
            const endD = parseISO(effectiveEndDate);
            let currentDate = new Date(startD);

            while (currentDate <= endD) {
                const dateStr = format(currentDate, 'yyyy-MM-dd');
                const dayOfWeek = currentDate.getDay(); // 0=日, 6=六

                for (const emp of employees) {
                    // 判斷個人休假日（使用 rest_days 欄位，預設週六日）
                    const schedule = schedules.find(s => s.employee_id === emp.id && s.effective_date <= dateStr);
                    const override = overrides.find(o => o.employee_id === emp.id && o.override_date === dateStr);
                    const empRestDays: number[] = schedule?.rest_days || emp.rest_days || [0, 6];
                    const salaryType = schedule?.salary_type ?? emp.salary_type;
                    // Explicit rest/work swaps take priority over weekends and holidays.
                    // Hourly scheduled work is not excused merely because it is a holiday.
                    const isRestDay = override?.day_type === 'REST_DAY' ? true :
                        override?.day_type === 'WORKDAY' ? false :
                            empRestDays.includes(dayOfWeek) || !!exemptionReason(dateStr, salaryType);

                    // 基本班表
                    const expectedStart = (override?.work_start_time || schedule?.work_start_time || emp.work_start_time || '09:00').slice(0, 5);
                    const expectedEnd = (override?.work_end_time || schedule?.work_end_time || emp.work_end_time || '18:00').slice(0, 5);

                    // 檢查當天是否有請假
                    const hasLeave = leaves.some(l => {
                        const lStart = taipeiPunch(l.start_date).date;
                        const lEnd = taipeiPunch(l.end_date).date;
                        return l.employee_id === emp.id && dateStr >= lStart && dateStr <= lEnd;
                    });

                    // 檢查當天是否有已核准的補登
                    const hasMakeupIn = makeups?.some(m => 
                        m.employee_id === emp.id && m.request_date === dateStr && m.check_type === 'IN'
                    );
                    const hasMakeupOut = makeups?.some(m => 
                        m.employee_id === emp.id && m.request_date === dateStr && m.check_type === 'OUT'
                    );

                    // 找出當天打卡紀錄
                    const dayLogs = logsByDay.get(`${emp.id}:${dateStr}`) || [];
                    const inLogs = dayLogs.filter(l => l.check_type === 'IN').sort((a, b) => a.timestamp.localeCompare(b.timestamp));
                    const outLogs = dayLogs.filter(l => l.check_type === 'OUT').sort((a, b) => b.timestamp.localeCompare(a.timestamp));

                    const firstIn = inLogs[0]?.localTime;
                    const lastOut = outLogs[0]?.localTime;
                    // Use raw instants for the boundary: 30:00 qualifies, 30:01 does not.
                    // Only anomaly comparisons shift; punches and payroll are untouched.
                    const scheduledInMs = Date.parse(`${dateStr}T${expectedStart}:00+08:00`);
                    const scheduledOutMs = Date.parse(`${dateStr}T${expectedEnd}:00+08:00`);
                    const lateMs = firstIn ? Date.parse(inLogs[0].timestamp) - scheduledInMs : 0;
                    const flexOffsetMs = Math.min(Math.max(lateMs, 0), 30 * 60 * 1000);
                    const requiredOutMs = scheduledOutMs + flexOffsetMs;
                    const requiredOutTime = taipeiPunch(new Date(requiredOutMs).toISOString()).time;

                    // 判斷異常（非休假日且無請假）
                    if (!isRestDay && !hasLeave) {
                        if (dayLogs.length === 0 && !hasMakeupIn && !hasMakeupOut) {
                            // 曠職
                            anomalies.push({
                                id: `${emp.id}-${dateStr}-ABSENT`,
                                employeeId: emp.id,
                                employeeName: emp.name,
                                department: emp.department,
                                date: dateStr,
                                type: 'ABSENT',
                                severity: 'HIGH',
                                description: '當日無打卡紀錄且無請假',
                                status: 'PENDING'
                            });
                        } else {
                            // 缺卡（排除已補登的）
                            if (!firstIn && !hasMakeupIn) {
                                anomalies.push({
                                    id: `${emp.id}-${dateStr}-MISSING_CHECK_IN`,
                                    employeeId: emp.id,
                                    employeeName: emp.name,
                                    department: emp.department,
                                    date: dateStr,
                                    type: 'MISSING_CHECK',
                                    severity: 'HIGH',
                                    description: '缺少上班打卡',
                                    status: 'PENDING'
                                });
                            }
                            if (!lastOut && !hasMakeupOut) {
                                anomalies.push({
                                    id: `${emp.id}-${dateStr}-MISSING_CHECK_OUT`,
                                    employeeId: emp.id,
                                    employeeName: emp.name,
                                    department: emp.department,
                                    date: dateStr,
                                    type: 'MISSING_CHECK',
                                    severity: 'HIGH',
                                    description: '缺少下班打卡',
                                    status: 'PENDING'
                                });
                            }

                            // Within 30 minutes, departure must make up the shift. A
                            // shortfall is EARLY_LEAVE only, not also LATE. Missing OUT
                            // stays MISSING_CHECK (we cannot infer a departure time).
                            if (firstIn && lateMs > 30 * 60 * 1000) {
                                anomalies.push({
                                    id: `${emp.id}-${dateStr}-LATE`,
                                    employeeId: emp.id,
                                    employeeName: emp.name,
                                    department: emp.department,
                                    date: dateStr,
                                    type: 'LATE',
                                    severity: 'MEDIUM',
                                    description: `遲到 (規定 ${expectedStart})`,
                                    actualTime: firstIn,
                                    expectedTime: expectedStart,
                                    status: 'PENDING'
                                });
                            }

                            // 早退
                            if (lastOut && Date.parse(outLogs[0].timestamp) < requiredOutMs) {
                                anomalies.push({
                                    id: `${emp.id}-${dateStr}-EARLY_LEAVE`,
                                    employeeId: emp.id,
                                    employeeName: emp.name,
                                    department: emp.department,
                                    date: dateStr,
                                    type: 'EARLY_LEAVE',
                                    severity: 'MEDIUM',
                                    description: flexOffsetMs > 0 ? `出勤不足 (彈性上班應於 ${requiredOutTime} 下班)` : `早退 (規定 ${expectedEnd})`,
                                    actualTime: lastOut,
                                    expectedTime: requiredOutTime,
                                    status: 'PENDING'
                                });
                            }
                        }
                    }
                }
                
                // 下一天
                currentDate = new Date(currentDate.getTime() + 86400000);
            }
            
            // 將最新的排在前面
            return anomalies.sort((a, b) => b.date.localeCompare(a.date));
            
        } catch (err) {
            console.error('Error detecting anomalies:', err);
            throw err;
        }
    },

    /**
     * 將異常紀錄依員工分組
     */
    groupByEmployee(anomalies: AnomalyRecord[]): EmployeeAnomalySummary[] {
        const map = new Map<string, EmployeeAnomalySummary>();

        for (const a of anomalies) {
            let entry = map.get(a.employeeId);
            if (!entry) {
                entry = {
                    employeeId: a.employeeId,
                    employeeName: a.employeeName,
                    department: a.department,
                    highestSeverity: a.severity,
                    anomalies: [],
                    lateCount: 0,
                    earlyLeaveCount: 0,
                    missingCheckCount: 0,
                    absentCount: 0,
                };
                map.set(a.employeeId, entry);
            }
            entry.anomalies.push(a);

            // 更新最高嚴重等級
            if (a.severity === 'HIGH') entry.highestSeverity = 'HIGH';
            else if (a.severity === 'MEDIUM' && entry.highestSeverity !== 'HIGH') entry.highestSeverity = 'MEDIUM';

            // 更新統計
            if (a.type === 'LATE') entry.lateCount++;
            else if (a.type === 'EARLY_LEAVE') entry.earlyLeaveCount++;
            else if (a.type === 'MISSING_CHECK') entry.missingCheckCount++;
            else if (a.type === 'ABSENT') entry.absentCount++;
        }

        // 按嚴重度排序：HIGH 在前
        return Array.from(map.values()).sort((a, b) => {
            const severityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
            const diff = severityOrder[a.highestSeverity] - severityOrder[b.highestSeverity];
            if (diff !== 0) return diff;
            return b.anomalies.length - a.anomalies.length;
        });
    }
};

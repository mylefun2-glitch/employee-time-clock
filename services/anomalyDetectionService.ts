import { supabase } from '../lib/supabase';
import { parseISO, format, subDays } from 'date-fns';

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
    async detectAnomalies(startDate: string, endDate: string, excludeToday = true): Promise<AnomalyRecord[]> {
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
            const { data: employees, error: empError } = await supabase
                .from('employees')
                .select('id, name, department, work_start_time, work_end_time, rest_days')
                .eq('is_active', true);
                
            if (empError || !employees) throw empError;

            // 2. 取得打卡紀錄
            const { data: logs, error: logError } = await supabase
                .from('attendance_logs')
                .select('*')
                .gte('timestamp', `${startDate}T00:00:00Z`)
                .lte('timestamp', `${effectiveEndDate}T23:59:59Z`);

            if (logError) throw logError;

            // 3. 取得請假紀錄（已核准）
            const { data: leaves, error: leaveError } = await supabase
                .from('leave_requests')
                .select('*')
                .eq('status', 'APPROVED')
                .gte('end_date', `${startDate}T00:00:00Z`)
                .lte('start_date', `${effectiveEndDate}T23:59:59Z`);

            if (leaveError) throw leaveError;

            // 4. 取得補登紀錄（已核准）- 排除已有補登的缺卡異常
            const { data: makeups, error: makeupError } = await supabase
                .from('makeup_attendance_requests')
                .select('employee_id, request_date, check_type')
                .eq('status', 'APPROVED')
                .gte('request_date', startDate)
                .lte('request_date', effectiveEndDate);

            if (makeupError) console.warn('Warning fetching makeup records:', makeupError);

            // 分析每一天、每位員工
            const startD = parseISO(startDate);
            const endD = parseISO(effectiveEndDate);
            let currentDate = new Date(startD);

            while (currentDate <= endD) {
                const dateStr = format(currentDate, 'yyyy-MM-dd');
                const dayOfWeek = currentDate.getDay(); // 0=日, 6=六

                for (const emp of employees) {
                    // 判斷個人休假日（使用 rest_days 欄位，預設週六日）
                    const empRestDays: number[] = emp.rest_days || [0, 6];
                    const isRestDay = empRestDays.includes(dayOfWeek);

                    // 基本班表
                    const expectedStart = emp.work_start_time || '09:00';
                    const expectedEnd = emp.work_end_time || '18:00';

                    // 檢查當天是否有請假
                    const hasLeave = leaves?.some(l => {
                        const lStart = l.start_date.split('T')[0];
                        const lEnd = l.end_date.split('T')[0];
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
                    const dayLogs = logs?.filter(l => l.employee_id === emp.id && l.timestamp.startsWith(dateStr)) || [];
                    const inLogs = dayLogs.filter(l => l.check_type === 'IN').sort((a, b) => a.timestamp.localeCompare(b.timestamp));
                    const outLogs = dayLogs.filter(l => l.check_type === 'OUT').sort((a, b) => b.timestamp.localeCompare(a.timestamp));

                    const firstIn = inLogs[0]?.timestamp.split('T')[1]?.substring(0, 5);
                    const lastOut = outLogs[0]?.timestamp.split('T')[1]?.substring(0, 5);

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

                            // 遲到
                            if (firstIn && firstIn > expectedStart) {
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
                            if (lastOut && lastOut < expectedEnd) {
                                anomalies.push({
                                    id: `${emp.id}-${dateStr}-EARLY_LEAVE`,
                                    employeeId: emp.id,
                                    employeeName: emp.name,
                                    department: emp.department,
                                    date: dateStr,
                                    type: 'EARLY_LEAVE',
                                    severity: 'MEDIUM',
                                    description: `早退 (規定 ${expectedEnd})`,
                                    actualTime: lastOut,
                                    expectedTime: expectedEnd,
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
            return [];
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

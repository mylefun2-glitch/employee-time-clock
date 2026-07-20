import { supabase } from '../lib/supabase';
import { parseISO, format } from 'date-fns';

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

export const anomalyDetectionService = {
    /**
     * 偵測指定日期範圍內的差勤異常
     */
    async detectAnomalies(startDate: string, endDate: string): Promise<AnomalyRecord[]> {
        const anomalies: AnomalyRecord[] = [];
        
        try {
            // 1. 取得所有在職人員
            const { data: employees, error: empError } = await supabase
                .from('employees')
                .select('id, name, department, work_start_time, work_end_time')
                .eq('is_active', true);
                
            if (empError || !employees) throw empError;

            // 2. 取得打卡紀錄
            const { data: logs, error: logError } = await supabase
                .from('attendance_logs')
                .select('*')
                .gte('timestamp', `${startDate}T00:00:00Z`)
                .lte('timestamp', `${endDate}T23:59:59Z`);

            if (logError) throw logError;

            // 3. 取得請假紀錄
            const { data: leaves, error: leaveError } = await supabase
                .from('leave_requests')
                .select('*')
                .eq('status', 'APPROVED')
                .gte('end_date', `${startDate}T00:00:00Z`)
                .lte('start_date', `${endDate}T23:59:59Z`);

            if (leaveError) throw leaveError;

            // 分析每一天、每位員工
            const startD = parseISO(startDate);
            const endD = parseISO(endDate);
            let currentDate = startD;

            while (currentDate <= endD) {
                const dateStr = format(currentDate, 'yyyy-MM-dd');
                const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;

                for (const emp of employees) {
                    // 基本班表 (簡化邏輯：預設 09:00 - 18:00 或從 employee 表取)
                    const expectedStart = emp.work_start_time || '09:00';
                    const expectedEnd = emp.work_end_time || '18:00';

                    // 檢查當天是否有請假
                    const hasLeave = leaves?.some(l => {
                        const lStart = l.start_date.split('T')[0];
                        const lEnd = l.end_date.split('T')[0];
                        return l.employee_id === emp.id && dateStr >= lStart && dateStr <= lEnd;
                    });

                    // 找出當天打卡紀錄
                    const dayLogs = logs?.filter(l => l.employee_id === emp.id && l.timestamp.startsWith(dateStr)) || [];
                    const inLogs = dayLogs.filter(l => l.check_type === 'IN').sort((a, b) => a.timestamp.localeCompare(b.timestamp));
                    const outLogs = dayLogs.filter(l => l.check_type === 'OUT').sort((a, b) => b.timestamp.localeCompare(a.timestamp));

                    const firstIn = inLogs[0]?.timestamp.split('T')[1].substring(0, 5);
                    const lastOut = outLogs[0]?.timestamp.split('T')[1].substring(0, 5);

                    // 判斷異常 (非假日且無請假)
                    if (!isWeekend && !hasLeave) {
                        if (dayLogs.length === 0) {
                            // 判斷曠職 (如果是過去的日期)
                            if (dateStr < format(new Date(), 'yyyy-MM-dd')) {
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
                            }
                        } else {
                            if (!firstIn || !lastOut) {
                                anomalies.push({
                                    id: `${emp.id}-${dateStr}-MISSING_CHECK`,
                                    employeeId: emp.id,
                                    employeeName: emp.name,
                                    department: emp.department,
                                    date: dateStr,
                                    type: 'MISSING_CHECK',
                                    severity: 'HIGH',
                                    description: !firstIn ? '缺少上班打卡' : '缺少下班打卡',
                                    status: 'PENDING'
                                });
                            }

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
                currentDate = new Date(currentDate.setDate(currentDate.getDate() + 1));
            }
            
            // 將最新的排在前面
            return anomalies.sort((a, b) => b.date.localeCompare(a.date));
            
        } catch (err) {
            console.error('Error detecting anomalies:', err);
            return [];
        }
    }
};

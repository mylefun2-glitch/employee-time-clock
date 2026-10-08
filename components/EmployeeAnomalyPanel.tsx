import React, { useEffect, useState } from 'react';
import { format, subDays } from 'date-fns';
import { anomalyDetectionService, type AnomalyRecord } from '../services/anomalyDetectionService';

const labels: Record<AnomalyRecord['type'], string> = {
    LATE: '遲到', EARLY_LEAVE: '早退', MISSING_CHECK: '缺卡', ABSENT: '無打卡紀錄', OVERTIME: '超時'
};

const EmployeeAnomalyPanel: React.FC<{ employeeId: string }> = ({ employeeId }) => {
    const [rangeDays, setRangeDays] = useState(7);
    const [records, setRecords] = useState<AnomalyRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const today = format(new Date(), 'yyyy-MM-dd');
    const startDate = format(subDays(new Date(), rangeDays), 'yyyy-MM-dd');
    const endDate = format(subDays(new Date(), 1), 'yyyy-MM-dd');

    useEffect(() => {
        let active = true;
        setLoading(true);
        setError(false);
        setRecords([]);
        anomalyDetectionService.detectAnomalies(startDate, endDate, true, employeeId)
            .then(data => { if (active) setRecords(data.filter(item => item.employeeId === employeeId)); })
            .catch(err => { console.error('Failed to load own anomalies:', err); if (active) setError(true); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [employeeId, rangeDays, today]);

    return (
        <section aria-label="我的差勤異常" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h3 className="text-lg font-black text-slate-900">我的差勤異常</h3>
                    <p className="text-xs text-slate-500 mt-1">{startDate}～{endDate}（不含今日）・只顯示本人；僅供核對，非正式曠職或扣薪認定</p>
                </div>
                <label className="text-sm text-slate-600 font-bold flex items-center gap-2">
                    查看區間
                    <select value={rangeDays} onChange={event => setRangeDays(Number(event.target.value))} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                        <option value={7}>近 7 天</option>
                        <option value={14}>近 14 天</option>
                        <option value={30}>近 30 天</option>
                    </select>
                </label>
            </div>
            {loading ? <p role="status" className="text-slate-500 py-5">正在檢查打卡與班表…</p> : error ? (
                <p role="alert" className="text-amber-800 bg-amber-50 rounded-xl p-4">資料讀取失敗，無法判定異常，請稍後重試。</p>
            ) : records.length === 0 ? (
                <p className="text-emerald-800 bg-emerald-50 rounded-xl p-4">此區間未偵測到差勤異常。</p>
            ) : (
                <div className="space-y-2">
                    <p className="text-sm text-slate-600">偵測到 {records.length} 項，請對照出勤月曆與申請紀錄。</p>
                    {records.map(record => (
                        <article key={record.id} className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 flex flex-wrap gap-x-4 gap-y-1 items-center">
                            <div className="font-bold text-slate-800">{record.date}・{labels[record.type]}</div>
                            <div className="text-sm text-slate-600">{record.description}</div>
                            {record.actualTime && <div className="text-sm text-slate-600">打卡 {record.actualTime}／班表 {record.expectedTime}</div>}
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
};

export default EmployeeAnomalyPanel;

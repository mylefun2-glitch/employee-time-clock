import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { anomalyDetectionService, type AnomalyRecord } from '../services/anomalyDetectionService';
import { format, subDays } from 'date-fns';

const ANOMALY_TYPE_LABEL = {
    LATE: '遲到', EARLY_LEAVE: '早退', MISSING_CHECK: '缺卡',
    ABSENT: '無打卡待確認', OVERTIME: '超時',
} satisfies Record<AnomalyRecord['type'], string>;
const ANOMALY_TYPE_COLOR = {
    LATE: 'bg-amber-50 text-amber-800 border-amber-200',
    EARLY_LEAVE: 'bg-orange-50 text-orange-800 border-orange-200',
    MISSING_CHECK: 'bg-red-50 text-red-700 border-red-200',
    ABSENT: 'bg-red-50 text-red-700 border-red-200',
    OVERTIME: 'bg-blue-50 text-blue-700 border-blue-200',
} satisfies Record<AnomalyRecord['type'], string>;
const TYPES = Object.keys(ANOMALY_TYPE_LABEL) as AnomalyRecord['type'][];
const controlClass = 'min-h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500';

const AttendanceAnomalyDashboard: React.FC = () => {
    const [anomalies, setAnomalies] = useState<AnomalyRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [rangeDays, setRangeDays] = useState(7);
    const [query, setQuery] = useState('');
    const [type, setType] = useState<'ALL' | AnomalyRecord['type']>('ALL');
    const [severity, setSeverity] = useState<'ALL' | AnomalyRecord['severity']>('ALL');
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [reload, setReload] = useState(0);
    const startDate = useMemo(() => format(subDays(new Date(), rangeDays), 'yyyy-MM-dd'), [rangeDays]);
    const endDate = useMemo(() => format(subDays(new Date(), 1), 'yyyy-MM-dd'), []);

    useEffect(() => {
        // Ignore an older range's response if the user changes the selector rapidly.
        let active = true;
        setLoading(true);
        setLoadError(false);
        setExpandedIds(new Set());
        anomalyDetectionService.detectAnomalies(startDate, endDate, true)
            .then(data => { if (active) setAnomalies(data); })
            .catch(error => {
                console.error('Failed to fetch anomalies:', error);
                if (active) { setAnomalies([]); setLoadError(true); }
            })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [startDate, endDate, reload]);

    const filtered = useMemo(() => {
        const search = query.trim().toLocaleLowerCase();
        return anomalies.filter(a =>
            (type === 'ALL' || a.type === type) &&
            (severity === 'ALL' || a.severity === severity) &&
            (!search || [a.employeeName, a.department, a.employeeId].some(value => value.toLocaleLowerCase().includes(search)))
        );
    }, [anomalies, query, type, severity]);
    const grouped = useMemo(() => {
        const employees = new Map<string, { employeeId: string; name: string; department: string; records: AnomalyRecord[]; days: Map<string, AnomalyRecord[]> }>();
        for (const a of filtered) {
            let employee = employees.get(a.employeeId);
            if (!employee) {
                employee = { employeeId: a.employeeId, name: a.employeeName, department: a.department, records: [], days: new Map() };
                employees.set(a.employeeId, employee);
            }
            employee.records.push(a);
            const day = employee.days.get(a.date) || [];
            day.push(a);
            employee.days.set(a.date, day);
        }
        // Keep actionable high-priority employees first, then a stable name/ID order.
        return [...employees.values()].sort((a, b) =>
            Number(b.records.some(r => r.severity === 'HIGH')) - Number(a.records.some(r => r.severity === 'HIGH')) ||
            a.name.localeCompare(b.name, 'zh-Hant') || a.employeeId.localeCompare(b.employeeId));
    }, [filtered]);
    const dayCount = grouped.reduce((sum, employee) => sum + employee.days.size, 0);
    const hasFilters = Boolean(query.trim() || type !== 'ALL' || severity !== 'ALL');
    const clearFilters = () => { setQuery(''); setType('ALL'); setSeverity('ALL'); };
    const toggleExpand = (id: string) => setExpandedIds(previous => {
        const next = new Set(previous);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });

    return (
        <section aria-label="差勤異常偵測" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-slate-50/50 px-4 py-3 sm:px-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800"><AlertCircle aria-hidden="true" className="h-5 w-5 text-amber-600" />差勤異常偵測</h2>
                    <select aria-label="查詢日期範圍" value={rangeDays} onChange={e => setRangeDays(Number(e.target.value))} className={controlClass}>
                        {[3, 7, 14, 30].map(days => <option key={days} value={days}>近 {days} 天</option>)}
                    </select>
                </div>
                <p className="mt-1 text-xs text-slate-500">{startDate} ～ {endDate}（不含今日）</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">僅偵測月薪制人員；月薪國假補假、已啟用的風災停班及符合彈性規則者不列異常，單日指定上班仍依班表檢查。無打卡不代表曠職，請先核對班表、假單與補登。</p>
                {!loading && !loadError && <>
                    <div className="mt-3 flex flex-wrap gap-2">
                        <input aria-label="搜尋員工、姓名或單位" placeholder="搜尋姓名／單位／員工 ID" value={query} onChange={e => setQuery(e.target.value)} className={`${controlClass} w-full min-w-0 sm:w-64`} />
                        <select aria-label="異常類型" value={type} onChange={e => setType(e.target.value as typeof type)} className={`${controlClass} min-w-0 flex-1 sm:flex-none`}>
                            <option value="ALL">全部類型</option>
                            {TYPES.map(key => <option key={key} value={key}>{ANOMALY_TYPE_LABEL[key]}</option>)}
                        </select>
                        <select aria-label="異常程度" value={severity} onChange={e => setSeverity(e.target.value as typeof severity)} className={`${controlClass} min-w-0 flex-1 sm:flex-none`}>
                            <option value="ALL">全部程度</option><option value="HIGH">嚴重</option><option value="MEDIUM">輕微</option><option value="LOW">提醒</option>
                        </select>
                        {hasFilters && <button onClick={clearFilters} className="min-h-10 px-2 text-sm text-blue-700 hover:underline">清除篩選</button>}
                    </div>
                    <p role="status" className="mt-2 text-sm leading-relaxed text-slate-600">
                        {hasFilters ? '篩選結果' : '區間合計'}：<strong>{grouped.length}</strong> 人・<strong>{dayCount}</strong> 異常人日・<strong>{filtered.length}</strong> 筆異常
                        <span className="ml-2 text-xs text-slate-500">（同人同日合計 1 人日）</span>
                    </p>
                </>}
            </div>

            {loading ? <p role="status" className="p-6 text-center text-sm text-slate-500">正在掃描差勤異常…</p>
                : loadError ? <div role="alert" className="bg-amber-50 p-5 text-sm text-amber-900">
                    差勤資料讀取失敗，無法判定異常。
                    <button onClick={() => setReload(value => value + 1)} className="ml-2 min-h-10 font-bold underline">重新讀取</button>
                </div>
                : grouped.length === 0 ? <div className="p-6 text-center text-sm text-slate-500">
                    <p>{anomalies.length === 0 ? '此區間未偵測到需確認的異常' : '沒有符合篩選條件的異常'}</p>
                    {hasFilters && <button onClick={clearFilters} className="mt-2 min-h-10 text-blue-700 underline">清除篩選</button>}
                </div>
                : <div className="max-h-[500px] overflow-y-auto divide-y divide-slate-100">
                    {grouped.map(employee => {
                        const expanded = expandedIds.has(employee.employeeId);
                        const high = employee.records.some(a => a.severity === 'HIGH');
                        return <div key={employee.employeeId} className={`border-l-2 ${high ? 'border-red-400' : 'border-amber-400'}`}>
                            <button aria-expanded={expanded} onClick={() => toggleExpand(employee.employeeId)} className="flex w-full items-center gap-2 px-3 py-3 text-left hover:bg-slate-50 focus-visible:outline-blue-500 sm:px-4">
                                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1.5">
                                    <span className="break-words font-bold text-slate-900">{employee.name}</span>
                                    <span className="break-words text-xs text-slate-500">{employee.department || '未設定單位'}</span>
                                    <span className="whitespace-nowrap text-xs font-medium text-slate-600">{employee.days.size} 天・{employee.records.length} 筆</span>
                                    <span className="flex w-full flex-wrap gap-1 sm:w-auto">
                                        {TYPES.map(key => {
                                            const count = employee.records.filter(a => a.type === key).length;
                                            return count > 0 && <span key={key} className={`rounded border px-1.5 py-0.5 text-xs ${ANOMALY_TYPE_COLOR[key]}`}>{ANOMALY_TYPE_LABEL[key]} {count}</span>;
                                        })}
                                    </span>
                                </div>
                                {expanded ? <ChevronUp aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" /> : <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" />}
                            </button>
                            {expanded && <div className="space-y-2 px-3 pb-3 sm:px-4">
                                {[...employee.days.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([date, records]) => <div key={date} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 sm:flex sm:items-start sm:gap-4">
                                    <div className="mb-1 shrink-0 text-xs font-medium text-slate-500 sm:mb-0 sm:pt-1"><time dateTime={date}>{date}</time><span className="ml-2">{records.length} 筆</span></div>
                                    <ul className="min-w-0 flex-1 space-y-1.5">
                                        {records.map((a, index) => <li key={`${a.type}-${index}`} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs leading-relaxed">
                                            <span className={`rounded border px-1.5 py-0.5 ${ANOMALY_TYPE_COLOR[a.type]}`}>{ANOMALY_TYPE_LABEL[a.type]}</span>
                                            <span className="min-w-0 break-words text-slate-600">{a.type === 'ABSENT' ? '無打卡紀錄，請核對班表、假單或補登' : a.description}</span>
                                            {(a.expectedTime || a.actualTime) && <span className="font-mono text-slate-700">{a.expectedTime && `應 ${a.expectedTime}`}{a.expectedTime && a.actualTime && '／'}{a.actualTime && `實 ${a.actualTime}`}</span>}
                                        </li>)}
                                    </ul>
                                </div>)}
                            </div>}
                        </div>;
                    })}
                </div>}
        </section>
    );
};

export default AttendanceAnomalyDashboard;

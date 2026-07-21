import React, { useEffect, useState, useMemo } from 'react';
import { AlertCircle, Clock, CalendarX, LogOut, ChevronDown, ChevronUp } from 'lucide-react';
import { anomalyDetectionService, AnomalyRecord, EmployeeAnomalySummary } from '../services/anomalyDetectionService';
import { format, subDays } from 'date-fns';

// 異常類型中文對照
const ANOMALY_TYPE_LABEL: Record<string, string> = {
    LATE: '遲到',
    EARLY_LEAVE: '早退',
    MISSING_CHECK: '缺卡',
    ABSENT: '曠職',
    OVERTIME: '超時',
};

const ANOMALY_TYPE_COLOR: Record<string, string> = {
    LATE: 'bg-amber-100 text-amber-700 border-amber-200',
    EARLY_LEAVE: 'bg-orange-100 text-orange-700 border-orange-200',
    MISSING_CHECK: 'bg-red-100 text-red-700 border-red-200',
    ABSENT: 'bg-red-100 text-red-700 border-red-200',
    OVERTIME: 'bg-blue-100 text-blue-700 border-blue-200',
};

const AttendanceAnomalyDashboard: React.FC = () => {
    const [anomalies, setAnomalies] = useState<AnomalyRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM'>('ALL');
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    // 日期範圍選擇
    const [rangeDays, setRangeDays] = useState(7);

    const startDate = useMemo(() => format(subDays(new Date(), rangeDays), 'yyyy-MM-dd'), [rangeDays]);
    const endDate = useMemo(() => format(subDays(new Date(), 1), 'yyyy-MM-dd'), []);

    useEffect(() => {
        const fetchAnomalies = async () => {
            setLoading(true);
            try {
                const data = await anomalyDetectionService.detectAnomalies(startDate, endDate, true);
                setAnomalies(data);
            } catch (error) {
                console.error('Failed to fetch anomalies:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchAnomalies();
    }, [startDate, endDate]);

    // 依員工分組
    const grouped: EmployeeAnomalySummary[] = useMemo(() => {
        const filtered = filter === 'ALL' ? anomalies : anomalies.filter(a => a.severity === filter);
        return anomalyDetectionService.groupByEmployee(filtered);
    }, [anomalies, filter]);

    // 統計摘要
    const stats = useMemo(() => {
        const high = anomalies.filter(a => a.severity === 'HIGH').length;
        const medium = anomalies.filter(a => a.severity === 'MEDIUM').length;
        return { total: anomalies.length, high, medium, employeeCount: new Set(anomalies.map(a => a.employeeId)).size };
    }, [anomalies]);

    const toggleExpand = (id: string) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    if (loading) {
        return (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-200 border-t-blue-500 mb-3" />
                <p className="text-slate-500 font-bold">正在掃描差勤異常...</p>
            </div>
        );
    }

    if (anomalies.length === 0) {
        return (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center">
                <span className="material-symbols-outlined text-4xl text-emerald-500 block mb-2">task_alt</span>
                <h3 className="text-emerald-900 font-bold text-lg">過去 {rangeDays} 天無任何異常</h3>
                <p className="text-emerald-600 text-sm mt-1">大家的出勤狀況非常良好！</p>
            </div>
        );
    }

    return (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            {/* 標題列 */}
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex flex-wrap justify-between items-center gap-4">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-red-500" />
                        <h2 className="text-lg font-black text-slate-800">差勤異常偵測</h2>
                        <span className="text-sm text-slate-500 font-medium">({startDate} ~ {endDate}，不含今日)</span>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* 日期範圍選擇器 */}
                        <select
                            value={rangeDays}
                            onChange={e => setRangeDays(Number(e.target.value))}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-bold text-slate-700 bg-white focus:ring-2 focus:ring-blue-500/20"
                        >
                            <option value={3}>近 3 天</option>
                            <option value={7}>近 7 天</option>
                            <option value={14}>近 14 天</option>
                            <option value={30}>近 30 天</option>
                        </select>
                        {/* 嚴重度篩選 */}
                        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                            {(['ALL', 'HIGH', 'MEDIUM'] as const).map(f => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={`px-3 py-1 rounded-md text-sm font-bold transition-all ${
                                        filter === f ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    {f === 'ALL' ? '全部' : f === 'HIGH' ? '🔴 嚴重' : '🟡 輕微'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 摘要統計 */}
                <div className="flex flex-wrap gap-4 mt-3">
                    <div className="flex items-center gap-1.5 text-sm">
                        <span className="w-2 h-2 rounded-full bg-slate-400" />
                        <span className="text-slate-600">涉及 <strong className="text-slate-900">{stats.employeeCount}</strong> 位員工</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm">
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                        <span className="text-slate-600">嚴重 <strong className="text-red-600">{stats.high}</strong> 筆</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        <span className="text-slate-600">輕微 <strong className="text-amber-600">{stats.medium}</strong> 筆</span>
                    </div>
                </div>
            </div>

            {/* 按員工分組列表 */}
            <div className="max-h-[500px] overflow-y-auto divide-y divide-slate-100">
                {grouped.map(emp => {
                    const isExpanded = expandedIds.has(emp.employeeId);
                    const borderColor = emp.highestSeverity === 'HIGH' ? 'border-l-red-500' : 'border-l-amber-400';

                    return (
                        <div key={emp.employeeId} className={`border-l-4 ${borderColor}`}>
                            {/* 員工摘要行（可展開） */}
                            <button
                                onClick={() => toggleExpand(emp.employeeId)}
                                className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50/80 transition-colors text-left"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm ${
                                        emp.highestSeverity === 'HIGH' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                                    }`}>
                                        {emp.employeeName.charAt(0)}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                                            {emp.employeeName}
                                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                                                {emp.department}
                                            </span>
                                        </div>
                                        {/* 異常類型標籤 */}
                                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                                            {emp.absentCount > 0 && (
                                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border bg-red-50 text-red-700 border-red-200">
                                                    曠職 ×{emp.absentCount}
                                                </span>
                                            )}
                                            {emp.missingCheckCount > 0 && (
                                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border bg-red-50 text-red-700 border-red-200">
                                                    缺卡 ×{emp.missingCheckCount}
                                                </span>
                                            )}
                                            {emp.lateCount > 0 && (
                                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                                                    遲到 ×{emp.lateCount}
                                                </span>
                                            )}
                                            {emp.earlyLeaveCount > 0 && (
                                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border bg-orange-50 text-orange-700 border-orange-200">
                                                    早退 ×{emp.earlyLeaveCount}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 shrink-0">
                                    <span className="text-sm font-black text-slate-500">
                                        {emp.anomalies.length} 筆
                                    </span>
                                    {isExpanded
                                        ? <ChevronUp className="w-5 h-5 text-slate-400" />
                                        : <ChevronDown className="w-5 h-5 text-slate-400" />
                                    }
                                </div>
                            </button>

                            {/* 展開的明細列 */}
                            {isExpanded && (
                                <div className="px-6 pb-4 pl-[4.5rem] space-y-2 animate-in slide-in-from-top-2 duration-200">
                                    {emp.anomalies.map(a => (
                                        <div key={a.id} className={`flex items-center justify-between px-4 py-2.5 rounded-lg border ${
                                            a.severity === 'HIGH' ? 'bg-red-50/60 border-red-100' : 'bg-amber-50/60 border-amber-100'
                                        }`}>
                                            <div className="flex items-center gap-3 text-sm">
                                                <span className="font-mono text-slate-500 w-[82px] shrink-0">{a.date}</span>
                                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${ANOMALY_TYPE_COLOR[a.type]}`}>
                                                    {ANOMALY_TYPE_LABEL[a.type]}
                                                </span>
                                                <span className="text-slate-600">{a.description}</span>
                                            </div>
                                            {a.actualTime && (
                                                <span className="text-sm font-mono font-bold text-slate-700 shrink-0">
                                                    {a.actualTime}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}

                {grouped.length === 0 && (
                    <div className="text-center py-10 text-slate-500 font-bold">
                        沒有符合條件的異常紀錄
                    </div>
                )}
            </div>
        </div>
    );
};

export default AttendanceAnomalyDashboard;

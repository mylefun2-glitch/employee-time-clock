import React, { useEffect, useState } from 'react';
import { AlertCircle, Clock, CalendarX, LogOut } from 'lucide-react';
import { anomalyDetectionService, AnomalyRecord } from '../services/anomalyDetectionService';
import { format, subDays } from 'date-fns';

const AttendanceAnomalyDashboard: React.FC = () => {
    const [anomalies, setAnomalies] = useState<AnomalyRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM'>('ALL');

    useEffect(() => {
        const fetchAnomalies = async () => {
            setLoading(true);
            try {
                const endDate = format(new Date(), 'yyyy-MM-dd');
                const startDate = format(subDays(new Date(), 7), 'yyyy-MM-dd'); // 預設看過去 7 天
                
                const data = await anomalyDetectionService.detectAnomalies(startDate, endDate);
                setAnomalies(data);
            } catch (error) {
                console.error('Failed to fetch anomalies:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchAnomalies();
    }, []);

    const filteredAnomalies = anomalies.filter(a => {
        if (filter === 'ALL') return true;
        return a.severity === filter;
    });

    if (loading) {
        return <div className="p-4 text-center text-slate-500 animate-pulse">正在掃描差勤異常...</div>;
    }

    if (anomalies.length === 0) {
        return (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
                <span className="material-symbols-outlined text-4xl text-emerald-500 mb-2">task_alt</span>
                <h3 className="text-emerald-900 font-bold text-lg">過去 7 天無任何異常</h3>
                <p className="text-emerald-600 text-sm mt-1">大家的出勤狀況非常良好！</p>
            </div>
        );
    }

    return (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    <h2 className="text-lg font-black text-slate-800">差勤異常偵測 (過去 7 天)</h2>
                </div>
                <div className="flex gap-2 bg-slate-100 p-1 rounded-lg">
                    {(['ALL', 'HIGH', 'MEDIUM'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-3 py-1 rounded-md text-sm font-bold transition-all ${
                                filter === f ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            {f === 'ALL' ? '全部' : f === 'HIGH' ? '嚴重' : '輕微'}
                        </button>
                    ))}
                </div>
            </div>

            <div className="max-h-[400px] overflow-y-auto p-4 space-y-3">
                {filteredAnomalies.map(anomaly => (
                    <div key={anomaly.id} className={`flex items-start gap-4 p-4 rounded-xl border ${
                        anomaly.severity === 'HIGH' ? 'bg-red-50/50 border-red-100' : 'bg-amber-50/50 border-amber-100'
                    }`}>
                        <div className={`p-2 rounded-lg ${
                            anomaly.severity === 'HIGH' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                        }`}>
                            {anomaly.type === 'ABSENT' && <CalendarX className="w-5 h-5" />}
                            {anomaly.type === 'LATE' && <Clock className="w-5 h-5" />}
                            {anomaly.type === 'EARLY_LEAVE' && <LogOut className="w-5 h-5" />}
                            {anomaly.type === 'MISSING_CHECK' && <AlertCircle className="w-5 h-5" />}
                        </div>
                        
                        <div className="flex-1">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className="font-bold text-slate-900 flex items-center gap-2">
                                        {anomaly.employeeName}
                                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                            {anomaly.department}
                                        </span>
                                    </h4>
                                    <p className="text-sm text-slate-600 mt-1">
                                        <span className="font-mono text-slate-500 mr-2">{anomaly.date}</span>
                                        {anomaly.description}
                                    </p>
                                </div>
                                <div className="text-right">
                                    {anomaly.actualTime && (
                                        <div className="text-sm font-black text-slate-900">
                                            實際: {anomaly.actualTime}
                                        </div>
                                    )}
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                        anomaly.severity === 'HIGH' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                    }`}>
                                        {anomaly.type}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
                {filteredAnomalies.length === 0 && (
                    <div className="text-center py-8 text-slate-500 font-bold">
                        沒有符合條件的異常紀錄
                    </div>
                )}
            </div>
        </div>
    );
};

export default AttendanceAnomalyDashboard;

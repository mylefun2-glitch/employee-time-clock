import React, { useState, useEffect } from 'react';
import { getCarUsageHistory } from '../services/carService';
import { format } from 'date-fns';

interface CarUsageHistoryModalProps {
    car: any;
    onClose: () => void;
}

const CarUsageHistoryModal: React.FC<CarUsageHistoryModalProps> = ({ car, onClose }) => {
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [targetDate, setTargetDate] = useState('');

    useEffect(() => {
        fetchHistory();
    }, [car.id, targetDate]);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const data = await getCarUsageHistory(car.id, targetDate || undefined);
            setHistory(data);
        } catch (error) {
            console.error('Error fetching car history:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'APPROVED': case 'CHAIRMAN_APPROVED': return 'text-emerald-700 bg-emerald-100 border-emerald-200';
            case 'PENDING': return 'text-amber-700 bg-amber-100 border-amber-200';
            default: return 'text-slate-700 bg-slate-100 border-slate-200';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'APPROVED': case 'CHAIRMAN_APPROVED': return '已核准';
            case 'PENDING': return '待審核';
            default: return status;
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-4xl w-full flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="flex justify-between items-start p-8 border-b border-slate-50 shrink-0">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                            <span className="material-symbols-outlined text-blue-600 shadow-sm">history</span>
                            車輛使用紀錄
                        </h2>
                        <div className="mt-2 flex items-center gap-2">
                            <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-sm font-bold">
                                {car.plate_number}
                            </span>
                            <span className="text-slate-500 font-bold text-sm">{car.model}</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="flex flex-col flex-1 min-h-0">
                    <div className="p-6 border-b border-slate-50 bg-slate-50/50">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">篩選日期</label>
                        <input
                            type="date"
                            value={targetDate}
                            onChange={(e) => setTargetDate(e.target.value)}
                            className="w-full max-w-xs px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-slate-700"
                        />
                    </div>

                    <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
                        {loading ? (
                            <div className="flex justify-center items-center h-32">
                                <span className="material-symbols-outlined animate-spin text-slate-300 text-3xl">refresh</span>
                            </div>
                        ) : history.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-48 text-center bg-white rounded-3xl border border-dashed border-slate-200">
                                <span className="material-symbols-outlined text-4xl text-slate-300 mb-3 block">event_busy</span>
                                <h3 className="text-lg font-black text-slate-700 mb-1">無使用紀錄</h3>
                                <p className="text-slate-500 font-medium text-sm">此區間目前沒有借用資料</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {history.map((record) => (
                                    <div key={record.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4 hover:border-blue-200 transition-colors">
                                        <div className="flex flex-col gap-1 min-w-[200px]">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-black text-slate-900">{record.employee_name}</span>
                                                <span className="text-xs font-bold px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md">
                                                    {record.department}
                                                </span>
                                            </div>
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border w-fit ${getStatusColor(record.status)}`}>
                                                {getStatusText(record.status)}
                                            </span>
                                        </div>

                                        <div className="flex-1 flex flex-col gap-1.5">
                                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                                <span className="material-symbols-outlined text-[16px] text-slate-400">schedule</span>
                                                <span className="font-bold">
                                                    {format(new Date(record.start_time), 'yyyy/MM/dd HH:mm')} - {format(new Date(record.end_time), 'yyyy/MM/dd HH:mm')}
                                                </span>
                                            </div>
                                            <div className="flex items-start gap-2 text-sm text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                <span className="material-symbols-outlined text-[16px] text-slate-400 mt-0.5">description</span>
                                                <span className="font-medium whitespace-pre-wrap">{record.purpose || '無填寫用途'}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CarUsageHistoryModal;

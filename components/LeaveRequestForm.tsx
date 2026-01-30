import React, { useState, useEffect, useMemo } from 'react';
import { LeaveType } from '../types';
import { requestService } from '../services/requestService';
import { leaveTypeService } from '../services/leaveTypeService';
import { getCars } from '../services/carService';

interface LeaveRequestFormProps {
    employeeId: string;
    onClose: () => void;
    onSuccess: () => void;
}

const LeaveRequestForm: React.FC<LeaveRequestFormProps> = ({ employeeId, onClose, onSuccess }) => {
    const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
    const [selectedTypeId, setSelectedTypeId] = useState<string>('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [needCar, setNeedCar] = useState(false);
    const [availableCars, setAvailableCars] = useState<any[]>([]);
    const [selectedCarId, setSelectedCarId] = useState<string>('');

    useEffect(() => {
        loadLeaveTypes();
        loadCars();
    }, []);

    const loadCars = async () => {
        try {
            const cars = await getCars(true);
            setAvailableCars(cars || []);
            if (cars && cars.length > 0) {
                setSelectedCarId(cars[0].id);
            }
        } catch (err) {
            console.error('Error loading cars:', err);
        }
    };

    const loadLeaveTypes = async () => {
        setIsLoading(true);
        const types = await leaveTypeService.getActiveLeaveTypes();
        setLeaveTypes(types);
        if (types.length > 0) {
            setSelectedTypeId(types[0].id);
        }
        setIsLoading(false);
    };

    // 計算總時數邏輯（扣除 12:00 - 13:00 午休）
    const totalHours = useMemo(() => {
        if (!startDate || !endDate) return 0;
        const start = new Date(startDate);
        const end = new Date(endDate);

        if (end <= start) return 0;

        let totalMinutes = 0;
        let current = new Date(start);

        // 逐分或逐段計算可能太慢，改用邏輯判斷
        // 簡單邏輯：計算總小時數，如果跨過 12:00 - 13:00 則減 60 分鐘
        // 考慮跨天情況：每一天只要跨過該時段就減 1 小時

        const diffMs = end.getTime() - start.getTime();
        const rawMinutes = Math.floor(diffMs / (1000 * 60));

        // 午休扣除邏輯
        let lunchMinutes = 0;

        // 遍歷每一天
        const d = new Date(start);
        d.setHours(0, 0, 0, 0);
        const endDay = new Date(end);
        endDay.setHours(0, 0, 0, 0);

        while (d <= endDay) {
            const dayStart = new Date(d);
            dayStart.setHours(12, 0, 0, 0);
            const dayEnd = new Date(d);
            dayEnd.setHours(13, 0, 0, 0);

            // 判斷申請區間是否與該天的午休區間重疊
            const overlapStart = new Date(Math.max(start.getTime(), dayStart.getTime()));
            const overlapEnd = new Date(Math.min(end.getTime(), dayEnd.getTime()));

            if (overlapStart < overlapEnd) {
                const overlapMinutes = Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60));
                lunchMinutes += overlapMinutes;
            }

            d.setDate(d.getDate() + 1);
        }

        const finalMinutes = rawMinutes - lunchMinutes;
        return Math.max(0, finalMinutes / 60);
    }, [startDate, endDate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedTypeId || !startDate || !endDate || !reason) {
            setError('請填寫所有必填欄位');
            return;
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        if (end <= start) {
            setError('結束時間必須晚於開始時間');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            await requestService.createRequest({
                employee_id: employeeId,
                type: 'LEAVE' as any,
                leave_type_id: selectedTypeId,
                start_date: new Date(startDate).toISOString(),
                end_date: new Date(endDate).toISOString(),
                reason,
                hours: totalHours,
                car_id: needCar ? selectedCarId : undefined
            });
            onSuccess();
        } catch (err: any) {
            setError(err.message || '提交失敗，請稍後再試');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-2xl bg-white dark:bg-[#1e293b] rounded-2xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-700 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
                <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center shrink-0">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">event_note</span>
                        申請出差勤
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {isLoading ? (
                    <div className="p-12 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                        <div className="p-6 space-y-4 overflow-y-auto flex-1 scrollbar-hide">
                            {error && (
                                <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-3 text-rose-600 animate-in slide-in-from-top-2">
                                    <span className="material-symbols-outlined shrink-0 mt-0.5">error</span>
                                    <span className="text-sm font-bold">{error}</span>
                                </div>
                            )}

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2 ml-1">類型 <span className="text-rose-500">*</span></label>
                                {leaveTypes.length === 0 ? (
                                    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg text-center text-slate-500">
                                        目前沒有可用的差勤類型
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        {leaveTypes.map((type) => (
                                            <button
                                                key={type.id}
                                                type="button"
                                                onClick={() => setSelectedTypeId(type.id)}
                                                className={`py-3 px-4 rounded-lg border-2 transition-all font-medium flex items-center gap-2 ${selectedTypeId === type.id
                                                    ? 'border-primary bg-primary/5 text-primary'
                                                    : 'border-slate-100 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                                                    }`}
                                            >
                                                <div
                                                    className="w-3 h-3 rounded-full flex-shrink-0"
                                                    style={{ backgroundColor: type.color }}
                                                />
                                                <span className="truncate font-bold">{type.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2 ml-1">開始時間 <span className="text-rose-500">*</span></label>
                                    <input
                                        type="datetime-local"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-bold"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2 ml-1">結束時間 <span className="text-rose-500">*</span></label>
                                    <input
                                        type="datetime-local"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-bold"
                                        required
                                    />
                                </div>
                            </div>

                            {/* 時數顯示區 */}
                            {startDate && endDate && totalHours > 0 && (
                                <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 flex items-center justify-between animate-in fade-in slide-in-from-bottom-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-100 text-white">
                                            <span className="material-symbols-outlined text-xl">schedule</span>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">預計總時數</p>
                                            <p className="text-sm font-black text-blue-900 mt-0.5">已扣除午休 (12:00-13:00)</p>
                                        </div>
                                    </div>
                                    <div className="text-2xl font-black text-blue-600 tabular-nums">
                                        {totalHours.toFixed(1)} <span className="text-xs ml-1">HR</span>
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2 ml-1">申請事由 <span className="text-rose-500">*</span></label>
                                <textarea
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all min-h-[100px] font-bold"
                                    placeholder="請敘明出差或請假具體事由..."
                                    required
                                />
                            </div>

                            {/* 公務車借用區塊 */}
                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-700">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-blue-600">directions_car</span>
                                        <span className="text-sm font-black text-slate-700 dark:text-slate-200">借用公務車</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setNeedCar(!needCar)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${needCar ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${needCar ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>

                                {needCar && (
                                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                        {availableCars.length === 0 ? (
                                            <p className="text-xs text-rose-500 font-bold px-1">目前無可用車輛</p>
                                        ) : (
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 ml-1">選擇車輛</label>
                                                <select
                                                    value={selectedCarId}
                                                    onChange={(e) => setSelectedCarId(e.target.value)}
                                                    className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-bold"
                                                >
                                                    {availableCars.map(car => (
                                                        <option key={car.id} value={car.id}>
                                                            {car.plate_number} - {car.model}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-100 dark:border-slate-700 flex gap-3 bg-slate-50/50 shrink-0">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-2xl font-black hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
                            >
                                取消退出
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting || leaveTypes.length === 0}
                                className="flex-1 py-4 bg-primary text-white rounded-2xl font-black shadow-xl shadow-primary/20 hover:bg-primary-dark transition-all disabled:opacity-50 active:scale-95"
                            >
                                {isSubmitting ? '提交處理中...' : '確認提交申請'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default LeaveRequestForm;

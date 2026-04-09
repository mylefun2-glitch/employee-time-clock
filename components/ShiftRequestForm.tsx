import React, { useState, useEffect } from 'react';
import { ShiftType, RequestStatus, ShiftRequest, Employee, EmployeeDayOverride } from '../types';
import { shiftService } from '../services/shiftService';
import { format, addMonths, startOfMonth, endOfMonth, isSameMonth } from 'date-fns';
import TimeInput24h from './ui/TimeInput24h';
import { supabase } from '../lib/supabase';

interface ShiftRequestFormProps {
    employeeId: string;
    onClose: () => void;
    onSuccess: () => void;
}

const ShiftRequestForm: React.FC<ShiftRequestFormProps> = ({ employeeId, onClose, onSuccess }) => {
    const [type, setType] = useState<ShiftType>(ShiftType.SWAP_REST_DAY);
    const [originalRestDate, setOriginalRestDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [newRestDate, setNewRestDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    
    const [targetDate, setTargetDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [startTime, setStartTime] = useState('08:00');
    const [endTime, setEndTime] = useState('17:00');
    const [breakStartTime, setBreakStartTime] = useState('12:00');
    const [breakEndTime, setBreakEndTime] = useState('13:00');

    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [monthlyCount, setMonthlyCount] = useState(0);

    useEffect(() => {
        loadMonthlyCount();
    }, [employeeId]);

    const loadMonthlyCount = async () => {
        const count = await shiftService.getMonthlyShiftCount(employeeId, new Date());
        setMonthlyCount(count);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        try {
            // 基本驗證
            if (type === ShiftType.SWAP_REST_DAY) {
                if (originalRestDate === newRestDate) {
                    throw new Error('調位日期不能相同');
                }
                const d1 = new Date(originalRestDate);
                const d2 = new Date(newRestDate);
                if (!isSameMonth(d1, d2)) {
                    // 雖然不是硬性規定，但通常對調建議在同一月份，這裡僅提示或允許
                }
            }

            const requestData: any = {
                employee_id: employeeId,
                type,
                reason,
                status: RequestStatus.PENDING
            };

            if (type === ShiftType.SWAP_REST_DAY) {
                requestData.original_rest_date = originalRestDate;
                requestData.new_rest_date = newRestDate;
            } else {
                requestData.target_date = targetDate;
                requestData.new_work_start_time = startTime;
                requestData.new_work_end_time = endTime;
                requestData.new_break_start_time = breakStartTime;
                requestData.new_break_end_time = breakEndTime;
            }

            const result = await shiftService.createShiftRequest(requestData);
            if (!result.success) {
                throw new Error(result.error);
            }

            onSuccess();
        } catch (err: any) {
            setError(err.message || '提交失敗');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-xl bg-white dark:bg-[#1e293b] rounded-2xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-700 animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-indigo-500">swap_calls</span>
                        申請出勤挪移 (調移)
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* 次數限制提示 */}
                    <div className={`p-3 rounded-xl border flex items-center justify-between ${monthlyCount >= 2 ? 'bg-rose-50 border-rose-100 text-rose-600' : 'bg-indigo-50 border-indigo-100 text-indigo-600'}`}>
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-lg">info</span>
                            <span className="text-xs font-black uppercase tracking-widest">本月申請進度</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-lg font-black tabular-nums">{monthlyCount}</span>
                            <span className="text-[10px] font-bold">/ 2 次</span>
                        </div>
                    </div>

                    {error && (
                        <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-3 text-rose-600 animate-in slide-in-from-top-2">
                            <span className="material-symbols-outlined shrink-0 mt-0.5">error</span>
                            <span className="text-sm font-bold">{error}</span>
                        </div>
                    )}

                    {/* 類型切換 */}
                    <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                        <button
                            type="button"
                            onClick={() => setType(ShiftType.SWAP_REST_DAY)}
                            className={`flex-1 py-2 px-4 rounded-lg text-sm font-black transition-all ${type === ShiftType.SWAP_REST_DAY ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            對調休息日
                        </button>
                        <button
                            type="button"
                            onClick={() => setType(ShiftType.HOURS_ADJUSTMENT)}
                            className={`flex-1 py-2 px-4 rounded-lg text-sm font-black transition-all ${type === ShiftType.HOURS_ADJUSTMENT ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            調整當日工時
                        </button>
                    </div>

                    {type === ShiftType.SWAP_REST_DAY ? (
                        <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-left-2 duration-300">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2 ml-1">
                                    原定休息日 <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    value={originalRestDate}
                                    onChange={(e) => setOriginalRestDate(e.target.value)}
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-bold"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2 ml-1">
                                    對調日期 <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    value={newRestDate}
                                    onChange={(e) => setNewRestDate(e.target.value)}
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-bold"
                                    required
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2 ml-1">
                                    目標日期 <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    value={targetDate}
                                    onChange={(e) => setTargetDate(e.target.value)}
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-bold"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2 ml-1">上班時間</label>
                                    <TimeInput24h value={startTime} onChange={setStartTime} />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2 ml-1">下班時間</label>
                                    <TimeInput24h value={endTime} onChange={setEndTime} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2 ml-1">休息開始</label>
                                    <TimeInput24h value={breakStartTime} onChange={setBreakStartTime} />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2 ml-1">休息結束</label>
                                    <TimeInput24h value={breakEndTime} onChange={setBreakEndTime} />
                                </div>
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2 ml-1">
                            申請原因 <span className="text-rose-500">*</span>
                        </label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all min-h-[80px] font-bold"
                            placeholder="請具體敘明調整原因..."
                            required
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 px-4 rounded-xl text-sm font-black text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all border border-slate-200 dark:border-slate-700"
                        >
                            取消
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || monthlyCount >= 2}
                            className={`flex-[2] py-3 px-4 rounded-xl text-sm font-black text-white shadow-lg shadow-indigo-200 dark:shadow-none transition-all flex items-center justify-center gap-2 ${isSubmitting || monthlyCount >= 2 ? 'bg-slate-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98]'}`}
                        >
                            {isSubmitting ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-lg">send</span>
                                    送出申請
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ShiftRequestForm;

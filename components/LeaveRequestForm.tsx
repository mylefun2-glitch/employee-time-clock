import React, { useState, useEffect } from 'react';
import { LeaveType } from '../types';
import { requestService } from '../services/requestService';
import { leaveTypeService } from '../services/leaveTypeService';

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

    useEffect(() => {
        loadLeaveTypes();
    }, []);

    const loadLeaveTypes = async () => {
        setIsLoading(true);
        const types = await leaveTypeService.getActiveLeaveTypes();
        setLeaveTypes(types);
        if (types.length > 0) {
            setSelectedTypeId(types[0].id);
        }
        setIsLoading(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTypeId || !startDate || !endDate || !reason) {
            setError('請填寫所有必填欄位');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            await requestService.createRequest({
                employee_id: employeeId,
                type: 'LEAVE' as any, // 保留舊欄位以維持向後相容
                leave_type_id: selectedTypeId,
                start_date: new Date(startDate).toISOString(),
                end_date: new Date(endDate).toISOString(),
                reason,
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
            <div className="w-full max-w-md bg-white dark:bg-[#1e293b] rounded-2xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-700 animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
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
                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        {error && (
                            <div className="p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/40 rounded-lg text-rose-600 dark:text-rose-400 text-sm">
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">類型</label>
                            {leaveTypes.length === 0 ? (
                                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg text-center text-slate-500">
                                    目前沒有可用的差勤類型
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-2">
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
                                            <span className="truncate">{type.name}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">開始時間</label>
                            <input
                                type="datetime-local"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">結束時間</label>
                            <input
                                type="datetime-local"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">事由</label>
                            <textarea
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all min-h-[100px]"
                                placeholder="請輸入申請事由..."
                                required
                            />
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 py-3 px-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-750 transition-all"
                            >
                                取消
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting || leaveTypes.length === 0}
                                className="flex-1 py-3 px-4 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all disabled:opacity-50"
                            >
                                {isSubmitting ? '提交中...' : '提交申請'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default LeaveRequestForm;

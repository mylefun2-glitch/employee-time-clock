import React, { useState, useEffect } from 'react';
import { LeaveRequest } from '../types';
import { requestService } from '../services/requestService';

interface ModificationRequestFormProps {
    originalRequest: LeaveRequest;
    employeeId: string;
    onClose: () => void;
    onSuccess: () => void;
}

const ModificationRequestForm: React.FC<ModificationRequestFormProps> = ({
    originalRequest,
    employeeId,
    onClose,
    onSuccess
}) => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reason, setReason] = useState('');
    const [modificationReason, setModificationReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        // 預填原申請資料
        setStartDate(originalRequest.start_date.slice(0, 16));
        setEndDate(originalRequest.end_date.slice(0, 16));
        setReason(originalRequest.reason || '');
    }, [originalRequest]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!modificationReason.trim()) {
            setError('請填寫變更原因');
            return;
        }

        setIsSubmitting(true);

        const result = await requestService.createModificationRequest(
            originalRequest.id,
            {
                start_date: new Date(startDate).toISOString(),
                end_date: new Date(endDate).toISOString(),
                reason: reason.trim(),
                modification_reason: modificationReason.trim(),
                leave_type_id: originalRequest.leave_type_id,
                type: originalRequest.type
            },
            employeeId
        );

        setIsSubmitting(false);

        if (result.success) {
            onSuccess();
        } else {
            setError(result.error || '提交失敗');
        }
    };

    const getStatusInfo = (status: string) => {
        switch (status) {
            case 'APPROVED':
                return { text: '已核准', class: 'bg-emerald-50 text-emerald-600 border-emerald-200' };
            case 'REJECTED':
                return { text: '已拒絕', class: 'bg-rose-50 text-rose-600 border-rose-200' };
            default:
                return { text: '待審核', class: 'bg-amber-50 text-amber-600 border-amber-200' };
        }
    };

    const status = getStatusInfo(originalRequest.status);

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-slate-100 px-8 py-6 flex items-center justify-between rounded-t-3xl">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900">申請變更</h2>
                        <p className="text-sm text-slate-500 mt-1">修改已審核的申請內容</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
                    >
                        <span className="material-symbols-outlined text-slate-600">close</span>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    {/* 原申請資訊 */}
                    <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="material-symbols-outlined text-slate-400">history</span>
                            <h3 className="text-sm font-black text-slate-600 uppercase tracking-wider">原申請資訊</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-black text-slate-400 uppercase tracking-wider">類型</label>
                                <div className="mt-1 text-sm font-bold text-slate-700">
                                    {originalRequest.leave_type?.name || '差勤申請'}
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-black text-slate-400 uppercase tracking-wider">狀態</label>
                                <div className="mt-1">
                                    <span className={`px-3 py-1 text-xs font-black rounded-lg border inline-block ${status.class}`}>
                                        {status.text}
                                    </span>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-black text-slate-400 uppercase tracking-wider">開始時間</label>
                                <div className="mt-1 text-sm font-mono text-slate-700">
                                    {new Date(originalRequest.start_date).toLocaleString('zh-TW')}
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-black text-slate-400 uppercase tracking-wider">結束時間</label>
                                <div className="mt-1 text-sm font-mono text-slate-700">
                                    {new Date(originalRequest.end_date).toLocaleString('zh-TW')}
                                </div>
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-wider">原因</label>
                                <div className="mt-1 text-sm text-slate-700">
                                    {originalRequest.reason || '-'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 變更後的資訊 */}
                    <div className="bg-blue-50 rounded-2xl p-6 border border-blue-200">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="material-symbols-outlined text-blue-600">edit</span>
                            <h3 className="text-sm font-black text-blue-900 uppercase tracking-wider">變更後的資訊</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-black text-blue-900 uppercase tracking-wider mb-2">
                                    開始時間 *
                                </label>
                                <input
                                    type="datetime-local"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    required
                                    className="w-full px-4 py-3 rounded-xl border border-blue-200 bg-white text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-blue-900 uppercase tracking-wider mb-2">
                                    結束時間 *
                                </label>
                                <input
                                    type="datetime-local"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    required
                                    className="w-full px-4 py-3 rounded-xl border border-blue-200 bg-white text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-black text-blue-900 uppercase tracking-wider mb-2">
                                    事由
                                </label>
                                <textarea
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    rows={3}
                                    className="w-full px-4 py-3 rounded-xl border border-blue-200 bg-white text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="請說明申請事由"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 變更原因 */}
                    <div>
                        <label className="block text-sm font-black text-slate-900 mb-2">
                            變更原因 <span className="text-rose-500">*</span>
                        </label>
                        <textarea
                            value={modificationReason}
                            onChange={(e) => setModificationReason(e.target.value)}
                            rows={4}
                            required
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="請說明為何需要變更此申請..."
                        />
                        <p className="text-xs text-slate-500 mt-2">此欄位將提供給主管審核時參考</p>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3">
                            <span className="material-symbols-outlined text-rose-600 text-xl">error</span>
                            <div>
                                <p className="text-sm font-bold text-rose-900">提交失敗</p>
                                <p className="text-sm text-rose-700 mt-1">{error}</p>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-black hover:bg-slate-200 transition-colors"
                        >
                            取消
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-black hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? '提交中...' : '提交變更申請'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ModificationRequestForm;

import React, { useState } from 'react';
import { createMakeupRequest } from '../services/employee';

interface MakeupRequestFormProps {
    employeeId: string;
    onClose: () => void;
    onSuccess: () => void;
}

const MakeupRequestForm: React.FC<MakeupRequestFormProps> = ({ employeeId, onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        requestDate: '',
        checkType: 'IN' as 'IN' | 'OUT',
        requestTime: '',
        reason: ''
    });
    const [submitting, setSubmitting] = useState(false);
    const [showSuccessDialog, setShowSuccessDialog] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setErrorMessage(null);

        const result = await createMakeupRequest(employeeId, formData);

        setSubmitting(false);

        if (result.success) {
            setShowSuccessDialog(true);
        } else {
            setErrorMessage(result.error || '提交失敗，請稍後再試');
        }
    };

    const handleSuccessConfirm = () => {
        setShowSuccessDialog(false);
        onSuccess();
    };

    // 成功對話框
    if (showSuccessDialog) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
                    <div className="text-center">
                        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="material-symbols-outlined text-emerald-600 text-4xl">check_circle</span>
                        </div>
                        <h2 className="text-xl font-black text-slate-900 mb-2">提交成功！</h2>
                        <p className="text-slate-600 mb-6">補登申請已提交，請等待主管審核</p>
                        <button
                            onClick={handleSuccessConfirm}
                            className="w-full px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors"
                        >
                            確定
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-black text-slate-900">申請補登打卡</h2>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* 錯誤訊息 */}
                {errorMessage && (
                    <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl">
                        <div className="flex items-start gap-2">
                            <span className="material-symbols-outlined text-rose-600 text-lg">error</span>
                            <p className="text-sm text-rose-700 font-medium">{errorMessage}</p>
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* 日期選擇 */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                            補登日期 <span className="text-rose-500">*</span>
                        </label>
                        <input
                            type="date"
                            required
                            value={formData.requestDate}
                            onChange={(e) => setFormData({ ...formData, requestDate: e.target.value })}
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
                        />
                    </div>

                    {/* 打卡類型 */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                            打卡類型 <span className="text-rose-500">*</span>
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, checkType: 'IN' })}
                                className={`px-4 py-3 rounded-xl font-bold transition-all ${formData.checkType === 'IN'
                                    ? 'bg-emerald-600 text-white shadow-md'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                            >
                                <span className="material-symbols-outlined text-sm mr-1">login</span>
                                上班打卡
                            </button>
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, checkType: 'OUT' })}
                                className={`px-4 py-3 rounded-xl font-bold transition-all ${formData.checkType === 'OUT'
                                    ? 'bg-orange-600 text-white shadow-md'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                            >
                                <span className="material-symbols-outlined text-sm mr-1">logout</span>
                                下班打卡
                            </button>
                        </div>
                    </div>

                    {/* 時間選擇 */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                            打卡時間 <span className="text-rose-500">*</span>
                        </label>
                        <input
                            type="time"
                            required
                            value={formData.requestTime}
                            onChange={(e) => setFormData({ ...formData, requestTime: e.target.value })}
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
                        />
                    </div>

                    {/* 原因說明 */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                            補登原因 <span className="text-rose-500">*</span>
                        </label>
                        <textarea
                            required
                            rows={3}
                            value={formData.reason}
                            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                            placeholder="請說明為何需要補登打卡..."
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none font-medium"
                        />
                    </div>

                    {/* 按鈕 */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            取消
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {submitting ? '提交中...' : '提交申請'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default MakeupRequestForm;

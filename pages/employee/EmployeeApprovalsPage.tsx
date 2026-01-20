import React, { useEffect, useState } from 'react';
import { useEmployee } from '../../contexts/EmployeeContext';
import { getPendingApprovalsForSupervisor } from '../../services/supervisorService';
import { requestService } from '../../services/requestService';
import { RequestStatus } from '../../types';

const EmployeeApprovalsPage: React.FC = () => {
    const { employee } = useEmployee();
    const [pendingRequests, setPendingRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);

    // 對話框狀態
    const [reviewDialog, setReviewDialog] = useState<{
        show: boolean;
        type: 'approve' | 'reject' | null;
        requestId: string | null;
    }>({ show: false, type: null, requestId: null });

    const [resultDialog, setResultDialog] = useState<{
        show: boolean;
        success: boolean;
        message: string;
    }>({ show: false, success: false, message: '' });

    useEffect(() => {
        if (employee && employee.is_supervisor) {
            fetchPendingApprovals();
        }
    }, [employee]);

    const fetchPendingApprovals = async () => {
        if (!employee) return;
        setLoading(true);
        try {
            const { requests } = await getPendingApprovalsForSupervisor(employee.id);
            setPendingRequests(requests);
        } catch (error) {
            console.error('Error fetching pending approvals:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleReviewClick = (id: string, type: 'approve' | 'reject') => {
        setReviewDialog({ show: true, type, requestId: id });
    };

    const handleReviewConfirm = async () => {
        if (!employee || !reviewDialog.requestId) return;

        const { type, requestId } = reviewDialog;
        setProcessingId(requestId);
        setReviewDialog({ show: false, type: null, requestId: null });

        try {
            const status = type === 'approve' ? RequestStatus.APPROVED : RequestStatus.REJECTED;
            const result = await requestService.updateRequestStatus(requestId, status, employee.id);

            if (!result.success) throw new Error(result.error);

            setResultDialog({
                show: true,
                success: true,
                message: type === 'approve' ? '該筆請假申請已核准成功' : '已拒絕該筆請假申請'
            });
            fetchPendingApprovals();
        } catch (error: any) {
            console.error('Error updating status:', error);
            setResultDialog({
                show: true,
                success: false,
                message: `操作失敗：${error.message || '未知錯誤'}`
            });
        } finally {
            setProcessingId(null);
        }
    };

    if (!employee?.is_supervisor) {
        return (
            <div className="flex flex-col items-center justify-center py-32 px-4 animate-in fade-in duration-500">
                <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                    <span className="material-symbols-outlined text-slate-200 text-6xl font-light">gpp_maybe</span>
                </div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">無審核權限</h2>
                <p className="text-slate-500 font-bold mt-2 text-center max-w-sm">您目前不是主管職，無法查看此頁面內容。如有疑問請聯繫管理者。</p>
            </div>
        );
    }

    if (loading) {
        return <div className="p-4 text-center font-bold text-slate-400 py-20">載入中...</div>;
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">請假審核</h1>
                    <p className="text-slate-500 text-sm font-medium mt-1">目前有 <span className="text-blue-600 font-black">{pendingRequests.length}</span> 筆待處理申請</p>
                </div>

                <div className="bg-white px-6 py-3 rounded-2xl border border-blue-100 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                        <span className="material-symbols-outlined text-xl">rule</span>
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">待審核總數</p>
                        <p className="text-xl font-black text-slate-900 leading-none">{pendingRequests.length}</p>
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="space-y-4">
                {pendingRequests.length === 0 ? (
                    <div className="bg-white rounded-[2.5rem] border border-slate-100 py-20 text-center shadow-sm">
                        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="material-symbols-outlined text-emerald-300 text-5xl">verified</span>
                        </div>
                        <h3 className="text-xl font-black text-slate-900 tracking-tight">工作已全部處理完畢</h3>
                        <p className="text-slate-500 font-bold mt-2">目前沒有任何待審核的請假申請事項。</p>
                    </div>
                ) : (
                    pendingRequests.map((request) => {
                        const isProcessing = processingId === request.id;
                        return (
                            <div key={request.id} className="group bg-white rounded-3xl border border-slate-100 p-8 hover:shadow-xl hover:border-blue-100 transition-all duration-300">
                                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                                    <div className="flex-1">
                                        {/* Employee Info */}
                                        <div className="flex items-center gap-5 mb-6">
                                            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center border border-blue-100 shrink-0 group-hover:scale-105 transition-transform shadow-sm">
                                                <span className="material-symbols-outlined text-3xl">person</span>
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-black text-slate-900 tracking-tight">
                                                    {request.employee?.name || '未知員工'}
                                                </h3>
                                                <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mt-1">
                                                    {request.employee?.department || '未分配部門'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Request Details */}
                                        <div className="bg-slate-50 rounded-[2rem] p-6 border border-slate-100 group-hover:bg-white transition-colors relative">
                                            <div className="flex items-center gap-3 mb-4">
                                                <span className="text-lg font-black text-slate-800">
                                                    {request.leave_type?.name || '請假'}
                                                </span>
                                                <span className="px-3 py-1 text-[10px] font-black rounded-lg bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-widest">
                                                    PENDING / 待處理
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-6 text-sm font-black text-slate-500 mb-6">
                                                <div className="flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-base text-slate-400">calendar_month</span>
                                                    <span className="font-mono tracking-tight">{new Date(request.start_date).toLocaleDateString('zh-TW')}</span>
                                                </div>
                                                <span className="text-slate-200">/</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono tracking-tight font-black text-slate-700">至 {new Date(request.end_date).toLocaleDateString('zh-TW')}</span>
                                                </div>
                                            </div>

                                            {request.reason && (
                                                <div className="pt-4 border-t border-slate-100/50">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className="material-symbols-outlined text-[14px] text-slate-300">chat</span>
                                                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">申請事由</span>
                                                    </div>
                                                    <p className="text-sm text-slate-600 font-bold leading-relaxed">
                                                        {request.reason}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex lg:flex-col gap-3 min-w-[160px]">
                                        <button
                                            onClick={() => handleReviewClick(request.id, 'approve')}
                                            disabled={isProcessing}
                                            className="flex-1 flex items-center justify-center gap-2 px-8 py-4 bg-emerald-600 text-white rounded-2xl font-black shadow-xl shadow-emerald-100 hover:bg-emerald-700 disabled:opacity-50 transition-all hover:-translate-y-1 active:scale-95"
                                        >
                                            <span className="material-symbols-outlined">verified</span>
                                            {isProcessing ? '...' : '核准'}
                                        </button>
                                        <button
                                            onClick={() => handleReviewClick(request.id, 'reject')}
                                            disabled={isProcessing}
                                            className="flex-1 flex items-center justify-center gap-2 px-8 py-4 bg-white text-rose-500 border-2 border-slate-100 rounded-2xl font-black hover:bg-rose-50 hover:border-rose-100 disabled:opacity-50 transition-all active:scale-95"
                                        >
                                            <span className="material-symbols-outlined">cancel</span>
                                            {isProcessing ? '...' : '拒絕'}
                                        </button>
                                    </div>
                                </div>
                                <div className="mt-4 flex items-center justify-between text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] px-2">
                                    <span>REF: {request.id.slice(0, 8)}</span>
                                    <span>SUBMITTED: {new Date(request.created_at).toLocaleString('zh-TW')}</span>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* 審核確認對話框 */}
            {reviewDialog.show && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-sm w-full p-8 animate-in zoom-in-95 duration-300 text-center">
                        <div className={`w-20 h-20 ${reviewDialog.type === 'approve' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'} rounded-3xl flex items-center justify-center mx-auto mb-6`}>
                            <span className="material-symbols-outlined text-4xl">
                                {reviewDialog.type === 'approve' ? 'verified' : 'help'}
                            </span>
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 mb-2">
                            {reviewDialog.type === 'approve' ? '確認核准？' : '確認拒絕？'}
                        </h2>
                        <p className="text-slate-500 font-bold mb-8 px-4">
                            您確定要執行此審核操作嗎？完成後將無法取消。
                        </p>
                        <div className="flex gap-4">
                            <button
                                onClick={() => setReviewDialog({ show: false, type: null, requestId: null })}
                                className="flex-1 py-4 bg-slate-50 text-slate-500 rounded-2xl font-black transition-all hover:bg-slate-100"
                            >
                                我再想想
                            </button>
                            <button
                                onClick={handleReviewConfirm}
                                className={`flex-1 py-4 rounded-2xl font-black text-white shadow-xl transition-all active:scale-95 ${reviewDialog.type === 'approve' ? 'bg-emerald-600 shadow-emerald-100' : 'bg-rose-600 shadow-rose-100'
                                    }`}
                            >
                                確定執行
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 結果提示對話框 */}
            {resultDialog.show && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-sm w-full p-8 animate-in zoom-in-95 duration-300 text-center">
                        <div className={`w-20 h-20 ${resultDialog.success ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'} rounded-3xl flex items-center justify-center mx-auto mb-6`}>
                            <span className="material-symbols-outlined text-4xl">
                                {resultDialog.success ? 'check_circle' : 'error'}
                            </span>
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 mb-2">
                            {resultDialog.success ? '處理成功' : '操作失敗'}
                        </h2>
                        <p className="text-slate-500 font-bold mb-8 px-4">{resultDialog.message}</p>
                        <button
                            onClick={() => setResultDialog({ show: false, success: false, message: '' })}
                            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black shadow-xl shadow-slate-200 transition-all active:scale-95"
                        >
                            我了解了
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmployeeApprovalsPage;

import React, { useEffect, useState } from 'react';
import { getCarRequests, reviewCarRequest } from '../../services/carService';
import { useAuth } from '../../contexts/AuthContext';

const CarRequestsPage: React.FC = () => {
    const { user } = useAuth();
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
    const [processingId, setProcessingId] = useState<string | null>(null);

    // 對話框狀態
    const [reviewDialog, setReviewDialog] = useState<{
        show: boolean;
        type: 'approve' | 'reject' | null;
        requestId: string | null;
        comment: string;
    }>({ show: false, type: null, requestId: null, comment: '' });

    useEffect(() => {
        fetchRequests();
    }, [filter]);

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const data = await getCarRequests({ status: filter });
            setRequests(data || []);
        } catch (error) {
            console.error('Error fetching car requests:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleReviewConfirm = async () => {
        if (!user || !reviewDialog.requestId || !reviewDialog.type) return;

        setProcessingId(reviewDialog.requestId);
        try {
            await reviewCarRequest(
                reviewDialog.requestId,
                user.id,
                reviewDialog.type === 'approve' ? 'APPROVED' : 'REJECTED',
                reviewDialog.comment
            );
            setReviewDialog({ show: false, type: null, requestId: null, comment: '' });
            fetchRequests();
        } catch (error) {
            console.error('Error reviewing request:', error);
            alert('處理失敗');
        } finally {
            setProcessingId(null);
        }
    };

    const getStatusInfo = (status: string) => {
        const statuses = {
            PENDING: { text: '待審核', class: 'bg-amber-50 text-amber-700 border-amber-200' },
            APPROVED: { text: '已核准', class: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
            REJECTED: { text: '已拒絕', class: 'bg-rose-50 text-rose-700 border-rose-200' }
        };
        return statuses[status as keyof typeof statuses] || { text: status, class: 'bg-slate-50 text-slate-700' };
    };

    if (loading && requests.length === 0) return <div className="p-8 text-center text-slate-400 font-bold">載入中...</div>;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">公務車申請審核</h1>
                <p className="text-slate-500 text-sm font-medium mt-1">管理與調度公務車預約申請</p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map((status) => (
                    <button
                        key={status}
                        onClick={() => setFilter(status)}
                        className={`px-6 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all border ${filter === status
                            ? 'bg-slate-900 text-white border-slate-900 shadow-lg'
                            : 'bg-white text-slate-500 border-slate-100 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                    >
                        {status === 'ALL' ? '全部記錄' : getStatusInfo(status).text}
                    </button>
                ))}
            </div>

            <div className="space-y-4">
                {requests.length === 0 ? (
                    <div className="bg-white rounded-3xl border border-slate-100 py-20 text-center shadow-sm">
                        <p className="text-slate-400 font-black tracking-wider">尚無相關申請記錄</p>
                    </div>
                ) : (
                    requests.map((request) => {
                        const status = getStatusInfo(request.status);
                        const isPending = request.status === 'PENDING';

                        return (
                            <div key={request.id} className="group bg-white rounded-3xl border border-slate-100 p-6 hover:shadow-xl transition-all duration-300">
                                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                                    <div className="flex items-center gap-5 flex-1">
                                        <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shrink-0 border border-slate-50">
                                            <span className="material-symbols-outlined text-3xl">time_to_leave</span>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-3 mb-1.5">
                                                <h3 className="text-xl font-black text-slate-900 truncate">
                                                    {request.employee?.name}
                                                </h3>
                                                <span className={`px-3 py-1 text-[10px] font-black rounded-lg border uppercase tracking-widest ${status.class}`}>
                                                    {status.text}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-bold text-slate-400">
                                                <span className="text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-xs font-black">
                                                    {request.car?.plate_number} ({request.car?.model})
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                    <span className="material-symbols-outlined text-base">calendar_today</span>
                                                    <span className="font-mono">{new Date(request.start_time).toLocaleString('zh-TW')}</span>
                                                    <span>至</span>
                                                    <span className="font-mono">{new Date(request.end_time).toLocaleString('zh-TW')}</span>
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {isPending && (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setReviewDialog({ show: true, type: 'reject', requestId: request.id, comment: '' })}
                                                className="px-6 py-2.5 bg-rose-50 text-rose-600 rounded-xl text-xs font-black hover:bg-rose-100 transition-all"
                                            >
                                                拒絕
                                            </button>
                                            <button
                                                onClick={() => setReviewDialog({ show: true, type: 'approve', requestId: request.id, comment: '' })}
                                                className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all"
                                            >
                                                核准預約
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-6 bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="material-symbols-outlined text-slate-400 text-sm">notes</span>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">使用用途</span>
                                    </div>
                                    <p className="text-sm font-bold text-slate-700 leading-relaxed">
                                        {request.purpose}
                                    </p>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Review Dialog */}
            {reviewDialog.show && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95 duration-300">
                        <h2 className="text-2xl font-black text-slate-900 mb-2">
                            {reviewDialog.type === 'approve' ? '核准預約' : '拒絕申請'}
                        </h2>
                        <p className="text-slate-500 font-bold text-sm mb-6">
                            請輸入審核意見（選填）
                        </p>

                        <textarea
                            value={reviewDialog.comment}
                            onChange={(e) => setReviewDialog({ ...reviewDialog, comment: e.target.value })}
                            placeholder="輸入意見..."
                            rows={4}
                            className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all resize-none font-bold text-slate-700 mb-6"
                        />

                        <div className="flex gap-4">
                            <button
                                onClick={() => setReviewDialog({ show: false, type: null, requestId: null, comment: '' })}
                                className="flex-1 px-6 py-4 bg-white text-slate-500 border border-slate-100 rounded-2xl font-black hover:bg-slate-50"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleReviewConfirm}
                                disabled={!!processingId}
                                className={`flex-1 px-6 py-4 rounded-2xl font-black text-white shadow-xl transition-all ${reviewDialog.type === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}
                            >
                                {processingId ? '處理中...' : '確認提交'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CarRequestsPage;

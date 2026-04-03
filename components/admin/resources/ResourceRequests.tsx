import React, { useEffect, useState } from 'react';
import { getResourceRequests, updateResourceRequestStatus } from '../../../services/resourceService';
import { ResourceRequest } from '../../../types';
import { useAuth } from '../../../contexts/AuthContext';

const STATUS_MAP: Record<string, { text: string; class: string }> = {
    PENDING: { text: '待審核', class: 'bg-amber-50 text-amber-700 border-amber-200' },
    APPROVED: { text: '已通過', class: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    REJECTED: { text: '已拒絕', class: 'bg-rose-50 text-rose-700 border-rose-200' },
    WITHDRAWN: { text: '已撤回', class: 'bg-slate-50 text-slate-500 border-slate-200' },
};

const TYPE_MAP: Record<string, string> = { ITEM: '物品', VENUE: '場地' };

const ResourceRequests: React.FC = () => {
    const { user } = useAuth();
    const [requests, setRequests] = useState<ResourceRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('PENDING');
    const [reviewingRequest, setReviewingRequest] = useState<ResourceRequest | null>(null);
    const [reviewComment, setReviewComment] = useState('');
    const [reviewLoading, setReviewLoading] = useState(false);

    useEffect(() => { fetchRequests(); }, [filterStatus]);

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const data = await getResourceRequests({ status: filterStatus });
            setRequests(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleReview = async (status: 'APPROVED' | 'REJECTED') => {
        if (!reviewingRequest || !user) return;
        setReviewLoading(true);
        try {
            await updateResourceRequestStatus(reviewingRequest.id, user.id, status, reviewComment);
            setReviewingRequest(null);
            setReviewComment('');
            fetchRequests();
        } catch (err) {
            console.error(err);
            alert('審核失敗，請再試一次');
        } finally {
            setReviewLoading(false);
        }
    };

    const formatDateTime = (dt: string) => {
        const d = new Date(dt);
        return d.toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
                {[
                    { key: 'PENDING', label: '待審核' },
                    { key: 'APPROVED', label: '已通過' },
                    { key: 'REJECTED', label: '已拒絕' },
                    { key: 'ALL', label: '全部' },
                ].map(s => (
                    <button
                        key={s.key}
                        onClick={() => setFilterStatus(s.key)}
                        className={`px-4 py-2 rounded-xl text-sm font-black transition-all ${filterStatus === s.key ? 'bg-violet-600 text-white shadow-lg shadow-violet-100' : 'bg-white text-slate-500 border border-slate-100 hover:bg-slate-50'}`}
                    >
                        {s.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="text-center text-slate-400 font-bold py-12">載入中...</div>
            ) : (
                <div className="space-y-3">
                    {requests.length === 0 && (
                        <div className="bg-white rounded-[2rem] border border-slate-100 p-12 text-center">
                            <span className="material-symbols-outlined text-4xl text-slate-300 mb-2 block">inbox</span>
                            <p className="text-sm font-bold text-slate-400">目前沒有相關申請</p>
                        </div>
                    )}
                    {requests.map(req => {
                        const statusInfo = STATUS_MAP[req.status];
                        return (
                            <div key={req.id} className="bg-white rounded-[1.5rem] border border-slate-100 shadow-sm p-6 flex flex-wrap gap-4 items-center justify-between hover:shadow-md transition-shadow">
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className="w-12 h-12 rounded-2xl bg-violet-50 flex items-center justify-center shrink-0">
                                        <span className="material-symbols-outlined text-violet-500">
                                            {req.resource?.type === 'VENUE' ? 'meeting_room' : 'inventory_2'}
                                        </span>
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-black text-slate-900 text-sm">{req.employee?.name}</span>
                                            <span className="text-xs text-slate-400 font-medium">{req.employee?.department}</span>
                                            <span className={`inline-flex px-2 py-0.5 text-[10px] font-black rounded-lg border uppercase tracking-widest ${statusInfo.class}`}>
                                                {statusInfo.text}
                                            </span>
                                        </div>
                                        <div className="text-sm font-bold text-slate-700 mt-1">
                                            <span className="text-violet-600">{req.resource?.name}</span>
                                            {req.resource?.type && <span className="text-xs text-slate-400 ml-1">({TYPE_MAP[req.resource.type]})</span>}
                                        </div>
                                        <div className="text-[11px] text-slate-400 font-medium mt-0.5">
                                            {formatDateTime(req.start_time)} – {formatDateTime(req.end_time)}
                                        </div>
                                    </div>
                                </div>
                                {req.status === 'PENDING' && (
                                    <button
                                        onClick={() => { setReviewingRequest(req); setReviewComment(''); }}
                                        className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white rounded-xl font-black text-xs shadow-lg shadow-violet-100 hover:bg-violet-700 transition-all shrink-0"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">rate_review</span>
                                        審核
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {reviewingRequest && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95 duration-300">
                        <h2 className="text-xl font-black text-slate-900 mb-1">審核借用申請</h2>
                        <p className="text-sm text-slate-400 font-medium mb-6">
                            {reviewingRequest.employee?.name} · {reviewingRequest.resource?.name}
                        </p>
                        <div className="bg-slate-50 rounded-2xl p-4 mb-6 text-xs space-y-1">
                            <div className="flex gap-2">
                                <span className="text-slate-400 font-bold min-w-[56px]">時段</span>
                                <span className="text-slate-700 font-bold">
                                    {formatDateTime(reviewingRequest.start_time)} –<br />{formatDateTime(reviewingRequest.end_time)}
                                </span>
                            </div>
                            <div className="flex gap-2">
                                <span className="text-slate-400 font-bold min-w-[56px]">用途</span>
                                <span className="text-slate-700 font-bold">{reviewingRequest.purpose}</span>
                            </div>
                        </div>
                        <div className="mb-6">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">審核備註（選填）</label>
                            <textarea
                                rows={3}
                                value={reviewComment}
                                onChange={e => setReviewComment(e.target.value)}
                                placeholder="輸入審核備註或拒絕原因..."
                                className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-bold text-slate-700 placeholder:text-slate-300 resize-none text-sm"
                            />
                        </div>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setReviewingRequest(null)}
                                disabled={reviewLoading}
                                className="flex-1 px-4 py-3 bg-white text-slate-500 border border-slate-100 rounded-2xl font-black hover:bg-slate-50 transition-all text-sm"
                            >
                                取消
                            </button>
                            <button
                                onClick={() => handleReview('REJECTED')}
                                disabled={reviewLoading}
                                className="flex-1 px-4 py-3 bg-rose-50 text-rose-600 border border-rose-100 rounded-2xl font-black hover:bg-rose-100 transition-all text-sm"
                            >
                                拒絕
                            </button>
                            <button
                                onClick={() => handleReview('APPROVED')}
                                disabled={reviewLoading}
                                className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-2xl font-black shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all text-sm active:scale-95"
                            >
                                通過
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ResourceRequests;

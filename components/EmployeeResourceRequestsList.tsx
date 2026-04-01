import React, { useEffect, useState } from 'react';
import { getResourceRequests, withdrawResourceRequest } from '../services/resourceService';
import { ResourceRequest } from '../types';
import ResourceRequestForm from './ResourceRequestForm';

// STATUS_MAP AND TYPE_MAP
const STATUS_MAP: Record<string, { text: string; class: string }> = {
    PENDING: { text: '待審核', class: 'bg-amber-50 text-amber-700 border-amber-200' },
    APPROVED: { text: '已通過', class: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    REJECTED: { text: '已拒絕', class: 'bg-rose-50 text-rose-700 border-rose-200' },
    WITHDRAWN: { text: '已撤回', class: 'bg-slate-50 text-slate-500 border-slate-200' },
};

const TYPE_MAP: Record<string, string> = { ITEM: '物品', VENUE: '場地' };

interface Props {
    employeeId: string;
    department?: string;
}

const EmployeeResourceRequestsList: React.FC<Props> = ({ employeeId, department }) => {
    const [requests, setRequests] = useState<ResourceRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('ALL');
    const [editingRequest, setEditingRequest] = useState<ResourceRequest | null>(null);
    const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

    useEffect(() => {
        fetchRequests();
    }, [filterStatus, department]);

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const data = await getResourceRequests({ 
                employee_id: department ? undefined : employeeId, 
                department,
                status: filterStatus 
            });
            setRequests(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleWithdraw = async (id: string) => {
        if (!confirm('確定要撤回此借用申請嗎？')) return;
        setWithdrawingId(id);
        try {
            await withdrawResourceRequest(id);
            alert('已成功撤回');
            fetchRequests();
        } catch (err: any) {
            alert('撤回失敗');
            console.error(err);
        } finally {
            setWithdrawingId(null);
        }
    };

    const formatDateTime = (dt: string) => {
        const d = new Date(dt);
        return d.toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Filter Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {[
                    { key: 'ALL', label: '全部' },
                    { key: 'PENDING', label: '待審核' },
                    { key: 'APPROVED', label: '已通過' },
                    { key: 'REJECTED', label: '已拒絕' },
                    { key: 'WITHDRAWN', label: '已撤回' },
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
                        const statusInfo = STATUS_MAP[req.status] || STATUS_MAP.PENDING;
                        const isPending = req.status === 'PENDING';
                        const isOwner = req.employee_id === employeeId;

                        return (
                            <div key={req.id} className="bg-white rounded-[1.5rem] border border-slate-100 shadow-sm p-6 flex flex-col sm:flex-row gap-4 sm:items-center justify-between hover:shadow-md transition-shadow">
                                <div className="flex items-start sm:items-center gap-4 min-w-0">
                                    <div className="w-12 h-12 rounded-2xl bg-violet-50 flex items-center justify-center shrink-0 mt-1 sm:mt-0">
                                        <span className="material-symbols-outlined text-violet-500">
                                            {req.resource?.type === 'VENUE' ? 'meeting_room' : 'inventory_2'}
                                        </span>
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <span className="font-black text-slate-900 text-base text-violet-700">{req.resource?.name}</span>
                                            {req.resource?.type && <span className="text-xs text-slate-400 font-bold">({TYPE_MAP[req.resource.type]})</span>}
                                            {req.quantity > 1 && <span className="text-xs text-slate-600 font-black px-2 py-0.5 bg-slate-100 rounded-md">× {req.quantity}</span>}
                                            <span className={`inline-flex px-2 py-0.5 text-[10px] font-black rounded-lg border uppercase tracking-widest ${statusInfo.class}`}>
                                                {statusInfo.text}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${isOwner ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                                                {req.employee?.name || '未知'} {isOwner && '(我)'}
                                            </div>
                                            <div className="text-[10px] text-slate-400 font-medium">
                                                {formatDateTime(req.start_time)} – {formatDateTime(req.end_time)}
                                            </div>
                                        </div>
                                        <div className="text-sm text-slate-600">用途：{req.purpose}</div>
                                        {req.review_comment && (
                                            <div className="text-xs text-rose-500 mt-2 p-2 bg-rose-50 rounded-lg border border-rose-100 italic">審核備註：{req.review_comment}</div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 sm:border-l sm:border-slate-100 sm:pl-6">
                                    {isPending && isOwner && (
                                        <>
                                            <button
                                                onClick={() => setEditingRequest(req)}
                                                className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-black text-xs hover:bg-blue-100 transition-colors flex items-center gap-1"
                                            >
                                                <span className="material-symbols-outlined text-[16px]">edit</span>
                                                編輯
                                            </button>
                                            <button
                                                onClick={() => handleWithdraw(req.id)}
                                                disabled={withdrawingId === req.id}
                                                className="px-4 py-2 bg-rose-50 text-rose-600 rounded-xl font-black text-xs hover:bg-rose-100 transition-colors flex items-center gap-1 disabled:opacity-50"
                                            >
                                                <span className="material-symbols-outlined text-[16px]">cancel</span>
                                                {withdrawingId === req.id ? '撤回中...' : '撤回'}
                                            </button>
                                        </>
                                    )}
                                    {!isOwner && (
                                        <span className="text-[10px] text-slate-400 font-bold italic">唯讀模式</span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {editingRequest && (
                <ResourceRequestForm
                    employeeId={employeeId}
                    initialData={editingRequest}
                    onClose={() => setEditingRequest(null)}
                    onSuccess={() => {
                        setEditingRequest(null);
                        fetchRequests();
                    }}
                />
            )}
        </div>
    );
};

export default EmployeeResourceRequestsList;

import React, { useEffect, useState } from 'react';
import { getMakeupRequests, approveMakeupRequest, rejectMakeupRequest } from '../../services/admin';
import { useEmployee } from '../../contexts/EmployeeContext';

const MakeupRequestsPage: React.FC = () => {
    const { employee } = useEmployee();
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

    const [resultDialog, setResultDialog] = useState<{
        show: boolean;
        success: boolean;
        message: string;
    }>({ show: false, success: false, message: '' });

    useEffect(() => {
        fetchRequests();
    }, [filter, employee]);

    const fetchRequests = async () => {
        if (!employee) {
            console.log('[MakeupRequestsPage] No employee context available');
            return;
        }

        console.log('[MakeupRequestsPage] Fetching requests for manager:', {
            employeeId: employee.id,
            employeeName: employee.name,
            filter: filter
        });

        setLoading(true);
        try {
            const data = await getMakeupRequests(filter, employee.id);

            console.log('[MakeupRequestsPage] Received data:', {
                count: data?.length || 0,
                data: data
            });

            setRequests(data || []);
        } catch (error) {
            console.error('[MakeupRequestsPage] Error fetching requests:', error);
            setRequests([]);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = (id: string) => {
        setReviewDialog({ show: true, type: 'approve', requestId: id, comment: '' });
    };

    const handleReject = (id: string) => {
        setReviewDialog({ show: true, type: 'reject', requestId: id, comment: '' });
    };

    const handleReviewConfirm = async () => {
        if (!employee || !reviewDialog.requestId) return;

        const { type, requestId, comment } = reviewDialog;

        // 拒絕時必須填寫原因
        if (type === 'reject' && !comment.trim()) {
            setResultDialog({
                show: true,
                success: false,
                message: '請輸入拒絕原因'
            });
            return;
        }

        setProcessingId(requestId);
        setReviewDialog({ show: false, type: null, requestId: null, comment: '' });

        const result = type === 'approve'
            ? await approveMakeupRequest(requestId, employee.id, comment || undefined)
            : await rejectMakeupRequest(requestId, employee.id, comment);

        setProcessingId(null);

        if (result.success) {
            setResultDialog({
                show: true,
                success: true,
                message: type === 'approve' ? '已核准並自動建立打卡記錄' : '已拒絕申請'
            });
            fetchRequests();
        } else {
            setResultDialog({
                show: true,
                success: false,
                message: `${type === 'approve' ? '核准' : '拒絕'}失敗：${result.error}`
            });
        }
    };

    const getStatusBadge = (status: string) => {
        const badges = {
            PENDING: { text: '待審核', class: 'bg-amber-50 text-amber-700 border-amber-200' },
            APPROVED: { text: '已核准', class: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
            REJECTED: { text: '已拒絕', class: 'bg-rose-50 text-rose-700 border-rose-200' }
        };
        return badges[status as keyof typeof badges] || badges.PENDING;
    };

    const getTypeIcon = (type: string) => {
        return type === 'IN'
            ? { icon: 'login', color: 'text-emerald-600', bg: 'bg-emerald-100' }
            : { icon: 'logout', color: 'text-orange-600', bg: 'bg-orange-100' };
    };

    const stats = [
        { label: '待審核', value: requests.filter(r => r.status === 'PENDING').length, color: 'bg-amber-500' },
        { label: '已核准', value: requests.filter(r => r.status === 'APPROVED').length, color: 'bg-emerald-500' },
        { label: '已拒絕', value: requests.filter(r => r.status === 'REJECTED').length, color: 'bg-rose-500' }
    ];

    if (loading) {
        return <div className="p-4">載入中...</div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">補登審核</h1>
                <p className="text-slate-500 mt-1">審核直屬下屬的漏卡補登申請</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                {stats.map((stat) => (
                    <div key={stat.label} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                        <p className="text-sm font-bold text-slate-500">{stat.label}</p>
                        <p className="text-3xl font-black text-slate-900 mt-1">{stat.value}</p>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex gap-2 p-1.5 bg-white border border-slate-100 rounded-2xl w-fit shadow-sm">
                {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map((status) => (
                    <button
                        key={status}
                        onClick={() => setFilter(status)}
                        className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${filter === status
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'text-slate-500 hover:bg-slate-50'
                            }`}
                    >
                        {status === 'ALL' ? '全部' : getStatusBadge(status).text}
                    </button>
                ))}
            </div>

            {/* Requests List */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                {requests.length === 0 ? (
                    <div className="px-6 py-20 text-center">
                        <span className="material-symbols-outlined text-slate-200 text-6xl">folder_off</span>
                        <p className="text-slate-400 mt-4 font-bold">尚無相關申請記錄</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-50">
                        {requests.map((request) => {
                            const badge = getStatusBadge(request.status);
                            const typeInfo = getTypeIcon(request.check_type);
                            const isPending = request.status === 'PENDING';
                            const isProcessing = processingId === request.id;

                            return (
                                <div key={request.id} className="p-4 hover:bg-slate-50/50 transition-colors">
                                    <div className="flex items-start justify-between gap-4">
                                        {/* Left: Employee & Request Info */}
                                        <div className="flex items-start gap-3 flex-1">
                                            <div className={`w-10 h-10 ${typeInfo.bg} rounded-lg flex items-center justify-center shrink-0`}>
                                                <span className={`material-symbols-outlined ${typeInfo.color} text-lg`}>
                                                    {typeInfo.icon}
                                                </span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="text-sm font-black text-slate-900">
                                                        {request.employee?.name || '未知員工'}
                                                    </h3>
                                                    <span className={`px-2 py-0.5 text-[9px] font-black rounded border ${badge.class}`}>
                                                        {badge.text}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3 text-xs text-slate-500 mb-2">
                                                    <span className="font-medium">{request.employee?.department || '未分配'}</span>
                                                    <span>•</span>
                                                    <span className="font-mono">
                                                        {new Date(request.request_date).toLocaleDateString('zh-TW')} {request.request_time}
                                                    </span>
                                                    <span>•</span>
                                                    <span className="font-bold">{request.check_type === 'IN' ? '上班打卡' : '下班打卡'}</span>
                                                </div>
                                                <div className="bg-slate-50 rounded-lg px-3 py-2 border-l-2 border-blue-200">
                                                    <p className="text-xs text-slate-600">{request.reason}</p>
                                                </div>
                                                {request.review_comment && (
                                                    <div className="mt-2 bg-amber-50 rounded-lg px-3 py-2 border-l-2 border-amber-300">
                                                        <p className="text-[10px] font-bold text-amber-600 mb-0.5">審核備註</p>
                                                        <p className="text-xs text-amber-700">{request.review_comment}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Right: Actions */}
                                        <div className="flex flex-col items-end gap-2 shrink-0">
                                            <p className="text-[9px] text-slate-400 font-bold">
                                                {new Date(request.created_at).toLocaleDateString('zh-TW')} 申請
                                            </p>
                                            {isPending && (
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleReject(request.id)}
                                                        disabled={isProcessing}
                                                        className="px-3 py-1.5 bg-rose-100 text-rose-700 rounded-lg text-xs font-bold hover:bg-rose-200 transition-colors disabled:opacity-50"
                                                    >
                                                        拒絕
                                                    </button>
                                                    <button
                                                        onClick={() => handleApprove(request.id)}
                                                        disabled={isProcessing}
                                                        className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                                                    >
                                                        {isProcessing ? '處理中...' : '核准'}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* 審核對話框 */}
            {reviewDialog.show && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
                        <div className="text-center mb-6">
                            <div className={`w-16 h-16 ${reviewDialog.type === 'approve' ? 'bg-emerald-100' : 'bg-rose-100'} rounded-full flex items-center justify-center mx-auto mb-4`}>
                                <span className={`material-symbols-outlined ${reviewDialog.type === 'approve' ? 'text-emerald-600' : 'text-rose-600'} text-4xl`}>
                                    {reviewDialog.type === 'approve' ? 'check_circle' : 'cancel'}
                                </span>
                            </div>
                            <h2 className="text-xl font-black text-slate-900 mb-2">
                                {reviewDialog.type === 'approve' ? '核准申請' : '拒絕申請'}
                            </h2>
                            <p className="text-slate-600 text-sm">
                                {reviewDialog.type === 'approve' ? '審核備註（選填）' : '請輸入拒絕原因'}
                            </p>
                        </div>

                        <textarea
                            value={reviewDialog.comment}
                            onChange={(e) => setReviewDialog({ ...reviewDialog, comment: e.target.value })}
                            placeholder={reviewDialog.type === 'approve' ? '輸入審核備註...' : '請說明拒絕原因...'}
                            rows={4}
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none font-medium mb-6"
                        />

                        <div className="flex gap-3">
                            <button
                                onClick={() => setReviewDialog({ show: false, type: null, requestId: null, comment: '' })}
                                className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleReviewConfirm}
                                className={`flex-1 px-4 py-2.5 rounded-xl font-bold transition-colors ${reviewDialog.type === 'approve'
                                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                        : 'bg-rose-600 text-white hover:bg-rose-700'
                                    }`}
                            >
                                確定{reviewDialog.type === 'approve' ? '核准' : '拒絕'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 結果對話框 */}
            {resultDialog.show && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
                        <div className="text-center">
                            <div className={`w-16 h-16 ${resultDialog.success ? 'bg-emerald-100' : 'bg-rose-100'} rounded-full flex items-center justify-center mx-auto mb-4`}>
                                <span className={`material-symbols-outlined ${resultDialog.success ? 'text-emerald-600' : 'text-rose-600'} text-4xl`}>
                                    {resultDialog.success ? 'check_circle' : 'error'}
                                </span>
                            </div>
                            <h2 className="text-xl font-black text-slate-900 mb-2">
                                {resultDialog.success ? '操作成功' : '操作失敗'}
                            </h2>
                            <p className="text-slate-600 mb-6">{resultDialog.message}</p>
                            <button
                                onClick={() => setResultDialog({ show: false, success: false, message: '' })}
                                className={`w-full px-4 py-2.5 rounded-xl font-bold transition-colors ${resultDialog.success
                                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                        : 'bg-rose-600 text-white hover:bg-rose-700'
                                    }`}
                            >
                                確定
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MakeupRequestsPage;

import React, { useEffect, useState } from 'react';
import { getMakeupRequests, approveMakeupRequest, rejectMakeupRequest } from '../../services/admin';
import { useEmployee } from '../../contexts/EmployeeContext';
import { useAuth } from '../../contexts/AuthContext';

const MakeupRequestsPage: React.FC = () => {
    const { employee } = useEmployee();
    const { user } = useAuth(); // 新增：用於管理端管理員身分
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

    // 判斷當前是管理員模式還是主管模式
    const isAdminMode = !employee && !!user;

    useEffect(() => {
        fetchRequests();
    }, [filter, employee, user]);

    const fetchRequests = async () => {
        // 如果兩者都沒有登入，則無法讀取
        if (!employee && !user) {
            console.log('[MakeupRequestsPage] No active session (Admin or Employee)');
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            // 如果是主管模式，傳入 employee.id 作為 managerId
            // 如果是管理員模式，不傳入 managerId，讀取全公司資料
            const managerId = isAdminMode ? undefined : employee?.id;

            console.log('[MakeupRequestsPage] Fetching requests:', {
                mode: isAdminMode ? 'ADMIN' : 'MANAGER',
                managerId: managerId,
                filter: filter
            });

            const data = await getMakeupRequests(filter, managerId);
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
        const activeReviewerId = employee?.id || user?.id;
        if (!activeReviewerId || !reviewDialog.requestId) return;

        const { type, requestId, comment } = reviewDialog;

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
            ? await approveMakeupRequest(requestId, activeReviewerId, comment || undefined)
            : await rejectMakeupRequest(requestId, activeReviewerId, comment);

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

    const getStatusInfo = (status: string) => {
        const statuses = {
            PENDING: { text: '待審核', class: 'bg-amber-50 text-amber-700 border-amber-200' },
            APPROVED: { text: '已核准', class: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
            REJECTED: { text: '已拒絕', class: 'bg-rose-50 text-rose-700 border-rose-200' }
        };
        return statuses[status as keyof typeof statuses] || statuses.PENDING;
    };

    const getTypeIcon = (type: string) => {
        return type === 'IN'
            ? { icon: 'login', color: 'text-emerald-600', bg: 'bg-emerald-50', label: '上班補登' }
            : { icon: 'logout', color: 'text-orange-600', bg: 'bg-orange-50', label: '下班補登' };
    };

    const stats = [
        { label: '待審核', value: requests.filter(r => r.status === 'PENDING').length, color: 'bg-amber-500', icon: 'pending' },
        { label: '已核准', value: requests.filter(r => r.status === 'APPROVED').length, color: 'bg-emerald-500', icon: 'check_circle' },
        { label: '已拒絕', value: requests.filter(r => r.status === 'REJECTED').length, color: 'bg-rose-500', icon: 'cancel' }
    ];

    if (loading) {
        return <div className="p-4 text-center font-bold text-slate-400 py-20">載入中...</div>;
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                    {isAdminMode ? '全公司補登審核' : '下屬補登審核'}
                </h1>
                <p className="text-slate-500 text-sm font-medium mt-1">
                    {isAdminMode ? '管理全公司的漏卡補登申請' : '審核直屬下屬的漏卡補登申請'}
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-4">
                {stats.map((stat) => (
                    <div key={stat.label} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
                        <div className="flex flex-col items-center text-center gap-2">
                            <div className={`${stat.color} w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-slate-100`}>
                                <span className="material-symbols-outlined text-white text-xl">{stat.icon}</span>
                            </div>
                            <div>
                                <p className="text-2xl font-black text-slate-900 leading-none">{stat.value}</p>
                                <p className="text-[10px] font-black text-slate-400 mt-1 uppercase tracking-widest">{stat.label}</p>
                            </div>
                        </div>
                    </div>
                ))}
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
                        {status === 'ALL' ? '全部處理' : getStatusInfo(status).text}
                    </button>
                ))}
            </div>

            {/* Requests List */}
            <div className="space-y-4">
                {requests.length === 0 ? (
                    <div className="bg-white rounded-3xl border border-slate-100 py-20 text-center shadow-sm">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="material-symbols-outlined text-slate-200 text-5xl font-light">folder_off</span>
                        </div>
                        <p className="text-slate-400 font-black tracking-wider">尚無相關申請記錄</p>
                    </div>
                ) : (
                    requests.map((request) => {
                        const statusInfo = getStatusInfo(request.status);
                        const typeInfo = getTypeIcon(request.check_type);
                        const isPending = request.status === 'PENDING';
                        const isProcessing = processingId === request.id;

                        return (
                            <div key={request.id} className="group bg-white rounded-3xl border border-slate-100 p-6 hover:shadow-xl hover:border-blue-100 transition-all duration-300">
                                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                                    {/* Left: Info */}
                                    <div className="flex items-center gap-5 flex-1">
                                        <div className={`w-16 h-16 ${typeInfo.bg} rounded-2xl flex items-center justify-center shrink-0 border border-slate-50`}>
                                            <span className={`material-symbols-outlined ${typeInfo.color} text-3xl`}>
                                                {typeInfo.icon}
                                            </span>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-3 mb-1.5">
                                                <h3 className="text-xl font-black text-slate-900 truncate">
                                                    {request.employee?.name || '未知員工'}
                                                </h3>
                                                <span className={`px-3 py-1 text-[10px] font-black rounded-lg border uppercase tracking-widest ${statusInfo.class}`}>
                                                    {statusInfo.text}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-bold text-slate-400">
                                                <span className="flex items-center gap-1.5">
                                                    <span className="material-symbols-outlined text-base">business</span>
                                                    {request.employee?.department || '未分配'}
                                                </span>
                                                <span className="text-slate-200 hidden sm:inline">|</span>
                                                <span className="flex items-center gap-1.5 text-slate-700">
                                                    <span className="material-symbols-outlined text-base text-slate-400">calendar_today</span>
                                                    <span className="font-mono">{new Date(request.request_date).toLocaleDateString('zh-TW')}</span>
                                                    <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-black">{request.request_time}</span>
                                                </span>
                                                <span className="text-slate-200 hidden sm:inline">|</span>
                                                <span className={`flex items-center gap-1.5 font-black ${typeInfo.color} text-xs`}>
                                                    {typeInfo.label}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Actions or Meta */}
                                    <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between lg:justify-center gap-4 pt-4 lg:pt-0 border-t lg:border-t-0 border-slate-50">
                                        <div className="flex flex-col lg:items-end">
                                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">ID: {request.id.slice(0, 8)}</span>
                                            <span className="text-[10px] text-slate-400 font-bold mt-0.5">申請於 {new Date(request.created_at).toLocaleDateString('zh-TW')}</span>
                                        </div>

                                        {isPending && (
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleReject(request.id)}
                                                    disabled={isProcessing}
                                                    className="px-6 py-2.5 bg-rose-50 text-rose-600 rounded-xl text-xs font-black hover:bg-rose-100 transition-all disabled:opacity-50 active:scale-95"
                                                >
                                                    拒絕
                                                </button>
                                                <button
                                                    onClick={() => handleApprove(request.id)}
                                                    disabled={isProcessing}
                                                    className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all disabled:opacity-50 active:scale-95"
                                                >
                                                    {isProcessing ? '...' : '核准'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Reason & Comment Section */}
                                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="material-symbols-outlined text-slate-400 text-sm">notes</span>
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">補登原因</span>
                                        </div>
                                        <p className="text-sm font-bold text-slate-700 leading-relaxed">
                                            {request.reason}
                                        </p>
                                    </div>

                                    {request.review_comment && (
                                        <div className="bg-amber-50/50 rounded-2xl p-4 border border-amber-100">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="material-symbols-outlined text-amber-500 text-sm">rate_review</span>
                                                <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">審核備註</span>
                                            </div>
                                            <p className="text-sm font-bold text-amber-700 leading-relaxed">
                                                {request.review_comment}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* 審核對話框 */}
            {reviewDialog.show && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95 duration-300">
                        <div className="text-center mb-8">
                            <div className={`w-20 h-20 ${reviewDialog.type === 'approve' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'} rounded-3xl flex items-center justify-center mx-auto mb-6`}>
                                <span className="material-symbols-outlined text-4xl">
                                    {reviewDialog.type === 'approve' ? 'verified' : 'cancel'}
                                </span>
                            </div>
                            <h2 className="text-2xl font-black text-slate-900 mb-2">
                                {reviewDialog.type === 'approve' ? '核准補登申請' : '拒絕補登申請'}
                            </h2>
                            <p className="text-slate-500 font-bold text-sm">
                                {reviewDialog.type === 'approve' ? '核准後系統將自動建立打卡記錄' : '請說明拒絕該筆補登的原因'}
                            </p>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">審核備註</label>
                                <textarea
                                    autoFocus
                                    value={reviewDialog.comment}
                                    onChange={(e) => setReviewDialog({ ...reviewDialog, comment: e.target.value })}
                                    placeholder={reviewDialog.type === 'approve' ? '輸入核准備註（選填）...' : '請輸入拒絕原因（必填）...'}
                                    rows={4}
                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all resize-none font-bold text-slate-700 placeholder:text-slate-300"
                                />
                            </div>

                            <div className="flex gap-4">
                                <button
                                    onClick={() => setReviewDialog({ show: false, type: null, requestId: null, comment: '' })}
                                    className="flex-1 px-6 py-4 bg-white text-slate-500 border border-slate-100 rounded-2xl font-black hover:bg-slate-50 transition-all"
                                >
                                    取消退出
                                </button>
                                <button
                                    onClick={handleReviewConfirm}
                                    className={`flex-1 px-6 py-4 rounded-2xl font-black text-white shadow-xl transition-all active:scale-95 ${reviewDialog.type === 'approve'
                                            ? 'bg-emerald-600 shadow-emerald-100 hover:bg-emerald-700'
                                            : 'bg-rose-600 shadow-rose-100 hover:bg-rose-700'
                                        }`}
                                >
                                    確定{reviewDialog.type === 'approve' ? '核准' : '拒絕'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 結果對話框 */}
            {resultDialog.show && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-sm w-full p-8 animate-in zoom-in-95 duration-300 text-center">
                        <div className={`w-20 h-20 ${resultDialog.success ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'} rounded-3xl flex items-center justify-center mx-auto mb-6`}>
                            <span className="material-symbols-outlined text-4xl">
                                {resultDialog.success ? 'check_circle' : 'error'}
                            </span>
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 mb-2">
                            {resultDialog.success ? '處理成功' : 'Oops! 發生錯誤'}
                        </h2>
                        <p className="text-slate-500 font-bold mb-8 px-4">{resultDialog.message}</p>
                        <button
                            onClick={() => setResultDialog({ show: false, success: false, message: '' })}
                            className={`w-full py-4 rounded-2xl font-black text-white shadow-xl transition-all active:scale-95 ${resultDialog.success
                                    ? 'bg-slate-900 shadow-slate-200'
                                    : 'bg-rose-600 shadow-rose-100 hover:bg-rose-700'
                                }`}
                        >
                            我了解了
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MakeupRequestsPage;

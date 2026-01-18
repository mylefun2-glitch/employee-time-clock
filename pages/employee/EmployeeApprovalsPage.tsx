import React, { useEffect, useState } from 'react';
import { useEmployee } from '../../contexts/EmployeeContext';
import { getPendingApprovalsForSupervisor } from '../../services/supervisorService';
import { requestService } from '../../services/requestService';
import { RequestStatus } from '../../types';
import { supabase } from '../../lib/supabase';

const EmployeeApprovalsPage: React.FC = () => {
    const { employee } = useEmployee();
    const [pendingRequests, setPendingRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<string | null>(null);

    useEffect(() => {
        if (employee && employee.is_supervisor) {
            fetchPendingApprovals();
        }
    }, [employee]);

    const fetchPendingApprovals = async () => {
        if (!employee) return;

        try {
            const { requests } = await getPendingApprovalsForSupervisor(employee.id);
            setPendingRequests(requests);
        } catch (error) {
            console.error('Error fetching pending approvals:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (requestId: string) => {
        if (!confirm('確定要核准此申請嗎？')) return;

        setProcessing(requestId);
        try {
            const result = await requestService.updateRequestStatus(
                requestId,
                RequestStatus.APPROVED,
                employee.id
            );
            if (!result.success) throw new Error(result.error);
            await fetchPendingApprovals();
            alert('已核准申請');
        } catch (error) {
            console.error('Error approving request:', error);
            alert('核准失敗，請稍後再試');
        } finally {
            setProcessing(null);
        }
    };

    const handleReject = async (requestId: string) => {
        if (!confirm('確定要拒絕此申請嗎？')) return;

        setProcessing(requestId);
        try {
            const result = await requestService.updateRequestStatus(
                requestId,
                RequestStatus.REJECTED,
                employee.id
            );
            if (!result.success) throw new Error(result.error);
            await fetchPendingApprovals();
            alert('已拒絕申請');
        } catch (error) {
            console.error('Error rejecting request:', error);
            alert('拒絕失敗，請稍後再試');
        } finally {
            setProcessing(null);
        }
    };

    if (!employee?.is_supervisor) {
        return (
            <div className="text-center py-20 px-4">
                <span className="material-symbols-outlined text-slate-200 text-6xl">gpp_maybe</span>
                <h2 className="text-xl font-bold text-slate-900 mt-4">無審核權限</h2>
                <p className="text-slate-500 mt-2">您目前不是主管職，無法查看此頁面內容。</p>
            </div>
        );
    }

    if (loading) {
        return <div className="p-4">載入中...</div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">待審核申請</h1>
                <p className="text-slate-500 mt-1">審核您下屬的請假申請，目前有 {pendingRequests.length} 筆待處理</p>
            </div>

            {/* Stats Summary */}
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl shadow-lg p-8 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <span className="material-symbols-outlined text-white text-9xl">rule</span>
                </div>
                <div className="relative z-10 flex items-center justify-between">
                    <div>
                        <div className="text-5xl font-black tracking-tighter">{pendingRequests.length}</div>
                        <div className="text-blue-100 mt-1 font-bold text-sm uppercase tracking-widest">筆待審核申請</div>
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                {pendingRequests.length === 0 ? (
                    <div className="px-6 py-20 text-center">
                        <span className="material-symbols-outlined text-emerald-300 text-6xl">check_circle</span>
                        <h3 className="text-lg font-bold text-slate-900 mt-4">已全部處理完畢</h3>
                        <p className="text-slate-500 mt-2">目前沒有任何待審核的申請事項。</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {pendingRequests.map((request) => (
                            <div key={request.id} className="group p-5 sm:p-6 hover:bg-slate-50/80 transition-all duration-200">
                                <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                                    <div className="flex-1 space-y-4">
                                        {/* Employee Header */}
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center border border-blue-100 shadow-sm transition-transform group-hover:scale-110">
                                                <span className="material-symbols-outlined text-blue-600">person</span>
                                            </div>
                                            <div>
                                                <h3 className="text-base font-bold text-slate-900 leading-tight">
                                                    {request.employee?.name || '未知員工'}
                                                </h3>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] mt-0.5">
                                                    {request.employee?.department || '未分配部門'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Content Box */}
                                        <div className="bg-white/50 rounded-2xl p-4 border border-slate-100 group-hover:bg-white transition-colors">
                                            <div className="flex items-center gap-3 mb-3">
                                                <span className="text-sm font-black text-slate-800">
                                                    {request.leave_type?.name || '請假'}
                                                </span>
                                                <span className="px-2 py-0.5 text-[9px] font-bold rounded bg-amber-50 text-amber-600 border border-amber-100 uppercase tracking-widest">
                                                    PENDING / 待處理
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-4 text-xs font-bold text-slate-500 mb-4">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="material-symbols-outlined text-[14px]">event</span>
                                                    <span className="font-mono tracking-tight">{new Date(request.start_date).toLocaleDateString('zh-TW')}</span>
                                                </div>
                                                <span className="text-slate-300">→</span>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-mono tracking-tight">{new Date(request.end_date).toLocaleDateString('zh-TW')}</span>
                                                </div>
                                            </div>

                                            {request.reason && (
                                                <div className="py-3 border-t border-slate-100">
                                                    <p className="text-xs text-slate-500 leading-relaxed font-medium">
                                                        <span className="font-black text-slate-300 mr-2 text-[9px] uppercase tracking-widest block mb-1">Reason Description / 事由</span>
                                                        {request.reason}
                                                    </p>
                                                </div>
                                            )}

                                            <div className="flex items-center gap-1 text-[9px] font-bold text-slate-300 uppercase tracking-widest mt-1">
                                                <span className="material-symbols-outlined text-[12px]">schedule</span>
                                                CREATED AT: {new Date(request.created_at).toLocaleString('zh-TW')}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Column */}
                                    <div className="flex lg:flex-col gap-2 min-w-[140px]">
                                        <button
                                            onClick={() => handleApprove(request.id)}
                                            disabled={processing === request.id}
                                            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-100 hover:bg-emerald-700 disabled:opacity-50 transition-all hover:-translate-y-0.5 active:translate-y-0"
                                        >
                                            <span className="material-symbols-outlined text-lg">check_circle</span>
                                            {processing === request.id ? '...' : '核准'}
                                        </button>
                                        <button
                                            onClick={() => handleReject(request.id)}
                                            disabled={processing === request.id}
                                            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-white text-rose-500 border border-slate-200 rounded-xl font-bold hover:bg-rose-50 hover:border-rose-100 disabled:opacity-50 transition-all"
                                        >
                                            <span className="material-symbols-outlined text-lg">cancel</span>
                                            {processing === request.id ? '...' : '拒絕'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default EmployeeApprovalsPage;


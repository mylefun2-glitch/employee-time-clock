import React, { useEffect, useState } from 'react';
import { shiftService } from '../../services/shiftService';
import { ShiftRequest, RequestStatus, ShiftType } from '../../types';
import TableHeaderFilter from '../../components/ui/TableHeaderFilter';
import { useAuth } from '../../contexts/AuthContext';
import * as supervisorService from '../../services/supervisorService';
import { supabase } from '../../lib/supabase';

const ShiftRequestsPage: React.FC = () => {
    const { user } = useAuth();
    const [requests, setRequests] = useState<ShiftRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('PENDING'); // 'ALL', 'PENDING', 'APPROVED', 'REJECTED'
    const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0, total: 0 });
    const [currentEmployee, setCurrentEmployee] = useState<any>(null);

    useEffect(() => {
        loadRequests();
        loadCurrentEmployee();
    }, []);

    const loadCurrentEmployee = async () => {
        console.log('[ShiftRequestsPage] Loading current employee for user:', user?.id, user?.email);
        
        let emp = null;
        if (user?.email) {
            emp = await supervisorService.getCurrentUserEmployee(user.email);
        }
        
        // 如果找不到對應 Email，或者 user 沒有 Email，
        // 在管理後台內，我們嘗試尋找理事長身分作為備選以便進行審核
        if (!emp) {
            console.log('[ShiftRequestsPage] No employee match for email, checking for Chairperson record...');
            const { data: chairman } = await supabase
                .from('employees')
                .select('*')
                .eq('is_chairman', true)
                .maybeSingle();
            emp = chairman;
        }
        
        console.log('[ShiftRequestsPage] Current employee set to:', emp?.id, emp?.name);
        setCurrentEmployee(emp);
    };

    const loadRequests = async () => {
        setLoading(true);
        const status = filterStatus === 'ALL' ? undefined : filterStatus as RequestStatus;
        const data = await shiftService.getShiftRequests(status);
        setRequests(data);

        // 獲取各項統計
        const allData = await shiftService.getShiftRequests();
        setCounts({
            pending: allData.filter(r => r.status === RequestStatus.PENDING || r.status === RequestStatus.WITHDRAW_PENDING).length,
            approved: allData.filter(r => r.status === RequestStatus.APPROVED).length,
            rejected: allData.filter(r => r.status === RequestStatus.REJECTED).length,
            total: allData.length
        });
        
        setLoading(false);
    };

    useEffect(() => {
        loadRequests();
    }, [filterStatus]);

    const handleAction = async (requestId: string, status: RequestStatus) => {
        console.log('[ShiftRequestsPage] handleAction called:', { requestId, status, currentEmployee });
        if (!currentEmployee) {
            alert('找不到您的員工資料，無法執行動作。請確保您的帳號已連結員工。');
            return;
        }

        const comment = status === RequestStatus.REJECTED ? prompt('請輸入拒絕原因（選填）') : undefined;
        if (status === RequestStatus.REJECTED && comment === null) return;

        console.log('[ShiftRequestsPage] Updating shift status with approverId:', currentEmployee.id);
        const { success, error } = await shiftService.updateShiftStatus(
            requestId,
            status,
            currentEmployee.id,
            comment || undefined
        );

        if (success) {
            alert('操作成功');
            loadRequests();
        } else {
            alert(`操作失敗: ${error}`);
        }
    };

    const getStatusLabel = (status: RequestStatus) => {
        const labels: Record<string, string> = {
            [RequestStatus.PENDING]: '待審核',
            [RequestStatus.APPROVED]: '已核准',
            [RequestStatus.REJECTED]: '已拒絕',
            [RequestStatus.WITHDRAWN]: '已撤回',
            [RequestStatus.WITHDRAW_PENDING]: '撤回待審'
        };
        return labels[status] || status;
    };

    const getStatusStyle = (status: RequestStatus) => {
        const styles: Record<string, string> = {
            [RequestStatus.PENDING]: 'bg-amber-100 text-amber-700 border-amber-200',
            [RequestStatus.APPROVED]: 'bg-emerald-100 text-emerald-700 border-emerald-200',
            [RequestStatus.REJECTED]: 'bg-rose-100 text-rose-700 border-rose-200',
            [RequestStatus.WITHDRAWN]: 'bg-slate-100 text-slate-500 border-slate-200',
            [RequestStatus.WITHDRAW_PENDING]: 'bg-orange-100 text-orange-700 border-orange-200'
        };
        return styles[status] || 'bg-slate-100 text-slate-700 border-slate-200';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <span className="material-symbols-outlined text-indigo-600">swap_calls</span>
                        挪移申請核准
                    </h1>
                    <p className="mt-1 text-sm text-slate-500 font-medium">審核員工的休假日對調或工時調整申請</p>
                </div>
            </div>

            {/* 統計卡 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className={`p-5 rounded-3xl border transition-all cursor-pointer ${filterStatus === 'ALL' ? 'bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-100 text-white' : 'bg-white border-slate-100 shadow-sm text-slate-900 group hover:border-indigo-200'}`}
                     onClick={() => setFilterStatus('ALL')}>
                    <div className={`text-[10px] font-black uppercase tracking-widest mb-1 ${filterStatus === 'ALL' ? 'text-indigo-100' : 'text-slate-400 group-hover:text-indigo-400'}`}>全部申請</div>
                    <div className="text-2xl font-black">{counts.total}</div>
                </div>
                <div className={`p-5 rounded-3xl border transition-all cursor-pointer ${filterStatus === 'PENDING' ? 'bg-amber-500 border-amber-500 shadow-lg shadow-amber-100 text-white' : 'bg-white border-slate-100 shadow-sm text-slate-900 group hover:border-amber-200'}`}
                     onClick={() => setFilterStatus('PENDING')}>
                    <div className={`text-[10px] font-black uppercase tracking-widest mb-1 ${filterStatus === 'PENDING' ? 'text-amber-50' : 'text-slate-400 group-hover:text-amber-500'}`}>待核准</div>
                    <div className="text-2xl font-black">{counts.pending}</div>
                </div>
                <div className={`p-5 rounded-3xl border transition-all cursor-pointer ${filterStatus === 'APPROVED' ? 'bg-emerald-500 border-emerald-500 shadow-lg shadow-emerald-100 text-white' : 'bg-white border-slate-100 shadow-sm text-slate-900 group hover:border-emerald-200'}`}
                     onClick={() => setFilterStatus('APPROVED')}>
                    <div className={`text-[10px] font-black uppercase tracking-widest mb-1 ${filterStatus === 'APPROVED' ? 'text-emerald-50' : 'text-slate-400 group-hover:text-emerald-500'}`}>已核准</div>
                    <div className="text-2xl font-black">{counts.approved}</div>
                </div>
                <div className={`p-5 rounded-3xl border transition-all cursor-pointer ${filterStatus === 'REJECTED' ? 'bg-rose-500 border-rose-500 shadow-lg shadow-rose-100 text-white' : 'bg-white border-slate-100 shadow-sm text-slate-900 group hover:border-rose-200'}`}
                     onClick={() => setFilterStatus('REJECTED')}>
                    <div className={`text-[10px] font-black uppercase tracking-widest mb-1 ${filterStatus === 'REJECTED' ? 'text-rose-50' : 'text-slate-400 group-hover:text-rose-500'}`}>已拒絕</div>
                    <div className="text-2xl font-black">{counts.rejected}</div>
                </div>
            </div>

            {/* 列表 */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50">
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">申請人</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">類型</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">調整內容</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">原因</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">狀態</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {requests.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-medium italic">
                                        目前沒有待處理的挪移申請
                                    </td>
                                </tr>
                            ) : (
                                requests.map((req) => (
                                    <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-900">{(req as any).employee_name || '未知'}</span>
                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{(req as any).employee?.department}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${req.type === ShiftType.SWAP_REST_DAY ? 'bg-indigo-50 text-indigo-600' : 'bg-sky-50 text-sky-600'}`}>
                                                {req.type === ShiftType.SWAP_REST_DAY ? '對調休息日' : '調整工時'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {req.type === ShiftType.SWAP_REST_DAY ? (
                                                <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                                                    <span className="text-slate-400 underline decoration-slate-200">{req.original_rest_date}</span>
                                                    <span className="material-symbols-outlined text-sm text-indigo-400">arrow_forward</span>
                                                    <span className="text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">{req.new_rest_date}</span>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col gap-1">
                                                    <div className="text-xs font-bold text-slate-600">{req.target_date}</div>
                                                    <div className="text-[10px] font-medium text-slate-400">
                                                        {req.new_work_start_time} - {req.new_work_end_time} 
                                                        (休: {req.new_break_start_time}-{req.new_break_end_time})
                                                    </div>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-sm text-slate-600 max-w-[200px] truncate" title={req.reason}>
                                                {req.reason}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${getStatusStyle(req.status)}`}>
                                                {getStatusLabel(req.status)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {(req.status === RequestStatus.PENDING || req.status === RequestStatus.WITHDRAW_PENDING) && (
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => handleAction(req.id, RequestStatus.APPROVED)}
                                                        className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-xl transition-all shadow-sm shadow-emerald-100"
                                                        title={req.status === RequestStatus.WITHDRAW_PENDING ? "核准撤回" : "核准"}
                                                    >
                                                        <span className="material-symbols-outlined text-sm">check</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleAction(req.id, RequestStatus.REJECTED)}
                                                        className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-xl transition-all shadow-sm shadow-rose-100"
                                                        title={req.status === RequestStatus.WITHDRAW_PENDING ? "拒絕撤回" : "拒絕"}
                                                    >
                                                        <span className="material-symbols-outlined text-sm">close</span>
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ShiftRequestsPage;

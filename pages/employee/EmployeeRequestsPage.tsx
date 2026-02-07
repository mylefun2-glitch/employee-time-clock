import React, { useEffect, useState } from 'react';
import { useEmployee } from '../../contexts/EmployeeContext';
import { requestService } from '../../services/requestService';
import LeaveRequestForm from '../../components/LeaveRequestForm';
import ModificationRequestForm from '../../components/ModificationRequestForm';
import { LeaveRequest } from '../../types';

const EmployeeRequestsPage: React.FC = () => {
    const { employee } = useEmployee();
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
    const [showForm, setShowForm] = useState(false);
    const [showModificationForm, setShowModificationForm] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);

    useEffect(() => {
        if (employee) {
            fetchData();
        }
    }, [employee]);

    const fetchData = async () => {
        if (!employee) return;
        setLoading(true);
        try {
            const data = await requestService.getEmployeeRequests(employee.id);
            setRequests(data || []);
            if (!data || data.length === 0) {
                console.log('No requests found for employee:', employee.id);
            }
        } catch (error) {
            console.error('Error fetching requests in EmployeeRequestsPage:', error);
        } finally {
            setLoading(false);
        }
    };

    const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
    const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);

    const getStatusInfo = (status: string) => {
        const statuses = {
            PENDING: { text: '待審核', class: 'bg-amber-50 text-amber-700 border-amber-200', icon: 'pending' },
            APPROVED: { text: '已核准', class: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'check_circle' },
            REJECTED: { text: '已拒絕', class: 'bg-rose-50 text-rose-700 border-rose-200', icon: 'cancel' },
            WITHDRAWN: { text: '已撤回', class: 'bg-slate-50 text-slate-600 border-slate-200', icon: 'block' }
        };
        return statuses[status as keyof typeof statuses] || statuses.PENDING;
    };

    const handleWithdrawRequest = async () => {
        if (!employee || !withdrawingId) return;

        const result = await requestService.withdrawRequest(withdrawingId, employee.id);
        setShowWithdrawConfirm(false);
        setWithdrawingId(null);

        if (result.success) {
            fetchData();
        } else {
            alert(result.error || '撤回失敗');
        }
    };

    const filteredRequests = requests.filter(req => filter === 'ALL' || req.status === filter);

    const getCount = (status: 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED') => {
        if (status === 'ALL') return requests.length;
        return requests.filter(r => r.status === status).length;
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">申請記錄</h1>
                    <p className="text-slate-500 text-sm font-medium mt-1">追蹤您的所有申請（含公務車借用）與審核狀態</p>
                </div>
                <button
                    onClick={() => setShowForm(true)}
                    className="flex items-center justify-center gap-2 px-8 py-3.5 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all hover:-translate-y-1 active:scale-95"
                >
                    <span className="material-symbols-outlined">add_circle</span>
                    發起新申請
                </button>
            </div>


            {/* Filter Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((status) => (
                    <button
                        key={status}
                        onClick={() => setFilter(status)}
                        className={`px-6 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all border ${filter === status
                            ? 'bg-slate-900 text-white border-slate-900 shadow-lg'
                            : 'bg-white text-slate-500 border-slate-100 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                    >
                        {status === 'ALL' ? '全部申請' : getStatusInfo(status).text}
                        <span className="ml-2 px-2 py-0.5 bg-slate-100 text-slate-500 rounded-lg text-[10px] group-hover:bg-slate-200 transition-colors">
                            {getCount(status)}
                        </span>
                    </button>
                ))}
            </div>

            {/* Requests Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-slate-400">載入中...</div>
                ) : filteredRequests.length === 0 ? (
                    <div className="py-20 text-center">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="material-symbols-outlined text-slate-200 text-5xl">folder_off</span>
                        </div>
                        <h3 className="text-xl font-black text-slate-900 tracking-tight">尚無相關紀錄</h3>
                        <p className="text-slate-500 font-bold mt-2">您還沒有任何申請記錄。</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50 border-b border-slate-100">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider">類型</th>
                                    <th className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider">開始時間</th>
                                    <th className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider">結束時間</th>
                                    <th className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider">事由</th>
                                    <th className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider">狀態</th>
                                    <th className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider">申請時間</th>
                                    <th className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredRequests.map((request) => {
                                    const status = getStatusInfo(request.status);
                                    return (
                                        <tr key={request.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 border border-blue-100 shrink-0">
                                                        <span className="material-symbols-outlined text-lg">edit_calendar</span>
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-slate-900">{request.leave_type?.name || '差勤申請'}</div>
                                                        {request.car && (
                                                            <div className="flex items-center gap-1 text-blue-600 text-xs mt-1">
                                                                <span className="material-symbols-outlined text-sm">directions_car</span>
                                                                <span>{request.car.plate_number}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="text-sm font-mono text-slate-700">
                                                    {new Date(request.start_date).toLocaleString('zh-TW', {
                                                        year: 'numeric',
                                                        month: '2-digit',
                                                        day: '2-digit',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="text-sm font-mono text-slate-700">
                                                    {new Date(request.end_date).toLocaleString('zh-TW', {
                                                        year: 'numeric',
                                                        month: '2-digit',
                                                        day: '2-digit',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 max-w-xs">
                                                <div className="text-sm text-slate-600 truncate" title={request.reason}>
                                                    {request.reason || '-'}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <span className={`px-3 py-1.5 text-xs font-black rounded-lg border inline-block ${status.class}`}>
                                                    {status.text}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="flex flex-col gap-1">
                                                    <div className="text-xs text-slate-500 font-medium">
                                                        {new Date(request.created_at).toLocaleString('zh-TW', {
                                                            year: 'numeric',
                                                            month: '2-digit',
                                                            day: '2-digit'
                                                        })}
                                                    </div>
                                                    {request.original_request_id && (
                                                        <span className="px-2 py-0.5 bg-purple-50 text-purple-600 text-[10px] font-black rounded-md inline-block w-fit">
                                                            變更申請
                                                        </span>
                                                    )}
                                                    {request.is_modified && (
                                                        <span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-[10px] font-black rounded-md inline-block w-fit">
                                                            已變更
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="flex gap-2">
                                                    {(request.status === 'PENDING' || request.status === 'APPROVED') && !request.is_modified && (
                                                        <button
                                                            onClick={() => {
                                                                setWithdrawingId(request.id);
                                                                setShowWithdrawConfirm(true);
                                                            }}
                                                            className="px-3 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-xs font-black hover:bg-slate-100 transition-all flex items-center gap-1"
                                                        >
                                                            <span className="material-symbols-outlined text-sm">cancel</span>
                                                            撤回
                                                        </button>
                                                    )}
                                                    {(request.status === 'APPROVED' || request.status === 'REJECTED') && !request.is_modified && !request.original_request_id && (
                                                        <button
                                                            onClick={() => {
                                                                setSelectedRequest(request);
                                                                setShowModificationForm(true);
                                                            }}
                                                            className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-black hover:bg-blue-100 transition-all flex items-center gap-1"
                                                        >
                                                            <span className="material-symbols-outlined text-sm">edit</span>
                                                            申請變更
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Integrated Form Modal */}
            {/* Leave Request Form Modal */}
            {showForm && employee && (
                <LeaveRequestForm
                    employeeId={employee.id}
                    onClose={() => setShowForm(false)}
                    onSuccess={() => {
                        setShowForm(false);
                        fetchData();
                    }}
                />
            )}

            {/* Modification Request Form Modal */}
            {showModificationForm && employee && selectedRequest && (
                <ModificationRequestForm
                    originalRequest={selectedRequest}
                    employeeId={employee.id}
                    onClose={() => {
                        setShowModificationForm(false);
                        setSelectedRequest(null);
                    }}
                    onSuccess={() => {
                        setShowModificationForm(false);
                        setSelectedRequest(null);
                        fetchData();
                    }}
                />
            )}

            {/* Withdraw Confirmation Dialog */}
            {showWithdrawConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center">
                                <span className="material-symbols-outlined text-amber-600 text-2xl">warning</span>
                            </div>
                            <h3 className="text-xl font-black text-slate-900">確認撤回申請</h3>
                        </div>
                        <p className="text-slate-600 mb-6">確定要撤回此申請嗎?撤回後將無法復原。</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowWithdrawConfirm(false);
                                    setWithdrawingId(null);
                                }}
                                className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-black hover:bg-slate-200 transition-colors"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleWithdrawRequest}
                                className="flex-1 px-6 py-3 bg-rose-600 text-white rounded-xl font-black hover:bg-rose-700 transition-colors"
                            >
                                確認撤回
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmployeeRequestsPage;

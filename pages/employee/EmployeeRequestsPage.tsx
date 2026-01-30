import React, { useEffect, useState } from 'react';
import { useEmployee } from '../../contexts/EmployeeContext';
import { requestService } from '../../services/requestService';
import LeaveRequestForm from '../../components/LeaveRequestForm';

const EmployeeRequestsPage: React.FC = () => {
    const { employee } = useEmployee();
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
    const [showForm, setShowForm] = useState(false);

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

    const getStatusInfo = (status: string) => {
        const statuses = {
            PENDING: { text: '待審核', class: 'bg-amber-50 text-amber-700 border-amber-200', icon: 'pending' },
            APPROVED: { text: '已核准', class: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'check_circle' },
            REJECTED: { text: '已拒絕', class: 'bg-rose-50 text-rose-700 border-rose-200', icon: 'cancel' }
        };
        return statuses[status as keyof typeof statuses] || statuses.PENDING;
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

            {/* Requests List */}
            <div className="space-y-4">
                {loading ? (
                    <div className="p-8 text-center text-slate-400">載入中...</div>
                ) : filteredRequests.length === 0 ? (
                    <div className="bg-white rounded-3xl border border-slate-100 py-20 text-center shadow-sm">
                        <span className="material-symbols-outlined text-slate-200 text-5xl mb-4">folder_off</span>
                        <p className="text-slate-400 font-black tracking-wider">尚無相關紀錄</p>
                    </div>
                ) : (
                    filteredRequests.map((request) => {
                        const status = getStatusInfo(request.status);
                        return (
                            <div key={request.id} className="group bg-white rounded-3xl border border-slate-100 p-5 hover:shadow-xl transition-all duration-300">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex items-center gap-5">
                                        <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 border border-blue-100 shrink-0">
                                            <span className="material-symbols-outlined text-2xl">edit_calendar</span>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-3 mb-1">
                                                <h3 className="text-lg font-black text-slate-900">
                                                    {request.leave_type?.name || '差勤申請'}
                                                </h3>
                                                <span className={`px-3 py-1 text-[10px] font-black rounded-lg border uppercase tracking-wider ${status.class}`}>
                                                    {status.text}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-sm font-bold text-slate-400">
                                                <span className="flex items-center gap-1.5 font-mono">
                                                    <span className="material-symbols-outlined text-base">calendar_today</span>
                                                    {new Date(request.start_date).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' })}
                                                    <span className="mx-1 font-sans">至</span>
                                                    {new Date(request.end_date).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' })}
                                                </span>
                                                {request.car && (
                                                    <span className="flex items-center gap-1.5 text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md text-xs">
                                                        <span className="material-symbols-outlined text-base">directions_car</span>
                                                        借用: {request.car.plate_number} ({request.car.model})
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-2 pt-4 md:pt-0 border-t md:border-t-0 border-slate-50">
                                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">ID: {request.id.slice(0, 8)}</span>
                                        <span className="text-xs font-bold text-slate-400">申請於 {new Date(request.created_at).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                {request.reason && (
                                    <div className="mt-4 bg-slate-50 rounded-2xl p-3 border border-slate-100 text-sm font-bold text-slate-700">
                                        {request.reason}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Integrated Form Modal */}
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
        </div>
    );
};

export default EmployeeRequestsPage;

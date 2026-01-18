import React, { useEffect, useState } from 'react';
import { useEmployee } from '../../contexts/EmployeeContext';
import { supabase } from '../../lib/supabase';
import LeaveRequestForm from '../../components/LeaveRequestForm';

const EmployeeRequestsPage: React.FC = () => {
    const { employee } = useEmployee();
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
    const [showForm, setShowForm] = useState(false);

    useEffect(() => {
        if (employee) {
            fetchRequests();
        }
    }, [employee]);

    const fetchRequests = async () => {
        if (!employee) return;

        try {
            const { data, error } = await supabase
                .from('leave_requests')
                .select(`
                    *,
                    leave_type:leave_types(*)
                `)
                .eq('employee_id', employee.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setRequests(data || []);
        } catch (error) {
            console.error('Error fetching requests:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status: string) => {
        const badges = {
            PENDING: { text: '待審核', class: 'bg-amber-50 text-amber-600 border-amber-100' },
            APPROVED: { text: '已核准', class: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
            REJECTED: { text: '已拒絕', class: 'bg-rose-50 text-rose-600 border-rose-100' }
        };
        return badges[status as keyof typeof badges] || badges.PENDING;
    };

    const filteredRequests = requests.filter(req =>
        filter === 'ALL' || req.status === filter
    );

    const stats = [
        { label: '總申請數', value: requests.length, icon: 'list_alt', color: 'bg-blue-500' },
        { label: '待審核', value: requests.filter(r => r.status === 'PENDING').length, icon: 'pending', color: 'bg-amber-500' },
        { label: '已核准', value: requests.filter(r => r.status === 'APPROVED').length, icon: 'check_circle', color: 'bg-emerald-500' },
        { label: '已拒絕', value: requests.filter(r => r.status === 'REJECTED').length, icon: 'cancel', color: 'bg-rose-500' }
    ];

    if (loading) {
        return <div className="p-4">載入中...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">申請記錄</h1>
                    <p className="text-slate-500 mt-1">追蹤您的所有請假申請狀態</p>
                </div>
                <button
                    onClick={() => setShowForm(true)}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all hover:-translate-y-0.5"
                >
                    <span className="material-symbols-outlined">add_circle</span>
                    發起新申請
                </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((item) => (
                    <div key={item.label} className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
                        <div className="flex items-center gap-4">
                            <div className={`${item.color} w-10 h-10 rounded-xl flex items-center justify-center shadow-md shadow-slate-100`}>
                                <span className="material-symbols-outlined text-white text-xl">{item.icon}</span>
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-900 leading-none">{item.value}</p>
                                <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">{item.label}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex gap-2 p-1.5 bg-white border border-slate-100 rounded-2xl w-fit shadow-sm">
                {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((status) => (
                    <button
                        key={status}
                        onClick={() => setFilter(status)}
                        className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${filter === status
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-100'
                            : 'text-slate-500 hover:bg-slate-50'
                            }`}
                    >
                        {status === 'ALL' ? '全部' : getStatusBadge(status).text}
                    </button>
                ))}
            </div>

            {/* List */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                {filteredRequests.length === 0 ? (
                    <div className="px-6 py-20 text-center">
                        <span className="material-symbols-outlined text-slate-200 text-6xl">folder_off</span>
                        <p className="text-slate-400 mt-4 font-bold">尚無相關申請記錄</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {filteredRequests.map((request) => {
                            const badge = getStatusBadge(request.status);
                            return (
                                <div key={request.id} className="group p-5 sm:p-6 hover:bg-slate-50/80 transition-all duration-200">
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                        {/* Icon & Primary Info */}
                                        <div className="flex items-center flex-1 gap-4">
                                            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center shrink-0 border border-slate-200 shadow-sm group-hover:bg-white group-hover:scale-110 transition-transform">
                                                <span className="material-symbols-outlined text-slate-500 text-2xl font-light">edit_calendar</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-base font-bold text-slate-900 border-b-2 border-transparent group-hover:border-blue-200 transition-colors">
                                                        {request.leave_type?.name || '請假申請'}
                                                    </h3>
                                                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md border uppercase tracking-wider ${badge.class}`}>
                                                        {badge.text}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3 mt-1.5 text-slate-400">
                                                    <div className="flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-[14px]">event</span>
                                                        <span className="text-xs font-bold font-mono tracking-tight">
                                                            {new Date(request.start_date).toLocaleDateString('zh-TW')}
                                                        </span>
                                                    </div>
                                                    <span className="text-slate-300">→</span>
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-xs font-bold font-mono tracking-tight">
                                                            {new Date(request.end_date).toLocaleDateString('zh-TW')}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Meta Stats & Date */}
                                        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-50">
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded sm:bg-transparent sm:px-0">
                                                ID: {request.id.slice(0, 8)}
                                            </div>
                                            <p className="text-[10px] sm:mt-1 font-bold text-slate-400 flex items-center gap-1 italic">
                                                <span className="material-symbols-outlined text-[12px]">schedule</span>
                                                {new Date(request.created_at).toLocaleDateString('zh-TW')} 申請
                                            </p>
                                        </div>
                                    </div>

                                    {request.reason && (
                                        <div className="mt-4 flex gap-4">
                                            <div className="hidden sm:block w-12 shrink-0"></div> {/* Alignment spacer */}
                                            <div className="flex-1 bg-slate-50/80 rounded-2xl p-4 border border-slate-100 group-hover:bg-white transition-colors border-l-4 border-l-blue-200">
                                                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                                                    <span className="font-black text-blue-400/60 mr-2 text-[9px] uppercase tracking-widest block mb-1">Reason / 事由</span>
                                                    {request.reason}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            {/* Leave Request Form Modal */}
            {showForm && employee && (
                <LeaveRequestForm
                    employeeId={employee.id}
                    onClose={() => setShowForm(false)}
                    onSuccess={() => {
                        setShowForm(false);
                        fetchRequests();
                    }}
                />
            )}
        </div>
    );
};

export default EmployeeRequestsPage;

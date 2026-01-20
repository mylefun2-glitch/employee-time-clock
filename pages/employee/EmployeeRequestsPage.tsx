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

    const getStatusInfo = (status: string) => {
        const statuses = {
            PENDING: { text: '待審核', class: 'bg-amber-50 text-amber-700 border-amber-200', icon: 'pending' },
            APPROVED: { text: '已核准', class: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'check_circle' },
            REJECTED: { text: '已拒絕', class: 'bg-rose-50 text-rose-700 border-rose-200', icon: 'cancel' }
        };
        return statuses[status as keyof typeof statuses] || statuses.PENDING;
    };

    const filteredRequests = requests.filter(req =>
        filter === 'ALL' || req.status === filter
    );

    const stats = [
        { label: '總申請數', value: requests.length, icon: 'list_alt', color: 'bg-blue-600' },
        { label: '待審核', value: requests.filter(r => r.status === 'PENDING').length, icon: 'pending', color: 'bg-amber-500' },
        { label: '已核准', value: requests.filter(r => r.status === 'APPROVED').length, icon: 'check_circle', color: 'bg-emerald-500' },
        { label: '已拒絕', value: requests.filter(r => r.status === 'REJECTED').length, icon: 'cancel', color: 'bg-rose-500' }
    ];

    if (loading) {
        return <div className="p-4">載入中...</div>;
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">申請記錄</h1>
                    <p className="text-slate-500 text-sm font-medium mt-1">追蹤您的所有請假申請與審核狀態</p>
                </div>
                <button
                    onClick={() => setShowForm(true)}
                    className="flex items-center justify-center gap-2 px-8 py-3.5 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all hover:-translate-y-1 active:scale-95"
                >
                    <span className="material-symbols-outlined">add_circle</span>
                    發起新申請
                </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((item) => (
                    <div key={item.label} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
                        <div className="flex flex-col items-center text-center gap-3">
                            <div className={`${item.color} w-12 h-12 rounded-xl flex items-center justify-center shadow-lg`}>
                                <span className="material-symbols-outlined text-white text-2xl">{item.icon}</span>
                            </div>
                            <div>
                                <p className="text-3xl font-black text-slate-900 leading-none mb-1">{item.value}</p>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{item.label}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((status) => {
                    const info = status === 'ALL' ? null : getStatusInfo(status);
                    return (
                        <button
                            key={status}
                            onClick={() => setFilter(status)}
                            className={`px-6 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all border ${filter === status
                                    ? 'bg-slate-900 text-white border-slate-900 shadow-lg'
                                    : 'bg-white text-slate-500 border-slate-100 hover:border-slate-300 hover:bg-slate-50'
                                }`}
                        >
                            {status === 'ALL' ? '全部申請' : info?.text}
                        </button>
                    );
                })}
            </div>

            {/* Requests List */}
            <div className="space-y-4">
                {filteredRequests.length === 0 ? (
                    <div className="bg-white rounded-3xl border border-slate-100 py-20 text-center shadow-sm">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="material-symbols-outlined text-slate-200 text-5xl">folder_off</span>
                        </div>
                        <p className="text-slate-400 font-black tracking-wider">尚無相關申請記錄</p>
                    </div>
                ) : (
                    filteredRequests.map((request) => {
                        const info = getStatusInfo(request.status);
                        return (
                            <div key={request.id} className="group bg-white rounded-3xl border border-slate-100 p-6 hover:shadow-xl hover:border-blue-100 transition-all duration-300">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                    {/* Left: Type & Status */}
                                    <div className="flex items-center gap-5">
                                        <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 border border-blue-100 shrink-0">
                                            <span className="material-symbols-outlined text-3xl">edit_calendar</span>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-3 mb-1">
                                                <h3 className="text-xl font-black text-slate-900">
                                                    {request.leave_type?.name || '請假申請'}
                                                </h3>
                                                <span className={`px-3 py-1 text-[10px] font-black rounded-lg border uppercase tracking-wider ${info.class}`}>
                                                    {info.text}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 text-sm font-bold text-slate-400">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="material-symbols-outlined text-base">calendar_today</span>
                                                    <span className="font-mono">{new Date(request.start_date).toLocaleDateString('zh-TW')}</span>
                                                </div>
                                                <span className="text-slate-200">/</span>
                                                <div className="flex items-center gap-1.5 font-mono">
                                                    至 {new Date(request.end_date).toLocaleDateString('zh-TW')}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Meta Info */}
                                    <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-2 pt-4 md:pt-0 border-t md:border-t-0 border-slate-50">
                                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">ID: {request.id.slice(0, 8)}</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-400">申請於</span>
                                            <span className="text-xs font-black text-slate-600">
                                                {new Date(request.created_at).toLocaleDateString('zh-TW')}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Reason Section */}
                                {request.reason && (
                                    <div className="mt-6 bg-slate-50 rounded-2xl p-5 border border-slate-100">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="material-symbols-outlined text-slate-400 text-sm">notes</span>
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">申請原因</span>
                                        </div>
                                        <p className="text-base font-bold text-slate-700 leading-relaxed">
                                            {request.reason}
                                        </p>
                                    </div>
                                )}
                            </div>
                        );
                    })
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

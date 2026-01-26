import React, { useEffect, useState } from 'react';
import { requestService } from '../../services/requestService';
import { LeaveRequest, RequestStatus } from '../../types';

interface DepartmentStats {
    department: string;
    count: number;
}

const RequestsPage: React.FC = () => {
    const [requests, setRequests] = useState<LeaveRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('ALL');
    const [filterDepartment, setFilterDepartment] = useState<string>('ALL');
    const [departments, setDepartments] = useState<string[]>([]);

    useEffect(() => {
        loadRequests();
    }, []);

    const loadRequests = async () => {
        setLoading(true);
        const data = await requestService.getAllRequests();
        setRequests(data);

        // 提取所有部門
        const deptSet = new Set<string>();
        data.forEach((req: any) => {
            if (req.employee?.department) {
                deptSet.add(req.employee.department);
            }
        });
        setDepartments(Array.from(deptSet).sort());

        setLoading(false);
    };

    const handleApprove = async (requestId: string) => {
        if (!confirm('確定要核准此申請嗎？')) return;

        const result = await requestService.updateRequestStatus(requestId, RequestStatus.APPROVED);
        if (result.success) {
            await loadRequests();
            alert('核准成功！');
        } else {
            alert(`核准失敗：${result.error}`);
        }
    };

    const handleReject = async (requestId: string) => {
        if (!confirm('確定要拒絕此申請嗎？')) return;

        const result = await requestService.updateRequestStatus(requestId, RequestStatus.REJECTED);
        if (result.success) {
            await loadRequests();
            alert('已拒絕申請');
        } else {
            alert(`拒絕失敗：${result.error}`);
        }
    };

    const getStatusBadge = (status: RequestStatus) => {
        const styles = {
            [RequestStatus.PENDING]: 'bg-yellow-100 text-yellow-800',
            [RequestStatus.APPROVED]: 'bg-green-100 text-green-800',
            [RequestStatus.REJECTED]: 'bg-red-100 text-red-800'
        };
        const labels = {
            [RequestStatus.PENDING]: '待審核',
            [RequestStatus.APPROVED]: '已核准',
            [RequestStatus.REJECTED]: '已拒絕'
        };
        return { style: styles[status] || 'bg-gray-100 text-gray-800', label: labels[status] || status };
    };

    const formatDateTime = (dateStr: string) => {
        return new Date(dateStr).toLocaleString('zh-TW', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // 雙重篩選：狀態 + 部門
    const filteredRequests = requests.filter(req => {
        const statusMatch = filterStatus === 'ALL' || req.status === filterStatus;
        const deptMatch = filterDepartment === 'ALL' || (req as any).employee?.department === filterDepartment;
        return statusMatch && deptMatch;
    });

    // 計算各部門的申請數量
    const getDepartmentStats = (): DepartmentStats[] => {
        const stats = new Map<string, number>();
        requests.forEach((req: any) => {
            const dept = req.employee?.department || '未分配';
            stats.set(dept, (stats.get(dept) || 0) + 1);
        });
        return Array.from(stats.entries()).map(([department, count]) => ({ department, count }));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    const departmentStats = getDepartmentStats();

    return (
        <div>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-8">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">請假/出差申請</h1>
                    <p className="mt-1 text-sm text-slate-500 font-medium">管理員工的請假與出差申請工作流</p>
                </div>
            </div>

            {/* 統計卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
                    <div className="text-xs font-black text-slate-400 uppercase tracking-widest">總申請數</div>
                    <div className="text-2xl font-black text-slate-900 mt-1">{requests.length}</div>
                </div>
                <div className="bg-yellow-50 rounded-2xl shadow-sm border border-yellow-100 p-5">
                    <div className="text-xs font-black text-yellow-600 uppercase tracking-widest">待審核</div>
                    <div className="text-2xl font-black text-yellow-800 mt-1">
                        {requests.filter(r => r.status === RequestStatus.PENDING).length}
                    </div>
                </div>
                <div className="bg-emerald-50 rounded-2xl shadow-sm border border-emerald-100 p-5">
                    <div className="text-xs font-black text-emerald-600 uppercase tracking-widest">已核准</div>
                    <div className="text-2xl font-black text-emerald-800 mt-1">
                        {requests.filter(r => r.status === RequestStatus.APPROVED).length}
                    </div>
                </div>
                <div className="bg-orange-50 rounded-2xl shadow-sm border border-orange-100 p-5">
                    <div className="text-xs font-black text-orange-600 uppercase tracking-widest">已拒絕</div>
                    <div className="text-2xl font-black text-orange-800 mt-1">
                        {requests.filter(r => r.status === RequestStatus.REJECTED).length}
                    </div>
                </div>
            </div>

            {/* 篩選器 */}
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm mb-4">
                <div className="flex gap-6 items-center flex-wrap">
                    {/* 狀態篩選 */}
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-slate-700 whitespace-nowrap">狀態：</label>
                        <div className="flex gap-2">
                            {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setFilterStatus(status)}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterStatus === status
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                >
                                    {status === 'ALL' ? '全部' : status === 'PENDING' ? '待審核' : status === 'APPROVED' ? '已核准' : '已拒絕'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 分隔線 */}
                    {departments.length > 0 && (
                        <div className="h-8 w-px bg-slate-200"></div>
                    )}

                    {/* 部門篩選 */}
                    {departments.length > 0 && (
                        <div className="flex items-center gap-2 flex-1">
                            <label className="text-sm font-medium text-slate-700 whitespace-nowrap">部門：</label>
                            <div className="flex gap-2 flex-wrap">
                                <button
                                    onClick={() => setFilterDepartment('ALL')}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterDepartment === 'ALL'
                                        ? 'bg-purple-600 text-white'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                >
                                    全部
                                </button>
                                {departments.map((dept) => {
                                    const stat = departmentStats.find(s => s.department === dept);
                                    return (
                                        <button
                                            key={dept}
                                            onClick={() => setFilterDepartment(dept)}
                                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${filterDepartment === dept
                                                ? 'bg-purple-600 text-white'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                }`}
                                        >
                                            {dept}
                                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${filterDepartment === dept
                                                ? 'bg-purple-500'
                                                : 'bg-slate-200'
                                                }`}>
                                                {stat?.count || 0}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="min-w-full divide-y divide-slate-100">
                        <thead className="bg-slate-50/50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest">員工</th>
                                <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest">部門</th>
                                <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest">類型</th>
                                <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest">開始時間</th>
                                <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest">結束時間</th>
                                <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest">公務車</th>
                                <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest">事由</th>
                                <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest">狀態</th>
                                <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest">操作</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-50">
                            {filteredRequests.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                                        {requests.length === 0 ? '目前沒有申請記錄' : '沒有符合篩選條件的申請'}
                                    </td>
                                </tr>
                            ) : (
                                filteredRequests.map((request: any) => {
                                    const statusBadge = getStatusBadge(request.status);
                                    return (
                                        <tr key={request.id} className="hover:bg-slate-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                                                {request.employee_name || request.employee?.name || '未知員工'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                                <span className="px-2 py-1 bg-slate-100 rounded text-xs">
                                                    {request.employee?.department || '未分配'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                {request.leave_type ? (
                                                    <div className="flex items-center gap-2">
                                                        <div
                                                            className="w-3 h-3 rounded-full"
                                                            style={{ backgroundColor: request.leave_type.color }}
                                                        />
                                                        <span className="text-slate-700">{request.leave_type.name}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-500">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                                {formatDateTime(request.start_date)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                                {formatDateTime(request.end_date)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                                {request.car ? (
                                                    <span className="flex flex-col">
                                                        <span className="font-black text-blue-600">{request.car.plate_number}</span>
                                                        <span className="text-[10px] text-slate-400 font-bold">{request.car.model}</span>
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-300">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-500 max-w-xs truncate">
                                                {request.reason}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${statusBadge.style}`}>
                                                    {statusBadge.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                {request.status === RequestStatus.PENDING && (
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => handleApprove(request.id)}
                                                            className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 font-medium transition-colors"
                                                        >
                                                            核准
                                                        </button>
                                                        <button
                                                            onClick={() => handleReject(request.id)}
                                                            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 font-medium transition-colors"
                                                        >
                                                            拒絕
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div >
    );
};

export default RequestsPage;

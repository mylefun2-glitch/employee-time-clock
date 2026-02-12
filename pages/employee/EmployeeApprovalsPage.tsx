import React, { useEffect, useState } from 'react';
import { useEmployee } from '../../contexts/EmployeeContext';
import { getPendingApprovalsForSupervisor, getAllSubordinateRequests } from '../../services/supervisorService';
import { requestService } from '../../services/requestService';
import { RequestStatus } from '../../types';
import TableHeaderFilter from '../../components/ui/TableHeaderFilter';

const EmployeeApprovalsPage: React.FC = () => {
    const { employee } = useEmployee();
    const [allRequests, setAllRequests] = useState<any[]>([]);
    const [chairmanRequests, setChairmanRequests] = useState<any[]>([]); // 理事長待審核列表
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');

    // 批量審核相關狀態
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isBatchProcessing, setIsBatchProcessing] = useState(false);

    // 對話框狀態
    const [reviewDialog, setReviewDialog] = useState<{
        show: boolean;
        type: 'approve' | 'reject' | null;
        requestId: string | null;
    }>({ show: false, type: null, requestId: null });

    const [resultDialog, setResultDialog] = useState<{
        show: boolean;
        success: boolean;
        message: string;
    }>({ show: false, success: false, message: '' });

    // 批量操作對話框
    const [batchDialog, setBatchDialog] = useState<{
        show: boolean;
        type: 'approve' | 'reject' | null;
    }>({ show: false, type: null });

    // 批量操作結果對話框
    const [batchResultDialog, setBatchResultDialog] = useState<{
        show: boolean;
        total: number;
        succeeded: number;
        failed: number;
        errors: string[];
    }>({ show: false, total: 0, succeeded: 0, failed: 0, errors: [] });

    // 表格標題篩選狀態
    const [columnFilters, setColumnFilters] = useState<{
        employee: string[];
        department: string[];
        leaveType: string[];
    }>({
        employee: [],
        department: [],
        leaveType: []
    });

    useEffect(() => {
        if (employee && employee.is_supervisor) {
            fetchPendingApprovals();
        }
    }, [employee]);

    const fetchPendingApprovals = async () => {
        if (!employee) return;
        setLoading(true);
        try {
            // 載入所有狀態的下屬申請記錄
            const requests = await getAllSubordinateRequests(employee.id);
            setAllRequests(requests);

            // 如果是理事長，載入等待理事長審核的申請
            if (employee.is_chairman) {
                const chairmanPending = await requestService.getChairmanPendingRequests();
                setChairmanRequests(chairmanPending);
            }

            // 清空選擇狀態
            setSelectedIds(new Set());
        } catch (error) {
            console.error('Error fetching approvals:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleReviewClick = (id: string, type: 'approve' | 'reject') => {
        setReviewDialog({ show: true, type, requestId: id });
    };

    const handleReviewConfirm = async () => {
        if (!employee || !reviewDialog.requestId) return;

        const { type, requestId } = reviewDialog;
        setProcessingId(requestId);
        setReviewDialog({ show: false, type: null, requestId: null });

        try {
            const status = type === 'approve' ? RequestStatus.APPROVED : RequestStatus.REJECTED;
            const result = await requestService.updateRequestStatus(requestId, status, employee.id);

            if (!result.success) throw new Error(result.error);

            setResultDialog({
                show: true,
                success: true,
                message: type === 'approve' ? '該筆請假申請已核准成功' : '已拒絕該筆請假申請'
            });
            fetchPendingApprovals();
        } catch (error: any) {
            console.error('Error updating status:', error);
            setResultDialog({
                show: true,
                success: false,
                message: `操作失敗：${error.message || '未知錯誤'}`
            });
        } finally {
            setProcessingId(null);
        }
    };

    // 批量審核相關函數
    const filteredRequests = allRequests
        .filter(r => filter === 'ALL' || r.status === filter)
        .filter(r => {
            // 應用表格欄位篩選
            const employeeMatch = columnFilters.employee.length === 0 ||
                columnFilters.employee.includes(r.employee?.name || '未知員工');
            const deptMatch = columnFilters.department.length === 0 ||
                columnFilters.department.includes(r.employee?.department || '未分配');
            const leaveTypeMatch = columnFilters.leaveType.length === 0 ||
                columnFilters.leaveType.includes(r.leave_type?.name || '請假');
            return employeeMatch && deptMatch && leaveTypeMatch;
        });
    const pendingRequests = allRequests.filter(r => r.status === 'PENDING');

    const toggleSelectAll = () => {
        if (selectedIds.size === pendingRequests.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(pendingRequests.map(r => r.id)));
        }
    };

    const toggleSelectItem = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const handleBatchAction = (type: 'approve' | 'reject') => {
        if (selectedIds.size === 0) return;
        setBatchDialog({ show: true, type });
    };

    const handleBatchConfirm = async () => {
        if (!employee || !batchDialog.type || selectedIds.size === 0) return;

        setBatchDialog({ show: false, type: null });
        setIsBatchProcessing(true);

        try {
            const status = batchDialog.type === 'approve' ? RequestStatus.APPROVED : RequestStatus.REJECTED;
            const result = await requestService.batchUpdateRequestStatus(
                Array.from(selectedIds),
                status,
                employee.id
            );

            setBatchResultDialog({
                show: true,
                total: result.total,
                succeeded: result.succeeded,
                failed: result.failed,
                errors: result.errors
            });

            // 重新載入列表
            await fetchPendingApprovals();
        } catch (error: any) {
            console.error('Error in batch operation:', error);
            setBatchResultDialog({
                show: true,
                total: selectedIds.size,
                succeeded: 0,
                failed: selectedIds.size,
                errors: ['批量操作失敗: ' + (error.message || '未知錯誤')]
            });
        } finally {
            setIsBatchProcessing(false);
        }
    };

    if (!employee?.is_supervisor) {
        return (
            <div className="flex flex-col items-center justify-center py-32 px-4 animate-in fade-in duration-500">
                <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                    <span className="material-symbols-outlined text-slate-200 text-6xl font-light">gpp_maybe</span>
                </div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">無審核權限</h2>
                <p className="text-slate-500 font-bold mt-2 text-center max-w-sm">您目前不是主管職,無法查看此頁面內容。如有疑問請聯繫管理者。</p>
            </div>
        );
    }

    if (loading) {
        return <div className="p-4 text-center font-bold text-slate-400 py-20">載入中...</div>;
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">請假審核</h1>
                <p className="text-slate-500 text-sm font-medium mt-1">目前有 <span className="text-blue-600 font-black">{allRequests.filter(r => r.status === 'PENDING').length}</span> 筆待處理申請</p>
            </div>

            {/* 理事長審核區塊 */}
            {employee?.is_chairman && chairmanRequests.length > 0 && (
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border-2 border-amber-200 p-6 shadow-lg">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-200">
                            <span className="material-symbols-outlined text-white text-2xl">admin_panel_settings</span>
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-amber-900">等待理事長審核</h2>
                            <p className="text-sm font-medium text-amber-700">
                                有 <span className="font-black">{chairmanRequests.length}</span> 筆申請需要您的核准
                            </p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {chairmanRequests.map((request) => (
                            <div key={request.id} className="bg-white rounded-xl p-4 border border-amber-100 hover:shadow-md transition-shadow">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">員工</p>
                                            <p className="text-sm font-bold text-slate-900">{request.employee?.name}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">假別</p>
                                            <p className="text-sm font-bold text-slate-700">{request.leave_type?.name}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">期間</p>
                                            <p className="text-xs font-medium text-slate-600">
                                                {new Date(request.start_date).toLocaleDateString('zh-TW')} - {new Date(request.end_date).toLocaleDateString('zh-TW')}
                                            </p>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-1.5">
                                                <span className={`w-2 h-2 bg-emerald-500 rounded-full`}></span>
                                                <span className="text-xs font-bold text-emerald-600">已核准</span>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">附件</p>
                                            {request.attachment_url ? (
                                                <a
                                                    href={request.attachment_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-bold text-xs"
                                                >
                                                    <span className="material-symbols-outlined text-sm">attach_file</span>
                                                    查看
                                                </a>
                                            ) : (
                                                <span className="text-xs text-slate-300">-</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                        <button
                                            onClick={() => handleReviewClick(request.id, 'reject')}
                                            className="px-4 py-2 bg-rose-50 text-rose-600 rounded-lg text-xs font-black hover:bg-rose-100 transition-all"
                                        >
                                            拒絕
                                        </button>
                                        <button
                                            onClick={() => handleReviewClick(request.id, 'approve')}
                                            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-black hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                                        >
                                            核准
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

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
                        {status === 'ALL' ? '全部申請' : status === 'PENDING' ? '待審核' : status === 'APPROVED' ? '已核准' : '已拒絕'}
                        <span className={`ml-2 px-2 py-0.5 rounded-lg text-[10px] transition-colors ${filter === status
                            ? 'bg-slate-700 text-slate-200'
                            : 'bg-slate-100 text-slate-500'
                            }`}>
                            {status === 'ALL' ? allRequests.length : allRequests.filter(r => r.status === status).length}
                        </span>
                    </button>
                ))}
            </div>

            {/* 批量操作工具列 */}
            {pendingRequests.length > 0 && filter === 'PENDING' && (
                <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                    {/* 全選 Checkbox */}
                    <label className="flex items-center gap-3 cursor-pointer group">
                        <input
                            type="checkbox"
                            checked={selectedIds.size === pendingRequests.length && pendingRequests.length > 0}
                            onChange={toggleSelectAll}
                            className="w-5 h-5 rounded border-2 border-slate-300 checked:bg-blue-600 checked:border-blue-600 cursor-pointer transition-all"
                        />
                        <span className="text-sm font-black text-slate-700 group-hover:text-blue-600 transition-colors">
                            {selectedIds.size === pendingRequests.length && pendingRequests.length > 0 ? '取消全選' : '全選'}
                        </span>
                    </label>

                    {/* 已選擇數量 */}
                    {selectedIds.size > 0 && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-xl border border-blue-100">
                            <span className="material-symbols-outlined text-blue-600 text-lg">check_circle</span>
                            <span className="text-sm font-black text-blue-700">已選擇 {selectedIds.size} 筆</span>
                        </div>
                    )}

                    <div className="flex-1"></div>

                    {/* 批量操作按鈕 */}
                    <div className="flex gap-3">
                        <button
                            onClick={() => handleBatchAction('approve')}
                            disabled={selectedIds.size === 0 || isBatchProcessing}
                            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl text-sm font-black hover:bg-emerald-700 shadow-lg shadow-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
                        >
                            <span className="material-symbols-outlined text-lg">verified</span>
                            批量核准
                        </button>
                        <button
                            onClick={() => handleBatchAction('reject')}
                            disabled={selectedIds.size === 0 || isBatchProcessing}
                            className="flex items-center gap-2 px-6 py-3 bg-white text-rose-600 border-2 border-rose-200 rounded-xl text-sm font-black hover:bg-rose-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
                        >
                            <span className="material-symbols-outlined text-lg">cancel</span>
                            批量拒絕
                        </button>
                    </div>
                </div>
            )}

            {/* Requests Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {filteredRequests.length === 0 ? (
                    <div className="py-20 text-center">
                        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="material-symbols-outlined text-emerald-300 text-5xl">verified</span>
                        </div>
                        <h3 className="text-xl font-black text-slate-900 tracking-tight">工作已全部處理完畢</h3>
                        <p className="text-slate-500 font-bold mt-2">目前沒有任何待審核的請假申請事項。</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50 border-b border-slate-100">
                                <tr>
                                    {filter === 'PENDING' && (
                                        <th className="px-4 py-3 text-left w-12"></th>
                                    )}
                                    <TableHeaderFilter
                                        columnKey="employee"
                                        label="員工"
                                        values={allRequests.map(r => r.employee?.name || '未知員工')}
                                        selectedValues={columnFilters.employee}
                                        onChange={(values) => setColumnFilters({ ...columnFilters, employee: values })}
                                    />
                                    <TableHeaderFilter
                                        columnKey="department"
                                        label="部門"
                                        values={allRequests.map(r => r.employee?.department || '未分配')}
                                        selectedValues={columnFilters.department}
                                        onChange={(values) => setColumnFilters({ ...columnFilters, department: values })}
                                    />
                                    <TableHeaderFilter
                                        columnKey="leaveType"
                                        label="假別"
                                        values={allRequests.map(r => r.leave_type?.name || '請假')}
                                        selectedValues={columnFilters.leaveType}
                                        onChange={(values) => setColumnFilters({ ...columnFilters, leaveType: values })}
                                    />
                                    <th className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider">開始日期</th>
                                    <th className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider">結束日期</th>
                                    <th className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider">事由</th>
                                    <th className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider">附件</th>
                                    <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-wider text-right">審核</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredRequests.map((request) => {
                                    const isProcessing = processingId === request.id;
                                    const isSelected = selectedIds.has(request.id);

                                    return (
                                        <tr
                                            key={request.id}
                                            className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-blue-50' : ''}`}
                                        >
                                            {filter === 'PENDING' && (
                                                <td className="px-4 py-4">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleSelectItem(request.id)}
                                                        className="w-5 h-5 rounded border-2 border-slate-300 checked:bg-blue-600 checked:border-blue-600 cursor-pointer transition-all"
                                                    />
                                                </td>
                                            )}
                                            <td className="px-4 py-4">
                                                <div className="font-bold text-slate-900">{request.employee?.name || '未知員工'}</div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="text-sm text-slate-600 font-medium">{request.employee?.department || '未分配'}</div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="text-sm font-bold text-slate-700">{request.leave_type?.name || '請假'}</div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="text-sm font-mono text-slate-700">
                                                    <div>{new Date(request.start_date).toLocaleDateString('zh-TW')}</div>
                                                    <div className="text-xs text-slate-500">{new Date(request.start_date).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}</div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="text-sm font-mono text-slate-700">
                                                    <div>{new Date(request.end_date).toLocaleDateString('zh-TW')}</div>
                                                    <div className="text-xs text-slate-500">{new Date(request.end_date).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}</div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 max-w-xs">
                                                <div className="text-sm text-slate-600 truncate" title={request.reason}>{request.reason || '-'}</div>
                                            </td>
                                            <td className="px-4 py-4">
                                                {request.attachment_url ? (
                                                    <a
                                                        href={request.attachment_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-bold text-xs"
                                                    >
                                                        <span className="material-symbols-outlined text-sm">attach_file</span>
                                                        查看
                                                    </a>
                                                ) : (
                                                    <span className="text-xs text-slate-300">-</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                <div className="flex items-center justify-end gap-6">
                                                    {/* 狀態顯示 (僅在需要理事長審核時顯示進度) */}
                                                    {request.requires_chairman_approval && (
                                                        <div className="flex flex-col items-end">
                                                            <div className="flex flex-col gap-1">
                                                                <div className="flex items-center gap-1.5 justify-end">
                                                                    <span className={`w-2 h-2 rounded-full ${request.supervisor_approved_at ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                                                                    <span className="text-xs font-bold text-slate-600">主管</span>
                                                                </div>
                                                                <div className="flex items-center gap-1.5 justify-end">
                                                                    <span className={`w-2 h-2 rounded-full ${request.chairman_approved_at ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                                                                    <span className="text-xs font-bold text-slate-600">理事長</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* 操作按鈕 (僅在 PENDING 且有權限時顯示) */}
                                                    {filter === 'PENDING' && (
                                                        <div className={`flex items-center gap-2 ${request.requires_chairman_approval ? 'border-l border-slate-100 pl-6' : ''}`}>
                                                            <button
                                                                onClick={() => handleReviewClick(request.id, 'reject')}
                                                                disabled={isProcessing}
                                                                className="px-4 py-2 bg-rose-50 text-rose-600 rounded-lg text-xs font-black hover:bg-rose-100 transition-all disabled:opacity-50"
                                                            >
                                                                拒絕
                                                            </button>
                                                            <button
                                                                onClick={() => handleReviewClick(request.id, 'approve')}
                                                                disabled={isProcessing}
                                                                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-black hover:bg-emerald-700 transition-all disabled:opacity-50 shadow-lg shadow-emerald-100"
                                                            >
                                                                {isProcessing ? '...' : '核准'}
                                                            </button>
                                                        </div>
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

            {/* 審核確認對話框 */}
            {reviewDialog.show && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-sm w-full p-8 animate-in zoom-in-95 duration-300 text-center">
                        <div className={`w-20 h-20 ${reviewDialog.type === 'approve' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'} rounded-3xl flex items-center justify-center mx-auto mb-6`}>
                            <span className="material-symbols-outlined text-4xl">
                                {reviewDialog.type === 'approve' ? 'verified' : 'help'}
                            </span>
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 mb-2">
                            {reviewDialog.type === 'approve' ? '確認核准？' : '確認拒絕？'}
                        </h2>
                        <p className="text-slate-500 font-bold mb-8 px-4">
                            您確定要執行此審核操作嗎？完成後將無法取消。
                        </p>
                        <div className="flex gap-4">
                            <button
                                onClick={() => setReviewDialog({ show: false, type: null, requestId: null })}
                                className="flex-1 py-4 bg-slate-50 text-slate-500 rounded-2xl font-black transition-all hover:bg-slate-100"
                            >
                                我再想想
                            </button>
                            <button
                                onClick={handleReviewConfirm}
                                className={`flex-1 py-4 rounded-2xl font-black text-white shadow-xl transition-all active:scale-95 ${reviewDialog.type === 'approve' ? 'bg-emerald-600 shadow-emerald-100' : 'bg-rose-600 shadow-rose-100'
                                    }`}
                            >
                                確定執行
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 批量操作確認對話框 */}
            {batchDialog.show && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95 duration-300">
                        <div className={`w-20 h-20 ${batchDialog.type === 'approve' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'} rounded-3xl flex items-center justify-center mx-auto mb-6`}>
                            <span className="material-symbols-outlined text-4xl">
                                {batchDialog.type === 'approve' ? 'verified' : 'help'}
                            </span>
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 mb-2 text-center">
                            {batchDialog.type === 'approve' ? '批量核准確認' : '批量拒絕確認'}
                        </h2>
                        <p className="text-slate-500 font-bold mb-6 text-center px-4">
                            您即將 {batchDialog.type === 'approve' ? '核准' : '拒絕'} <span className="text-blue-600 font-black">{selectedIds.size}</span> 筆請假申請
                        </p>

                        {/* 顯示選中的員工 */}
                        <div className="bg-slate-50 rounded-2xl p-4 mb-6 max-h-48 overflow-y-auto">
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">申請人員</p>
                            <div className="space-y-2">
                                {pendingRequests
                                    .filter(r => selectedIds.has(r.id))
                                    .map(r => (
                                        <div key={r.id} className="flex items-center gap-2 text-sm">
                                            <span className="material-symbols-outlined text-slate-400 text-base">person</span>
                                            <span className="font-bold text-slate-700">{r.employee?.name}</span>
                                            <span className="text-slate-400">-</span>
                                            <span className="text-slate-500 text-xs">{r.leave_type?.name}</span>
                                        </div>
                                    ))
                                }
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={() => setBatchDialog({ show: false, type: null })}
                                className="flex-1 py-4 bg-slate-50 text-slate-500 rounded-2xl font-black transition-all hover:bg-slate-100"
                            >
                                我再想想
                            </button>
                            <button
                                onClick={handleBatchConfirm}
                                className={`flex-1 py-4 rounded-2xl font-black text-white shadow-xl transition-all active:scale-95 ${batchDialog.type === 'approve'
                                    ? 'bg-emerald-600 shadow-emerald-100'
                                    : 'bg-rose-600 shadow-rose-100'
                                    }`}
                            >
                                確定執行
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 批量操作結果對話框 */}
            {batchResultDialog.show && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95 duration-300">
                        <div className={`w-20 h-20 ${batchResultDialog.failed === 0
                            ? 'bg-emerald-100 text-emerald-600'
                            : batchResultDialog.succeeded === 0
                                ? 'bg-rose-100 text-rose-600'
                                : 'bg-amber-100 text-amber-600'
                            } rounded-3xl flex items-center justify-center mx-auto mb-6`}>
                            <span className="material-symbols-outlined text-4xl">
                                {batchResultDialog.failed === 0 ? 'check_circle' : batchResultDialog.succeeded === 0 ? 'error' : 'warning'}
                            </span>
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 mb-2 text-center">
                            批量操作完成
                        </h2>

                        {/* 統計資訊 */}
                        <div className="bg-slate-50 rounded-2xl p-6 mb-6">
                            <div className="grid grid-cols-3 gap-4 text-center">
                                <div>
                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">總數</p>
                                    <p className="text-2xl font-black text-slate-900">{batchResultDialog.total}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-black text-emerald-400 uppercase tracking-widest mb-1">成功</p>
                                    <p className="text-2xl font-black text-emerald-600">{batchResultDialog.succeeded}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-black text-rose-400 uppercase tracking-widest mb-1">失敗</p>
                                    <p className="text-2xl font-black text-rose-600">{batchResultDialog.failed}</p>
                                </div>
                            </div>
                        </div>

                        {/* 錯誤訊息 */}
                        {batchResultDialog.errors.length > 0 && (
                            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 mb-6 max-h-48 overflow-y-auto">
                                <p className="text-xs font-black text-rose-600 uppercase tracking-widest mb-2">錯誤詳情</p>
                                <div className="space-y-1">
                                    {batchResultDialog.errors.map((err, idx) => (
                                        <p key={idx} className="text-xs text-rose-700 font-medium">{err}</p>
                                    ))}
                                </div>
                            </div>
                        )}

                        <button
                            onClick={() => setBatchResultDialog({ show: false, total: 0, succeeded: 0, failed: 0, errors: [] })}
                            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black shadow-xl shadow-slate-200 transition-all active:scale-95"
                        >
                            我了解了
                        </button>
                    </div>
                </div>
            )}

            {/* 結果提示對話框 */}
            {resultDialog.show && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-sm w-full p-8 animate-in zoom-in-95 duration-300 text-center">
                        <div className={`w-20 h-20 ${resultDialog.success ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'} rounded-3xl flex items-center justify-center mx-auto mb-6`}>
                            <span className="material-symbols-outlined text-4xl">
                                {resultDialog.success ? 'check_circle' : 'error'}
                            </span>
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 mb-2">
                            {resultDialog.success ? '處理成功' : '操作失敗'}
                        </h2>
                        <p className="text-slate-500 font-bold mb-8 px-4">{resultDialog.message}</p>
                        <button
                            onClick={() => setResultDialog({ show: false, success: false, message: '' })}
                            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black shadow-xl shadow-slate-200 transition-all active:scale-95"
                        >
                            我了解了
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmployeeApprovalsPage;

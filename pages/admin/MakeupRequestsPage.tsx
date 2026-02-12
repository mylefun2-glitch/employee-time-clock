import React, { useEffect, useState } from 'react';
import { getMakeupRequests, batchApproveMakeupRequests, batchRejectMakeupRequests, approveMakeupRequest, rejectMakeupRequest } from '../../services/admin';
import { useEmployee } from '../../contexts/EmployeeContext';
import { useAuth } from '../../contexts/AuthContext';
import TableHeaderFilter from '../../components/ui/TableHeaderFilter';

const MakeupRequestsPage: React.FC = () => {
    const { employee } = useEmployee();
    const { user } = useAuth();
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
    const [processingId, setProcessingId] = useState<string | null>(null);

    // 批量審核相關狀態
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isBatchProcessing, setIsBatchProcessing] = useState(false);

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

    // 批量操作對話框
    const [batchDialog, setBatchDialog] = useState<{
        show: boolean;
        type: 'approve' | 'reject' | null;
        comment: string;
    }>({ show: false, type: null, comment: '' });

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
        checkType: string[];
    }>({
        employee: [],
        department: [],
        checkType: []
    });

    const isAdminMode = !employee && !!user;

    useEffect(() => {
        fetchRequests();
    }, [filter, employee, user, columnFilters]);

    const fetchRequests = async () => {
        if (!employee && !user) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const managerId = isAdminMode ? undefined : employee?.id;
            const data = await getMakeupRequests(filter, managerId);
            const allRequests = data || [];

            // 應用表格欄位篩選
            const filtered = allRequests.filter((req: any) => {
                const employeeMatch = columnFilters.employee.length === 0 ||
                    columnFilters.employee.includes(req.employee?.name || '未知');
                const deptMatch = columnFilters.department.length === 0 ||
                    columnFilters.department.includes(req.employee?.department || '未分配');
                const typeMatch = columnFilters.checkType.length === 0 ||
                    columnFilters.checkType.includes(req.check_type === 'IN' ? '上班' : '下班');
                return employeeMatch && deptMatch && typeMatch;
            });

            setRequests(filtered);
            setSelectedIds(new Set());
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

    // 批量審核相關函數
    const toggleSelectAll = () => {
        const pendingRequests = requests.filter(r => r.status === 'PENDING');
        if (selectedIds.size === pendingRequests.length && pendingRequests.length > 0) {
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
        setBatchDialog({ show: true, type, comment: '' });
    };

    const handleBatchConfirm = async () => {
        const activeReviewerId = employee?.id || user?.id;
        if (!activeReviewerId || !batchDialog.type || selectedIds.size === 0) return;

        if (batchDialog.type === 'reject' && !batchDialog.comment.trim()) {
            setResultDialog({
                show: true,
                success: false,
                message: '批量拒絕必須提供拒絕原因'
            });
            return;
        }

        setBatchDialog({ show: false, type: null, comment: '' });
        setIsBatchProcessing(true);

        try {
            const result = batchDialog.type === 'approve'
                ? await batchApproveMakeupRequests(
                    Array.from(selectedIds),
                    activeReviewerId,
                    batchDialog.comment || undefined
                )
                : await batchRejectMakeupRequests(
                    Array.from(selectedIds),
                    activeReviewerId,
                    batchDialog.comment
                );

            setBatchResultDialog({
                show: true,
                total: result.total,
                succeeded: result.succeeded,
                failed: result.failed,
                errors: result.errors
            });

            await fetchRequests();
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
            ? { icon: 'login', color: 'text-emerald-600', bg: 'bg-emerald-50', label: '上班' }
            : { icon: 'logout', color: 'text-orange-600', bg: 'bg-orange-50', label: '下班' };
    };

    const stats = [
        { label: '待審核', value: requests.filter(r => r.status === 'PENDING').length, color: 'bg-amber-500', icon: 'pending' },
        { label: '已核准', value: requests.filter(r => r.status === 'APPROVED').length, color: 'bg-emerald-500', icon: 'check_circle' },
        { label: '已拒絕', value: requests.filter(r => r.status === 'REJECTED').length, color: 'bg-rose-500', icon: 'cancel' }
    ];

    const pendingRequests = requests.filter(r => r.status === 'PENDING');

    if (loading) {
        return <div className="p-4 text-center font-bold text-slate-400 py-20">載入中...</div>;
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                    {isAdminMode ? '全公司補登審核' : '補登審核'}
                </h1>
                <p className="text-slate-500 text-sm font-medium mt-1">
                    {isAdminMode ? '管理全公司的漏卡補登申請' : '審核漏卡補登申請'}
                </p>
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
                        {status === 'ALL' ? '全部' : getStatusInfo(status).text}
                        <span className={`ml-2 px-2 py-0.5 rounded-lg text-[10px] transition-colors ${filter === status
                            ? 'bg-slate-700 text-slate-200'
                            : 'bg-slate-100 text-slate-500'
                            }`}>
                            {status === 'ALL' ? requests.length : requests.filter(r => r.status === status).length}
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
                {requests.length === 0 ? (
                    <div className="py-20 text-center">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="material-symbols-outlined text-slate-200 text-5xl font-light">folder_off</span>
                        </div>
                        <p className="text-slate-400 font-black tracking-wider">尚無相關申請記錄</p>
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
                                        values={requests.map((r: any) => r.employee?.name || '未知')}
                                        selectedValues={columnFilters.employee}
                                        onChange={(values) => setColumnFilters({ ...columnFilters, employee: values })}
                                    />
                                    <TableHeaderFilter
                                        columnKey="department"
                                        label="部門"
                                        values={requests.map((r: any) => r.employee?.department || '未分配')}
                                        selectedValues={columnFilters.department}
                                        onChange={(values) => setColumnFilters({ ...columnFilters, department: values })}
                                    />
                                    <th className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider">補登日期</th>
                                    <th className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider">時間</th>
                                    <TableHeaderFilter
                                        columnKey="checkType"
                                        label="類型"
                                        values={requests.map((r: any) => r.check_type === 'IN' ? '上班' : '下班')}
                                        selectedValues={columnFilters.checkType}
                                        onChange={(values) => setColumnFilters({ ...columnFilters, checkType: values })}
                                    />
                                    <th className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider">原因</th>
                                    <th className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider">狀態</th>
                                    {filter === 'PENDING' && (
                                        <th className="px-4 py-3 text-right text-xs font-black text-slate-500 uppercase tracking-wider">操作</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {requests.map((request) => {
                                    const statusInfo = getStatusInfo(request.status);
                                    const typeInfo = getTypeIcon(request.check_type);
                                    const isPending = request.status === 'PENDING';
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
                                                <div className="font-bold text-slate-900">{request.employee?.name || '未知'}</div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="text-sm text-slate-600 font-medium">{request.employee?.department || '未分配'}</div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="text-sm font-mono text-slate-700">{new Date(request.request_date).toLocaleDateString('zh-TW')}</div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="text-sm font-mono font-bold text-slate-900">{request.request_time}</div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg ${typeInfo.bg}`}>
                                                    <span className={`material-symbols-outlined text-sm ${typeInfo.color}`}>{typeInfo.icon}</span>
                                                    <span className={`text-xs font-black ${typeInfo.color}`}>{typeInfo.label}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 max-w-xs">
                                                <div className="text-sm text-slate-600 truncate" title={request.reason}>{request.reason}</div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <span className={`inline-block px-3 py-1 text-xs font-black rounded-lg border ${statusInfo.class}`}>
                                                    {statusInfo.text}
                                                </span>
                                            </td>
                                            {filter === 'PENDING' && (
                                                <td className="px-4 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => handleReject(request.id)}
                                                            disabled={isProcessing}
                                                            className="px-4 py-2 bg-rose-50 text-rose-600 rounded-lg text-xs font-black hover:bg-rose-100 transition-all disabled:opacity-50"
                                                        >
                                                            拒絕
                                                        </button>
                                                        <button
                                                            onClick={() => handleApprove(request.id)}
                                                            disabled={isProcessing}
                                                            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-black hover:bg-emerald-700 transition-all disabled:opacity-50"
                                                        >
                                                            {isProcessing ? '...' : '核准'}
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* 單筆審核對話框 */}
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
                                    取消
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
                            您即將 {batchDialog.type === 'approve' ? '核准' : '拒絕'} <span className="text-blue-600 font-black">{selectedIds.size}</span> 筆補登申請
                        </p>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">
                                    {batchDialog.type === 'approve' ? '批量備註（選填）' : '批量拒絕原因（必填）'}
                                </label>
                                <textarea
                                    autoFocus
                                    value={batchDialog.comment}
                                    onChange={(e) => setBatchDialog({ ...batchDialog, comment: e.target.value })}
                                    placeholder={batchDialog.type === 'approve' ? '輸入批量備註...' : '請輸入批量拒絕原因...'}
                                    rows={4}
                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all resize-none font-bold text-slate-700 placeholder:text-slate-300"
                                />
                            </div>

                            <div className="flex gap-4">
                                <button
                                    onClick={() => setBatchDialog({ show: false, type: null, comment: '' })}
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

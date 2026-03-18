import React, { useEffect, useState } from 'react';
import { useEmployee } from '../../contexts/EmployeeContext';
import { getPendingApprovalsForSupervisor, getAllSubordinateRequests } from '../../services/supervisorService';
import { requestService } from '../../services/requestService';
import { getMakeupRequests, approveMakeupRequest, rejectMakeupRequest, batchApproveMakeupRequests, batchRejectMakeupRequests } from '../../services/admin';
import { RequestStatus } from '../../types';
import TableHeaderFilter from '../../components/ui/TableHeaderFilter';
import { formatDateTimeRange } from '../../lib/hrUtils';

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
        leaveType: string[];
    }>({
        employee: [],
        department: [],
        leaveType: []
    });

    // 互動模式相關狀態
    const [selectionMode, setSelectionMode] = useState(false);
    const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
    const [isLongPress, setIsLongPress] = useState(false);
    const [showActionMenu, setShowActionMenu] = useState(false);
    const [actionMenuRequest, setActionMenuRequest] = useState<any | null>(null);

    useEffect(() => {
        if (employee && employee.is_supervisor) {
            fetchPendingApprovals();
        }
    }, [employee]);

    const fetchPendingApprovals = async () => {
        if (!employee) return;
        setLoading(true);
        try {
            // 載入所有狀態的下屬請假申請記錄
            const requests = await getAllSubordinateRequests(employee.id);
            const formattedLeaveRequests = requests.map(r => ({ ...r, __type: 'LEAVE' }));

            // 載入所有狀態的下屬補登申請記錄
            const makeupRequests = await getMakeupRequests('ALL', employee.id);
            const formattedMakeupRequests = (makeupRequests || []).map((r: any) => ({ ...r, __type: 'MAKEUP' }));

            // 標記並合併
            const allUnifiedRequests = [...formattedLeaveRequests, ...formattedMakeupRequests].sort(
                (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );

            setAllRequests(allUnifiedRequests);

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
        setReviewDialog({ show: true, type, requestId: id, comment: '' });
    };

    const handleReviewConfirm = async () => {
        if (!employee || !reviewDialog.requestId) return;

        const { type, requestId, comment } = reviewDialog;
        setProcessingId(requestId);
        setReviewDialog({ show: false, type: null, requestId: null, comment: '' });

        try {
            const request = allRequests.find(r => r.id === requestId);
            let result;

            if (request?.__type === 'LEAVE') {
                const status = type === 'approve' ? RequestStatus.APPROVED : RequestStatus.REJECTED;
                result = await requestService.updateRequestStatus(requestId, status, employee.id);
            } else {
                if (type === 'approve') {
                    result = await approveMakeupRequest(requestId, employee.id, comment);
                } else {
                    result = await rejectMakeupRequest(requestId, employee.id, comment);
                }
            }

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

    const getStatusInfo = (status: string) => {
        const statuses = {
            PENDING: { text: '待審核', class: 'bg-amber-50 text-amber-700 border-amber-200', icon: 'pending' },
            APPROVED: { text: '已核准', class: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'check_circle' },
            REJECTED: { text: '已拒絕', class: 'bg-rose-50 text-rose-700 border-rose-200', icon: 'cancel' },
            WITHDRAWN: { text: '已撤回', class: 'bg-slate-50 text-slate-600 border-slate-200', icon: 'block' },
            WITHDRAW_PENDING: { text: '撤回待審', class: 'bg-orange-50 text-orange-700 border-orange-200', icon: 'pending' }
        };
        return statuses[status as keyof typeof statuses] || statuses.PENDING;
    };

    // 批量審核相關函數
    const activeRequests = allRequests.filter(r => r.status !== RequestStatus.WITHDRAWN && !r.is_modified);
    const filteredRequests = activeRequests
        .filter(r => {
            if (filter === 'ALL') {
                return r.status === RequestStatus.APPROVED || r.status === RequestStatus.REJECTED;
            }
            if (filter === 'PENDING') {
                return r.status === 'PENDING' || r.status === 'WITHDRAW_PENDING';
            }
            return r.status === filter;
        })
        .filter(r => {
            // 應用表格欄位篩選 (加上 trim 確保比對精確)
            const empName = (r.employee?.name || '未知員工').trim();
            const deptName = (r.employee?.department || '未分配').trim();
            const typeName = (r.__type === 'MAKEUP' ? `補登(${r.check_type === 'IN' ? '上班' : '下班'})` : (r.leave_type?.name || '請假')).trim();

            const employeeMatch = columnFilters.employee.length === 0 ||
                columnFilters.employee.map(v => v.trim()).includes(empName);
            const deptMatch = columnFilters.department.length === 0 ||
                columnFilters.department.map(v => v.trim()).includes(deptName);
            const leaveTypeMatch = columnFilters.leaveType.length === 0 ||
                columnFilters.leaveType.map(v => v.trim()).includes(typeName);
            return employeeMatch && deptMatch && leaveTypeMatch;
        });
    const pendingRequests = activeRequests.filter(r => r.status === 'PENDING' || r.status === 'WITHDRAW_PENDING');

    const handleLongPressStart = (requestId: string, request: any) => {
        // 只有在待審核標籤下且未進入選擇模式時才處理長按
        if (selectionMode || filter !== 'PENDING') return;

        setIsLongPress(false);
        const timer = setTimeout(() => {
            // 標記為長按並進入選擇模式
            setIsLongPress(true);
            setSelectionMode(true);
            setSelectedIds(new Set([requestId]));
        }, 500); // 500ms 觸發長按
        setLongPressTimer(timer);
    };

    const handleLongPressEnd = () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            setLongPressTimer(null);
        }
    };

    const handleRowClick = (request: any) => {
        // 如果是長按產生的 mouseup，或者是處於選擇模式，則不顯示操作選單
        if (isLongPress || selectionMode) {
            setIsLongPress(false);
            return;
        }

        // 只有 Pending 狀態才顯示審核選單
        if (filter !== 'PENDING') return;

        setActionMenuRequest(request);
        setShowActionMenu(true);
    };

    const handleBatchConfirm = async () => {
        if (!employee || !batchDialog.type || selectedIds.size === 0) return;

        const { type, comment } = batchDialog;

        setBatchDialog({ show: false, type: null, comment: '' });
        setIsBatchProcessing(true);

        try {
            const leaveIds: string[] = [];
            const makeupIds: string[] = [];

            selectedIds.forEach(id => {
                const req = allRequests.find(r => r.id === id);
                if (req?.__type === 'LEAVE') leaveIds.push(id);
                else if (req?.__type === 'MAKEUP') makeupIds.push(id);
            });

            let totalSucceeded = 0;
            let totalFailed = 0;
            const errors: string[] = [];

            if (leaveIds.length > 0) {
                const status = type === 'approve' ? RequestStatus.APPROVED : RequestStatus.REJECTED;
                const result = await requestService.batchUpdateRequestStatus(
                    leaveIds,
                    status,
                    employee.id
                );
                totalSucceeded += result.succeeded;
                totalFailed += result.failed;
                if (result.errors) errors.push(...result.errors);
            }

            if (makeupIds.length > 0) {
                let result;
                if (type === 'approve') {
                    result = await batchApproveMakeupRequests(makeupIds, employee.id, comment);
                } else {
                    result = await batchRejectMakeupRequests(makeupIds, employee.id, comment);
                }
                totalSucceeded += result.succeeded;
                totalFailed += result.failed;
                if (result.errors) errors.push(...result.errors);
            }

            setBatchResultDialog({
                show: true,
                total: selectedIds.size,
                succeeded: totalSucceeded,
                failed: totalFailed,
                errors
            });

            // 重新載入列表
            await fetchPendingApprovals();
            // 退出選擇模式
            exitSelectionMode();
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

    const exitSelectionMode = () => {
        setSelectionMode(false);
        setSelectedIds(new Set());
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
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">審核差勤</h1>
                <p className="text-slate-500 text-sm font-medium mt-1">目前有 <span className="text-blue-600 font-black">{allRequests.filter(r => r.status === 'PENDING' || r.status === 'WITHDRAW_PENDING').length}</span> 筆待處理申請</p>
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
                                                {formatDateTimeRange(request.start_date, request.end_date)}
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
                            {status === 'ALL'
                                ? activeRequests.filter(r => r.status === RequestStatus.APPROVED || r.status === RequestStatus.REJECTED).length
                                : status === 'PENDING'
                                    ? activeRequests.filter(r => r.status === 'PENDING' || r.status === 'WITHDRAW_PENDING').length
                                    : activeRequests.filter(r => r.status === status).length}
                        </span>
                    </button>
                ))}
            </div>

            {/* 批量操作工具列 */}
            {selectionMode && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center gap-4 animate-in slide-in-from-top-4 duration-300">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-blue-600">check_circle</span>
                            <span className="font-bold text-slate-900">選擇模式</span>
                        </div>
                        <div className="h-4 w-px bg-blue-200 hidden sm:block"></div>
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={selectedIds.size === pendingRequests.length && pendingRequests.length > 0}
                                onChange={() => {
                                    if (selectedIds.size === pendingRequests.length) {
                                        setSelectedIds(new Set());
                                    } else {
                                        setSelectedIds(new Set(pendingRequests.map(r => r.id)));
                                    }
                                }}
                                className="w-5 h-5 rounded border-2 border-slate-300 checked:bg-blue-600 checked:border-blue-600 cursor-pointer transition-all"
                            />
                            <span className="text-sm font-black text-slate-700 group-hover:text-blue-600 transition-colors">
                                全選 ({selectedIds.size}/{pendingRequests.length})
                            </span>
                        </label>
                    </div>

                    <div className="flex-1"></div>

                    <div className="flex gap-3">
                        <button
                            onClick={() => {
                                if (selectedIds.size === 0) return;
                                setBatchDialog({ show: true, type: 'approve', comment: '' });
                            }}
                            disabled={selectedIds.size === 0 || isBatchProcessing}
                            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl text-sm font-black hover:bg-emerald-700 shadow-lg shadow-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
                        >
                            批量核准
                        </button>
                        <button
                            onClick={() => {
                                if (selectedIds.size === 0) return;
                                setBatchDialog({ show: true, type: 'reject', comment: '' });
                            }}
                            disabled={selectedIds.size === 0 || isBatchProcessing}
                            className="flex items-center gap-2 px-6 py-3 bg-white text-rose-600 border-2 border-rose-200 rounded-xl text-sm font-black hover:bg-rose-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
                        >
                            批量拒絕
                        </button>
                        <button
                            onClick={exitSelectionMode}
                            className="px-6 py-3 bg-white text-slate-600 border border-slate-200 rounded-xl text-sm font-black hover:bg-slate-50 transition-all"
                        >
                            完成
                        </button>
                    </div>
                </div>
            )}

            {/* Requests Table */}
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm relative">
                {filteredRequests.length === 0 ? (
                    <div className="py-20 text-center">
                        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="material-symbols-outlined text-emerald-300 text-5xl">verified</span>
                        </div>
                        <h3 className="text-xl font-black text-slate-900 tracking-tight">工作已全部處理完畢</h3>
                        <p className="text-slate-500 font-bold mt-2">目前沒有任何待審核的差勤申請事項。</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50 border-b border-slate-100">
                                <tr>
                                    {selectionMode && (
                                        <th className="px-4 py-3 text-left w-12">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.size === pendingRequests.length && pendingRequests.length > 0}
                                                onChange={() => {
                                                    if (selectedIds.size === pendingRequests.length) {
                                                        setSelectedIds(new Set());
                                                    } else {
                                                        setSelectedIds(new Set(pendingRequests.map(r => r.id)));
                                                    }
                                                }}
                                                className="w-5 h-5 rounded border-2 border-slate-300 checked:bg-blue-600 checked:border-blue-600 cursor-pointer transition-all"
                                            />
                                        </th>
                                    )}
                                    <TableHeaderFilter
                                        columnKey="employee"
                                        label="員工"
                                        values={activeRequests.map(r => r.employee?.name || '未知員工')}
                                        selectedValues={columnFilters.employee}
                                        onChange={(values) => setColumnFilters({ ...columnFilters, employee: values })}
                                    />
                                    <TableHeaderFilter
                                        columnKey="department"
                                        label="部門"
                                        values={activeRequests.map(r => r.employee?.department || '未分配')}
                                        selectedValues={columnFilters.department}
                                        onChange={(values) => setColumnFilters({ ...columnFilters, department: values })}
                                    />
                                    <TableHeaderFilter
                                        columnKey="leaveType"
                                        label="假別/類型"
                                        values={Array.from(new Set(activeRequests.map(r => r.__type === 'MAKEUP' ? `補登(${r.check_type === 'IN' ? '上班' : '下班'})` : (r.leave_type?.name || '請假'))))}
                                        selectedValues={columnFilters.leaveType}
                                        onChange={(values) => setColumnFilters({ ...columnFilters, leaveType: values })}
                                    />
                                    <th className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider">期間</th>
                                    <th className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider">時數</th>
                                    <th className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider">事由</th>
                                    <th className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider">附件</th>
                                    {filter !== 'PENDING' && (
                                        <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-wider text-right text-nowrap">狀態</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredRequests.map((request) => {
                                    const isProcessing = processingId === request.id;
                                    const isSelected = selectedIds.has(request.id);

                                    return (
                                        <tr
                                            key={request.id}
                                            className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-blue-50' : ''} ${filter === 'PENDING' && !selectionMode ? 'cursor-pointer' : ''}`}
                                            onClick={() => handleRowClick(request)}
                                            onMouseDown={() => handleLongPressStart(request.id, request)}
                                            onMouseUp={handleLongPressEnd}
                                            onMouseLeave={handleLongPressEnd}
                                            onTouchStart={() => handleLongPressStart(request.id, request)}
                                            onTouchEnd={handleLongPressEnd}
                                        >
                                            {selectionMode && (
                                                <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => {
                                                            const newSelected = new Set(selectedIds);
                                                            if (newSelected.has(request.id)) {
                                                                newSelected.delete(request.id);
                                                            } else {
                                                                newSelected.add(request.id);
                                                            }
                                                            setSelectedIds(newSelected);
                                                        }}
                                                        className="w-5 h-5 rounded border-2 border-slate-300 checked:bg-blue-600 checked:border-blue-600 cursor-pointer transition-all"
                                                    />
                                                </td>
                                            )}
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="font-bold text-slate-900">{request.employee?.name || '未知員工'}</div>
                                                    {request.status === 'WITHDRAW_PENDING' && (
                                                        <span className="px-2 py-0.5 bg-orange-100 text-orange-600 text-[10px] rounded-full font-black border border-orange-200">
                                                            撤回申請
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="text-sm text-slate-600 font-medium">{request.employee?.department || '未分配'}</div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="text-sm font-bold text-slate-700">
                                                    {request.__type === 'MAKEUP' ? `補登(${request.check_type === 'IN' ? '上班' : '下班'})` : (request.leave_type?.name || '請假')}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-nowrap">
                                                <div className="text-sm font-mono text-slate-700">
                                                    {request.__type === 'MAKEUP' ? 
                                                        `${new Date(request.request_date).toLocaleDateString('zh-TW')} ${request.request_time}` 
                                                        : formatDateTimeRange(request.start_date, request.end_date)
                                                    }
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-nowrap">
                                                <div className="text-sm font-black text-slate-900">
                                                    {request.__type === 'MAKEUP' ? (
                                                        '-'
                                                    ) : (
                                                        <>{request.hours || 0} <span className="text-[10px] text-slate-400 font-bold">小時</span></>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 max-w-xs">
                                                <div className="text-sm text-slate-600 truncate" title={request.reason}>{request.reason || '-'}</div>
                                            </td>
                                            <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
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
                                            {filter !== 'PENDING' && (
                                                <td className="px-4 py-4 text-right whitespace-nowrap">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {request.status === RequestStatus.APPROVED ? (
                                                            <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-black">已核准</span>
                                                        ) : request.status === RequestStatus.REJECTED ? (
                                                            <span className="px-3 py-1 bg-rose-50 text-rose-600 rounded-lg text-xs font-black">已拒絕</span>
                                                        ) : (
                                                            <span className="px-3 py-1 bg-slate-50 text-slate-500 rounded-lg text-xs font-black">已撤回</span>
                                                        )}
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
                        <p className="text-slate-500 font-bold mb-4 px-4">
                            您確定要執行此審核操作嗎？完成後將無法取消。
                        </p>
                        <div className="mb-6 px-4">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 text-left">
                                {reviewDialog.type === 'approve' ? '審核備註（選填）' : '拒絕原因（選項或補登需填）'}
                            </label>
                            <textarea
                                autoFocus={reviewDialog.type === 'reject'}
                                value={reviewDialog.comment}
                                onChange={(e) => setReviewDialog({ ...reviewDialog, comment: e.target.value })}
                                placeholder={reviewDialog.type === 'approve' ? '輸入核准備註...' : '請輸入拒絕原因...'}
                                rows={3}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none font-bold text-slate-700 placeholder:text-slate-300 text-sm"
                            />
                        </div>
                        <div className="flex gap-4">
                            <button
                                onClick={() => setReviewDialog({ show: false, type: null, requestId: null, comment: '' })}
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
                                {(() => {
                                    const grouped = pendingRequests
                                        .filter(r => selectedIds.has(r.id))
                                        .reduce((acc, curr) => {
                                            const key = `${curr.employee?.name}-${curr.leave_type?.name}`;
                                            if (!acc[key]) {
                                                acc[key] = {
                                                    name: curr.employee?.name || '未知',
                                                    type: curr.leave_type?.name || '請假',
                                                    count: 0
                                                };
                                            }
                                            acc[key].count++;
                                            return acc;
                                        }, {} as Record<string, { name: string; type: string; count: number }>);

                                    return (Object.values(grouped) as { name: string; type: string; count: number }[]).map((info, idx) => (
                                        <div key={idx} className="flex items-center gap-2 text-sm">
                                            <span className="material-symbols-outlined text-slate-400 text-base">person</span>
                                            <span className="font-bold text-slate-700">{info.name}</span>
                                            <span className="text-slate-400">-</span>
                                            <span className="text-slate-500 text-xs">{info.type}</span>
                                            <span className="text-blue-600 font-black ml-1">{info.count}筆</span>
                                            {pendingRequests.find(r => selectedIds.has(r.id) && r.employee?.name === info.name && r.leave_type?.name === info.type && r.status === 'WITHDRAW_PENDING') && (
                                                <span className="px-2 py-0.5 bg-orange-100 text-orange-600 text-[10px] rounded-full font-black ml-1">撤回</span>
                                            )}
                                        </div>
                                    ));
                                })()}
                            </div>
                        </div>

                        <div className="mb-6">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 text-left">
                                {batchDialog.type === 'approve' ? '批量核准備註（選填）' : '批量拒絕原因（選項或補登需填）'}
                            </label>
                            <textarea
                                autoFocus={batchDialog.type === 'reject'}
                                value={batchDialog.comment}
                                onChange={(e) => setBatchDialog({ ...batchDialog, comment: e.target.value })}
                                placeholder={batchDialog.type === 'approve' ? '輸入批量核准備註...' : '請輸入批量拒絕原因...'}
                                rows={3}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none font-bold text-slate-700 placeholder:text-slate-300 text-sm"
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

            {/* Action Menu Modal (置中彈窗式操作選單) */}
            {showActionMenu && actionMenuRequest && (
                <div
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300"
                    onClick={() => setShowActionMenu(false)}
                >
                    <div
                        className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm p-8 animate-in zoom-in-95 duration-300 text-center"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* 紀錄資訊 */}
                        <div className="mb-8 items-center flex flex-col">
                            <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center text-blue-600 border border-blue-100 mb-6 font-light">
                                <span className="material-symbols-outlined text-4xl">fact_check</span>
                            </div>
                            <h2 className="text-2xl font-black text-slate-900 mb-2">審核申請</h2>
                            <div className="flex flex-col gap-2 items-center">
                                <span className="font-bold text-blue-600 bg-blue-50 px-4 py-1 rounded-full text-xs">
                                    {actionMenuRequest.__type === 'MAKEUP' ? `補登(${actionMenuRequest.check_type === 'IN' ? '上班' : '下班'})` : (actionMenuRequest.leave_type?.name || '差勤申請')}
                                </span>
                                <div className="text-sm font-bold text-slate-900">{actionMenuRequest.employee?.name} ({actionMenuRequest.employee?.department})</div>
                                <div className="text-xs text-slate-500 font-medium bg-slate-50 px-4 py-2 rounded-full mt-1">
                                    {actionMenuRequest.__type === 'MAKEUP' ? 
                                        `${new Date(actionMenuRequest.request_date).toLocaleDateString('zh-TW')} ${actionMenuRequest.request_time}` 
                                        : formatDateTimeRange(actionMenuRequest.start_date, actionMenuRequest.end_date)
                                    }
                                </div>
                            </div>
                            {actionMenuRequest.reason && (
                                <div className="mt-4 p-4 bg-slate-50 rounded-2xl text-left w-full">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                        {actionMenuRequest.status === 'WITHDRAW_PENDING' ? '原事由' : '事由'}
                                    </p>
                                    <p className="text-sm text-slate-700 font-medium line-clamp-3 italic">"{actionMenuRequest.reason}"</p>
                                </div>
                            )}
                            {actionMenuRequest.status === 'WITHDRAW_PENDING' && (
                                <div className="mt-2 p-4 bg-orange-50 rounded-2xl text-left w-full border border-orange-100">
                                    <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-1">撤回說明</p>
                                    <p className="text-sm text-orange-700 font-medium italic">
                                        員工申請撤回此項「{getStatusInfo(actionMenuRequest.modification_reason?.split(':')[1] || 'APPROVED').text}」的紀錄。
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* 操作按鈕 */}
                        <div className="flex flex-col gap-4">
                            <button
                                onClick={() => {
                                    handleReviewClick(actionMenuRequest.id, 'approve');
                                    setShowActionMenu(false);
                                }}
                                className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined text-lg">verified</span>
                                {actionMenuRequest.status === 'WITHDRAW_PENDING' ? '核准撤回' : '核准申請'}
                            </button>
                            <button
                                onClick={() => {
                                    handleReviewClick(actionMenuRequest.id, 'reject');
                                    setShowActionMenu(false);
                                }}
                                className="w-full py-4 bg-white text-rose-600 border-2 border-rose-200 rounded-2xl font-black hover:bg-rose-50 transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined text-lg">block</span>
                                拒絕申請
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmployeeApprovalsPage;

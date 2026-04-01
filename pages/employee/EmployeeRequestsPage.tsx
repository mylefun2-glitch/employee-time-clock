import React, { useEffect, useState } from 'react';
import { useEmployee } from '../../contexts/EmployeeContext';
import { requestService } from '../../services/requestService';
import LeaveRequestForm from '../../components/LeaveRequestForm';
import ModificationRequestForm from '../../components/ModificationRequestForm';
import ResourceRequestForm from '../../components/ResourceRequestForm';
import { LeaveRequest } from '../../types';
import TableHeaderFilter from '../../components/ui/TableHeaderFilter';
import { formatDateTimeRange } from '../../lib/hrUtils';
import EmployeeResourceRequestsList from '../../components/EmployeeResourceRequestsList';

const EmployeeRequestsPage: React.FC = () => {
    const { employee } = useEmployee();
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'LEAVE' | 'RESOURCE'>('LEAVE');
    const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
    const [showForm, setShowForm] = useState(false);
    const [showModificationForm, setShowModificationForm] = useState(false);
    const [showResourceForm, setShowResourceForm] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
    const [selectedYear, setSelectedYear] = useState<number | null>(null);
    const [availableYears, setAvailableYears] = useState<number[]>([]);

    // 欄位篩選狀態
    const [columnFilters, setColumnFilters] = useState<{
        leaveType: string[];
        reason: string[];
        deputy: string[];
        employeeName: string[];
    }>({
        leaveType: [],
        reason: [],
        deputy: [],
        employeeName: []
    });

    useEffect(() => {
        if (employee) {
            // 計算初始基準年度 (從到職年到今年)
            const currentYear = new Date().getFullYear();
            const joinYear = employee.join_date
                ? new Date(employee.join_date).getFullYear()
                : currentYear - 1;
            const years = [];
            for (let y = currentYear; y >= joinYear; y--) {
                years.push(y);
            }
            // 確保至少有今年
            if (!years.includes(currentYear)) years.unshift(currentYear);
            setAvailableYears(years);

            fetchData(selectedYear);
        }
    }, [employee, selectedYear]);

    const fetchData = async (year: number | null) => {
        if (!employee) return;
        setLoading(true);
        try {
            // 如果 year 為 null,不傳入 year 參數(查詢所有年度)
            const data = year === null
                ? await requestService.getEmployeeRequests(employee.id, undefined, employee.department)
                : await requestService.getEmployeeRequests(employee.id, year, employee.department);
            setRequests(data || []);

            // 動態更新可用年度 list (基於實際抓取到的資料)
            if (data && data.length > 0) {
                const years = Array.from(new Set(data.map(req => new Date(req.start_date).getFullYear())));
                const currentYear = new Date().getFullYear();
                if (!years.includes(currentYear)) years.push(currentYear);

                setAvailableYears(prev => {
                    const combined = Array.from(new Set([...prev, ...years])).sort((a, b) => b - a);
                    return combined;
                });
            } else if (availableYears.length === 0) {
                // 如果沒資料，至少顯示今年
                setAvailableYears([new Date().getFullYear()]);
            }

            if (!data || data.length === 0) {
                console.log('No requests found for employee:', employee.id, 'year:', year);
            }
        } catch (error) {
            console.error('Error fetching requests in EmployeeRequestsPage:', error);
        } finally {
            setLoading(false);
        }
    };

    const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
    const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isBatchWithdrawing, setIsBatchWithdrawing] = useState(false);

    // 選擇模式狀態
    const [selectionMode, setSelectionMode] = useState(false);
    const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
    const [isLongPress, setIsLongPress] = useState(false);

    // 操作選單狀態
    const [showActionMenu, setShowActionMenu] = useState(false);
    const [actionMenuRequest, setActionMenuRequest] = useState<any | null>(null);

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

    const handleWithdrawRequest = async () => {
        if (!employee || !withdrawingId) return;

        const result = await requestService.withdrawRequest(withdrawingId, employee.id);
        setShowWithdrawConfirm(false);
        setWithdrawingId(null);

        if (result.success) {
            alert('已送出撤回申請，請等待主管審核');
            fetchData(selectedYear);
        } else {
            alert(result.error || '撤回失敗');
        }
    };

    const handleBatchWithdraw = async () => {
        if (!employee || selectedIds.length === 0) return;

        if (!confirm(`確定要批量撤回選中的 ${selectedIds.length} 筆申請嗎？`)) return;

        setIsBatchWithdrawing(true);
        try {
            const result = await requestService.batchWithdrawRequests(selectedIds, employee.id);
            if (result.success) {
                alert(`已成功送出 ${result.succeeded} 筆撤回申請，請等待主管審核`);
            } else {
                alert(`部分撤回失敗：\n成功 ${result.succeeded} 筆，失敗 ${result.failed} 筆\n\n失敗原因：\n${result.errors.join('\n')}`);
            }
            setSelectedIds([]);
            fetchData(selectedYear);
        } catch (error: any) {
            alert('批量撤回發生錯誤');
        } finally {
            setIsBatchWithdrawing(false);
        }
    };

    const toggleSelectAll = () => {
        // 只有待審核或核准的項目可以被撤回
        const withdrawableRequests = filteredRequests.filter(req =>
            (req.status === 'PENDING' || req.status === 'APPROVED') && !req.is_modified
        );

        if (selectedIds.length === withdrawableRequests.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(withdrawableRequests.map(r => r.id));
        }
    };

    // 長按事件處理
    const handleLongPressStart = (requestId: string, request: any) => {
        // 如果已在選擇模式,不處理長按
        if (selectionMode) return;

        // 只有可撤回的項目才能長按選擇
        if (!((request.status === 'PENDING' || request.status === 'APPROVED') && !request.is_modified)) {
            return;
        }

        setIsLongPress(false);
        const timer = setTimeout(() => {
            // 標記為長按
            setIsLongPress(true);
            // 進入選擇模式
            setSelectionMode(true);
            // 自動勾選被長按的項目
            setSelectedIds([requestId]);
        }, 500); // 500ms 觸發長按
        setLongPressTimer(timer);
    };

    const handleLongPressEnd = () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            setLongPressTimer(null);
        }
    };

    // 點擊紀錄顯示操作選單
    const handleRowClick = (request: any) => {
        // 如果是長按或已在選擇模式,不顯示操作選單
        if (isLongPress || selectionMode) {
            setIsLongPress(false);
            return;
        }

        // 顯示操作選單
        setActionMenuRequest(request);
        setShowActionMenu(true);
    };

    const exitSelectionMode = () => {
        setSelectionMode(false);
        setSelectedIds([]);
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const filteredRequests = requests
        .filter(req => {
            // 基礎狀態過濾
            if (filter === 'PENDING') {
                return req.status === 'PENDING' || req.status === 'WITHDRAW_PENDING';
            }
            if (filter !== 'ALL' && req.status !== filter) return false;

            // 年度過濾保險 (解決 API 可能撈到跨時區鄰近數據的問題)
            if (selectedYear !== null) {
                const reqYear = new Date(req.start_date).getFullYear();
                if (reqYear !== selectedYear) return false;
            }

            return true;
        })
        .filter(req => {
            // 應用類型篩選 (加上 trim 確保比對精確)
            const reqType = (req.leave_type?.name || '差勤申請').trim();
            const leaveTypeMatch = columnFilters.leaveType.length === 0 ||
                columnFilters.leaveType.map(v => v.trim()).includes(reqType);

            // 應用事由篩選
            const reqReason = (req.reason || '-').trim();
            const reasonMatch = columnFilters.reason.length === 0 ||
                columnFilters.reason.map(v => v.trim()).includes(reqReason);

            // 應用職代篩選
            const reqDeputy = (req.deputy?.name || '未指定').trim();
            const deputyMatch = columnFilters.deputy.length === 0 ||
                columnFilters.deputy.map(v => v.trim()).includes(reqDeputy);

            // 應用姓名篩選
            const reqName = (req.employee?.name || '-').trim();
            const nameMatch = columnFilters.employeeName.length === 0 ||
                columnFilters.employeeName.map(v => v.trim()).includes(reqName);

            return leaveTypeMatch && reasonMatch && deputyMatch && nameMatch;
        });

    const getCount = (status: 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED') => {
        if (status === 'ALL') return requests.length;
        if (status === 'PENDING') {
            return requests.filter(r => r.status === 'PENDING' || r.status === 'WITHDRAW_PENDING').length;
        }
        return requests.filter(r => r.status === status).length;
    };

    const hasAnyColumnFilter = Object.values(columnFilters).some(v => v.length > 0);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">申請記錄</h1>
                    <p className="text-slate-500 text-sm font-medium mt-1">追蹤您的所有申請（含公務車借用）與審核狀態</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                <button
                    onClick={() => setShowResourceForm(true)}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-violet-600 text-white rounded-2xl font-black shadow-xl shadow-violet-100 hover:bg-violet-700 transition-all hover:-translate-y-1 active:scale-95"
                >
                    <span className="material-symbols-outlined text-lg">handshake</span>
                    借用申請
                </button>
                <button
                    onClick={() => setShowForm(true)}
                    className="flex items-center justify-center gap-2 px-8 py-3.5 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all hover:-translate-y-1 active:scale-95"
                >
                    <span className="material-symbols-outlined text-lg">add_circle</span>
                    發起新申請
                </button>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-6 border-b border-slate-200 pb-px">
                <button
                    onClick={() => setActiveTab('LEAVE')}
                    className={`pb-3 px-2 text-lg font-black transition-all border-b-4 ${activeTab === 'LEAVE' ? 'text-blue-600 border-blue-600' : 'text-slate-400 border-transparent hover:text-slate-600 hover:border-slate-300'}`}
                >
                    差勤與車輛申請
                </button>
                <button
                    onClick={() => setActiveTab('RESOURCE')}
                    className={`pb-3 px-2 text-lg font-black transition-all border-b-4 ${activeTab === 'RESOURCE' ? 'text-violet-600 border-violet-600' : 'text-slate-400 border-transparent hover:text-slate-600 hover:border-slate-300'}`}
                >
                    物品及場地借用
                </button>
            </div>

            {activeTab === 'LEAVE' ? (
                <>
            {/* Filter & Year Selector Area */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                {/* Year Selector - Dropdown */}
                <div className="relative">
                    <select
                        value={selectedYear === null ? 'all' : selectedYear}
                        onChange={(e) => {
                            const value = e.target.value;
                            setSelectedYear(value === 'all' ? null : parseInt(value));
                        }}
                        className="appearance-none pl-4 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm cursor-pointer hover:border-slate-300 transition-colors min-w-[140px]"
                    >
                        <option value="all">全部年度</option>
                        {availableYears.map(year => (
                            <option key={year} value={year}>
                                {year}年
                            </option>
                        ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-lg">
                        expand_more
                    </span>
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-3 overflow-x-auto pb-2 sm:pb-0 scrollbar-hide flex-1">
                    {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((status) => (
                        <button
                            key={status}
                            onClick={() => setFilter(status)}
                            className={`px-6 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all border flex items-center gap-2 ${filter === status
                                ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-200'
                                : 'bg-white text-slate-500 border-slate-100 hover:border-slate-300 hover:bg-slate-50'
                                }`}
                        >
                            {status === 'ALL' ? '全部申請' : getStatusInfo(status).text}
                            <span className={`px-2 py-0.5 rounded-lg text-[10px] ${filter === status ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                {getCount(status)}
                            </span>
                        </button>
                    ))}
                </div>

            </div>

            {/* Main Content */}
            <div className="bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden">
                {/* Selection Mode Indicator */}
                {selectionMode && (
                    <div className="bg-blue-50 border-b border-blue-200 px-6 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-blue-600">check_circle</span>
                            <span className="font-bold text-slate-900">選擇模式</span>
                            <span className="text-sm text-slate-500">已選擇 {selectedIds.length} 個項目</span>
                        </div>
                        <button
                            onClick={exitSelectionMode}
                            className="px-4 py-2 bg-white text-slate-700 rounded-lg font-bold hover:bg-slate-100 transition-colors border border-slate-200"
                        >
                            完成
                        </button>
                    </div>
                )}

                {loading ? (
                    <div className="p-20 text-center">
                        <div className="flex justify-center mb-4">
                            <div className="w-10 h-10 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
                        </div>
                        <div className="text-slate-400 font-bold">載入中...</div>
                    </div>
                ) : filteredRequests.length === 0 ? (
                    <div className="py-24 text-center">
                        <div className="w-24 h-24 bg-slate-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                            <span className="material-symbols-outlined text-slate-200 text-6xl">search_off</span>
                        </div>
                        <h3 className="text-xl font-black text-slate-900 tracking-tight">未找到匹配紀錄</h3>
                        <p className="text-slate-500 font-bold mt-2 max-w-xs mx-auto text-sm">請嘗試調整篩選條件或清除目前的篩選。</p>
                        {hasAnyColumnFilter && (
                            <button
                                onClick={() => setColumnFilters({ leaveType: [], reason: [], deputy: [], employeeName: [] })}
                                className="mt-6 px-6 py-2.5 bg-blue-50 text-blue-600 rounded-xl text-sm font-black hover:bg-blue-100 transition-all border border-blue-100"
                            >
                                清除所有篩選
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50 border-b border-slate-100">
                                <tr>
                                    {/* 只在選擇模式顯示勾選框欄位 */}
                                    {selectionMode && (
                                        <th className="px-4 py-3 text-left w-10">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                checked={selectedIds.length > 0 && selectedIds.length === filteredRequests.filter(r => (r.status === 'PENDING' || r.status === 'APPROVED') && !r.is_modified).length}
                                                onChange={toggleSelectAll}
                                            />
                                        </th>
                                    )}
                                    <TableHeaderFilter
                                        columnKey="employeeName"
                                        label="姓名"
                                        values={requests.map(r => r.employee?.name || '-')}
                                        selectedValues={columnFilters.employeeName}
                                        onChange={(values) => setColumnFilters({ ...columnFilters, employeeName: values })}
                                    />
                                    <TableHeaderFilter
                                        columnKey="leaveType"
                                        label="類型"
                                        values={requests.map(r => r.leave_type?.name || '差勤申請')}
                                        selectedValues={columnFilters.leaveType}
                                        onChange={(values) => setColumnFilters({ ...columnFilters, leaveType: values })}
                                    />
                                    <TableHeaderFilter
                                        columnKey="reason"
                                        label="事由"
                                        values={requests.map(r => r.reason || '-')}
                                        selectedValues={columnFilters.reason}
                                        onChange={(values) => setColumnFilters({ ...columnFilters, reason: values })}
                                    />
                                    <TableHeaderFilter
                                        columnKey="deputy"
                                        label="職代"
                                        values={requests.map(r => r.deputy?.name || '未指定')}
                                        selectedValues={columnFilters.deputy}
                                        onChange={(values) => setColumnFilters({ ...columnFilters, deputy: values })}
                                    />
                                    <th className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider">狀態</th>
                                    <th className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider">附件</th>
                                    <th className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider">時數</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredRequests.map((request) => {
                                    const status = getStatusInfo(request.status);
                                    return (
                                        <tr
                                            key={request.id}
                                            className={`hover:bg-slate-50 transition-colors ${selectedIds.includes(request.id) ? 'bg-blue-50/30' : ''} ${!selectionMode ? 'cursor-pointer' : ''}`}
                                            onClick={() => handleRowClick(request)}
                                            onMouseDown={() => !selectionMode && handleLongPressStart(request.id, request)}
                                            onMouseUp={handleLongPressEnd}
                                            onMouseLeave={handleLongPressEnd}
                                            onTouchStart={() => !selectionMode && handleLongPressStart(request.id, request)}
                                            onTouchEnd={handleLongPressEnd}
                                        >
                                            {/* 只在選擇模式顯示勾選框 */}
                                            {selectionMode && (
                                                <td className="px-4 py-4">
                                                    <input
                                                        type="checkbox"
                                                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                        checked={selectedIds.includes(request.id)}
                                                        onChange={() => toggleSelect(request.id)}
                                                        disabled={!(request.status === 'PENDING' || request.status === 'APPROVED') || request.is_modified}
                                                    />
                                                </td>
                                            )}
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${request.employee_id === employee?.id ? 'bg-blue-100 text-blue-600 border border-blue-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                                                        {(request.employee?.name || '-').charAt(0)}
                                                    </div>
                                                    <span className={`font-bold ${request.employee_id === employee?.id ? 'text-blue-600' : 'text-slate-900'}`}>
                                                        {request.employee?.name || '-'}
                                                        {request.employee_id === employee?.id && <span className="ml-1 text-[10px] bg-blue-50 px-1.5 py-0.5 rounded uppercase tracking-tighter">我</span>}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 border border-blue-100 shrink-0">
                                                        <span className="material-symbols-outlined text-lg">edit_calendar</span>
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-slate-900">{request.leave_type?.name || '差勤申請'}</div>
                                                        <div className="text-xs font-mono text-slate-500 mt-1">
                                                            {formatDateTimeRange(request.start_date, request.end_date)}
                                                        </div>
                                                        {request.car && (
                                                            <div className="flex items-center gap-1 text-blue-600 text-xs mt-1">
                                                                <span className="material-symbols-outlined text-sm">directions_car</span>
                                                                <span>{request.car.plate_number}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 max-w-xs">
                                                <div className="text-sm text-slate-600 truncate" title={request.reason}>
                                                    {request.reason || '-'}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                {request.deputy ? (
                                                    <div className="text-sm font-bold text-slate-900">{request.deputy.name}</div>
                                                ) : (
                                                    <span className="text-xs text-slate-400">未指定</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-4">
                                                <span className={`px-3 py-1.5 text-xs font-black rounded-lg border inline-block ${status.class}`}>
                                                    {status.text}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4">
                                                {request.attachment_url ? (
                                                    <a
                                                        href={request.attachment_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-bold text-xs"
                                                        title={request.attachment_name || '查看附件'}
                                                    >
                                                        <span className="material-symbols-outlined text-sm">attach_file</span>
                                                        查看
                                                    </a>
                                                ) : (
                                                    <span className="text-xs text-slate-300">-</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-bold text-slate-900">
                                                        {request.hours || 0}
                                                    </span>
                                                    <span className="text-xs text-slate-500">小時</span>
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
            </>
            ) : (
                <EmployeeResourceRequestsList employeeId={employee.id} department={employee.department} />
            )}

            {/* Action Menu Modal */}
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
                            <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center text-blue-600 border border-blue-100 mb-6">
                                <span className="material-symbols-outlined text-4xl">edit_calendar</span>
                            </div>
                            <h2 className="text-2xl font-black text-slate-900 mb-2">{actionMenuRequest.leave_type?.name || '差勤申請'}</h2>
                            <div className="text-xs text-slate-500 font-medium bg-slate-50 px-4 py-2 rounded-full">
                                {formatDateTimeRange(actionMenuRequest.start_date, actionMenuRequest.end_date)}
                            </div>
                            {actionMenuRequest.reason && (
                                <div className="text-sm text-slate-600 mt-4 px-4 line-clamp-2 italic">
                                    "{actionMenuRequest.reason}"
                                </div>
                            )}
                        </div>

                        {/* 操作按鈕 */}
                        <div className="flex flex-col gap-4 mt-8">
                            {(actionMenuRequest.status === 'PENDING' || actionMenuRequest.status === 'APPROVED') && 
                             !actionMenuRequest.is_modified && 
                             actionMenuRequest.employee_id === employee?.id && (
                                <button
                                    onClick={() => {
                                        setWithdrawingId(actionMenuRequest.id);
                                        setShowWithdrawConfirm(true);
                                        setShowActionMenu(false);
                                    }}
                                    className="w-full py-4 bg-rose-50 text-rose-600 rounded-2xl font-black hover:bg-rose-100 transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-lg">cancel</span>
                                    撤回申請
                                </button>
                            )}

                            {(actionMenuRequest.status === 'APPROVED' || actionMenuRequest.status === 'REJECTED') && 
                             !actionMenuRequest.is_modified && 
                             !actionMenuRequest.original_request_id && 
                             actionMenuRequest.employee_id === employee?.id && (
                                <button
                                    onClick={() => {
                                        setSelectedRequest(actionMenuRequest);
                                        setShowModificationForm(true);
                                        setShowActionMenu(false);
                                    }}
                                    className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-lg">edit</span>
                                    申請變更
                                </button>
                            )}

                            {actionMenuRequest.employee_id !== employee?.id && (
                                <div className="p-4 bg-slate-50 rounded-2xl text-slate-500 text-sm font-bold">
                                    此紀錄為同部門同仁申請，您無權限修改。
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Integrated Form Modal */}
            {/* Leave Request Form Modal */}
            {showForm && employee && (
                <LeaveRequestForm
                    employeeId={employee.id}
                    onClose={() => setShowForm(false)}
                    onSuccess={() => {
                        setShowForm(false);
                        fetchData(selectedYear);
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
                        fetchData(selectedYear);
                    }}
                />
            )}

            {/* Resource Request Form Modal */}
            {showResourceForm && employee && (
                <ResourceRequestForm
                    employeeId={employee.id}
                    onClose={() => setShowResourceForm(false)}
                    onSuccess={() => {
                        setShowResourceForm(false);
                        alert('借用申請已送出，請等待審核！');
                        setActiveTab('RESOURCE');
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

            {/* Bulk Actions Bar - Only show in selection mode */}
            {selectionMode && selectedIds.length > 0 && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-6 z-40 animate-in slide-in-from-bottom-8 duration-300">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-black text-sm">
                            {selectedIds.length}
                        </div>
                        <span className="font-bold text-sm">個項目已選取</span>
                    </div>
                    <div className="h-6 w-px bg-slate-700"></div>
                    <button
                        onClick={handleBatchWithdraw}
                        disabled={isBatchWithdrawing}
                        className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 rounded-xl font-black text-sm transition-all active:scale-95 disabled:opacity-50"
                    >
                        <span className="material-symbols-outlined text-sm">cancel</span>
                        {isBatchWithdrawing ? '處理中...' : '批量撤回'}
                    </button>
                    <button
                        onClick={exitSelectionMode}
                        className="text-slate-400 hover:text-white font-bold text-sm transition-colors"
                    >
                        取消選取
                    </button>
                </div>
            )}
        </div>
    );
};

export default EmployeeRequestsPage;

import React, { useEffect, useState, useRef } from 'react';
import { Download, Upload, Plus } from 'lucide-react';
import { requestService } from '../../services/requestService';
import { supabase } from '../../lib/supabase';
import { LeaveRequest, RequestStatus } from '../../types';
import TableHeaderFilter from '../../components/ui/TableHeaderFilter';
import EmployeeSelectModal from '../../components/admin/EmployeeSelectModal';
import LeaveRequestForm from '../../components/LeaveRequestForm';

const taipeiDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit'
});

const taipeiDay = (timestamp: string) => {
    const parts = taipeiDate.formatToParts(new Date(timestamp));
    const value = (type: string) => parts.find(part => part.type === type)?.value || '';
    return `${value('year')}-${value('month')}-${value('day')}`;
};

const RequestsPage: React.FC = () => {
    const [requests, setRequests] = useState<LeaveRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingFullHistory, setLoadingFullHistory] = useState(false);
    const [fullHistoryLoaded, setFullHistoryLoaded] = useState(false);
    const [filterStatus, setFilterStatus] = useState<string>('ALL');
    const [employeeSearch, setEmployeeSearch] = useState('');
    const [leaveFrom, setLeaveFrom] = useState('');
    const [leaveTo, setLeaveTo] = useState('');
    const [importing, setImporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [isEmployeeSelectOpen, setIsEmployeeSelectOpen] = useState(false);
    const [selectedEmployeeIdForRequest, setSelectedEmployeeIdForRequest] = useState<string | null>(null);

    // 修改代理人狀態
    const [showDeputyEdit, setShowDeputyEdit] = useState(false);
    const [deputyEditRequestId, setDeputyEditRequestId] = useState<string | null>(null);
    const [deputyEditCurrentName, setDeputyEditCurrentName] = useState<string>('');
    const [deputyEmployees, setDeputyEmployees] = useState<any[]>([]);
    const [selectedNewDeputyId, setSelectedNewDeputyId] = useState<string>('');
    const [isUpdatingDeputy, setIsUpdatingDeputy] = useState(false);

    // 表格標題篩選狀態
    const [columnFilters, setColumnFilters] = useState<{
        employee: string[];
        department: string[];
        leaveType: string[];
        status: RequestStatus[];
        hasCar: string[];
        deputy: string[];
    }>({
        employee: [],
        department: [],
        leaveType: [],
        status: [],
        hasCar: [],
        deputy: []
    });

    useEffect(() => {
        loadRequests();
    }, []);

    // A new filter starts at the first page and cannot leave hidden rows selected.
    useEffect(() => {
        setPage(1);
        setSelectedIds(new Set());
    }, [filterStatus, columnFilters, employeeSearch, leaveFrom, leaveTo]);

    useEffect(() => {
        setSelectedIds(new Set());
    }, [page, pageSize]);

    const loadRequests = async () => {
        setLoading(true);
        const data = await requestService.getRecentRequests();
        setRequests(data);
        setFullHistoryLoaded(false);

        setLoading(false);
        setSelectedIds(new Set()); // 清除選取
    };

    const loadFullHistory = async () => {
        setLoadingFullHistory(true);
        const data = await requestService.getAllRequests();
        setRequests(data);
        setFullHistoryLoaded(true);
        setLoadingFullHistory(false);
        setSelectedIds(new Set());
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

    const handleDelete = async (requestId: string) => {
        if (!confirm('確定要永久刪除此申請紀錄嗎？此動作無法復原！')) return;

        const result = await requestService.deleteRequest(requestId);
        if (result.success) {
            await loadRequests();
            alert('刪除成功！');
        } else {
            alert(`刪除失敗：${result.error}`);
        }
    };

    const handleBatchDelete = async () => {
        const idsToDelete = Array.from(selectedIds);
        if (idsToDelete.length === 0) return;

        if (!confirm(`確定要永久刪除選中的 ${idsToDelete.length} 筆申請紀錄嗎？此動作無法復原！`)) return;

        const result = await requestService.batchDeleteRequests(idsToDelete);
        if (result.success) {
            await loadRequests();
            alert(`成功刪除 ${result.succeeded} 筆紀錄！`);
        } else {
            const errorMsg = result.errors.length > 0 ? `\n原因：${result.errors.join(', ')}` : '';
            alert(`部分刪除完成：成功 ${result.succeeded} 筆，失敗 ${result.failed} 筆${errorMsg}`);
            await loadRequests();
        }
    };

    const handleBatchApprove = async () => {
        const idsToApprove = Array.from(selectedIds);
        if (idsToApprove.length === 0) return;

        if (!confirm(`確定要批量核准選中的 ${idsToApprove.length} 筆申請嗎？`)) return;

        setLoading(true);
        const result = await requestService.batchUpdateRequestStatus(idsToApprove, RequestStatus.APPROVED);
        if (result.success) {
            await loadRequests();
            alert(`成功核准 ${result.succeeded} 筆申請！`);
        } else {
            const errorMsg = result.errors.length > 0 ? `\n原因：${result.errors.join(', ')}` : '';
            alert(`部分核准完成：成功 ${result.succeeded} 筆，失敗 ${result.failed} 筆${errorMsg}`);
            await loadRequests();
        }
    };

    const handleBatchReject = async () => {
        const idsToReject = Array.from(selectedIds);
        if (idsToReject.length === 0) return;

        if (!confirm(`確定要批量拒絕選中的 ${idsToReject.length} 筆申請嗎？`)) return;

        setLoading(true);
        const result = await requestService.batchUpdateRequestStatus(idsToReject, RequestStatus.REJECTED);
        if (result.success) {
            await loadRequests();
            alert(`成功拒絕 ${result.succeeded} 筆申請！`);
        } else {
            const errorMsg = result.errors.length > 0 ? `\n原因：${result.errors.join(', ')}` : '';
            alert(`部分拒絕完成：成功 ${result.succeeded} 筆，失敗 ${result.failed} 筆${errorMsg}`);
            await loadRequests();
        }
    };

    const toggleSelection = (id: string) => {
        const newSelection = new Set(selectedIds);
        if (newSelection.has(id)) {
            newSelection.delete(id);
        } else {
            newSelection.add(id);
        }
        setSelectedIds(newSelection);
    };

    const toggleAllSelection = () => {
        const pageIds = pagedRequests.map(r => r.id);
        const next = new Set(selectedIds);
        if (pageIds.length > 0 && pageIds.every(id => next.has(id))) {
            pageIds.forEach(id => next.delete(id));
        } else {
            pageIds.forEach(id => next.add(id));
        }
        setSelectedIds(next);
    };

    // 打開修改代理人 Modal
    const openDeputyEdit = async (request: any) => {
        setDeputyEditRequestId(request.id);
        setDeputyEditCurrentName(request.deputy?.name || '未指定');
        setSelectedNewDeputyId(request.deputy_id || '');

        // 載入所有活動員工（排除申請人本人）
        try {
            const { data } = await supabase
                .from('employees')
                .select('id, name, department')
                .eq('is_active', true)
                .neq('id', request.employee_id || '')
                .order('name');
            setDeputyEmployees(data || []);
        } catch (err) {
            console.error('Error loading employees for deputy edit:', err);
            setDeputyEmployees([]);
        }

        setShowDeputyEdit(true);
    };

    // 執行修改代理人
    const handleUpdateDeputy = async () => {
        if (!deputyEditRequestId) return;

        setIsUpdatingDeputy(true);
        try {
            const deputyId = (selectedNewDeputyId && selectedNewDeputyId !== 'NONE') ? selectedNewDeputyId : null;
            const result = await requestService.updateDeputy(deputyEditRequestId, deputyId);

            if (result.success) {
                alert('職務代理人已更新！');
                setShowDeputyEdit(false);
                setDeputyEditRequestId(null);
                await loadRequests();
            } else {
                alert(`更新失敗：${result.error}`);
            }
        } catch (err: any) {
            alert('更新代理人時發生錯誤');
        } finally {
            setIsUpdatingDeputy(false);
        }
    };

    const getStatusBadge = (status: RequestStatus) => {
        const styles = {
            [RequestStatus.PENDING]: 'bg-yellow-100 text-yellow-800',
            [RequestStatus.APPROVED]: 'bg-green-100 text-green-800',
            [RequestStatus.REJECTED]: 'bg-red-100 text-red-800',
            [RequestStatus.WITHDRAWN]: 'bg-gray-100 text-gray-800',
            [RequestStatus.WITHDRAW_PENDING]: 'bg-orange-100 text-orange-800'
        };
        const labels = {
            [RequestStatus.PENDING]: '待審核',
            [RequestStatus.APPROVED]: '已核准',
            [RequestStatus.REJECTED]: '已拒絕',
            [RequestStatus.WITHDRAWN]: '已撤回',
            [RequestStatus.WITHDRAW_PENDING]: '撤回待審'
        };
        return { style: styles[status] || 'bg-gray-100 text-gray-800', label: labels[status] || status };
    };

    const formatDateTimeRange = (startStr: string, endStr: string) => {
        const start = new Date(startStr);
        const end = new Date(endStr);

        const dateOptions: Intl.DateTimeFormatOptions = {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        };

        const timeOptions: Intl.DateTimeFormatOptions = {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        };

        const startDate = start.toLocaleDateString('zh-TW', dateOptions);
        const endDate = end.toLocaleDateString('zh-TW', dateOptions);
        const startTime = start.toLocaleTimeString('zh-TW', timeOptions);
        const endTime = end.toLocaleTimeString('zh-TW', timeOptions);

        if (startDate === endDate) {
            return `${startDate} ${startTime} ～ ${endTime}`;
        } else {
            return `${startDate} ${startTime} ～ ${endDate} ${endTime}`;
        }
    };

    // A request overlaps the selected attendance period if its end >= from and start <= to.
    const filteredRequests = requests.filter(req => {
        // 快速篩選（現有的）
        const statusMatch = filterStatus === 'ALL' || req.status === filterStatus;

        // 表格欄位篩選 (加上 trim 確保比對精確)
        const empName = ((req as any).employee_name || (req as any).employee?.name || '未知員工').trim();
        const searchMatch = empName.toLocaleLowerCase('zh-TW').includes(employeeSearch.trim().toLocaleLowerCase('zh-TW'));
        const leaveMatch = (!leaveFrom || (req.end_date && taipeiDay(req.end_date) >= leaveFrom)) &&
            (!leaveTo || (req.start_date && taipeiDay(req.start_date) <= leaveTo));
        const deptName = ((req as any).employee?.department || '未分配').trim();
        const typeName = ((req as any).leave_type?.name || '-').trim();

        const employeeMatch = columnFilters.employee.length === 0 ||
            columnFilters.employee.map(v => v.trim()).includes(empName);
        const deptColumnMatch = columnFilters.department.length === 0 ||
            columnFilters.department.map(v => v.trim()).includes(deptName);
        const leaveTypeMatch = columnFilters.leaveType.length === 0 ||
            columnFilters.leaveType.map(v => v.trim()).includes(typeName);
        const statusColumnMatch = columnFilters.status.length === 0 ||
            columnFilters.status.includes(req.status);
        const hasCarMatch = columnFilters.hasCar.length === 0 ||
            columnFilters.hasCar.includes((req as any).car ? '有' : '無');
        const deputyName = ((req as any).deputy?.name || '未指定').trim();
        const deputyMatch = columnFilters.deputy.length === 0 ||
            columnFilters.deputy.map(v => v.trim()).includes(deputyName);

        return statusMatch && searchMatch && leaveMatch && employeeMatch && deptColumnMatch &&
            leaveTypeMatch && statusColumnMatch && hasCarMatch && deputyMatch;
    });

    const totalPages = Math.max(1, Math.ceil(filteredRequests.length / pageSize));
    const currentPage = Math.min(page, totalPages);
    const pagedRequests = filteredRequests.slice((currentPage - 1) * pageSize, currentPage * pageSize);


    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }


    // 健壯的 CSV 解析器
    const parseCSV = (text: string) => {
        const rows: string[][] = [];
        let currentRow: string[] = [];
        let currentField = '';
        let inQuotes = false;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const nextChar = text[i + 1];

            if (inQuotes) {
                if (char === '"') {
                    if (nextChar === '"') {
                        currentField += '"';
                        i++;
                    } else {
                        inQuotes = false;
                    }
                } else {
                    currentField += char;
                }
            } else {
                if (char === '"') {
                    inQuotes = true;
                } else if (char === ',') {
                    currentRow.push(currentField.trim());
                    currentField = '';
                } else if (char === '\r' || char === '\n') {
                    currentRow.push(currentField.trim());
                    if (currentRow.length > 0 && currentRow.some(f => f !== '')) {
                        rows.push(currentRow);
                    }
                    currentRow = [];
                    currentField = '';
                    if (char === '\r' && nextChar === '\n') i++;
                } else {
                    currentField += char;
                }
            }
        }

        if (currentField || currentRow.length > 0) {
            currentRow.push(currentField.trim());
            rows.push(currentRow);
        }

        return rows;
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!file.name.endsWith('.csv')) {
            alert('請選擇 CSV 檔案');
            return;
        }

        setImporting(true);
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target?.result as string;
                const rows = parseCSV(text);

                if (rows.length <= 1) {
                    alert('檔案中沒有資料');
                    return;
                }

                // 標題 mapping: 姓名,PIN碼,請假類型,開始時間,結束時間,事由
                const importRequests = [];
                for (let i = 1; i < rows.length; i++) {
                    const [name, pin, leave_type_name, start_date, end_date, reason, hours, manual_break_hours, is_makeup_workday] = rows[i];
                    if (!name || !pin || !leave_type_name || !start_date || !end_date) {
                        continue;
                    }

                    importRequests.push({
                        name,
                        pin,
                        leave_type_name,
                        start_date,
                        end_date,
                        reason,
                        hours: hours ? parseFloat(hours) : undefined,
                        manual_break_hours: manual_break_hours ? parseFloat(manual_break_hours) : undefined,
                        is_makeup_workday: is_makeup_workday === '是' || is_makeup_workday === 'yes' || is_makeup_workday === 'true'
                    });
                }

                if (importRequests.length === 0) {
                    alert('沒有有效的資料可匯入');
                    return;
                }

                const result = await requestService.importLeaveRequests(importRequests);

                let resultMsg = `匯入完成！\n成功：${result.succeeded} 筆\n已跳過(重複)：${result.skipped} 筆\n失敗：${result.failed} 筆`;
                if (result.errors.length > 0) {
                    resultMsg += `\n\n失敗詳情：\n` + result.errors.map(e => `第 ${e.line} 行 (${e.name}): ${e.error}`).join('\n');
                }

                alert(resultMsg);
                loadRequests();
            } catch (error: any) {
                alert(`匯入執行錯誤：${error.message}`);
            } finally {
                setImporting(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsText(file, 'UTF-8');
    };

    const handleDownloadTemplate = () => {
        const headers = ['姓名', 'PIN碼', '請假類型(例如:事假、特休)', '開始時間(YYYY-MM-DD HH:mm)', '結束時間(YYYY-MM-DD HH:mm)', '事由', '時數(選填)', '手動休息時數', '補班日(是/否)'].join(',');
        const example = ['王小明', '123456', '事假', '2026-03-01 09:00', '2026-03-01 18:00', '家庭私事', '', '', '否'].join(',');
        const template = `${headers}\n${example}`;
        const blob = new Blob(['\uFEFF' + template], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', '請假紀錄匯入範本.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <div>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-8">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">請假/出差申請</h1>
                    <p className="mt-1 text-sm text-slate-500 font-medium">管理員工的請假與出差申請工作流</p>
                </div>
                <div className="flex flex-wrap gap-2 md:gap-3">
                    <button
                        onClick={() => setIsEmployeeSelectOpen(true)}
                        className="flex-1 md:flex-none inline-flex items-center justify-center px-4 py-2.5 rounded-xl border border-transparent bg-blue-600 text-xs font-bold text-white hover:bg-blue-700 transition-all shadow-sm"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        新增申請
                    </button>
                    <button
                        onClick={handleDownloadTemplate}
                        className="flex-1 md:flex-none inline-flex items-center justify-center px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
                    >
                        <Download className="h-4 w-4 mr-2" />
                        下載範本
                    </button>
                    <button
                        onClick={handleImportClick}
                        disabled={importing}
                        className="flex-1 md:flex-none inline-flex items-center justify-center px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
                    >
                        <Upload className="h-4 w-4 mr-2" />
                        {importing ? '匯入中...' : '匯入 CSV'}
                    </button>
                    {selectedIds.size > 0 && filterStatus === RequestStatus.WITHDRAWN && (
                        <button
                            onClick={handleBatchDelete}
                            className="flex-1 md:flex-none inline-flex items-center justify-center px-4 py-2.5 rounded-xl border border-rose-200 bg-rose-50 text-xs font-bold text-rose-600 hover:bg-rose-100 transition-all shadow-sm"
                        >
                            <span className="material-symbols-outlined text-sm mr-2">delete_sweep</span>
                            批量刪除 ({selectedIds.size})
                        </button>
                    )}
                    {selectedIds.size > 0 && (filterStatus === 'ALL' || filterStatus === RequestStatus.PENDING || filterStatus === RequestStatus.WITHDRAW_PENDING) && (
                        <div className="flex gap-2">
                            <button
                                onClick={handleBatchApprove}
                                className="flex-1 md:flex-none inline-flex items-center justify-center px-4 py-2.5 rounded-xl border border-transparent bg-green-600 text-xs font-bold text-white hover:bg-green-700 transition-all shadow-sm"
                            >
                                <span className="material-symbols-outlined text-sm mr-2">done_all</span>
                                批量核准 ({selectedIds.size})
                            </button>
                            <button
                                onClick={handleBatchReject}
                                className="flex-1 md:flex-none inline-flex items-center justify-center px-4 py-2.5 rounded-xl border border-transparent bg-red-600 text-xs font-bold text-white hover:bg-red-700 transition-all shadow-sm"
                            >
                                <span className="material-symbols-outlined text-sm mr-2">close_fullscreen</span>
                                批量拒絕 ({selectedIds.size})
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* 統計卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
                    <div className="text-xs font-black text-slate-400 uppercase tracking-widest">已載入申請數</div>
                    <div className="text-2xl font-black text-slate-900 mt-1">
                        {requests.filter(r => r.status !== RequestStatus.WITHDRAWN && !r.is_modified).length}
                    </div>
                </div>
                <div className="bg-yellow-50 rounded-2xl shadow-sm border border-yellow-100 p-5">
                    <div className="text-xs font-black text-yellow-600 uppercase tracking-widest">待審核 (含撤回中)</div>
                    <div className="text-2xl font-black text-yellow-800 mt-1">
                        {requests.filter(r => r.status === RequestStatus.PENDING || r.status === RequestStatus.WITHDRAW_PENDING).length}
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
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm mb-4 space-y-5">
                <div className="flex flex-wrap items-end gap-3">
                    <label className="flex min-w-[180px] flex-1 flex-col gap-1.5 text-sm font-bold text-slate-600">
                        員工姓名
                        <input type="search" value={employeeSearch} onChange={e => setEmployeeSearch(e.target.value)}
                            placeholder="輸入姓名關鍵字" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-900 focus:border-blue-500 focus:outline-none" />
                    </label>
                    <label className="flex flex-col gap-1.5 text-sm font-bold text-slate-600">
                        差勤日期・起
                        <input type="date" value={leaveFrom} max={leaveTo || undefined} onChange={e => setLeaveFrom(e.target.value)}
                            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-900 focus:border-blue-500 focus:outline-none" />
                    </label>
                    <label className="flex flex-col gap-1.5 text-sm font-bold text-slate-600">
                        差勤日期・迄
                        <input type="date" value={leaveTo} min={leaveFrom || undefined} onChange={e => setLeaveTo(e.target.value)}
                            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-900 focus:border-blue-500 focus:outline-none" />
                    </label>
                    {(employeeSearch || leaveFrom || leaveTo) && (
                        <button type="button" onClick={() => { setEmployeeSearch(''); setLeaveFrom(''); setLeaveTo(''); }}
                            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">
                            清除搜尋
                        </button>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <p>依台灣時間的請假／出差起訖日篩選；跨日申請只要與所選日期區間重疊就會顯示。</p>
                    {!fullHistoryLoaded && (
                        <>
                            <span className="text-amber-600 font-bold">目前先載入最新 {requests.length} 筆以加快開啟速度。</span>
                            <button
                                type="button"
                                onClick={loadFullHistory}
                                disabled={loadingFullHistory}
                                className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-700 hover:bg-amber-100 disabled:opacity-60"
                            >
                                {loadingFullHistory ? '載入完整歷史中…' : '載入完整歷史'}
                            </button>
                        </>
                    )}
                    {fullHistoryLoaded && <span className="text-emerald-600 font-bold">已載入完整歷史。</span>}
                </div>
                {/* 狀態篩選 */}
                <div className="flex items-start gap-3">
                    <label className="text-sm font-bold text-slate-400 whitespace-nowrap mt-1.5 min-w-[3.5rem]">狀態：</label>
                    <div className="flex gap-2 flex-wrap">
                        {['ALL', 'PENDING', 'WITHDRAW_PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN'].map((status) => (
                            <button
                                key={status}
                                onClick={() => setFilterStatus(status)}
                                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${filterStatus === status
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-100 ring-2 ring-blue-100'
                                    : 'bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                                    }`}
                            >
                                {status === 'ALL' ? '全部' :
                                    status === 'PENDING' ? '待審核' :
                                        status === 'WITHDRAW_PENDING' ? '撤回中' :
                                            status === 'APPROVED' ? '已核准' :
                                                status === 'REJECTED' ? '已拒絕' : '已撤回'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 relative">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="min-w-full divide-y divide-slate-100">
                        <thead className="bg-slate-50/50">
                            <tr>
                                <th className="px-3 py-4 text-left w-10">
                                    <input
                                        type="checkbox"
                                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                        checked={pagedRequests.length > 0 && pagedRequests.every(r => selectedIds.has(r.id))}
                                        aria-label="選取本頁全部申請"
                                        onChange={toggleAllSelection}
                                    />
                                </th>
                                <TableHeaderFilter
                                    columnKey="employee"
                                    portal
                                    label="員工"
                                    values={requests.map((r: any) => r.employee_name || r.employee?.name || '未知員工')}
                                    selectedValues={columnFilters.employee}
                                    onChange={(values) => setColumnFilters({ ...columnFilters, employee: values })}
                                    className="w-24"
                                />
                                <TableHeaderFilter
                                    columnKey="department"
                                    portal
                                    label="部門"
                                    values={requests.map((r: any) => r.employee?.department || '未分配')}
                                    selectedValues={columnFilters.department}
                                    onChange={(values) => setColumnFilters({ ...columnFilters, department: values })}
                                    className="w-24"
                                />
                                <TableHeaderFilter
                                    columnKey="leaveType"
                                    portal
                                    label="類型"
                                    values={requests.map((r: any) => r.leave_type?.name || '-')}
                                    selectedValues={columnFilters.leaveType}
                                    onChange={(values) => setColumnFilters({ ...columnFilters, leaveType: values })}
                                    className="w-20"
                                />
                                <th className="px-2.5 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest min-w-[200px]">日期時間</th>
                                <TableHeaderFilter
                                    columnKey="hasCar"
                                    portal
                                    label="車"
                                    values={requests.map((r: any) => r.car ? '有' : '無')}
                                    selectedValues={columnFilters.hasCar}
                                    onChange={(values) => setColumnFilters({ ...columnFilters, hasCar: values })}
                                    className="w-16"
                                />
                                <TableHeaderFilter
                                    columnKey="deputy"
                                    portal
                                    label="代理人"
                                    values={requests.map((r: any) => r.deputy?.name || '未指定')}
                                    selectedValues={columnFilters.deputy}
                                    onChange={(values) => setColumnFilters({ ...columnFilters, deputy: values })}
                                    className="w-20"
                                />
                                <th className="px-2.5 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest min-w-[120px] max-w-[180px]">事由</th>
                                <TableHeaderFilter<RequestStatus>
                                    columnKey="status"
                                    portal
                                    label="狀態"
                                    values={[RequestStatus.PENDING, RequestStatus.WITHDRAW_PENDING, RequestStatus.APPROVED, RequestStatus.REJECTED, RequestStatus.WITHDRAWN]}
                                    selectedValues={columnFilters.status}
                                    onChange={(values) => setColumnFilters({ ...columnFilters, status: values })}
                                    valueFormatter={(v) => {
                                        const labels = {
                                            [RequestStatus.PENDING]: '待審',
                                            [RequestStatus.WITHDRAW_PENDING]: '撤回中',
                                            [RequestStatus.APPROVED]: '核准',
                                            [RequestStatus.REJECTED]: '拒絕',
                                            [RequestStatus.WITHDRAWN]: '撤回'
                                        };
                                        return labels[v] || v;
                                    }}
                                    className="w-20"
                                />
                                <th className="px-2.5 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest w-14">附件</th>
                                <th className="px-2.5 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest w-24">操作</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-50">
                            {filteredRequests.length === 0 ? (
                                <tr>
                                    <td colSpan={12} className="px-6 py-12 text-center text-slate-500">
                                        {requests.length === 0 ? '目前沒有申請記錄' : '沒有符合篩選條件的申請'}
                                    </td>
                                </tr>
                            ) : (
                                pagedRequests.map((request: any) => {
                                    const statusBadge = getStatusBadge(request.status);
                                    return (
                                        <tr key={request.id} className={`hover:bg-slate-50 ${selectedIds.has(request.id) ? 'bg-blue-50/30' : ''}`}>
                                            <td className="px-3 py-4 whitespace-nowrap">
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                    checked={selectedIds.has(request.id)}
                                                    onChange={() => toggleSelection(request.id)}
                                                />
                                            </td>
                                            <td className="px-2.5 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                                                {request.employee_name || request.employee?.name || '未知員工'}
                                            </td>
                                            <td className="px-2.5 py-4 whitespace-nowrap text-sm text-slate-600">
                                                <span className="px-2 py-1 bg-slate-100 rounded text-xs">
                                                    {request.employee?.department || '未分配'}
                                                </span>
                                            </td>
                                            <td className="px-2.5 py-4 whitespace-nowrap text-sm">
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
                                            <td className="px-2.5 py-4 whitespace-nowrap text-sm text-slate-500 font-medium">
                                                {formatDateTimeRange(request.start_date, request.end_date)}
                                            </td>
                                            <td className="px-2.5 py-4 whitespace-nowrap text-sm text-slate-600">
                                                {request.car ? (
                                                    <span className="flex flex-col">
                                                        <span className="font-black text-blue-600">{request.car.plate_number}</span>
                                                        <span className="text-[10px] text-slate-400 font-bold">{request.car.model}</span>
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-300">-</span>
                                                )}
                                            </td>
                                            <td className="px-2.5 py-4 whitespace-nowrap text-sm">
                                                <div className="flex items-center gap-1">
                                                    {request.deputy ? (
                                                        <span className="font-bold text-slate-700">{request.deputy.name}</span>
                                                    ) : (
                                                        <span className="text-slate-300">未指定</span>
                                                    )}
                                                    {request.status !== RequestStatus.WITHDRAWN && (
                                                        <button
                                                            onClick={() => openDeputyEdit(request)}
                                                            className="ml-1 p-0.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-all"
                                                            title="變更代理人"
                                                        >
                                                            <span className="material-symbols-outlined text-sm">edit</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-2.5 py-4 text-sm text-slate-500 max-w-[150px] truncate">
                                                {request.reason}
                                            </td>
                                            <td className="px-2.5 py-4 whitespace-nowrap">
                                                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${statusBadge.style}`}>
                                                    {statusBadge.label}
                                                </span>
                                            </td>
                                            <td className="px-2.5 py-4 whitespace-nowrap text-sm">
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
                                                    <span className="text-slate-300">-</span>
                                                )}
                                            </td>
                                            <td className="px-2.5 py-4 whitespace-nowrap text-sm">
                                                {(request.status === RequestStatus.PENDING || request.status === RequestStatus.WITHDRAW_PENDING) && (
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => handleApprove(request.id)}
                                                            className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 font-medium transition-colors"
                                                        >
                                                            {request.status === RequestStatus.WITHDRAW_PENDING ? '核准撤回' : '核准'}
                                                        </button>
                                                        <button
                                                            onClick={() => handleReject(request.id)}
                                                            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 font-medium transition-colors"
                                                        >
                                                            {request.status === RequestStatus.WITHDRAW_PENDING ? '拒絕撤回' : '拒絕'}
                                                        </button>
                                                    </div>
                                                )}
                                                {request.status === RequestStatus.WITHDRAWN && (
                                                    <button
                                                        onClick={() => handleDelete(request.id)}
                                                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all border border-transparent hover:border-rose-100"
                                                        title="永久刪除"
                                                    >
                                                        <span className="material-symbols-outlined text-lg">delete</span>
                                                    </button>
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
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 text-sm text-slate-600">
                <span>篩選後 {filteredRequests.length} 筆{filteredRequests.length > 0 ? `・顯示第 ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filteredRequests.length)} 筆` : ''}</span>
                <div className="flex flex-wrap items-center gap-2">
                    <label htmlFor="requests-page-size">每頁</label>
                    <select id="requests-page-size" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                        {[20, 50, 100].map(size => <option key={size} value={size}>{size} 筆</option>)}
                    </select>
                    <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40">上一頁</button>
                    <span className="min-w-[4.5rem] text-center tabular-nums">{currentPage} / {totalPages}</span>
                    <button type="button" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40">下一頁</button>
                </div>
            </div>
            <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" />

            {isEmployeeSelectOpen && (
                <EmployeeSelectModal
                    isOpen={isEmployeeSelectOpen}
                    onClose={() => setIsEmployeeSelectOpen(false)}
                    onSelect={(id) => {
                        setSelectedEmployeeIdForRequest(id);
                        setIsEmployeeSelectOpen(false);
                    }}
                    title="選擇代為申請差勤的員工"
                />
            )}

            {selectedEmployeeIdForRequest && (
                <LeaveRequestForm
                    employeeId={selectedEmployeeIdForRequest}
                    onClose={() => setSelectedEmployeeIdForRequest(null)}
                    onSuccess={() => {
                        setSelectedEmployeeIdForRequest(null);
                        loadRequests();
                        alert('代為申請已成功提交！');
                    }}
                    isAdmin={true}
                />
            )}

            {/* Deputy Edit Modal */}
            {showDeputyEdit && (
                <div
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                    onClick={() => setShowDeputyEdit(false)}
                >
                    <div
                        className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-14 h-14 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600 border border-purple-100">
                                <span className="material-symbols-outlined text-3xl">person_pin</span>
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-900">變更職務代理人</h3>
                                <p className="text-xs text-slate-500 font-medium">目前：{deputyEditCurrentName}</p>
                            </div>
                        </div>

                        <div className="mb-6">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">新代理人</label>
                            <div className="relative">
                                <select
                                    value={selectedNewDeputyId}
                                    onChange={(e) => setSelectedNewDeputyId(e.target.value)}
                                    className="w-full p-3 pl-10 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-purple-200 focus:border-purple-400 outline-none transition-all font-bold appearance-none cursor-pointer"
                                >
                                    <option value="">請選擇代理人</option>
                                    <option value="NONE">無代理人</option>
                                    {deputyEmployees.map((emp) => (
                                        <option key={emp.id} value={emp.id}>
                                            {emp.name} - {emp.department}
                                        </option>
                                    ))}
                                </select>
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">person_pin</span>
                                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeputyEdit(false)}
                                className="flex-1 px-6 py-3.5 bg-slate-100 text-slate-700 rounded-xl font-black hover:bg-slate-200 transition-colors"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleUpdateDeputy}
                                disabled={isUpdatingDeputy || (!selectedNewDeputyId)}
                                className="flex-1 px-6 py-3.5 bg-purple-600 text-white rounded-xl font-black hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isUpdatingDeputy ? (
                                    <>
                                        <span className="animate-spin material-symbols-outlined text-sm">progress_activity</span>
                                        更新中...
                                    </>
                                ) : (
                                    '確認變更'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};

export default RequestsPage;

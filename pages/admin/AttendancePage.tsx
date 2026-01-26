import React, { useEffect, useState } from 'react';
import { Download, Trash2 } from 'lucide-react';
import { getAttendanceLogs, deleteAttendanceLog } from '../../services/admin';
import { format } from 'date-fns';

interface DepartmentStats {
    department: string;
    count: number;
}

const AttendancePage: React.FC = () => {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [filterDepartment, setFilterDepartment] = useState<string>('ALL');
    const [filterType, setFilterType] = useState<string>('ALL');
    const [departments, setDepartments] = useState<string[]>([]);
    const [deleteConfirmModal, setDeleteConfirmModal] = useState(false);
    const [deletingLogId, setDeletingLogId] = useState<string | null>(null);

    useEffect(() => {
        fetchLogs();
    }, [startDate, endDate]);

    const fetchLogs = async () => {
        setLoading(true);
        const data = await getAttendanceLogs(startDate || undefined, endDate || undefined);
        setLogs(data || []);

        // 提取所有部門
        const deptSet = new Set<string>();
        (data || []).forEach((log: any) => {
            if (log.employees?.department) {
                deptSet.add(log.employees.department);
            }
        });
        setDepartments(Array.from(deptSet).sort());

        setLoading(false);
    };

    const handleDeleteLog = async (id: string) => {
        setDeletingLogId(id);
        setDeleteConfirmModal(true);
    };

    const confirmDelete = async () => {
        if (!deletingLogId) return;

        const result = await deleteAttendanceLog(deletingLogId);
        if (result.success) {
            await fetchLogs();
        } else {
            alert(`刪除失敗：${result.error}`);
        }

        setDeleteConfirmModal(false);
        setDeletingLogId(null);
    };

    // 篩選邏輯
    const filteredLogs = logs.filter(log => {
        const deptMatch = filterDepartment === 'ALL' || log.employees?.department === filterDepartment;
        const typeMatch = filterType === 'ALL' || log.check_type === filterType;
        return deptMatch && typeMatch;
    });

    // 計算各部門的打卡數量
    const getDepartmentStats = (): DepartmentStats[] => {
        const stats = new Map<string, number>();
        logs.forEach((log: any) => {
            const dept = log.employees?.department || '未分配';
            stats.set(dept, (stats.get(dept) || 0) + 1);
        });
        return Array.from(stats.entries()).map(([department, count]) => ({ department, count }));
    };

    const handleExportCSV = () => {
        if (filteredLogs.length === 0) return;

        const headers = ['員工姓名', '部門', 'PIN (前5碼)', '打卡類型', '打卡時間', '緯度', '經度', '定位精度(公尺)'];
        const rows = filteredLogs.map(log => [
            log.employees?.name || 'Unknown',
            log.employees?.department || '',
            `*****${(log.employees?.pin || '').slice(-1)}`,
            log.check_type === 'IN' ? '上班' : '下班',
            format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss'),
            log.latitude || '',
            log.longitude || '',
            log.location_accuracy || ''
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `attendance_export_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`;
        link.click();
    };

    const departmentStats = getDepartmentStats();

    // 將打卡紀錄按日期與員工整併
    const groupedLogsValue = React.useMemo(() => {
        const groups: { [key: string]: any } = {};

        filteredLogs.forEach(log => {
            const dateObj = new Date(log.timestamp);
            const dateKey = format(dateObj, 'yyyy-MM-dd');
            const empId = log.employee_id;
            const key = `${dateKey}-${empId}`;

            if (!groups[key]) {
                groups[key] = {
                    key,
                    dateKey,
                    timestamp: dateObj.getTime(), // 用於排序
                    employee: log.employees,
                    logs: []
                };
            }

            groups[key].logs.push({
                id: log.id,
                type: log.check_type,
                timestamp: log.timestamp,
                time: format(dateObj, 'HH:mm'),
                latitude: log.latitude,
                longitude: log.longitude,
                accuracy: log.location_accuracy
            });
        });

        // 轉換為陣列並排序（日期由新到舊，組內時間由早到晚）
        return Object.values(groups)
            .sort((a: any, b: any) => b.timestamp - a.timestamp)
            .map((group: any) => ({
                ...group,
                logs: group.logs.sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
            }));
    }, [filteredLogs]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">出勤紀錄管理</h1>
                    <p className="mt-1 text-sm text-slate-500 font-medium">
                        查看、篩選並匯出所有員工作業時間點。
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={handleExportCSV}
                        disabled={filteredLogs.length === 0}
                        className="flex-1 lg:flex-none inline-flex items-center justify-center px-6 py-2.5 rounded-xl bg-blue-600 text-sm font-bold text-white shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all disabled:opacity-50"
                    >
                        <Download className="h-4 w-4 mr-2" />
                        匯出 CSV ({filteredLogs.length})
                    </button>
                </div>
            </div>

            {/* 統計卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                    <div className="text-xs font-black text-slate-400 uppercase tracking-widest">總打卡次數</div>
                    <div className="text-2xl font-black text-slate-900 mt-1">{logs.length}</div>
                </div>
                <div className="bg-emerald-50 rounded-2xl border border-emerald-100 p-5 shadow-sm">
                    <div className="text-xs font-black text-emerald-600 uppercase tracking-widest">上班打卡</div>
                    <div className="text-2xl font-black text-emerald-800 mt-1">
                        {logs.filter(l => l.check_type === 'IN').length}
                    </div>
                </div>
                <div className="bg-orange-50 rounded-2xl border border-orange-100 p-5 shadow-sm">
                    <div className="text-xs font-black text-orange-600 uppercase tracking-widest">下班打卡</div>
                    <div className="text-2xl font-black text-orange-800 mt-1">
                        {logs.filter(l => l.check_type === 'OUT').length}
                    </div>
                </div>
                <div className="bg-purple-50 rounded-2xl border border-purple-100 p-5 shadow-sm">
                    <div className="text-xs font-black text-purple-600 uppercase tracking-widest">活動部門數</div>
                    <div className="text-2xl font-black text-purple-800 mt-1">{departments.length}</div>
                </div>
            </div>

            {/* 篩選與搜尋工具列 */}
            <div className="flex flex-col gap-4 bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                <div className="flex gap-4 items-center flex-wrap">
                    <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-slate-400">calendar_today</span>
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="px-3 py-2 border-slate-200 bg-slate-50/50 rounded-xl text-sm font-bold focus:ring-blue-500 border transition-all"
                            />
                            <span className="text-slate-300">至</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="px-3 py-2 border-slate-200 bg-slate-50/50 rounded-xl text-sm font-bold focus:ring-blue-500 border transition-all"
                            />
                        </div>
                    </div>

                    <div className="h-6 w-px bg-slate-100"></div>

                    <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-slate-400">filter_alt</span>
                        <div className="flex gap-2">
                            {['ALL', 'IN', 'OUT'].map((type) => (
                                <button
                                    key={type}
                                    onClick={() => setFilterType(type)}
                                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${filterType === type
                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-100'
                                        : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                                        }`}
                                >
                                    {type === 'ALL' ? '全部類型' : type === 'IN' ? '上班' : '下班'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {departments.length > 0 && (
                    <div className="flex items-center gap-3 flex-wrap">
                        <span className="material-symbols-outlined text-slate-400">domain</span>
                        <div className="flex gap-2 flex-wrap">
                            <button
                                onClick={() => setFilterDepartment('ALL')}
                                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${filterDepartment === 'ALL'
                                    ? 'bg-purple-600 text-white shadow-md shadow-purple-100'
                                    : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                                    }`}
                            >
                                全部部門
                            </button>
                            {departments.map((dept) => {
                                const stat = departmentStats.find(s => s.department === dept);
                                return (
                                    <button
                                        key={dept}
                                        onClick={() => setFilterDepartment(dept)}
                                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${filterDepartment === dept
                                            ? 'bg-purple-600 text-white shadow-md shadow-purple-100'
                                            : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-transparent'
                                            }`}
                                    >
                                        {dept}
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${filterDepartment === dept ? 'bg-white/20' : 'bg-slate-200 text-slate-600'}`}>
                                            {stat?.count || 0}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="min-w-full divide-y divide-slate-100">
                        <thead className="bg-slate-50/50">
                            <tr>
                                <th className="px-8 py-5 text-left text-xs font-black text-slate-400 uppercase tracking-widest">日期</th>
                                <th className="px-8 py-5 text-left text-xs font-black text-slate-400 uppercase tracking-widest">員工姓名</th>
                                <th className="px-8 py-5 text-left text-xs font-black text-slate-400 uppercase tracking-widest">部門</th>
                                <th className="px-8 py-5 text-left text-xs font-black text-slate-400 uppercase tracking-widest">打卡歷程時間軸 (Location)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="px-8 py-20 text-center text-slate-400 font-bold">載入中...</td>
                                </tr>
                            ) : groupedLogsValue.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-8 py-20 text-center text-slate-400 font-bold">沒有符合條件的紀錄</td>
                                </tr>
                            ) : groupedLogsValue.map((group) => (
                                <tr key={group.key} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-8 py-5 whitespace-nowrap">
                                        <div className="text-sm font-black text-slate-400 font-mono tracking-tighter">
                                            {group.dateKey}
                                        </div>
                                    </td>
                                    <td className="px-8 py-5 whitespace-nowrap">
                                        <div className="text-base font-black text-slate-900">{group.employee?.name}</div>
                                    </td>
                                    <td className="px-8 py-5 whitespace-nowrap">
                                        <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-black">
                                            {group.employee?.department || '未分配'}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="flex flex-wrap gap-4 items-center">
                                            {group.logs.map((log: any, idx: number) => (
                                                <div key={log.id} className="flex items-center gap-3">
                                                    <div className={`relative group inline-flex flex-col p-3 rounded-2xl border transition-all hover:shadow-md ${log.type === 'IN'
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100'
                                                        : 'bg-orange-50 text-orange-700 border-orange-100 hover:bg-orange-100'
                                                        }`}>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="material-symbols-outlined text-[18px]">
                                                                {log.type === 'IN' ? 'login' : 'logout'}
                                                            </span>
                                                            <span className="text-sm font-black font-mono tracking-tight">{log.time}</span>
                                                            <span className="text-[10px] font-black opacity-60 uppercase tracking-widest">
                                                                {log.type === 'IN' ? '上班' : '下班'}
                                                            </span>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDeleteLog(log.id);
                                                                }}
                                                                className="ml-auto p-1 opacity-0 group-hover:opacity-100 hover:bg-white/50 rounded-lg transition-all text-slate-400 hover:text-rose-600"
                                                                title="刪除紀錄"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </button>
                                                        </div>
                                                        {log.latitude && (
                                                            <a
                                                                href={`https://www.google.com/maps?q=${log.latitude},${log.longitude}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="flex items-center gap-1 opacity-50 hover:opacity-100 text-[10px] font-bold transition-all hover:text-blue-600 cursor-pointer group/location"
                                                                title="在 Google 地圖中查看"
                                                            >
                                                                <span className="material-symbols-outlined text-[12px] group-hover/location:scale-110 transition-transform">location_on</span>
                                                                <span className="truncate max-w-[120px] underline decoration-dotted underline-offset-2">
                                                                    {Number(log.latitude).toFixed(4)}, {Number(log.longitude).toFixed(4)}
                                                                </span>
                                                            </a>
                                                        )}
                                                        {/* Tooltip for accuracy */}
                                                        {log.accuracy && (
                                                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                                                精度: {Math.round(log.accuracy)}m
                                                            </div>
                                                        )}
                                                    </div>
                                                    {idx < group.logs.length - 1 && (
                                                        <span className="material-symbols-outlined text-slate-300 text-xl">double_arrow</span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 刪除確認彈出框 */}
            {deleteConfirmModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95 duration-300">
                        <div className="flex items-center justify-center w-16 h-16 bg-rose-50 rounded-2xl mx-auto mb-6">
                            <span className="material-symbols-outlined text-4xl text-rose-600">warning</span>
                        </div>

                        <h2 className="text-2xl font-black text-slate-900 mb-3 text-center">
                            確定要刪除此筆打卡紀錄嗎？
                        </h2>

                        <p className="text-slate-500 text-center mb-8 font-medium">
                            此動作無法復原，打卡紀錄將永久刪除。
                        </p>

                        <div className="flex gap-4">
                            <button
                                type="button"
                                onClick={() => {
                                    setDeleteConfirmModal(false);
                                    setDeletingLogId(null);
                                }}
                                className="flex-1 px-6 py-4 bg-white text-slate-500 border border-slate-100 rounded-2xl font-black hover:bg-slate-50 transition-all"
                            >
                                取消
                            </button>
                            <button
                                type="button"
                                onClick={confirmDelete}
                                className="flex-1 px-6 py-4 bg-rose-600 text-white rounded-2xl font-black shadow-xl shadow-rose-100 hover:bg-rose-700 transition-all active:scale-95"
                            >
                                確定刪除
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AttendancePage;


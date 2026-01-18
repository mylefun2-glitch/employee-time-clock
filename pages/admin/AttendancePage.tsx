import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { getAttendanceLogs } from '../../services/admin';
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

    return (
        <div className="space-y-6">
            <div className="sm:flex sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">出勤紀錄</h1>
                    <p className="mt-2 text-sm text-slate-700">
                        查看並匯出員工打卡紀錄。
                    </p>
                </div>
                <div className="mt-4 sm:mt-0">
                    <button
                        type="button"
                        onClick={handleExportCSV}
                        disabled={filteredLogs.length === 0}
                        className="inline-flex items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Download className="h-4 w-4 mr-2" />
                        匯出 CSV ({filteredLogs.length} 筆)
                    </button>
                </div>
            </div>

            {/* 統計卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg shadow-sm border border-slate-100 p-4">
                    <div className="text-sm text-slate-500">總打卡數</div>
                    <div className="text-2xl font-bold text-slate-800 mt-1">{logs.length}</div>
                </div>
                <div className="bg-emerald-50 rounded-lg shadow-sm border border-emerald-100 p-4">
                    <div className="text-sm text-emerald-700">上班打卡</div>
                    <div className="text-2xl font-bold text-emerald-800 mt-1">
                        {logs.filter(l => l.check_type === 'IN').length}
                    </div>
                </div>
                <div className="bg-orange-50 rounded-lg shadow-sm border border-orange-100 p-4">
                    <div className="text-sm text-orange-700">下班打卡</div>
                    <div className="text-2xl font-bold text-orange-800 mt-1">
                        {logs.filter(l => l.check_type === 'OUT').length}
                    </div>
                </div>
                <div className="bg-purple-50 rounded-lg shadow-sm border border-purple-100 p-4">
                    <div className="text-sm text-purple-700">部門數量</div>
                    <div className="text-2xl font-bold text-purple-800 mt-1">{departments.length}</div>
                </div>
            </div>

            {/* 日期篩選 */}
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                <div className="flex gap-4 items-end flex-wrap">
                    <div>
                        <label htmlFor="start-date" className="block text-sm font-medium text-slate-700 mb-1">開始日期</label>
                        <input
                            type="date"
                            id="start-date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                        />
                    </div>
                    <div>
                        <label htmlFor="end-date" className="block text-sm font-medium text-slate-700 mb-1">結束日期</label>
                        <input
                            type="date"
                            id="end-date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                        />
                    </div>
                    <div className="pb-1 text-sm text-slate-500">
                        顯示 {filteredLogs.length} / {logs.length} 筆資料
                    </div>
                </div>
            </div>

            {/* 篩選器 */}
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                <div className="flex gap-6 items-center flex-wrap">
                    {/* 打卡類型篩選 */}
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-slate-700 whitespace-nowrap">類型：</label>
                        <div className="flex gap-2">
                            {['ALL', 'IN', 'OUT'].map((type) => (
                                <button
                                    key={type}
                                    onClick={() => setFilterType(type)}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterType === type
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                >
                                    {type === 'ALL' ? '全部' : type === 'IN' ? '上班' : '下班'}
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

            {/* Table */}
            <div className="flex flex-col">
                <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
                    <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
                        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                            <table className="min-w-full divide-y divide-slate-300">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-slate-900 sm:pl-6">
                                            姓名
                                        </th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">
                                            部門
                                        </th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">
                                            打卡類型
                                        </th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">
                                            時間
                                        </th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">
                                            位置
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 bg-white">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={5} className="py-8 text-center text-slate-500 text-sm">
                                                載入中...
                                            </td>
                                        </tr>
                                    ) : filteredLogs.map((log) => (
                                        <tr key={log.id} className="hover:bg-slate-50">
                                            <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-slate-900 sm:pl-6">
                                                {log.employees?.name || 'Unknown'}
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-600">
                                                <span className="px-2 py-1 bg-slate-100 rounded text-xs">
                                                    {log.employees?.department || '未分配'}
                                                </span>
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">
                                                <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${log.check_type === 'IN'
                                                    ? 'bg-emerald-100 text-emerald-800'
                                                    : 'bg-orange-100 text-orange-800'
                                                    }`}>
                                                    {log.check_type === 'IN' ? '上班' : '下班'}
                                                </span>
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">
                                                {format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss')}
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">
                                                {log.latitude && log.longitude ? (
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="text-xs font-mono">
                                                            {Number(log.latitude).toFixed(6)}, {Number(log.longitude).toFixed(6)}
                                                        </span>
                                                        {log.location_accuracy && (
                                                            <span className="text-xs text-slate-400">
                                                                精度: {Math.round(log.location_accuracy)}m
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-400">無位置資訊</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {!loading && filteredLogs.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="py-8 text-center text-slate-500 text-sm">
                                                {logs.length === 0 ? '沒有打卡紀錄' : '沒有符合篩選條件的紀錄'}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AttendancePage;

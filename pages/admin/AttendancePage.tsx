import React, { useEffect, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { getAttendanceLogs } from '../../services/admin';
import { format } from 'date-fns';

const AttendancePage: React.FC = () => {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    useEffect(() => {
        fetchLogs();
    }, [startDate, endDate]);

    const fetchLogs = async () => {
        setLoading(true);
        const data = await getAttendanceLogs(startDate || undefined, endDate || undefined);
        setLogs(data || []);
        setLoading(false);
    };

    const handleExportCSV = () => {
        if (logs.length === 0) return;

        const headers = ['員工姓名', '部門', 'PIN (前5碼)', '打卡類型', '打卡時間'];
        const rows = logs.map(log => [
            log.employees?.name || 'Unknown',
            log.employees?.department || '',
            `*****${(log.employees?.pin || '').slice(-1)}`,
            log.check_type === 'IN' ? '上班' : '下班',
            format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss')
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
                        disabled={logs.length === 0}
                        className="inline-flex items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Download className="h-4 w-4 mr-2" />
                        匯出 CSV
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-4 items-end bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
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
                    共 {logs.length} 筆資料
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
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 bg-white">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={4} className="py-8 text-center text-slate-500 text-sm">
                                                載入中...
                                            </td>
                                        </tr>
                                    ) : logs.map((log) => (
                                        <tr key={log.id}>
                                            <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-slate-900 sm:pl-6">
                                                {log.employees?.name || 'Unknown'}
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">
                                                {log.employees?.department}
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
                                        </tr>
                                    ))}
                                    {!loading && logs.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="py-8 text-center text-slate-500 text-sm">
                                                沒有符合條件的紀錄
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

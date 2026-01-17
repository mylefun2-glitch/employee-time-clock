import React, { useEffect, useState, useRef } from 'react';
import { Plus, Pencil, Trash2, Search, Upload, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Employee } from '../../services/attendance';
import { createEmployee, updateEmployee, deleteEmployee } from '../../services/admin';
import EmployeeModal from '../../components/admin/EmployeeModal';

interface ImportResult {
    success: number;
    failed: number;
    errors: string[];
}

const EmployeesPage: React.FC = () => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [importing, setImporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

    useEffect(() => {
        fetchEmployees();
    }, []);

    const fetchEmployees = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('employees')
                .select('*')
                .order('name');
            if (error) throw error;
            setEmployees(data || []);
        } catch (error) {
            console.error('Error fetching employees:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = () => {
        setEditingEmployee(null);
        setIsModalOpen(true);
    };

    const handleEdit = (employee: Employee) => {
        setEditingEmployee(employee);
        setIsModalOpen(true);
    };

    const handleDelete = async (employee: Employee) => {
        if (!confirm(`確定要將員工 ${employee.name} 設為離職狀態嗎？`)) {
            return;
        }

        const result = await deleteEmployee(employee.id);
        if (result.success) {
            fetchEmployees();
        } else {
            alert(`操作失敗: ${result.error}`);
        }
    };

    const handleSubmit = async (data: { name: string; pin: string; department: string; is_active: boolean }) => {
        let result;
        if (editingEmployee) {
            result = await updateEmployee(editingEmployee.id, data);
        } else {
            result = await createEmployee(data.name, data.pin, data.department);
        }

        if (!result.success) {
            throw new Error(result.error);
        }

        fetchEmployees();
    };

    // CSV 匯入功能
    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // 檢查檔案類型
        if (!file.name.endsWith('.csv')) {
            alert('請選擇 CSV 檔案');
            return;
        }

        setImporting(true);
        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const text = e.target?.result as string;
                const result = await parseAndImportCSV(text);

                // 顯示結果
                let message = `匯入完成！\n成功：${result.success} 筆\n失敗：${result.failed} 筆`;
                if (result.errors.length > 0) {
                    message += '\n\n錯誤詳情：\n' + result.errors.join('\n');
                }
                alert(message);

                // 重新載入員工列表
                await fetchEmployees();
            } catch (error: any) {
                alert(`匯入失敗：${error.message}`);
            } finally {
                setImporting(false);
                // 清空 input 以允許重複選擇同一檔案
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            }
        };

        reader.readAsText(file, 'UTF-8');
    };

    const parseAndImportCSV = async (csvText: string): Promise<ImportResult> => {
        const lines = csvText.split('\n').filter(line => line.trim());
        const result: ImportResult = {
            success: 0,
            failed: 0,
            errors: []
        };

        // 跳過標題行（第一行）
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            try {
                // 解析 CSV 行（處理逗號分隔）
                const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));

                if (values.length < 3) {
                    result.failed++;
                    result.errors.push(`第 ${i + 1} 行：欄位不足（需要：姓名,PIN碼,部門）`);
                    continue;
                }

                const [name, pin, department] = values;

                // 驗證資料
                if (!name || !pin || !department) {
                    result.failed++;
                    result.errors.push(`第 ${i + 1} 行：有空白欄位`);
                    continue;
                }

                if (pin.length !== 6 || !/^\d+$/.test(pin)) {
                    result.failed++;
                    result.errors.push(`第 ${i + 1} 行：PIN 碼必須是 6 位數字（${name}）`);
                    continue;
                }

                // 檢查 PIN 是否已存在
                const { data: existing } = await supabase
                    .from('employees')
                    .select('id')
                    .eq('pin', pin)
                    .single();

                if (existing) {
                    result.failed++;
                    result.errors.push(`第 ${i + 1} 行：PIN 碼 ${pin} 已存在（${name}）`);
                    continue;
                }

                // 建立員工
                const createResult = await createEmployee(name, pin, department);

                if (createResult.success) {
                    result.success++;
                } else {
                    result.failed++;
                    result.errors.push(`第 ${i + 1} 行：${createResult.error}（${name}）`);
                }
            } catch (error: any) {
                result.failed++;
                result.errors.push(`第 ${i + 1} 行：${error.message}`);
            }
        }

        return result;
    };

    // 下載 CSV 範本
    const handleDownloadTemplate = () => {
        const template = '姓名,PIN碼,部門\n張三,123456,IT Dept\n李四,234567,HR Dept\n王五,345678,Sales Dept';
        const blob = new Blob(['\uFEFF' + template], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;

        // 加入時間戳記讓檔案名稱更明顯
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        link.download = `員工匯入範本_${timestamp}.csv`;

        link.click();
        URL.revokeObjectURL(url);

        // 顯示下載成功提示
        setTimeout(() => {
            alert('範本已下載！\n\n檔案位置：瀏覽器的下載資料夾\n檔案名稱：員工匯入範本_' + timestamp + '.csv\n\n在 macOS 上通常是：/Users/您的使用者名稱/Downloads/');
        }, 100);
    };

    const filteredEmployees = employees.filter(emp =>
        emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (emp as any).pin.includes(searchTerm)
    );

    return (
        <div className="space-y-6">
            <div className="sm:flex sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">員工管理</h1>
                    <p className="mt-2 text-sm text-slate-700">
                        管理所有員工資料、PIN 碼與部門資訊。
                    </p>
                </div>
                <div className="mt-4 sm:mt-0 flex gap-2">
                    <button
                        type="button"
                        onClick={handleDownloadTemplate}
                        className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                        <Download className="h-4 w-4 mr-2" />
                        下載範本
                    </button>
                    <button
                        type="button"
                        onClick={handleImportClick}
                        disabled={importing}
                        className="inline-flex items-center justify-center rounded-md border border-transparent bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
                    >
                        <Upload className="h-4 w-4 mr-2" />
                        {importing ? '匯入中...' : '匯入 CSV'}
                    </button>
                    <button
                        type="button"
                        onClick={handleCreate}
                        className="inline-flex items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        新增員工
                    </button>
                </div>
            </div>

            {/* 隱藏的檔案輸入 */}
            <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
            />

            {/* 使用說明 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-blue-800 mb-2">📋 CSV 匯入說明</h3>
                <ul className="text-sm text-blue-700 space-y-1">
                    <li>• CSV 檔案格式：姓名,PIN碼,部門</li>
                    <li>• PIN 碼必須是 6 位數字且不可重複</li>
                    <li>• 第一行為標題行，將被忽略</li>
                    <li>• 建議先下載範本參考格式</li>
                </ul>
            </div>

            {/* Search */}
            <div className="relative max-w-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-slate-400" />
                </div>
                <input
                    type="text"
                    className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-md leading-5 bg-white placeholder-slate-500 focus:outline-none focus:placeholder-slate-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="搜尋姓名、部門或 PIN..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
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
                                            PIN 碼
                                        </th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">
                                            狀態
                                        </th>
                                        <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                                            <span className="sr-only">Actions</span>
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
                                    ) : filteredEmployees.map((person) => (
                                        <tr key={person.id}>
                                            <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-slate-900 sm:pl-6">
                                                {person.name}
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">
                                                {person.department}
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500 font-mono">
                                                *****{(person as any).pin.slice(-1)}
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">
                                                <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${(person as any).is_active
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-red-100 text-red-800'
                                                    }`}>
                                                    {(person as any).is_active ? '在職' : '離職'}
                                                </span>
                                            </td>
                                            <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                                <button
                                                    onClick={() => handleEdit(person)}
                                                    className="text-blue-600 hover:text-blue-900 mr-4"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(person)}
                                                    className="text-red-600 hover:text-red-900"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {!loading && filteredEmployees.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="py-8 text-center text-slate-500 text-sm">
                                                沒有找到員工資料
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <EmployeeModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleSubmit}
                employee={editingEmployee}
            />
        </div>
    );
};

export default EmployeesPage;

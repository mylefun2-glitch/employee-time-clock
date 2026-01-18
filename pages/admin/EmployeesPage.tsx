import React, { useEffect, useState, useRef } from 'react';
import { Plus, Pencil, Trash2, Search, Upload, Download, Filter } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Employee } from '../../types';
import { createEmployee, updateEmployee, deleteEmployee } from '../../services/admin';
import EmployeeModal from '../../components/admin/EmployeeModal';
import { calculateSeniority, getSeniorityRange } from '../../lib/hrUtils';

interface ImportResult {
    success: number;
    failed: number;
    errors: string[];
}

const EmployeesPage: React.FC = () => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDept, setSelectedDept] = useState('ALL');
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

    const handleSubmit = async (data: Partial<Employee>) => {
        let result;
        if (editingEmployee) {
            result = await updateEmployee(editingEmployee.id, data);
        } else {
            result = await createEmployee(data);
        }

        if (!result.success) {
            throw new Error(result.error);
        }

        fetchEmployees();
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
                const lines = text.split('\n').filter(line => line.trim());
                let success = 0;
                let failed = 0;
                // 注意：這裡匯入邏輯較簡單，目前僅處理基本欄位
                for (let i = 1; i < lines.length; i++) {
                    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
                    if (values.length < 3) { failed++; continue; }
                    const [name, pin, department] = values;
                    const res = await createEmployee({ name, pin, department });
                    if (res.success) success++; else failed++;
                }
                alert(`匯入完成！成功：${success} 筆，失敗：${failed} 筆`);
                fetchEmployees();
            } catch (error: any) {
                alert(`匯入失敗：${error.message}`);
            } finally {
                setImporting(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsText(file, 'UTF-8');
    };

    const handleDownloadTemplate = () => {
        // 更新下載範本，包含所有擴展欄位
        const headers = [
            '姓名', 'PIN碼(6位)', '部門', '職務', '性別(MALE/FEMALE/OTHER)',
            '出生日期(YYYY-MM-DD)', '到職日期(YYYY-MM-DD)', 'Gmail', '通訊電話',
            '通訊地址', '緊急聯絡人姓名', '緊急聯絡人關係', '緊急聯絡人電話',
            '勞保加保日期(YYYY-MM-DD)', '勞保退保日期(YYYY-MM-DD)'
        ].join(',');

        const example = [
            '王小明', '123456', '行政部', '行政助理', 'MALE',
            '1990-05-20', '2023-01-01', 'xiaoming@gmail.com', '0912345678',
            '台北市中正區123號', '王大明', '父子', '0987654321',
            '2023-01-01', ''
        ].join(',');

        const template = `${headers}\n${example}`;
        const blob = new Blob(['\uFEFF' + template], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', '員工擴展資料匯入範本.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const departments = ['ALL', ...Array.from(new Set(employees.map(emp => emp.department || '未分配')))];

    const filteredEmployees = employees.filter(emp => {
        const matchesSearch = (
            emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            emp.department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            emp.pin.includes(searchTerm)
        );
        const matchesDept = selectedDept === 'ALL' || (emp.department || '未分配') === selectedDept;
        return matchesSearch && matchesDept;
    });

    return (
        <div className="space-y-6">
            <div className="sm:flex sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">員工管理</h1>
                    <p className="mt-2 text-base text-slate-500 font-medium">
                        管理成員詳細人事資料、年資與在職狀態。
                    </p>
                </div>
                <div className="mt-4 sm:mt-0 flex flex-wrap gap-3">
                    <button
                        onClick={handleDownloadTemplate}
                        className="inline-flex items-center px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
                    >
                        <Download className="h-4 w-4 mr-2" />
                        下載範本
                    </button>
                    <button
                        onClick={handleImportClick}
                        disabled={importing}
                        className="inline-flex items-center px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
                    >
                        <Upload className="h-4 w-4 mr-2" />
                        {importing ? '匯入中...' : '匯入 CSV'}
                    </button>
                    <button
                        onClick={handleCreate}
                        className="inline-flex items-center px-6 py-2.5 rounded-xl bg-blue-600 text-sm font-bold text-white shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all"
                    >
                        <Plus className="h-5 w-5 mr-2" />
                        新增員工
                    </button>
                </div>
            </div>

            {/* 篩選與搜尋工具列 - 統一在同一列 */}
            <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm items-stretch md:items-center">
                <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                        type="text"
                        className="block w-full pl-11 pr-4 py-3 border-slate-200 bg-slate-50/50 rounded-xl text-base font-medium focus:ring-blue-500 focus:border-blue-500 border transition-all"
                        placeholder="搜尋姓名、部門或 PIN..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 flex items-center gap-2 text-sm font-bold text-slate-400">
                        <Filter className="h-4 w-4" />
                        篩選
                    </div>
                    <select
                        value={selectedDept}
                        onChange={(e) => setSelectedDept(e.target.value)}
                        className="block w-full md:w-48 pl-4 pr-10 py-3 border-slate-200 bg-slate-50/50 rounded-xl text-base font-bold text-slate-700 focus:ring-blue-500 focus:border-blue-500 border transition-all"
                    >
                        {departments.map(dept => (
                            <option key={dept} value={dept}>{dept === 'ALL' ? '全部分門' : dept}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-100">
                        <thead className="bg-slate-50/50">
                            <tr>
                                <th className="px-6 py-5 text-left text-xs font-black text-slate-400 uppercase tracking-widest">姓名 / 職務</th>
                                <th className="px-6 py-5 text-left text-xs font-black text-slate-400 uppercase tracking-widest">部門</th>
                                <th className="px-6 py-5 text-left text-xs font-black text-slate-400 uppercase tracking-widest">年資</th>
                                <th className="px-6 py-5 text-left text-xs font-black text-slate-400 uppercase tracking-widest">PIN 碼</th>
                                <th className="px-6 py-5 text-left text-xs font-black text-slate-400 uppercase tracking-widest">狀態</th>
                                <th className="px-6 py-5 text-right text-xs font-black text-slate-400 uppercase tracking-widest">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-20 text-center text-slate-400 font-bold text-base">數據加載中...</td>
                                </tr>
                            ) : filteredEmployees.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-20 text-center text-slate-400 font-bold text-base">找不到相符的員工資料</td>
                                </tr>
                            ) : filteredEmployees.map((person) => {
                                const seniority = person.join_date ? calculateSeniority(person.join_date) : 0;
                                const range = person.join_date ? getSeniorityRange(seniority) : '未設定';
                                return (
                                    <tr key={person.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-5 whitespace-nowrap">
                                            <div className="text-base font-black text-slate-900">{person.name}</div>
                                            <div className="text-xs font-black text-blue-500 uppercase tracking-tight mt-0.5">{person.position || '未設定職務'}</div>
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap text-base font-bold text-slate-600">
                                            {person.department || '未分配'}
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap">
                                            <div className="text-sm font-black text-slate-700">{seniority} 年</div>
                                            <div className="text-[11px] font-black text-slate-400 uppercase mt-0.5 tracking-wider">{range}</div>
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap text-sm font-mono text-slate-400">
                                            *****{person.pin.slice(-1)}
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap">
                                            <span className={`inline-flex px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider border ${person.is_active
                                                ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                                : 'bg-rose-50 text-rose-600 border-rose-100'
                                                }`}>
                                                {person.is_active ? '在職' : '離職'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap text-right">
                                            <div className="flex justify-end gap-3">
                                                <button
                                                    onClick={() => handleEdit(person)}
                                                    className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all border border-transparent hover:border-blue-100"
                                                    title="編輯資料"
                                                >
                                                    <Pencil className="h-5 w-5" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(person)}
                                                    className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all border border-transparent hover:border-rose-100"
                                                    title="離職處理"
                                                >
                                                    <Trash2 className="h-5 w-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <EmployeeModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleSubmit}
                employee={editingEmployee}
                allEmployees={employees}
            />

            <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
        </div>
    );
};

export default EmployeesPage;

import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Employee } from '../../services/attendance';
import { createEmployee, updateEmployee, deleteEmployee } from '../../services/admin';
import EmployeeModal from '../../components/admin/EmployeeModal';

const EmployeesPage: React.FC = () => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

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
        if (!confirm(`確定要刪除員工 ${employee.name} 嗎？此操作無法復原。`)) {
            return;
        }

        const result = await deleteEmployee(employee.id);
        if (result.success) {
            fetchEmployees();
        } else {
            alert(`刪除失敗: ${result.error}`);
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
                <div className="mt-4 sm:mt-0">
                    <button
                        type="button"
                        onClick={handleCreate}
                        className="inline-flex items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:w-auto"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        新增員工
                    </button>
                </div>
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

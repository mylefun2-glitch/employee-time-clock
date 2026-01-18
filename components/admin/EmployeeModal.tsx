import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { Employee } from '../../services/attendance';

interface EmployeeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: { name: string; pin: string; department: string; is_active: boolean; supervisor_id?: string | null }) => Promise<void>;
    employee?: Employee | null;
    allEmployees?: Employee[]; // 用於主管選擇
}

const EmployeeModal: React.FC<EmployeeModalProps> = ({ isOpen, onClose, onSubmit, employee, allEmployees = [] }) => {
    const [name, setName] = useState('');
    const [pin, setPin] = useState('');
    const [department, setDepartment] = useState('');
    const [supervisorId, setSupervisorId] = useState<string>('');
    const [isActive, setIsActive] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (employee) {
            setName(employee.name);
            setPin((employee as any).pin);
            setDepartment(employee.department);
            setSupervisorId((employee as any).supervisor_id || '');
            setIsActive((employee as any).is_active ?? true);
        } else {
            setName('');
            setPin('');
            setDepartment('');
            setSupervisorId('');
            setIsActive(true);
        }
        setError(null);
    }, [employee, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        if (pin.length !== 6) {
            setError('PIN 碼必須為 6 位數字');
            setLoading(false);
            return;
        }

        try {
            await onSubmit({
                name,
                pin,
                department,
                is_active: isActive,
                supervisor_id: supervisorId || null
            });
            onClose();
        } catch (err: any) {
            setError(err.message || '發生錯誤');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={employee ? '編輯員工' : '新增員工'}
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                    <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
                        {error}
                    </div>
                )}

                <div>
                    <label htmlFor="name" className="block text-sm font-medium text-slate-700">姓名</label>
                    <input
                        type="text"
                        id="name"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                    />
                </div>

                <div>
                    <label htmlFor="pin" className="block text-sm font-medium text-slate-700">PIN 碼 (6位數)</label>
                    <input
                        type="text"
                        id="pin"
                        required
                        maxLength={6}
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                        className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2 font-mono"
                    />
                </div>

                <div>
                    <label htmlFor="department" className="block text-sm font-medium text-slate-700">部門</label>
                    <input
                        type="text"
                        id="department"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                    />
                </div>

                {/* 主管選擇 */}
                <div>
                    <label htmlFor="supervisor" className="block text-sm font-medium text-slate-700">主管（選填）</label>
                    <select
                        id="supervisor"
                        value={supervisorId}
                        onChange={(e) => setSupervisorId(e.target.value)}
                        className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                    >
                        <option value="">無主管</option>
                        {allEmployees
                            .filter(emp => emp.id !== employee?.id) // 排除自己
                            .map(emp => (
                                <option key={emp.id} value={emp.id}>
                                    {emp.name} - {emp.department || '未分配部門'}
                                </option>
                            ))
                        }
                    </select>
                </div>

                {employee && (
                    <div className="flex items-center">
                        <input
                            id="is_active"
                            type="checkbox"
                            checked={isActive}
                            onChange={(e) => setIsActive(e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <label htmlFor="is_active" className="ml-2 block text-sm text-slate-900">
                            在職狀態 (Active)
                        </label>
                    </div>
                )}

                <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3">
                    <button
                        type="submit"
                        disabled={loading}
                        className="inline-flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:text-sm disabled:opacity-50"
                    >
                        {loading ? '儲存中...' : '儲存'}
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="mt-3 inline-flex w-full justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-base font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:mt-0 sm:text-sm"
                    >
                        取消
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default EmployeeModal;

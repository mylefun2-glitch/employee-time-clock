import React, { useEffect, useState } from 'react';
import { leaveTypeService } from '../../services/leaveTypeService';
import { LeaveType } from '../../types';
import { Pencil, Power, Plus, X } from 'lucide-react';

const LeaveTypesPage: React.FC = () => {
    const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingType, setEditingType] = useState<LeaveType | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        code: '',
        color: '#3B82F6',
        is_active: true,
        sort_order: 0
    });

    useEffect(() => {
        loadLeaveTypes();
    }, []);

    const loadLeaveTypes = async () => {
        setLoading(true);
        const types = await leaveTypeService.getAllLeaveTypes();
        setLeaveTypes(types);
        setLoading(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (editingType) {
            const result = await leaveTypeService.updateLeaveType(editingType.id, formData);
            if (result.success) {
                await loadLeaveTypes();
                resetForm();
            } else {
                alert(`更新失敗：${result.error}`);
            }
        } else {
            const result = await leaveTypeService.createLeaveType(formData);
            if (result.success) {
                await loadLeaveTypes();
                resetForm();
            } else {
                alert(`建立失敗：${result.error}`);
            }
        }
    };

    const handleEdit = (type: LeaveType) => {
        setEditingType(type);
        setFormData({
            name: type.name,
            code: type.code,
            color: type.color,
            is_active: type.is_active,
            sort_order: type.sort_order
        });
        setShowForm(true);
    };


    const handleToggle = async (id: string, isActive: boolean, typeName: string) => {
        console.log('handleToggle called:', { id, isActive, typeName });

        const action = isActive ? '停用' : '啟用';
        const confirmMessage = `確定要${action}「${typeName}」差勤類型嗎？`;

        console.log('Showing confirm dialog:', confirmMessage);
        const userConfirmed = window.confirm(confirmMessage);

        if (!userConfirmed) {
            console.log('User cancelled the action');
            return;
        }

        console.log('User confirmed, updating leave type...');
        const result = await leaveTypeService.toggleLeaveType(id, !isActive);

        console.log('Toggle result:', result);

        if (result.success) {
            console.log('Successfully toggled, reloading leave types...');
            await loadLeaveTypes();
        } else {
            console.error('Toggle failed:', result.error);
            alert(`更新失敗：${result.error}`);
        }
    };


    const resetForm = () => {
        setFormData({
            name: '',
            code: '',
            color: '#3B82F6',
            is_active: true,
            sort_order: 0
        });
        setEditingType(null);
        setShowForm(false);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="sm:flex sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">差勤類型管理</h1>
                    <p className="text-base text-slate-500 font-medium mt-1">管理與設定員工可申請的各類差勤項目。</p>
                </div>
                <button
                    onClick={() => setShowForm(true)}
                    className="mt-4 sm:mt-0 inline-flex items-center px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all gap-2"
                >
                    <Plus className="h-5 w-5" />
                    新增類型
                </button>
            </div>

            {/* 差勤類型列表 */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-100">
                        <thead className="bg-slate-50/50">
                            <tr>
                                <th className="px-6 py-5 text-left text-xs font-black text-slate-400 uppercase tracking-widest">類型名稱</th>
                                <th className="px-6 py-5 text-left text-xs font-black text-slate-400 uppercase tracking-widest">排序</th>
                                <th className="px-6 py-5 text-left text-xs font-black text-slate-400 uppercase tracking-widest">狀態</th>
                                <th className="px-6 py-5 text-right text-xs font-black text-slate-400 uppercase tracking-widest">操作</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-50">
                            {leaveTypes.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-20 text-center text-slate-400 font-black text-base">
                                        目前沒有已設定的差勤類型
                                    </td>
                                </tr>
                            ) : (
                                leaveTypes.map((type) => (
                                    <tr key={type.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-5 whitespace-nowrap">
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="w-4 h-4 rounded-full shadow-sm ring-2 ring-white"
                                                    style={{ backgroundColor: type.color }}
                                                />
                                                <span className="text-base font-black text-slate-800">{type.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap text-sm font-bold text-slate-500">
                                            {type.sort_order}
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap">
                                            <span className={`inline-flex px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider border ${type.is_active
                                                ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                                : 'bg-slate-50 text-slate-400 border-slate-100'
                                                }`}>
                                                {type.is_active ? '啟用中' : '已停用'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap text-right text-sm">
                                            <div className="flex justify-end gap-3">
                                                <button
                                                    onClick={() => handleEdit(type)}
                                                    className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all border border-transparent hover:border-blue-100"
                                                    title="編輯"
                                                >
                                                    <Pencil className="h-5 w-5" />
                                                </button>
                                                <button
                                                    onClick={() => handleToggle(type.id, type.is_active, type.name)}
                                                    className={`p-2.5 rounded-xl transition-all border border-transparent ${type.is_active
                                                        ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-100'
                                                        : 'text-amber-400 hover:text-emerald-600 hover:bg-emerald-50 hover:border-emerald-100'
                                                        }`}
                                                    title={type.is_active ? '停用' : '啟用'}
                                                >
                                                    <Power className="h-5 w-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 新增/編輯表單 Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 scale-in-center transition-transform">
                        <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
                            <h2 className="text-xl font-black text-slate-900 tracking-tight">
                                {editingType ? '編輯差勤類型' : '新增差勤類型'}
                            </h2>
                            <button onClick={resetForm} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">類型名稱</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full p-3.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 font-bold focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
                                    placeholder="例如：事假"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">類型代碼 (建立後不可修改)</label>
                                <input
                                    type="text"
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                    className="w-full p-3.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 font-mono font-bold focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all disabled:opacity-50 disabled:bg-slate-100"
                                    placeholder="例如：PERSONAL"
                                    required
                                    disabled={!!editingType}
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">標誌顏色</label>
                                <div className="flex gap-4">
                                    <div className="relative">
                                        <input
                                            type="color"
                                            value={formData.color}
                                            onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                            className="h-14 w-14 rounded-xl border-4 border-white shadow-xl cursor-pointer overflow-hidden p-0"
                                        />
                                    </div>
                                    <input
                                        type="text"
                                        value={formData.color}
                                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                        className="flex-1 p-3.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 font-mono font-bold focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
                                        placeholder="#3B82F6"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">排序順序</label>
                                    <input
                                        type="number"
                                        value={formData.sort_order}
                                        onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                                        className="w-full p-3.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 font-bold focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
                                        placeholder="0"
                                    />
                                </div>
                                <div className="flex flex-col justify-end">
                                    <label className="relative inline-flex items-center cursor-pointer group">
                                        <input
                                            type="checkbox"
                                            checked={formData.is_active}
                                            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none ring-0 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                        <span className="ml-3 text-sm font-bold text-slate-600 group-hover:text-slate-900 transition-colors">啟用</span>
                                    </label>
                                </div>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className="flex-1 py-4 px-6 bg-slate-50 text-slate-500 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-100 transition-all"
                                >
                                    取消
                                </button>
                                <button
                                    type="submit"
                                    className="flex-[2] py-4 px-6 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-700 hover:-translate-y-0.5 transition-all"
                                >
                                    {editingType ? '更新內容' : '建立類型'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LeaveTypesPage;

import React, { useEffect, useState } from 'react';
import { leaveTypeService } from '../../services/leaveTypeService';
import { LeaveType } from '../../types';

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
            // 更新現有類型
            const result = await leaveTypeService.updateLeaveType(editingType.id, formData);
            if (result.success) {
                await loadLeaveTypes();
                resetForm();
            } else {
                alert(`更新失敗：${result.error}`);
            }
        } else {
            // 建立新類型
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

    const handleDelete = async (id: string, typeName: string) => {
        if (!confirm(`確定要刪除「${typeName}」差勤類型嗎？\n\n注意：如果此類型已被使用，刪除將會失敗。建議改用「停用」功能。`)) return;

        const result = await leaveTypeService.deleteLeaveType(id);
        if (result.success) {
            await loadLeaveTypes();
        } else {
            // 提供更友善的錯誤訊息
            let errorMessage = '刪除失敗';
            if (result.error?.includes('foreign key') || result.error?.includes('violates')) {
                errorMessage = '無法刪除此差勤類型，因為已有員工使用此類型提交申請。\n\n建議：請改用「停用」功能來隱藏此類型。';
            } else if (result.error) {
                errorMessage = `刪除失敗：${result.error}`;
            }
            alert(errorMessage);
        }
    };

    const handleToggle = async (id: string, isActive: boolean) => {
        const result = await leaveTypeService.toggleLeaveType(id, !isActive);
        if (result.success) {
            await loadLeaveTypes();
        } else {
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
        <div>
            <div className="mb-6 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">差勤類型管理</h1>
                    <p className="text-slate-500 mt-1">管理員工可申請的差勤類型</p>
                </div>
                <button
                    onClick={() => setShowForm(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                    <span className="material-symbols-outlined text-xl">add</span>
                    新增類型
                </button>
            </div>

            {/* 差勤類型列表 */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">類型名稱</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">代碼</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">顏色</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">排序</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">狀態</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">操作</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {leaveTypes.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                        目前沒有差勤類型
                                    </td>
                                </tr>
                            ) : (
                                leaveTypes.map((type) => (
                                    <tr key={type.id} className="hover:bg-slate-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className="w-3 h-3 rounded-full"
                                                    style={{ backgroundColor: type.color }}
                                                />
                                                <span className="text-sm font-medium text-slate-900">{type.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-mono">
                                            {type.code}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                            {type.color}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                            {type.sort_order}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <button
                                                onClick={() => handleToggle(type.id, type.is_active)}
                                                className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full transition-colors ${type.is_active
                                                    ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                                                    }`}
                                            >
                                                {type.is_active ? '啟用' : '停用'}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleEdit(type)}
                                                    className="text-blue-600 hover:text-blue-800 transition-colors"
                                                >
                                                    編輯
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(type.id, type.name)}
                                                    className="text-red-600 hover:text-red-800 transition-colors"
                                                >
                                                    刪除
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
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-slate-800">
                                {editingType ? '編輯差勤類型' : '新增差勤類型'}
                            </h2>
                            <button onClick={resetForm} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">類型名稱</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                    placeholder="例如：事假"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">類型代碼</label>
                                <input
                                    type="text"
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-mono"
                                    placeholder="例如：PERSONAL"
                                    required
                                    disabled={!!editingType}
                                />
                                {editingType && (
                                    <p className="text-xs text-slate-500 mt-1">代碼建立後無法修改</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">顯示顏色</label>
                                <div className="flex gap-3 items-center">
                                    <input
                                        type="color"
                                        value={formData.color}
                                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                        className="h-10 w-20 rounded border border-slate-200 cursor-pointer"
                                    />
                                    <input
                                        type="text"
                                        value={formData.color}
                                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                        className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-mono"
                                        placeholder="#3B82F6"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">排序順序</label>
                                <input
                                    type="number"
                                    value={formData.sort_order}
                                    onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                    placeholder="0"
                                />
                            </div>

                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    id="is_active"
                                    checked={formData.is_active}
                                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                    className="w-4 h-4 text-blue-600 bg-slate-100 border-slate-300 rounded focus:ring-blue-500"
                                />
                                <label htmlFor="is_active" className="ml-2 text-sm font-medium text-slate-700">
                                    啟用此類型
                                </label>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className="flex-1 py-3 px-4 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                                >
                                    取消
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all"
                                >
                                    {editingType ? '更新' : '建立'}
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

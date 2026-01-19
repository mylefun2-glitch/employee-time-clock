import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, MapPin } from 'lucide-react';
import { getAllLocations, createLocation, updateLocation, deleteLocation } from '../../services/companyLocationService';
import { CompanyLocation } from '../../services/geolocation';

const CompanyLocationsPage: React.FC = () => {
    const [locations, setLocations] = useState<CompanyLocation[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingLocation, setEditingLocation] = useState<CompanyLocation | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        latitude: '',
        longitude: '',
        radius_meters: '100',
        description: ''
    });

    useEffect(() => {
        fetchLocations();
    }, []);

    const fetchLocations = async () => {
        setLoading(true);
        const data = await getAllLocations();
        setLocations(data);
        setLoading(false);
    };

    const handleCreate = () => {
        setEditingLocation(null);
        setFormData({
            name: '',
            latitude: '',
            longitude: '',
            radius_meters: '100',
            description: ''
        });
        setIsModalOpen(true);
    };

    const handleEdit = (location: CompanyLocation) => {
        setEditingLocation(location);
        setFormData({
            name: location.name || '',
            latitude: location.latitude.toString(),
            longitude: location.longitude.toString(),
            radius_meters: location.radius_meters.toString(),
            description: location.description || ''
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (location: CompanyLocation) => {
        if (!confirm(`確定要刪除地點「${location.name}」嗎？`)) return;

        const result = await deleteLocation(location.id!);
        if (result.success) {
            fetchLocations();
        } else {
            alert(`刪除失敗：${result.error}`);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const locationData = {
            name: formData.name,
            latitude: parseFloat(formData.latitude),
            longitude: parseFloat(formData.longitude),
            radius_meters: parseInt(formData.radius_meters),
            description: formData.description,
            is_active: true
        };

        let result;
        if (editingLocation) {
            result = await updateLocation(editingLocation.id!, locationData);
        } else {
            result = await createLocation(locationData);
        }

        if (result.success) {
            setIsModalOpen(false);
            fetchLocations();
        } else {
            alert(`操作失敗：${result.error}`);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">公司地點管理</h1>
                    <p className="mt-1 text-sm text-slate-500 font-medium">
                        管理多個辦公室/分店的位置設定。
                    </p>
                </div>
                <button
                    type="button"
                    onClick={handleCreate}
                    className="w-full lg:w-auto inline-flex items-center justify-center rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all gap-2"
                >
                    <Plus className="h-5 w-5" />
                    新增地點
                </button>
            </div>

            {/* 使用說明 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-blue-800 mb-2">💡 使用提示</h3>
                <ul className="text-sm text-blue-700 space-y-1">
                    <li>• 使用 Google Maps 搜尋地點，右鍵點選「這是哪裡？」取得座標</li>
                    <li>• 建議範圍：50-200 公尺</li>
                    <li>• 員工打卡時會自動選擇最近的地點</li>
                </ul>
            </div>

            {/* 地點列表 */}
            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="min-w-full divide-y divide-slate-100">
                        <thead className="bg-slate-50/50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest">地點名稱</th>
                                <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest">座標</th>
                                <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest">範圍</th>
                                <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest">狀態</th>
                                <th className="px-6 py-4 text-right text-xs font-black text-slate-400 uppercase tracking-widest">操作</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-50">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">載入中...</td>
                                </tr>
                            ) : locations.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">尚無地點資料</td>
                                </tr>
                            ) : (
                                locations.map((location) => (
                                    <tr key={location.id}>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <MapPin className="h-4 w-4 text-blue-600" />
                                                <div>
                                                    <div className="font-medium text-slate-900">{location.name}</div>
                                                    {location.description && (
                                                        <div className="text-xs text-slate-500">{location.description}</div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-500 font-mono">
                                            {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-500">
                                            {location.radius_meters} 公尺
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${location.is_active
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-gray-100 text-gray-800'
                                                }`}>
                                                {location.is_active ? '啟用' : '停用'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => handleEdit(location)}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                    title="編輯"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(location)}
                                                    className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                                    title="刪除"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* 編輯/新增 Modal */}
                {isModalOpen && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-lg p-6 max-w-md w-full">
                            <h2 className="text-xl font-bold mb-4">
                                {editingLocation ? '編輯地點' : '新增地點'}
                            </h2>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">地點名稱</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-md"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">緯度</label>
                                        <input
                                            type="number"
                                            step="any"
                                            required
                                            value={formData.latitude}
                                            onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-md"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">經度</label>
                                        <input
                                            type="number"
                                            step="any"
                                            required
                                            value={formData.longitude}
                                            onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-md"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">允許範圍（公尺）</label>
                                    <input
                                        type="number"
                                        required
                                        value={formData.radius_meters}
                                        onChange={(e) => setFormData({ ...formData, radius_meters: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-md"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">說明（選填）</label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-md"
                                        rows={2}
                                    />
                                </div>
                                <div className="flex gap-2 justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="px-4 py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50"
                                    >
                                        取消
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                    >
                                        {editingLocation ? '更新' : '建立'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
        </div >
    );
};

export default CompanyLocationsPage;

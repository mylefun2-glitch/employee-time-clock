import React, { useEffect, useState } from 'react';
import { Building2, MapPin, Save, Plus, Pencil, Trash2 } from 'lucide-react';
import { getCompanyInfo, updateCompanyInfo, createCompanyInfo, CompanyInfo } from '../../services/companyInfoService';
import { getAllLocations, createLocation, updateLocation, deleteLocation } from '../../services/companyLocationService';
import { CompanyLocation } from '../../services/geolocation';

const CompanyManagementPage: React.FC = () => {
    const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
    const [locations, setLocations] = useState<CompanyLocation[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // 表單狀態
    const [formData, setFormData] = useState({
        company_name: '',
        tax_id: '',
        phone: '',
        contact_person: '',
        email: '',
        address: ''
    });

    // 地點編輯狀態
    const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
    const [editingLocation, setEditingLocation] = useState<CompanyLocation | null>(null);
    const [locationFormData, setLocationFormData] = useState({
        name: '',
        latitude: '',
        longitude: '',
        radius_meters: '100',
        description: ''
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        const [info, locs] = await Promise.all([
            getCompanyInfo(),
            getAllLocations()
        ]);

        if (info) {
            setCompanyInfo(info);
            setFormData({
                company_name: info.company_name || '',
                tax_id: info.tax_id || '',
                phone: info.phone || '',
                contact_person: info.contact_person || '',
                email: info.email || '',
                address: info.address || ''
            });
        }

        setLocations(locs);
        setLoading(false);
    };

    const handleSaveCompanyInfo = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            let result;
            if (companyInfo) {
                result = await updateCompanyInfo(companyInfo.id, formData);
            } else {
                result = await createCompanyInfo(formData as any);
            }

            if (result.success) {
                alert('儲存成功！');
                await fetchData();
            } else {
                alert(`儲存失敗：${result.error}`);
            }
        } catch (error) {
            alert('儲存時發生錯誤');
        } finally {
            setSaving(false);
        }
    };

    // 地點管理函數
    const handleCreateLocation = () => {
        setEditingLocation(null);
        setLocationFormData({
            name: '',
            latitude: '',
            longitude: '',
            radius_meters: '100',
            description: ''
        });
        setIsLocationModalOpen(true);
    };

    const handleEditLocation = (location: CompanyLocation) => {
        setEditingLocation(location);
        setLocationFormData({
            name: location.name || '',
            latitude: location.latitude.toString(),
            longitude: location.longitude.toString(),
            radius_meters: location.radius_meters.toString(),
            description: location.description || ''
        });
        setIsLocationModalOpen(true);
    };

    const handleDeleteLocation = async (location: CompanyLocation) => {
        if (!confirm(`確定要刪除地點「${location.name}」嗎？`)) return;

        const result = await deleteLocation(location.id!);
        if (result.success) {
            fetchData();
        } else {
            alert(`刪除失敗：${result.error}`);
        }
    };

    const handleSubmitLocation = async (e: React.FormEvent) => {
        e.preventDefault();

        const locationData = {
            name: locationFormData.name,
            latitude: parseFloat(locationFormData.latitude),
            longitude: parseFloat(locationFormData.longitude),
            radius_meters: parseInt(locationFormData.radius_meters),
            description: locationFormData.description,
            is_active: true
        };

        let result;
        if (editingLocation) {
            result = await updateLocation(editingLocation.id!, locationData);
        } else {
            result = await createLocation(locationData);
        }

        if (result.success) {
            setIsLocationModalOpen(false);
            fetchData();
        } else {
            alert(`操作失敗：${result.error}`);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-slate-500">載入中...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* 頁面標題 */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900">公司管理</h1>
                <p className="mt-2 text-sm text-slate-700">
                    管理公司基本資訊和辦公地點設定
                </p>
            </div>

            {/* 公司基本資訊 */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200">
                <div className="px-6 py-4 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-blue-600" />
                        <h2 className="text-lg font-semibold text-slate-900">公司基本資訊</h2>
                    </div>
                </div>

                <form onSubmit={handleSaveCompanyInfo} className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* 公司抬頭 */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                公司抬頭 <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                required
                                value={formData.company_name}
                                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="例如：ABC 科技股份有限公司"
                            />
                        </div>

                        {/* 統一編號 */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                統一編號
                            </label>
                            <input
                                type="text"
                                value={formData.tax_id}
                                onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="8 位數字"
                                maxLength={8}
                            />
                        </div>

                        {/* 電話 */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                電話
                            </label>
                            <input
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="例如：02-1234-5678"
                            />
                        </div>

                        {/* 負責人 */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                負責人
                            </label>
                            <input
                                type="text"
                                value={formData.contact_person}
                                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="負責人姓名"
                            />
                        </div>

                        {/* Email */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Email
                            </label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="company@example.com"
                            />
                        </div>

                        {/* 地址 */}
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                地址
                            </label>
                            <input
                                type="text"
                                value={formData.address}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="完整地址"
                            />
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end">
                        <button
                            type="submit"
                            disabled={saving}
                            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                        >
                            <Save className="h-4 w-4 mr-2" />
                            {saving ? '儲存中...' : '儲存'}
                        </button>
                    </div>
                </form>
            </div>

            {/* 辦公地點管理 */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200">
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-blue-600" />
                        <h2 className="text-lg font-semibold text-slate-900">辦公地點</h2>
                    </div>
                    <button
                        onClick={handleCreateLocation}
                        className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                    >
                        <Plus className="h-4 w-4 mr-1" />
                        新增地點
                    </button>
                </div>

                {/* 使用說明 */}
                <div className="px-6 py-3 bg-blue-50 border-b border-blue-100">
                    <p className="text-sm text-blue-700">
                        💡 使用 Google Maps 搜尋地點，右鍵點選「這是哪裡？」取得座標。員工打卡時會自動選擇最近的地點。
                    </p>
                </div>

                {/* 地點列表 */}
                <div className="p-6">
                    {locations.length === 0 ? (
                        <div className="text-center py-8 text-slate-500">
                            尚無地點資料，請新增辦公地點
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {locations.map((location) => (
                                <div
                                    key={location.id}
                                    className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50"
                                >
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-medium text-slate-900">{location.name}</h3>
                                            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${location.is_active
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-gray-100 text-gray-800'
                                                }`}>
                                                {location.is_active ? '啟用' : '停用'}
                                            </span>
                                        </div>
                                        <div className="mt-1 text-sm text-slate-500 space-y-1">
                                            <div className="font-mono">
                                                座標：{location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                                            </div>
                                            <div>
                                                範圍：{location.radius_meters} 公尺
                                            </div>
                                            {location.description && (
                                                <div className="text-slate-600">{location.description}</div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-2 ml-4">
                                        <button
                                            onClick={() => handleEditLocation(location)}
                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteLocation(location)}
                                            className="p-2 text-red-600 hover:bg-red-50 rounded"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* 地點編輯 Modal */}
            {isLocationModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full">
                        <h2 className="text-xl font-bold mb-4">
                            {editingLocation ? '編輯地點' : '新增地點'}
                        </h2>
                        <form onSubmit={handleSubmitLocation} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    地點名稱 <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={locationFormData.name}
                                    onChange={(e) => setLocationFormData({ ...locationFormData, name: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                                    placeholder="例如：總公司、台北分店"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        緯度 <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        required
                                        value={locationFormData.latitude}
                                        onChange={(e) => setLocationFormData({ ...locationFormData, latitude: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-md"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        經度 <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        required
                                        value={locationFormData.longitude}
                                        onChange={(e) => setLocationFormData({ ...locationFormData, longitude: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-md"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    允許範圍（公尺）<span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    required
                                    value={locationFormData.radius_meters}
                                    onChange={(e) => setLocationFormData({ ...locationFormData, radius_meters: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">說明（選填）</label>
                                <textarea
                                    value={locationFormData.description}
                                    onChange={(e) => setLocationFormData({ ...locationFormData, description: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                                    rows={2}
                                />
                            </div>
                            <div className="flex gap-2 justify-end">
                                <button
                                    type="button"
                                    onClick={() => setIsLocationModalOpen(false)}
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
    );
};

export default CompanyManagementPage;

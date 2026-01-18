import React, { useEffect, useState } from 'react';
import { Building2, MapPin, Save, Plus, Pencil, Trash2, Info } from 'lucide-react';
import { getCompanyInfo, updateCompanyInfo, createCompanyInfo, CompanyInfo } from '../../services/companyInfoService';
import { getAllLocations, createLocation, updateLocation, deleteLocation } from '../../services/companyLocationService';
import { CompanyLocation } from '../../services/geolocation';

const CompanyManagementPage: React.FC = () => {
    const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
    const [locations, setLocations] = useState<CompanyLocation[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isEditingInfo, setIsEditingInfo] = useState(false);

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
        } else {
            // 如果沒有公司資訊，預設開啟編輯模式
            setIsEditingInfo(true);
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
                setIsEditingInfo(false);
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
                <div className="text-slate-500 font-bold animate-pulse">載入中...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            {/* 頁面標題 */}
            <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">公司管理</h1>
                <p className="mt-1 text-slate-500 font-medium">
                    管理公司基本資訊和辦公地點設定
                </p>
            </div>

            {/* 公司基本資訊 */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                    <div className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-blue-600" />
                        <h2 className="text-lg font-black text-slate-900">公司基本資訊</h2>
                    </div>
                    {!isEditingInfo && (
                        <button
                            onClick={() => setIsEditingInfo(true)}
                            className="inline-flex items-center px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 text-sm font-bold shadow-sm transition-all"
                        >
                            <Pencil className="h-4 w-4 mr-2" />
                            編輯資訊
                        </button>
                    )}
                </div>

                {!isEditingInfo ? (
                    <div className="p-8 animate-in fade-in duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                            <InfoItem label="公司抬頭" value={formData.company_name} isBold />
                            <InfoItem label="統一編號" value={formData.tax_id || '未設定'} />
                            <InfoItem label="電話" value={formData.phone || '未設定'} />
                            <InfoItem label="負責人" value={formData.contact_person || '未設定'} />
                            <InfoItem label="Email" value={formData.email || '未設定'} />
                            <div className="md:col-span-2">
                                <InfoItem label="地址" value={formData.address || '未設定'} />
                            </div>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSaveCompanyInfo} className="p-8 animate-in slide-in-from-top-2 duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* 公司抬頭 */}
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                                    公司抬頭 <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.company_name}
                                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 border font-bold text-slate-700 transition-all"
                                    placeholder="例如：ABC 科技股份有限公司"
                                />
                            </div>

                            {/* 統一編號 */}
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                                    統一編號
                                </label>
                                <input
                                    type="text"
                                    value={formData.tax_id}
                                    onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 border font-bold text-slate-700 transition-all"
                                    placeholder="8 位數字"
                                    maxLength={8}
                                />
                            </div>

                            {/* 電話 */}
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                                    電話
                                </label>
                                <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 border font-bold text-slate-700 transition-all"
                                    placeholder="例如：02-1234-5678"
                                />
                            </div>

                            {/* 負責人 */}
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                                    負責人
                                </label>
                                <input
                                    type="text"
                                    value={formData.contact_person}
                                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 border font-bold text-slate-700 transition-all"
                                    placeholder="負責人姓名"
                                />
                            </div>

                            {/* Email */}
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 border font-bold text-slate-700 transition-all"
                                    placeholder="company@example.com"
                                />
                            </div>

                            {/* 地址 */}
                            <div className="md:col-span-2">
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                                    地址
                                </label>
                                <input
                                    type="text"
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 border font-bold text-slate-700 transition-all"
                                    placeholder="完整地址"
                                />
                            </div>
                        </div>

                        <div className="mt-8 flex justify-end gap-3">
                            {companyInfo && (
                                <button
                                    type="button"
                                    onClick={() => setIsEditingInfo(false)}
                                    className="px-6 py-2.5 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 font-bold transition-all"
                                >
                                    取消
                                </button>
                            )}
                            <button
                                type="submit"
                                disabled={saving}
                                className="inline-flex items-center px-8 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 font-bold shadow-lg shadow-blue-100 transition-all"
                            >
                                <Save className="h-4 w-4 mr-2" />
                                {saving ? '儲存中...' : '儲存變更'}
                            </button>
                        </div>
                    </form>
                )}
            </div>

            {/* 辦公地點管理 */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                    <div className="flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-blue-600" />
                        <h2 className="text-lg font-black text-slate-900">辦公地點</h2>
                    </div>
                    <button
                        onClick={handleCreateLocation}
                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all"
                    >
                        <Plus className="h-4 w-4 mr-1" />
                        新增地點
                    </button>
                </div>

                {/* 使用說明 */}
                <div className="px-8 py-3 bg-blue-50/50 border-b border-blue-100">
                    <p className="text-xs text-blue-700 font-bold flex items-center gap-2">
                        <Info className="h-3.5 w-3.5" />
                        使用 Google Maps 搜尋地點，右鍵點選「這是哪裡？」取得座標。員工打卡時會自動選擇最近的地點。
                    </p>
                </div>

                {/* 地點列表 */}
                <div className="p-8">
                    {locations.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 font-bold">
                            尚無地點資料，請新增辦公地點
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {locations.map((location) => (
                                <div
                                    key={location.id}
                                    className="flex items-center justify-between p-5 border border-slate-100 rounded-2xl hover:bg-slate-50 transition-all group"
                                >
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-black text-slate-900">{location.name}</h3>
                                            <span className={`px-2 py-0.5 text-[10px] font-black rounded-full uppercase tracking-widest ${location.is_active
                                                ? 'bg-emerald-100 text-emerald-800'
                                                : 'bg-slate-100 text-slate-800'
                                                }`}>
                                                {location.is_active ? '啟用' : '停用'}
                                            </span>
                                        </div>
                                        <div className="mt-2 text-xs text-slate-500 space-y-1">
                                            <div className="font-mono bg-slate-100 inline-block px-2 py-0.5 rounded text-[10px] mb-1">
                                                {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                                            </div>
                                            <div className="font-bold">
                                                範圍：{location.radius_meters} 公尺
                                            </div>
                                            {location.description && (
                                                <div className="text-slate-400 italic line-clamp-1">{location.description}</div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-2 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleEditLocation(location)}
                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteLocation(location)}
                                            className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
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
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                                <MapPin className="h-5 w-5 text-blue-600" />
                            </div>
                            <h2 className="text-xl font-black text-slate-900">
                                {editingLocation ? '編輯辦公地點' : '新增辦公地點'}
                            </h2>
                        </div>

                        <form onSubmit={handleSubmitLocation} className="space-y-5">
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                                    地點名稱 <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={locationFormData.name}
                                    onChange={(e) => setLocationFormData({ ...locationFormData, name: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 border font-bold text-slate-700 transition-all"
                                    placeholder="例如：總公司、台北分店"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                                        緯度 <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        required
                                        value={locationFormData.latitude}
                                        onChange={(e) => setLocationFormData({ ...locationFormData, latitude: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 border font-bold text-slate-700 transition-all font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                                        經度 <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        required
                                        value={locationFormData.longitude}
                                        onChange={(e) => setLocationFormData({ ...locationFormData, longitude: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 border font-bold text-slate-700 transition-all font-mono"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                                    允許範圍（公尺）<span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        required
                                        value={locationFormData.radius_meters}
                                        onChange={(e) => setLocationFormData({ ...locationFormData, radius_meters: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 border font-bold text-slate-700 transition-all"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">METERS</span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">說明（選填）</label>
                                <textarea
                                    value={locationFormData.description}
                                    onChange={(e) => setLocationFormData({ ...locationFormData, description: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 border font-bold text-slate-700 transition-all"
                                    rows={2}
                                    placeholder="位置補充說明..."
                                />
                            </div>
                            <div className="flex gap-3 justify-end pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsLocationModalOpen(false)}
                                    className="px-6 py-2.5 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 font-bold transition-all"
                                >
                                    取消
                                </button>
                                <button
                                    type="submit"
                                    className="px-8 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold shadow-lg shadow-blue-100 transition-all"
                                >
                                    {editingLocation ? '更新地點' : '建立地點'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

// Helper components for Info Items
const InfoItem: React.FC<{ label: string; value: string; isBold?: boolean }> = ({ label, value, isBold }) => (
    <div className="space-y-1">
        <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">{label}</p>
        <p className={`text-slate-700 transition-all ${isBold ? 'text-lg font-black' : 'font-bold'}`}>{value}</p>
    </div>
);

export default CompanyManagementPage;

import React, { useEffect, useState } from 'react';
import { getResources, upsertResource } from '../../services/resourceService';
import { Resource } from '../../types';

const RESOURCE_TYPE_LABELS: Record<string, { text: string; icon: string; color: string }> = {
    ITEM: { text: '物品', icon: 'inventory_2', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    VENUE: { text: '場地', icon: 'meeting_room', color: 'bg-violet-50 text-violet-700 border-violet-200' },
};

const defaultForm = {
    name: '',
    type: 'ITEM' as 'ITEM' | 'VENUE',
    description: '',
    location: '',
    quantity: 1,
    is_active: true,
};

const ResourceManagementPage: React.FC = () => {
    const [resources, setResources] = useState<Resource[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingResource, setEditingResource] = useState<Resource | null>(null);
    const [formData, setFormData] = useState({ ...defaultForm });
    const [filterType, setFilterType] = useState<'ALL' | 'ITEM' | 'VENUE'>('ALL');

    useEffect(() => { fetchResources(); }, []);

    const fetchResources = async () => {
        setLoading(true);
        try {
            const data = await getResources(false);
            setResources(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (resource: Resource | null = null) => {
        if (resource) {
            setEditingResource(resource);
            setFormData({
                name: resource.name,
                type: resource.type,
                description: resource.description || '',
                location: resource.location || '',
                quantity: resource.quantity,
                is_active: resource.is_active,
            });
        } else {
            setEditingResource(null);
            setFormData({ ...defaultForm });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await upsertResource({ id: editingResource?.id, ...formData });
            setIsModalOpen(false);
            fetchResources();
        } catch (err) {
            console.error(err);
            alert('儲存失敗，請再試一次');
        }
    };

    const filtered = filterType === 'ALL' ? resources : resources.filter(r => r.type === filterType);

    if (loading) return <div className="p-8 text-center text-slate-400 font-bold">載入中...</div>;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-wrap justify-between items-center gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">資源管理</h1>
                    <p className="text-slate-500 text-sm font-medium mt-1">管理可借用的物品及場地項目</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 px-6 py-3 bg-violet-600 text-white rounded-2xl font-black shadow-lg shadow-violet-100 hover:bg-violet-700 transition-all hover:-translate-y-1"
                >
                    <span className="material-symbols-outlined">add_circle</span>
                    新增資源
                </button>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2">
                {(['ALL', 'ITEM', 'VENUE'] as const).map(type => (
                    <button
                        key={type}
                        onClick={() => setFilterType(type)}
                        className={`px-4 py-2 rounded-xl text-sm font-black transition-all ${filterType === type ? 'bg-violet-600 text-white shadow-lg shadow-violet-100' : 'bg-white text-slate-500 border border-slate-100 hover:bg-slate-50'}`}
                    >
                        {type === 'ALL' ? '全部' : RESOURCE_TYPE_LABELS[type].text}
                    </button>
                ))}
            </div>

            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/50">
                                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">資源名稱</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">類型</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">位置</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">可借數量</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">說明</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filtered.map(resource => {
                                const typeInfo = RESOURCE_TYPE_LABELS[resource.type];
                                return (
                                    <tr key={resource.id} className={`hover:bg-slate-50/50 transition-colors ${!resource.is_active ? 'opacity-50' : ''}`}>
                                        <td className="px-6 py-4 align-middle">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                                                    <span className="material-symbols-outlined text-slate-500">{typeInfo.icon}</span>
                                                </div>
                                                <div>
                                                    <div className="text-sm font-black text-slate-900">{resource.name}</div>
                                                    {!resource.is_active && <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">已停用</span>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 align-middle">
                                            <span className={`inline-flex px-3 py-1 text-[10px] font-black rounded-lg border uppercase tracking-widest ${typeInfo.color}`}>
                                                {typeInfo.text}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 align-middle text-sm text-slate-500 font-medium">{resource.location || '—'}</td>
                                        <td className="px-6 py-4 align-middle text-sm font-black text-slate-700 tabular-nums">{resource.quantity}</td>
                                        <td className="px-6 py-4 align-middle text-sm text-slate-500 font-medium max-w-[200px] truncate">{resource.description || '—'}</td>
                                        <td className="px-6 py-4 align-middle text-right">
                                            <button
                                                onClick={() => handleOpenModal(resource)}
                                                className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-xl transition-all"
                                                title="編輯"
                                            >
                                                <span className="material-symbols-outlined text-[20px]">edit</span>
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center justify-center">
                                            <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">inventory_2</span>
                                            <p className="text-sm font-bold text-slate-400">尚無資源資料</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-lg w-full p-8 animate-in zoom-in-95 duration-300">
                        <h2 className="text-2xl font-black text-slate-900 mb-6">
                            {editingResource ? '編輯資源' : '新增資源'}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">資源名稱 *</label>
                                    <input
                                        required
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="例如: 投影機、大會議室"
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-bold text-slate-700 placeholder:text-slate-300"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">類型 *</label>
                                    <select
                                        value={formData.type}
                                        onChange={e => setFormData({ ...formData, type: e.target.value as 'ITEM' | 'VENUE' })}
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-bold text-slate-700"
                                    >
                                        <option value="ITEM">物品</option>
                                        <option value="VENUE">場地</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">可借數量 *</label>
                                    <input
                                        type="number"
                                        min={1}
                                        required
                                        value={formData.quantity}
                                        onChange={e => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-bold text-slate-700"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">放置位置</label>
                                    <input
                                        value={formData.location}
                                        onChange={e => setFormData({ ...formData, location: e.target.value })}
                                        placeholder="例如: 3F 儲藏室、2F 會議室"
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-bold text-slate-700 placeholder:text-slate-300"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">說明</label>
                                    <textarea
                                        rows={2}
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        placeholder="其他備註說明..."
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-bold text-slate-700 placeholder:text-slate-300 resize-none"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">啟用狀態</label>
                                    <select
                                        value={formData.is_active ? 'true' : 'false'}
                                        onChange={e => setFormData({ ...formData, is_active: e.target.value === 'true' })}
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-bold text-slate-700"
                                    >
                                        <option value="true">啟用中</option>
                                        <option value="false">已停用</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex gap-4 pt-2">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-6 py-4 bg-white text-slate-500 border border-slate-100 rounded-2xl font-black hover:bg-slate-50 transition-all">取消</button>
                                <button type="submit" className="flex-1 px-6 py-4 bg-violet-600 text-white rounded-2xl font-black shadow-xl shadow-violet-100 hover:bg-violet-700 transition-all active:scale-95">儲存變更</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ResourceManagementPage;

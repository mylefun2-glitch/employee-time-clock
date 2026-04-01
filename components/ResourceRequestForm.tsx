import React, { useEffect, useState } from 'react';
import { getResources, createResourceRequest, updateResourceRequest } from '../services/resourceService';
import { Resource, ResourceRequest } from '../types';
import TimeInput24h from './ui/TimeInput24h';

interface Props {
    employeeId: string;
    initialData?: ResourceRequest | null;
    onSuccess: () => void;
    onClose: () => void;
}

const ResourceRequestForm: React.FC<Props> = ({ employeeId, initialData, onSuccess, onClose }) => {
    const [resources, setResources] = useState<Resource[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    // Helper to extract date and time from a date object or string
    const parseDateTime = (d?: string | Date) => {
        if (!d) return { date: '', time: '' };
        const dt = new Date(d);
        if (isNaN(dt.getTime())) return { date: '', time: '' };
        
        // Extract local date (YYYY-MM-DD)
        const year = dt.getFullYear();
        const month = String(dt.getMonth() + 1).padStart(2, '0');
        const day = String(dt.getDate()).padStart(2, '0');
        const date = `${year}-${month}-${day}`;
        
        // Extract local time (HH:mm)
        const hours = String(dt.getHours()).padStart(2, '0');
        const minutes = String(dt.getMinutes()).padStart(2, '0');
        const time = `${hours}:${minutes}`;
        
        return { date, time };
    };

    const now = new Date();
    const initialStart = initialData ? parseDateTime(initialData.start_time) : { ...parseDateTime(now), time: '08:00' };
    const initialEnd = initialData ? parseDateTime(initialData.end_time) : { date: initialStart.date, time: '17:00' };

    const [formData, setFormData] = useState({
        resource_id: initialData?.resource_id || '',
        quantity: initialData?.quantity || 1,
        start_date: initialStart.date,
        start_time: initialStart.time || '08:00',
        end_date: initialEnd.date,
        end_time: initialEnd.time || '17:00',
        purpose: initialData?.purpose || '',
    });

    useEffect(() => {
        fetchResources();
    }, []);

    const fetchResources = async () => {
        try {
            const data = await getResources(true);
            setResources(data);
            if (data.length > 0 && (!formData.resource_id)) {
                setFormData(prev => ({ ...prev, resource_id: data[0].id }));
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!formData.resource_id) { setError('請選擇借用資源'); return; }
        if (!formData.start_date || !formData.start_time) { setError('請填寫完整借用時間'); return; }
        if (!formData.end_date || !formData.end_time) { setError('請填寫完整歸還時間'); return; }

        const start = new Date(`${formData.start_date}T${formData.start_time}`);
        const end = new Date(`${formData.end_date}T${formData.end_time}`);

        if (end <= start) {
            setError('歸還時間必須在借用時間之後');
            return;
        }
        if (!formData.purpose.trim()) { setError('請填寫用途說明'); return; }

        setSubmitting(true);
        try {
            const payload = {
                resource_id: formData.resource_id,
                quantity: formData.quantity,
                start_time: start.toISOString(),
                end_time: end.toISOString(),
                purpose: formData.purpose.trim(),
            };

            if (initialData) {
                await updateResourceRequest(initialData.id, payload);
            } else {
                await createResourceRequest({
                    employee_id: employeeId,
                    ...payload,
                });
            }
            onSuccess();
        } catch (err: any) {
            console.error(err);
            setError(err.message || '儲存失敗，請再試一次');
        } finally {
            setSubmitting(false);
        }
    };

    const TYPE_LABELS: Record<string, { text: string; icon: string }> = {
        ITEM: { text: '物品', icon: 'inventory_2' },
        VENUE: { text: '場地', icon: 'meeting_room' },
    };

    const itemResources = resources.filter(r => r.type === 'ITEM');
    const venueResources = resources.filter(r => r.type === 'VENUE');

    const selectedRes = resources.find(r => r.id === formData.resource_id);

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-2xl w-full p-8 animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-violet-100 flex items-center justify-center">
                        <span className="material-symbols-outlined text-violet-600">{initialData ? 'edit_square' : 'handshake'}</span>
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-900">{initialData ? '編輯申請' : '申請借用'}</h2>
                        <p className="text-sm text-slate-400 font-medium">物品及場地借用申請</p>
                    </div>
                </div>

                {loading ? (
                    <div className="text-center py-8 text-slate-400 font-bold">載入資源清單...</div>
                ) : resources.length === 0 ? (
                    <div className="text-center py-8">
                        <span className="material-symbols-outlined text-4xl text-slate-300 mb-2 block">inventory_2</span>
                        <p className="text-slate-400 font-bold">目前沒有可借用的資源</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Resource selector */}
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">借用資源 *</label>
                            <select
                                value={formData.resource_id}
                                onChange={e => setFormData({ ...formData, resource_id: e.target.value, quantity: 1 })}
                                className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-bold text-slate-700 appearance-none cursor-pointer"
                            >
                                {itemResources.length > 0 && (
                                    <optgroup label="── 物品">
                                        {itemResources.map(r => (
                                            <option key={r.id} value={r.id}>{r.name}{r.location ? ` (${r.location})` : ''}</option>
                                        ))}
                                    </optgroup>
                                )}
                                {venueResources.length > 0 && (
                                    <optgroup label="── 場地">
                                        {venueResources.map(r => (
                                            <option key={r.id} value={r.id}>{r.name}{r.location ? ` (${r.location})` : ''}</option>
                                        ))}
                                    </optgroup>
                                )}
                            </select>

                            {selectedRes && (
                                <div className="mt-2 px-4 py-3 bg-violet-50 rounded-xl flex items-start gap-2">
                                    <span className="material-symbols-outlined text-violet-500 text-lg mt-0.5 shrink-0">
                                        {TYPE_LABELS[selectedRes.type]?.icon}
                                    </span>
                                    <div className="text-xs font-medium text-slate-600 space-y-0.5">
                                        <div><span className="font-black text-violet-700">{TYPE_LABELS[selectedRes.type]?.text}</span>{selectedRes.location && <span className="text-slate-400 ml-1">· {selectedRes.location}</span>}</div>
                                        {selectedRes.description && <div className="text-slate-500">{selectedRes.description}</div>}
                                        <div className="text-slate-400">最大可借數量：{selectedRes.quantity}</div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Quantity */}
                        {selectedRes && selectedRes.quantity > 1 && (
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">借用數量 *</label>
                                <input
                                    type="number"
                                    min={1}
                                    max={selectedRes.quantity}
                                    value={formData.quantity}
                                    onChange={e => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-bold text-slate-700"
                                />
                            </div>
                        )}

                        {/* Time range */}
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">借用時間 *</label>
                                <div className="flex gap-2">
                                    <input
                                        type="date"
                                        required
                                        value={formData.start_date}
                                        onChange={e => setFormData({ ...formData, start_date: e.target.value, end_date: e.target.value })}
                                        className="flex-1 p-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-bold text-slate-700 text-sm h-[44px]"
                                    />
                                    <TimeInput24h
                                        value={formData.start_time}
                                        onChange={val => setFormData({ ...formData, start_time: val })}
                                        className="flex-1"
                                        required
                                    />
                                </div>
                            </div>
                            
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">歸還時間 *</label>
                                <div className="flex gap-2">
                                    <input
                                        type="date"
                                        required
                                        value={formData.end_date}
                                        min={formData.start_date}
                                        onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                                        className="flex-1 p-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-bold text-slate-700 text-sm h-[44px]"
                                    />
                                    <TimeInput24h
                                        value={formData.end_time}
                                        onChange={val => setFormData({ ...formData, end_time: val })}
                                        className="flex-1"
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Purpose */}
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">用途說明 *</label>
                            <textarea
                                rows={3}
                                required
                                value={formData.purpose}
                                onChange={e => setFormData({ ...formData, purpose: e.target.value })}
                                placeholder="請說明借用用途..."
                                className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-bold text-slate-700 placeholder:text-slate-300 resize-none text-sm"
                            />
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 px-4 py-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-sm font-bold">
                                <span className="material-symbols-outlined text-[18px]">error</span>
                                {error}
                            </div>
                        )}

                        <div className="flex gap-4 pt-2">
                            <button type="button" onClick={onClose} className="flex-1 px-6 py-4 bg-white text-slate-500 border border-slate-100 rounded-2xl font-black hover:bg-slate-50 transition-all">取消</button>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="flex-1 px-6 py-4 bg-violet-600 text-white rounded-2xl font-black shadow-xl shadow-violet-100 hover:bg-violet-700 transition-all active:scale-95 disabled:opacity-60"
                            >
                                {submitting ? '儲存中...' : (initialData ? '儲存變更' : '送出申請')}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default ResourceRequestForm;

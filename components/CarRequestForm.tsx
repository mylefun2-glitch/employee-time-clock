import React, { useState, useEffect } from 'react';
import { getCars, submitCarRequest } from '../services/carService';

interface CarRequestFormProps {
    employeeId: string;
    onClose: () => void;
    onSuccess: () => void;
}

const CarRequestForm: React.FC<CarRequestFormProps> = ({ employeeId, onClose, onSuccess }) => {
    const [cars, setCars] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        car_id: '',
        start_date: '',
        start_time: '09:00',
        end_date: '',
        end_time: '18:00',
        purpose: ''
    });

    useEffect(() => {
        const fetchCars = async () => {
            try {
                const data = await getCars(true);
                setCars(data || []);
                if (data && data.length > 0) {
                    setFormData(prev => ({ ...prev, car_id: data[0].id }));
                }
            } catch (error) {
                console.error('Error fetching cars:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchCars();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // 驗證時間
        const start = new Date(`${formData.start_date}T${formData.start_time}`);
        const end = new Date(`${formData.end_date}T${formData.end_time}`);

        if (end <= start) {
            alert('結束時間必須晚於開始時間');
            return;
        }

        setSubmitting(true);
        try {
            await submitCarRequest({
                employee_id: employeeId,
                car_id: formData.car_id,
                start_time: start.toISOString(),
                end_time: end.toISOString(),
                purpose: formData.purpose
            });
            onSuccess();
        } catch (error) {
            console.error('Error submitting car request:', error);
            alert('提交失敗，請重試');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="flex justify-between items-start p-8 border-b border-slate-50 shrink-0">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900">申請公務車</h2>
                        <p className="text-slate-500 font-bold text-sm mt-1">請填寫預計使用的時間與用途</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                        <span className="material-symbols-outlined text-slate-400">close</span>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                    <div className="p-8 space-y-6 overflow-y-auto flex-1 scrollbar-hide">
                        {/* 車輛選擇 */}
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">選擇公務車</label>
                            <select
                                required
                                value={formData.car_id}
                                onChange={(e) => setFormData({ ...formData, car_id: e.target.value })}
                                className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-slate-700"
                            >
                                {cars.length === 0 ? (
                                    <option disabled>目前無可用車輛</option>
                                ) : (
                                    cars.map(car => (
                                        <option key={car.id} value={car.id}>
                                            {car.plate_number} - {car.model}
                                        </option>
                                    ))
                                )}
                            </select>
                        </div>

                        {/* 開始時間 */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">取車日期</label>
                                <input
                                    required
                                    type="date"
                                    value={formData.start_date}
                                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-slate-700"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">時間</label>
                                <input
                                    required
                                    type="time"
                                    value={formData.start_time}
                                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-slate-700"
                                />
                            </div>
                        </div>

                        {/* 結束時間 */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">還車日期</label>
                                <input
                                    required
                                    type="date"
                                    value={formData.end_date}
                                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-slate-700"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">時間</label>
                                <input
                                    required
                                    type="time"
                                    value={formData.end_time}
                                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-slate-700"
                                />
                            </div>
                        </div>

                        {/* 用途說明 */}
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">用途說明</label>
                            <textarea
                                required
                                value={formData.purpose}
                                onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                                placeholder="請填寫具體用途（如：外訪客戶）"
                                rows={3}
                                className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-slate-700 resize-none placeholder:text-slate-300"
                            />
                        </div>
                    </div>

                    <div className="p-8 border-t border-slate-50 flex gap-4 bg-slate-50/50 shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-6 py-4 bg-white text-slate-500 border border-slate-100 rounded-2xl font-black hover:bg-slate-50 transition-all shadow-sm"
                        >
                            取消
                        </button>
                        <button
                            type="submit"
                            disabled={submitting || cars.length === 0}
                            className="flex-1 px-6 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                        >
                            {submitting ? '提交中...' : '確認申請'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CarRequestForm;

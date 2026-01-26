import React, { useEffect, useState } from 'react';
import { getCars, upsertCar } from '../../services/carService';

const CarManagementPage: React.FC = () => {
    const [cars, setCars] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCar, setEditingCar] = useState<any>(null);
    const [formData, setFormData] = useState({
        plate_number: '',
        model: '',
        status: 'AVAILABLE',
        is_active: true
    });

    useEffect(() => {
        fetchCars();
    }, []);

    const fetchCars = async () => {
        setLoading(true);
        try {
            const data = await getCars(false); // 包含不啟用的
            setCars(data || []);
        } catch (error) {
            console.error('Error fetching cars:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (car: any = null) => {
        if (car) {
            setEditingCar(car);
            setFormData({
                plate_number: car.plate_number,
                model: car.model,
                status: car.status,
                is_active: car.is_active
            });
        } else {
            setEditingCar(null);
            setFormData({
                plate_number: '',
                model: '',
                status: 'AVAILABLE',
                is_active: true
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await upsertCar({
                id: editingCar?.id,
                ...formData
            });
            setIsModalOpen(false);
            fetchCars();
        } catch (error) {
            console.error('Error saving car:', error);
            alert('儲存失敗，請檢查內容');
        }
    };

    const getStatusInfo = (status: string) => {
        const statuses = {
            AVAILABLE: { text: '可用', class: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
            IN_USE: { text: '使用中', class: 'bg-blue-50 text-blue-700 border-blue-200' },
            MAINTENANCE: { text: '維修中', class: 'bg-rose-50 text-rose-700 border-rose-200' }
        };
        return statuses[status as keyof typeof statuses] || { text: status, class: 'bg-slate-50 text-slate-700' };
    };

    if (loading) return <div className="p-8 text-center text-slate-400 font-bold">載入中...</div>;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">公務車管理</h1>
                    <p className="text-slate-500 text-sm font-medium mt-1">維護公司車輛檔案與即時狀態</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all hover:-translate-y-1"
                >
                    <span className="material-symbols-outlined">add_circle</span>
                    新增車輛
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {cars.map((car) => {
                    const status = getStatusInfo(car.status);
                    return (
                        <div key={car.id} className={`group bg-white rounded-3xl border ${car.is_active ? 'border-slate-100' : 'border-slate-200 opacity-60'} p-6 hover:shadow-xl transition-all duration-300 relative`}>
                            <div className="flex justify-between items-start mb-4">
                                <div className={`px-3 py-1 text-[10px] font-black rounded-lg border uppercase tracking-widest ${status.class}`}>
                                    {status.text}
                                </div>
                                <button
                                    onClick={() => handleOpenModal(car)}
                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                                >
                                    <span className="material-symbols-outlined text-xl">edit</span>
                                </button>
                            </div>

                            <div className="mb-6">
                                <h3 className="text-2xl font-black text-slate-900 mb-1">{car.plate_number}</h3>
                                <p className="text-slate-500 font-bold text-sm flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-base">directions_car</span>
                                    {car.model}
                                </p>
                            </div>

                            <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                                    里程: {car.last_mileage} KM
                                </span>
                                {!car.is_active && (
                                    <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">已停用</span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95 duration-300">
                        <h2 className="text-2xl font-black text-slate-900 mb-6">
                            {editingCar ? '編輯車輛資訊' : '新增公務車'}
                        </h2>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">車牌號碼</label>
                                <input
                                    required
                                    value={formData.plate_number}
                                    onChange={(e) => setFormData({ ...formData, plate_number: e.target.value.toUpperCase() })}
                                    placeholder="例如: ABC-1234"
                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-slate-700 placeholder:text-slate-300 font-mono"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">廠牌型號</label>
                                <input
                                    required
                                    value={formData.model}
                                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                                    placeholder="例如: Toyota RAV4"
                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-slate-700 placeholder:text-slate-300"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">目前狀態</label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-slate-700"
                                    >
                                        <option value="AVAILABLE">可用</option>
                                        <option value="IN_USE">使用中</option>
                                        <option value="MAINTENANCE">維修中</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">啟用狀態</label>
                                    <select
                                        value={formData.is_active ? 'true' : 'false'}
                                        onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'true' })}
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-slate-700"
                                    >
                                        <option value="true">啟用中</option>
                                        <option value="false">已停用</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-6 py-4 bg-white text-slate-500 border border-slate-100 rounded-2xl font-black hover:bg-slate-50 transition-all"
                                >
                                    取消
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-6 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95"
                                >
                                    儲存變更
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CarManagementPage;

import React, { useState, useEffect, useMemo } from 'react';
import { LeaveType } from '../types';
import { requestService } from '../services/requestService';
import { leaveTypeService } from '../services/leaveTypeService';
import { getCars } from '../services/carService';

interface LeaveRequestFormProps {
    employeeId: string;
    onClose: () => void;
    onSuccess: () => void;
}

const LeaveRequestForm: React.FC<LeaveRequestFormProps> = ({ employeeId, onClose, onSuccess }) => {
    const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
    const [selectedTypeId, setSelectedTypeId] = useState<string>('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [needCar, setNeedCar] = useState(false);
    const [availableCars, setAvailableCars] = useState<any[]>([]);
    const [selectedCarId, setSelectedCarId] = useState<string>('');
    const [employees, setEmployees] = useState<any[]>([]);
    const [selectedDeputyId, setSelectedDeputyId] = useState<string>('');

    useEffect(() => {
        loadLeaveTypes();
        loadCars();
        loadEmployees();
    }, []);

    const loadCars = async () => {
        try {
            const cars = await getCars(true);
            setAvailableCars(cars || []);
            if (cars && cars.length > 0) {
                setSelectedCarId(cars[0].id);
            }
        } catch (err) {
            console.error('Error loading cars:', err);
        }
    };

    const loadEmployees = async () => {
        try {
            const { supabase } = await import('../lib/supabase');

            // 先取得當前員工的部門
            const { data: currentEmployee } = await supabase
                .from('employees')
                .select('department')
                .eq('id', employeeId)
                .single();

            if (!currentEmployee) {
                console.error('無法取得當前員工資訊');
                return;
            }

            // 只載入相同部門的員工(排除自己)
            const { data } = await supabase
                .from('employees')
                .select('id, name, department')
                .eq('is_active', true)
                .eq('department', currentEmployee.department)
                .neq('id', employeeId)
                .order('name');
            setEmployees(data || []);
        } catch (err) {
            console.error('Error loading employees:', err);
        }
    };

    const loadLeaveTypes = async () => {
        setIsLoading(true);
        const types = await leaveTypeService.getActiveLeaveTypes();
        setLeaveTypes(types);
        if (types.length > 0) {
            setSelectedTypeId(types[0].id);
        }
        setIsLoading(false);
    };

    // 計算總時數邏輯(只計算工作時間 08:00-17:00,扣除 12:00-13:00 午休)
    const totalHours = useMemo(() => {
        if (!startDate || !endDate) return 0;
        const start = new Date(startDate);
        const end = new Date(endDate);

        if (end <= start) return 0;

        let totalMinutes = 0;

        // 工作時間定義
        const WORK_START_HOUR = 8;
        const WORK_END_HOUR = 17;
        const LUNCH_START_HOUR = 12;
        const LUNCH_END_HOUR = 13;

        // 遍歷每一天
        let currentDay = new Date(start);
        currentDay.setHours(0, 0, 0, 0);

        const endDay = new Date(end);
        endDay.setHours(0, 0, 0, 0);

        while (currentDay <= endDay) {
            // 當天的工作時間範圍
            const dayWorkStart = new Date(currentDay);
            dayWorkStart.setHours(WORK_START_HOUR, 0, 0, 0);

            const dayWorkEnd = new Date(currentDay);
            dayWorkEnd.setHours(WORK_END_HOUR, 0, 0, 0);

            // 計算當天實際的開始和結束時間(與申請時間取交集)
            const actualStart = new Date(Math.max(start.getTime(), dayWorkStart.getTime()));
            const actualEnd = new Date(Math.min(end.getTime(), dayWorkEnd.getTime()));

            // 如果當天有工作時間
            if (actualStart < actualEnd) {
                // 計算當天的工作分鐘數
                let dayMinutes = Math.floor((actualEnd.getTime() - actualStart.getTime()) / (1000 * 60));

                // 扣除午休時間(如果跨過午休時段)
                const lunchStart = new Date(currentDay);
                lunchStart.setHours(LUNCH_START_HOUR, 0, 0, 0);

                const lunchEnd = new Date(currentDay);
                lunchEnd.setHours(LUNCH_END_HOUR, 0, 0, 0);

                // 計算與午休時段的重疊
                const lunchOverlapStart = new Date(Math.max(actualStart.getTime(), lunchStart.getTime()));
                const lunchOverlapEnd = new Date(Math.min(actualEnd.getTime(), lunchEnd.getTime()));

                if (lunchOverlapStart < lunchOverlapEnd) {
                    const lunchMinutes = Math.floor((lunchOverlapEnd.getTime() - lunchOverlapStart.getTime()) / (1000 * 60));
                    dayMinutes -= lunchMinutes;
                }

                totalMinutes += dayMinutes;
            }

            // 移到下一天
            currentDay.setDate(currentDay.getDate() + 1);
        }

        return Math.max(0, totalMinutes / 60);
    }, [startDate, endDate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedTypeId || !startDate || !endDate || !reason || !selectedDeputyId) {
            setError('請填寫所有必填欄位(包含職務代理人)');
            return;
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        if (end <= start) {
            setError('結束時間必須晚於開始時間');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            await requestService.createRequest({
                employee_id: employeeId,
                type: 'LEAVE' as any,
                leave_type_id: selectedTypeId,
                start_date: new Date(startDate).toISOString(),
                end_date: new Date(endDate).toISOString(),
                reason,
                hours: totalHours,
                car_id: needCar ? selectedCarId : undefined,
                deputy_id: selectedDeputyId || undefined
            });
            onSuccess();
        } catch (err: any) {
            setError(err.message || '提交失敗，請稍後再試');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-2xl bg-white dark:bg-[#1e293b] rounded-2xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-700 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
                <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center shrink-0">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">event_note</span>
                        申請出差勤
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {isLoading ? (
                    <div className="p-12 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                        <div className="p-6 space-y-4 overflow-y-auto flex-1 scrollbar-hide">
                            {error && (
                                <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-3 text-rose-600 animate-in slide-in-from-top-2">
                                    <span className="material-symbols-outlined shrink-0 mt-0.5">error</span>
                                    <span className="text-sm font-bold">{error}</span>
                                </div>
                            )}

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2 ml-1">類型 <span className="text-rose-500">*</span></label>
                                {leaveTypes.length === 0 ? (
                                    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg text-center text-slate-500">
                                        目前沒有可用的差勤類型
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <select
                                            value={selectedTypeId}
                                            onChange={(e) => setSelectedTypeId(e.target.value)}
                                            className="w-full p-3 pl-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-bold appearance-none cursor-pointer"
                                            required
                                        >
                                            {leaveTypes.map((type) => (
                                                <option key={type.id} value={type.id}>
                                                    {type.name}
                                                </option>
                                            ))}
                                        </select>
                                        {/* 顏色指示器 */}
                                        <div
                                            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full pointer-events-none"
                                            style={{ backgroundColor: leaveTypes.find(t => t.id === selectedTypeId)?.color || '#3B82F6' }}
                                        />
                                        {/* 下拉箭頭 */}
                                        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                                            expand_more
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2 ml-1">開始時間 <span className="text-rose-500">*</span></label>
                                    <input
                                        type="datetime-local"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-bold"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2 ml-1">結束時間 <span className="text-rose-500">*</span></label>
                                    <input
                                        type="datetime-local"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-bold"
                                        required
                                    />
                                </div>
                            </div>

                            {/* 時數顯示區 */}
                            {startDate && endDate && totalHours > 0 && (
                                <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 flex items-center justify-between animate-in fade-in slide-in-from-bottom-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-100 text-white">
                                            <span className="material-symbols-outlined text-xl">schedule</span>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">預計總時數</p>
                                            <p className="text-sm font-black text-blue-900 mt-0.5">已扣除午休 (12:00-13:00)</p>
                                        </div>
                                    </div>
                                    <div className="text-2xl font-black text-blue-600 tabular-nums">
                                        {totalHours.toFixed(1)} <span className="text-xs ml-1">HR</span>
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2 ml-1">申請事由 <span className="text-rose-500">*</span></label>
                                <textarea
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all min-h-[100px] font-bold"
                                    placeholder="請敘明出差或請假具體事由..."
                                    required
                                />
                            </div>

                            {/* 職代選擇 */}
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2 ml-1">
                                    職務代理人 <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <select
                                        value={selectedDeputyId}
                                        onChange={(e) => setSelectedDeputyId(e.target.value)}
                                        className="w-full p-3 pl-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-bold appearance-none cursor-pointer"
                                        required
                                    >
                                        <option value="">請選擇職務代理人</option>
                                        {employees.map((emp) => (
                                            <option key={emp.id} value={emp.id}>
                                                {emp.name} - {emp.department}
                                            </option>
                                        ))}
                                    </select>
                                    {/* 圖示 */}
                                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                                        person_pin
                                    </span>
                                    {/* 下拉箭頭 */}
                                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                                        expand_more
                                    </span>
                                </div>
                                {selectedDeputyId && (
                                    <p className="text-xs text-slate-500 mt-2 ml-1">
                                        已選擇 {employees.find(e => e.id === selectedDeputyId)?.name} 作為職務代理人
                                    </p>
                                )}
                            </div>

                            {/* 公務車借用區塊 */}
                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-700">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-blue-600">directions_car</span>
                                        <span className="text-sm font-black text-slate-700 dark:text-slate-200">借用公務車</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setNeedCar(!needCar)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${needCar ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${needCar ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>

                                {needCar && (
                                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                        {availableCars.length === 0 ? (
                                            <p className="text-xs text-rose-500 font-bold px-1">目前無可用車輛</p>
                                        ) : (
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 ml-1">選擇車輛</label>
                                                <select
                                                    value={selectedCarId}
                                                    onChange={(e) => setSelectedCarId(e.target.value)}
                                                    className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-bold"
                                                >
                                                    {availableCars.map(car => (
                                                        <option key={car.id} value={car.id}>
                                                            {car.plate_number} - {car.model}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-100 dark:border-slate-700 flex gap-3 bg-slate-50/50 shrink-0">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-2xl font-black hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
                            >
                                取消退出
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting || leaveTypes.length === 0}
                                className="flex-1 py-4 bg-primary text-white rounded-2xl font-black shadow-xl shadow-primary/20 hover:bg-primary-dark transition-all disabled:opacity-50 active:scale-95"
                            >
                                {isSubmitting ? '提交處理中...' : '確認提交申請'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default LeaveRequestForm;

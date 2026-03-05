import React, { useState, useEffect, useMemo } from 'react';
import { LeaveType, Employee, EmployeeSchedule } from '../types';
import { calculateLeaveHours, calculateLeaveHoursDetailed, isRestDay, validateOTHours, OTValidationResult, DetailedLeaveHours } from '../lib/leaveUtils';
import { requestService } from '../services/requestService';
import { getEmployeeSchedules } from '../services/admin';
import { leaveTypeService } from '../services/leaveTypeService';
import { getCars } from '../services/carService';

interface LeaveRequestFormProps {
    employeeId: string;
    onClose: () => void;
    onSuccess: () => void;
}

const LeaveRequestForm: React.FC<LeaveRequestFormProps> = ({ employeeId, onClose, onSuccess }) => {
    const [employeeSchedule, setEmployeeSchedule] = useState<Partial<Employee>>({});
    const [historicalSchedules, setHistoricalSchedules] = useState<EmployeeSchedule[]>([]);
    const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
    const [selectedTypeId, setSelectedTypeId] = useState<string>('');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [startTime, setStartTime] = useState('09:00');
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [endTime, setEndTime] = useState('18:00');
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [needCar, setNeedCar] = useState(false);
    const [availableCars, setAvailableCars] = useState<any[]>([]);
    const [selectedCarId, setSelectedCarId] = useState<string>('');
    const [employees, setEmployees] = useState<any[]>([]);
    const [selectedDeputyId, setSelectedDeputyId] = useState<string>('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [otValidation, setOtValidation] = useState<OTValidationResult | null>(null);
    const [detailedHours, setDetailedHours] = useState<DetailedLeaveHours | null>(null);
    const [manualBreakHours, setManualBreakHours] = useState<string>('0');
    const [isMakeupWorkday, setIsMakeupWorkday] = useState(false);

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

            // 先取得當前員工的部門與班表
            const { data: currentEmployee } = await supabase
                .from('employees')
                .select('department, work_start_time, work_end_time, break_start_time, break_end_time, break2_start_time, break2_end_time, break3_start_time, break3_end_time')
                .eq('id', employeeId)
                .single();

            if (!currentEmployee) {
                console.error('無法取得當前員工資訊');
                return;
            }
            setEmployeeSchedule(currentEmployee);

            // 取得歷史班表紀錄
            const schedules = await getEmployeeSchedules(employeeId);
            setHistoricalSchedules(schedules);

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

    // 計算總時數邏輯 (使用統一工具函數)
    const totalHours = useMemo(() => {
        if (!startDate || !endDate) return 0;
        const selectedType = leaveTypes.find(t => t.id === selectedTypeId);

        // 判斷是否為加班或折現類型：檢查代碼 (OT, CO, ALC) 或名稱包含「加班/折現」
        const isOvertime =
            selectedType?.code === 'OT' ||
            selectedType?.code === 'CO' ||
            selectedType?.code === 'ALC' ||
            selectedType?.code === 'COMPENSATORY' ||
            selectedType?.code === 'TOIL' ||
            selectedType?.name?.includes('加班') ||
            selectedType?.name?.includes('折現') ||
            selectedType?.name?.includes('折算') ||
            selectedType?.name?.includes('補休');

        const startDateTimeStr = `${startDate}T${startTime}`;
        const endDateTimeStr = `${endDate}T${endTime}`;

        console.log('LeaveRequestForm Calculation Start:', {
            leaveTypeId: selectedTypeId,
            leaveTypeName: selectedType?.name,
            leaveTypeCode: selectedType?.code,
            isOvertime,
            startDateStr: startDateTimeStr,
            endDateStr: endDateTimeStr
        });

        const manualBreak = parseFloat(manualBreakHours) || 0;

        // 如果是加班類型，使用驗證函數
        if (selectedType?.code === 'OT') {
            const validation = validateOTHours(
                new Date(startDateTimeStr),
                new Date(endDateTimeStr),
                employeeSchedule,
                historicalSchedules,
                manualBreak
            );
            setOtValidation(validation);
            setDetailedHours({
                totalHours: validation.adjustedHours || 0,
                finalHours: validation.adjustedHours || 0,
                rawHours: validation.originalHours || 0,
                breakHours: (validation.breakDeducted || 0) + manualBreak
            });

            if (!validation.isValid) {
                setError(validation.error || '加班時數驗證失敗');
                return 0;
            }

            // 清除錯誤訊息
            if (error && error.includes('加班')) {
                setError(null);
            }

            console.log('OT Validation Result:', validation);
            return validation.adjustedHours || 0;
        } else {
            // 非加班類型，清除 OT 驗證狀態
            setOtValidation(null);
        }

        const detailed = calculateLeaveHoursDetailed(
            new Date(startDateTimeStr),
            new Date(endDateTimeStr),
            employeeSchedule,
            isOvertime,
            true,
            historicalSchedules,
            manualBreak,
            isMakeupWorkday
        );
        setDetailedHours(detailed);

        console.log('LeaveRequestForm Calculation End:', {
            calculatedHours: detailed.finalHours
        });

        return detailed.finalHours;
    }, [startDate, startTime, endDate, endTime, employeeSchedule, selectedTypeId, leaveTypes, historicalSchedules, manualBreakHours, isMakeupWorkday]);

    // 計算請假天數（用於判斷是否需要理事長審核）
    const totalDays = useMemo(() => {
        if (!startDate || !startTime || !endDate || !endTime) return 0;
        const start = new Date(`${startDate}T${startTime}`);
        const end = new Date(`${endDate}T${endTime}`);

        if (end <= start) return 0;

        // 計算跨越的日曆天數
        // 例如：2/15 08:00 到 2/17 17:00 = 3 天 (2/15, 2/16, 2/17)
        const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
        return Math.round((endDay.getTime() - startDay.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }, [startDate, startTime, endDate, endTime]);

    // 判斷是否需要理事長審核
    const requiresChairmanApproval = totalDays >= 3;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const selectedType = leaveTypes.find(t => t.id === selectedTypeId);
        const isDeputyOptional =
            selectedType?.code === 'OT' ||
            selectedType?.code === 'CO' ||
            selectedType?.code === 'ALC' ||
            selectedType?.name?.includes('加班') ||
            selectedType?.name?.includes('折現') ||
            selectedType?.name?.includes('折算');

        const startDateTimeStr = `${startDate}T${startTime}`;
        const endDateTimeStr = `${endDate}T${endTime}`;

        // 如果不是免填類型，則職代為必填
        if (!selectedTypeId || !startDate || !startTime || !endDate || !endTime || !reason || (!isDeputyOptional && !selectedDeputyId)) {
            setError(isDeputyOptional ? '請填寫所有必填欄位(除職務代理人外)' : '請填寫所有必填欄位(包含職務代理人)');
            return;
        }

        const start = new Date(startDateTimeStr);
        const end = new Date(endDateTimeStr);
        if (end <= start) {
            setError('結束時間必須晚於開始時間');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            let attachmentInfo = {};

            // 如果有選取檔案，先上傳
            if (selectedFile) {
                setUploadProgress(10); // 模擬進度開始
                const { data: uploadData, error: uploadError } = await requestService.uploadAttachment(selectedFile);
                if (uploadError) throw new Error(`附件上傳失敗: ${uploadError}`);

                attachmentInfo = {
                    attachment_drive_id: uploadData.driveId,
                    attachment_name: selectedFile.name,
                    attachment_url: uploadData.url,
                    attachment_expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() // 3 個月後
                };
                setUploadProgress(100);
            }

            await requestService.createRequest({
                employee_id: employeeId,
                type: 'LEAVE' as any,
                leave_type_id: selectedTypeId,
                start_date: new Date(startDateTimeStr).toISOString(),
                end_date: new Date(endDateTimeStr).toISOString(),
                reason,
                hours: totalHours,
                manual_break_hours: parseFloat(manualBreakHours) || 0,
                car_id: needCar ? selectedCarId : undefined,
                deputy_id: selectedDeputyId || undefined,
                is_makeup_workday: isMakeupWorkday,
                ...attachmentInfo
            });
            onSuccess();
        } catch (err: any) {
            setError(err.message || '提交失敗，請稍後再試');
        } finally {
            setIsSubmitting(false);
            setUploadProgress(0);
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
                                <div className="space-y-4">
                                    <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2 ml-1">開始時間 <span className="text-rose-500">*</span></label>
                                    <div className="flex gap-2">
                                        <input
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => {
                                                const newDate = e.target.value;
                                                setStartDate(newDate);
                                                // 預設結束日期與開始日期相同
                                                setEndDate(newDate);
                                            }}
                                            className="flex-[2] p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-bold"
                                            max="9999-12-31"
                                            required
                                        />
                                        <input
                                            type="time"
                                            value={startTime}
                                            onChange={(e) => setStartTime(e.target.value)}
                                            className="flex-1 p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-bold"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2 ml-1">結束時間 <span className="text-rose-500">*</span></label>
                                    <div className="flex gap-2">
                                        <input
                                            type="date"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            className="flex-[2] p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-bold"
                                            max="9999-12-31"
                                            required
                                        />
                                        <input
                                            type="time"
                                            value={endTime}
                                            onChange={(e) => setEndTime(e.target.value)}
                                            className="flex-1 p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-bold"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* 例外情形：手動扣除休息時間 */}
                            <div className="bg-amber-50/30 border border-amber-100 rounded-2xl p-4 animate-in fade-in slide-in-from-bottom-2">
                                <label className="block text-[10px] font-black text-amber-600 uppercase tracking-[0.2em] mb-3 ml-1 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-sm">potted_plant</span>
                                    例外情形 (手動扣除休息時數)
                                </label>
                                <div className="flex items-center gap-4">
                                    <div className="flex-1 relative">
                                        <input
                                            type="number"
                                            step="0.5"
                                            min="0"
                                            value={manualBreakHours}
                                            onChange={(e) => setManualBreakHours(e.target.value)}
                                            className="w-full p-2.5 pl-10 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/50 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all font-bold tabular-nums"
                                            placeholder="請輸入欲扣除的休息時數..."
                                        />
                                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-amber-400 pointer-events-none text-lg">
                                            nest_clock_farsight_analog
                                        </span>
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-amber-500 pointer-events-none uppercase">
                                            小時
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-amber-500 font-medium max-w-[140px] leading-tight text-right">
                                        若總時數中包含不計薪的休息片段，請在此輸入。
                                    </p>
                                </div>
                            </div>

                            {/* 補行上班日開關 */}
                            <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 flex items-center justify-between animate-in fade-in slide-in-from-bottom-2">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100 text-white shrink-0">
                                        <span className="material-symbols-outlined text-xl">work_history</span>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">特殊項目</p>
                                        <p className="text-sm font-black text-indigo-900 mt-0.5">補行上班日</p>
                                        <p className="text-[10px] text-indigo-500 mt-1">若申請日適逢補班日（如週末補班），請開啟此開關。</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsMakeupWorkday(!isMakeupWorkday)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isMakeupWorkday ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isMakeupWorkday ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>

                            {/* OT 規則說明 */}
                            {leaveTypes.find(t => t.id === selectedTypeId)?.code === 'OT' && (
                                <div className="bg-blue-50/50 border border-blue-200 rounded-2xl p-4 animate-in fade-in slide-in-from-bottom-2">
                                    <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-100 text-white shrink-0">
                                            <span className="material-symbols-outlined text-xl">info</span>
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">加班時數規則</p>
                                            <ul className="space-y-1.5 text-xs text-blue-900">
                                                <li className="flex items-start gap-2">
                                                    <span className="text-blue-500 shrink-0">•</span>
                                                    <span><span className="font-black">平日加班</span>：最多 4 小時</span>
                                                </li>
                                                <li className="flex items-start gap-2">
                                                    <span className="text-blue-500 shrink-0">•</span>
                                                    <span><span className="font-black">休息日加班</span>：最多 12 小時</span>
                                                </li>
                                                <li className="flex items-start gap-2">
                                                    <span className="text-blue-500 shrink-0">•</span>
                                                    <span>連續工作超過 4 小時，<span className="font-black">自動扣除 0.5 小時休息時間</span></span>
                                                </li>
                                                <li className="flex items-start gap-2">
                                                    <span className="text-blue-500 shrink-0">•</span>
                                                    <span><span className="font-black">國定假日加班</span>：不論工時統一以 <span className="font-black">8 小時計</span></span>
                                                </li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 時數顯示區 */}
                            {startDate && endDate && totalHours > 0 && (
                                <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 flex flex-wrap items-center justify-between animate-in fade-in slide-in-from-bottom-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-100 text-white">
                                            <span className="material-symbols-outlined text-xl">schedule</span>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">預計總時數</p>
                                            <p className="text-sm font-black text-blue-900 mt-0.5">
                                                {detailedHours && detailedHours.breakHours > 0 ? (
                                                    `原始 ${detailedHours.rawHours} 小時，扣除休息 ${detailedHours.breakHours} 小時`
                                                ) : (
                                                    '已依據班表扣除休息時間'
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-2xl font-black text-blue-600 tabular-nums">
                                        {totalHours.toFixed(1)} <span className="text-xs ml-1">HR</span>
                                    </div>
                                </div>
                            )}

                            {/* 理事長審核提示 */}
                            {requiresChairmanApproval && (
                                <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2">
                                    <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-100 text-white shrink-0">
                                        <span className="material-symbols-outlined text-xl">admin_panel_settings</span>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">多層級審核</p>
                                        <p className="text-sm font-bold text-amber-900">
                                            此申請需要 <span className="font-black">主管及理事長</span> 雙重審核
                                        </p>
                                        <p className="text-xs text-amber-700 mt-1">
                                            請假 {totalDays} 日 ≥ 3 日，將由主管審核後轉送理事長核准
                                        </p>
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
                                    職務代理人 {(() => {
                                        const selectedType = leaveTypes.find(t => t.id === selectedTypeId);
                                        const isDeputyOptional =
                                            selectedType?.code === 'OT' ||
                                            selectedType?.code === 'CO' ||
                                            selectedType?.code === 'ALC' ||
                                            selectedType?.name?.includes('加班') ||
                                            selectedType?.name?.includes('折現') ||
                                            selectedType?.name?.includes('折算');
                                        return !isDeputyOptional && <span className="text-rose-500">*</span>;
                                    })()}
                                </label>
                                <div className="relative">
                                    <select
                                        value={selectedDeputyId}
                                        onChange={(e) => setSelectedDeputyId(e.target.value)}
                                        className="w-full p-3 pl-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-bold appearance-none cursor-pointer"
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
                            </div>

                            {/* 附件上傳 */}
                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-700">
                                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 ml-1 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-sm">attach_file</span>
                                    附件 (選填，如：診斷證明、公文等)
                                </label>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <label className="flex-1">
                                            <div className={`relative flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-xl cursor-pointer transition-all ${selectedFile ? 'border-primary bg-primary/5' : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500 bg-white dark:bg-slate-900'}`}>
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                                                    accept="image/*,.pdf,.doc,.docx"
                                                />
                                                <span className="material-symbols-outlined text-2xl text-slate-400 mb-1">
                                                    {selectedFile ? 'check_circle' : 'cloud_upload'}
                                                </span>
                                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                                    {selectedFile ? selectedFile.name : '點擊或拖放檔案至此'}
                                                </span>
                                                <span className="text-[10px] text-slate-400 mt-1">最大 10MB (PDF, JPG, DOC)</span>
                                            </div>
                                        </label>
                                        {selectedFile && (
                                            <button
                                                type="button"
                                                onClick={() => setSelectedFile(null)}
                                                className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                            >
                                                <span className="material-symbols-outlined">delete_outline</span>
                                            </button>
                                        )}
                                    </div>

                                    {isSubmitting && uploadProgress > 0 && (
                                        <div className="w-full bg-slate-200 rounded-full h-1 mt-2 overflow-hidden">
                                            <div
                                                className="bg-primary h-full transition-all duration-300"
                                                style={{ width: `${uploadProgress}%` }}
                                            />
                                        </div>
                                    )}

                                    <div className="flex items-start gap-2 text-[10px] text-slate-400 dark:text-slate-500 italic mt-1">
                                        <span className="material-symbols-outlined text-xs leading-none">info</span>
                                        附件將上傳至 Google 雲端空間，並於 3 個月後自動刪除。
                                    </div>
                                </div>
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
        </div >
    );
};

export default LeaveRequestForm;

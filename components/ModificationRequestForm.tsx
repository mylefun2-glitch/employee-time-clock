import React, { useState, useEffect, useMemo } from 'react';
import { LeaveRequest, Employee, EmployeeSchedule } from '../types';
import { requestService } from '../services/requestService';
import { calculateLeaveHours, calculateLeaveHoursDetailed, validateOTHours, OTValidationResult, DetailedLeaveHours } from '../lib/leaveUtils';
import { getEmployeeSchedules } from '../services/admin';
import { formatDateTimeRange } from '../lib/hrUtils';
import { getEmployeeLeaveBalances } from '../services/employee';
import { LeaveBalance } from '../types';
import TimeInput24h from './ui/TimeInput24h';

interface ModificationRequestFormProps {
    originalRequest: LeaveRequest;
    employeeId: string;
    onClose: () => void;
    onSuccess: () => void;
}

const ModificationRequestForm: React.FC<ModificationRequestFormProps> = ({
    originalRequest,
    employeeId,
    onClose,
    onSuccess
}) => {
    const [startDate, setStartDate] = useState('');
    const [startTime, setStartTime] = useState('09:00');
    const [endDate, setEndDate] = useState('');
    const [endTime, setEndTime] = useState('18:00');
    const [reason, setReason] = useState('');
    const [modificationReason, setModificationReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [employeeSchedule, setEmployeeSchedule] = useState<Partial<Employee>>({});
    const [historicalSchedules, setHistoricalSchedules] = useState<EmployeeSchedule[]>([]);
    const [error, setError] = useState('');
    const [otValidation, setOtValidation] = useState<OTValidationResult | null>(null);
    const [detailedHours, setDetailedHours] = useState<DetailedLeaveHours | null>(null);
    const [manualBreakHours, setManualBreakHours] = useState<string>('0');
    const [isMakeupWorkday, setIsMakeupWorkday] = useState(false);
    const [isMakeupHoliday, setIsMakeupHoliday] = useState(false);
    const [leaveBalance, setLeaveBalance] = useState<LeaveBalance | null>(null);

    useEffect(() => {
        const splitISO = (isoStr: string) => {
            if (!isoStr) return { date: '', time: '09:00' };
            const d = new Date(isoStr);
            if (isNaN(d.getTime())) return { date: '', time: '09:00' };
            const date = d.toISOString().split('T')[0];
            const time = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
            return { date, time };
        };

        const startInfo = splitISO(originalRequest.start_date);
        const endInfo = splitISO(originalRequest.end_date);

        setStartDate(startInfo.date);
        setStartTime(startInfo.time);
        setEndDate(endInfo.date);
        setEndTime(endInfo.time);
        setReason(originalRequest.reason || '');
        setManualBreakHours(originalRequest.manual_break_hours?.toString() || '0');
        setIsMakeupWorkday(originalRequest.is_makeup_workday || false);
        setIsMakeupHoliday(originalRequest.is_makeup_holiday || false);

        // 獲取班表資訊以便計算時數
        const fetchSchedule = async () => {
            const { supabase } = await import('../lib/supabase');
            const { data } = await supabase
                .from('employees')
                .select('*')
                .eq('id', employeeId)
                .single();
            if (data) setEmployeeSchedule(data);

            const schedules = await getEmployeeSchedules(employeeId);
            setHistoricalSchedules(schedules);

            // 取得餘額資訊
            const balance = await getEmployeeLeaveBalances(employeeId);
            setLeaveBalance(balance);
        };
        fetchSchedule();
    }, [originalRequest, employeeId]);

    // 計算新時數
    const [totalHours, setTotalHours] = useState(0);

    // 計算總時數邏輯 (使用 useEffect 處理副作用，避免 Infinite Loop)
    useEffect(() => {
        if (!startDate || !endDate) {
            setTotalHours(0);
            return;
        }

        const leaveTypeName = originalRequest.leave_type?.name || '';
        const leaveTypeCode = originalRequest.leave_type?.code || '';

        // 判斷是否為加班或折現類型
        const isOvertime =
            leaveTypeCode === 'OT' ||
            leaveTypeCode === 'CO' ||
            leaveTypeCode === 'ALC' ||
            leaveTypeCode === 'TOIL' ||
            leaveTypeName.includes('加班') ||
            leaveTypeName.includes('折現') ||
            leaveTypeName.includes('補休') ||
            leaveTypeName.includes('小時換補休') ||
            leaveTypeName.includes('折算') ||
            originalRequest.reason?.includes('補休');

        const startDateTimeStr = `${startDate}T${startTime}`;
        const endDateTimeStr = `${endDate}T${endTime}`;
        const manualBreak = parseFloat(manualBreakHours) || 0;

        // 如果是加班類型 (OT)，使用驗證函數
        if (leaveTypeCode === 'OT') {
            const validation = validateOTHours(
                new Date(startDateTimeStr),
                new Date(endDateTimeStr),
                employeeSchedule,
                historicalSchedules,
                manualBreak,
                isMakeupHoliday
            );

            // 批次更新狀態
            setOtValidation(validation);
            setDetailedHours({
                totalHours: validation.adjustedHours || 0,
                finalHours: validation.adjustedHours || 0,
                rawHours: validation.originalHours || 0,
                breakHours: (validation.breakDeducted || 0) + manualBreak
            });

            if (!validation.isValid) {
                setError(validation.error || '加班時數驗證失敗');
                setTotalHours(0);
            } else {
                // 如果目前的錯誤是關於「加班」的，則清除
                if (error && error.includes('加班')) {
                    setError('');
                }
                setTotalHours(validation.adjustedHours || 0);
            }
        } else {
            // 非 OT 加班登記類型
            setOtValidation(null);

            const detailed = calculateLeaveHoursDetailed(
                new Date(startDateTimeStr),
                new Date(endDateTimeStr),
                employeeSchedule,
                isOvertime,
                true,
                historicalSchedules,
                manualBreak,
                isMakeupWorkday,
                isMakeupHoliday
            );

            setDetailedHours(detailed);
            setTotalHours(detailed.finalHours);

            // 嘗試清除因加班導致的舊錯誤訊息
            if (error && error.includes('加班')) {
                setError('');
            }
        }
    }, [startDate, startTime, endDate, endTime, employeeSchedule, originalRequest, historicalSchedules, manualBreakHours, isMakeupWorkday, isMakeupHoliday]);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!modificationReason.trim()) {
            setError('請填寫變更原因');
            return;
        }

        setIsSubmitting(true);

        const startDateTimeStr = `${startDate}T${startTime}`;
        const endDateTimeStr = `${endDate}T${endTime}`;

        const start = new Date(startDateTimeStr);
        const end = new Date(endDateTimeStr);
        if (end <= start) {
            setError('結束時間必須晚於開始時間');
            setIsSubmitting(false);
            return;
        }

        const result = await requestService.createModificationRequest(
            originalRequest.id,
            {
                start_date: new Date(startDateTimeStr).toISOString(),
                end_date: new Date(endDateTimeStr).toISOString(),
                reason: reason.trim(),
                modification_reason: modificationReason.trim(),
                leave_type_id: originalRequest.leave_type_id,
                type: originalRequest.type,
                hours: totalHours,
                manual_break_hours: parseFloat(manualBreakHours) || 0,
                is_makeup_workday: isMakeupWorkday,
                is_makeup_holiday: isMakeupHoliday
            },
            employeeId
        );

        setIsSubmitting(false);

        if (result.success) {
            onSuccess();
        } else {
            setError(result.error || '提交失敗');
        }
    };

    const getStatusInfo = (status: string) => {
        switch (status) {
            case 'APPROVED':
                return { text: '已核准', class: 'bg-emerald-50 text-emerald-600 border-emerald-200' };
            case 'REJECTED':
                return { text: '已拒絕', class: 'bg-rose-50 text-rose-600 border-rose-200' };
            default:
                return { text: '待審核', class: 'bg-amber-50 text-amber-600 border-amber-200' };
        }
    };

    const status = getStatusInfo(originalRequest.status);

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-slate-100 px-8 py-6 flex items-center justify-between rounded-t-3xl">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900">申請變更</h2>
                        <p className="text-sm text-slate-500 mt-1">修改已審核的申請內容</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
                    >
                        <span className="material-symbols-outlined text-slate-600">close</span>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    {/* 原申請內容 */}
                    <div className="bg-slate-50/50 rounded-2xl p-6 border border-slate-100">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="material-symbols-outlined text-slate-400">history</span>
                            <h3 className="text-sm font-black text-slate-500 uppercase tracking-wider">原申請內容參考</h3>
                        </div>
                        <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm space-y-3">
                            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">類型</span>
                                    <span className="text-sm font-bold text-slate-700">{originalRequest.leave_type?.name || '差勤申請'}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">時間</span>
                                    <span className="text-sm font-mono font-bold text-slate-700">
                                        {formatDateTimeRange(originalRequest.start_date, originalRequest.end_date)}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">時數</span>
                                    <span className="text-sm font-bold text-slate-700">{originalRequest.hours || 0} 小時</span>
                                </div>
                            </div>
                            <div className="pt-2 border-t border-slate-50">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">原事由</span>
                                <p className="text-sm text-slate-600 leading-relaxed italic">
                                    "{originalRequest.reason || '未填寫事由'}"
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* 變更後的資訊 */}
                    <div className="bg-blue-50 rounded-2xl p-6 border border-blue-200">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="material-symbols-outlined text-blue-600">edit</span>
                            <h3 className="text-sm font-black text-blue-900 uppercase tracking-wider">變更後的資訊</h3>
                        </div>

                        {/* 餘額顯示提示 */}
                        {(() => {
                            const leaveTypeName = originalRequest.leave_type?.name || '';
                            const leaveTypeCode = originalRequest.leave_type?.code || '';

                            if (!leaveBalance) return null;

                            const isAnnual = leaveTypeCode === 'ANNUAL' || leaveTypeName.includes('特休') || leaveTypeName.includes('折現');
                            const isCompensatory =
                                leaveTypeCode === 'TOIL' ||
                                leaveTypeCode === 'ALC' ||
                                leaveTypeName.includes('補休') ||
                                leaveTypeName.includes('小時換補休') ||
                                leaveTypeName.includes('折算');

                            if (!isAnnual && !isCompensatory) return null;

                            const balanceValue = isAnnual ? leaveBalance.annual.remaining : leaveBalance.compensatory.remaining;
                            const label = isAnnual ? '特休餘額' : '補休餘額';
                            const icon = isAnnual ? 'calendar_month' : 'history';

                            return (
                                <div className={`p-3 mb-4 rounded-xl border flex items-center justify-between animate-in fade-in slide-in-from-top-1 ${isAnnual ? 'border-emerald-200 bg-emerald-50/50' : 'border-purple-200 bg-purple-50/50'}`}>
                                    <div className="flex items-center gap-2">
                                        <span className={`material-symbols-outlined text-lg ${isAnnual ? 'text-emerald-500' : 'text-purple-500'}`}>{icon}</span>
                                        <span className={`text-xs font-black uppercase tracking-widest ${isAnnual ? 'text-emerald-700' : 'text-purple-700'}`}>{label}</span>
                                    </div>
                                    <div className="flex items-baseline gap-1">
                                        <span className={`text-lg font-black tabular-nums ${isAnnual ? 'text-emerald-600' : 'text-purple-600'}`}>{balanceValue}</span>
                                        <span className={`text-[10px] font-bold ${isAnnual ? 'text-emerald-500' : 'text-purple-500'}`}>小時</span>
                                    </div>
                                </div>
                            );
                        })()}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-black text-blue-900 uppercase tracking-wider mb-2">
                                    開始時間 *
                                </label>
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
                                        required
                                        max="9999-12-31"
                                        className="flex-1 px-4 py-3 rounded-xl border border-blue-200 bg-white text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                    <TimeInput24h
                                        value={startTime}
                                        onChange={setStartTime}
                                        required
                                        className="flex-1"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-black text-blue-900 uppercase tracking-wider mb-2">
                                    結束時間 *
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        required
                                        max="9999-12-31"
                                        className="flex-[2] px-4 py-3 rounded-xl border border-blue-200 bg-white text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                    <TimeInput24h
                                        value={endTime}
                                        onChange={setEndTime}
                                        required
                                        className="flex-1"
                                    />
                                </div>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-[10px] font-black text-blue-900 uppercase tracking-wider mb-2">
                                    事由
                                </label>
                                <textarea
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    rows={4}
                                    className="w-full px-4 py-3 rounded-xl border border-blue-200 bg-white text-sm font-bold resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="請說明申請事由"
                                />
                            </div>

                            {/* 例外情形：手動扣除休息時間 */}
                            <div className="md:col-span-2 bg-amber-50/30 border border-amber-100 rounded-2xl p-4 animate-in fade-in slide-in-from-bottom-2">
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
                                            className="w-full p-2.5 pl-10 bg-white border border-amber-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all font-bold tabular-nums text-sm"
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

                            {/* 特殊項目：補行上班日與補假列 */}
                            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* 補行上班日開關 */}
                                <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 flex items-center justify-between animate-in fade-in slide-in-from-bottom-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100 text-white shrink-0">
                                            <span className="material-symbols-outlined text-xl">work_history</span>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">特殊項目</p>
                                            <p className="text-sm font-black text-indigo-900 mt-0.5">補行上班日</p>
                                            <p className="text-[10px] text-indigo-500 mt-1">若申請日適逢補班日（如週末補班）。</p>
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

                                {/* 補假開關 */}
                                <div className="bg-rose-50/50 border border-rose-100 rounded-2xl p-4 flex items-center justify-between animate-in fade-in slide-in-from-bottom-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-rose-600 rounded-xl flex items-center justify-center shadow-lg shadow-rose-100 text-white shrink-0">
                                            <span className="material-symbols-outlined text-xl">event_busy</span>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest">假日設定</p>
                                            <p className="text-sm font-black text-rose-900 mt-0.5">本日為補假</p>
                                            <p className="text-[10px] text-rose-500 mt-1">若申請日為補假日（如國假避開週休）。</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIsMakeupHoliday(!isMakeupHoliday)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isMakeupHoliday ? 'bg-rose-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isMakeupHoliday ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>
                            </div>

                            {/* OT 規則說明 */}
                            {originalRequest.leave_type?.code === 'OT' && (
                                <div className="md:col-span-2 bg-blue-50/50 border border-blue-200 rounded-2xl p-4 animate-in fade-in slide-in-from-bottom-2">
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

                            <div className="md:col-span-2">
                                <div className="bg-blue-100/30 rounded-xl p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-blue-600 text-sm">schedule</span>
                                        <span className="text-sm font-black text-blue-900">預計新時數</span>
                                    </div>
                                    <div className="text-2xl font-black text-blue-600">
                                        {Number.isInteger(totalHours) ? totalHours : totalHours.toFixed(1)} <span className="text-xs text-blue-400 font-bold">小時</span>
                                    </div>
                                </div>
                                <p className="text-[10px] text-blue-400 font-bold mt-2 ml-1">
                                    {detailedHours && detailedHours.breakHours > 0 ? (
                                        `原始 ${Number.isInteger(detailedHours.rawHours) ? detailedHours.rawHours : detailedHours.rawHours.toFixed(1)} 小時，扣除休息 ${Number.isInteger(detailedHours.breakHours) ? detailedHours.breakHours : detailedHours.breakHours.toFixed(1)} 小時`
                                    ) : (
                                        '已依據班表扣除休息時間'
                                    )}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* 變更原因 */}
                    <div>
                        <label className="block text-sm font-black text-slate-900 mb-2">
                            變更原因 <span className="text-rose-500">*</span>
                        </label>
                        <textarea
                            value={modificationReason}
                            onChange={(e) => setModificationReason(e.target.value)}
                            rows={4}
                            required
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="請說明為何需要變更此申請..."
                        />
                        <p className="text-xs text-slate-500 mt-2">此欄位將提供給主管審核時參考</p>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3">
                            <span className="material-symbols-outlined text-rose-600 text-xl">error</span>
                            <div>
                                <p className="text-sm font-bold text-rose-900">提交失敗</p>
                                <p className="text-sm text-rose-700 mt-1">{error}</p>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-black hover:bg-slate-200 transition-colors"
                        >
                            取消
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-black hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? '提交中...' : '提交變更申請'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ModificationRequestForm;

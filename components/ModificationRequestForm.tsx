import React, { useState, useEffect, useMemo } from 'react';
import { LeaveRequest, Employee, EmployeeSchedule } from '../types';
import { requestService } from '../services/requestService';
import { calculateLeaveHours, calculateLeaveHoursDetailed, validateOTHours, OTValidationResult, DetailedLeaveHours } from '../lib/leaveUtils';
import { getEmployeeSchedules } from '../services/admin';
import { formatDateTimeRange } from '../lib/hrUtils';

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
        };
        fetchSchedule();
    }, [originalRequest, employeeId]);

    // 計算新時數
    const totalHours = useMemo(() => {
        if (!startDate || !endDate) return 0;

        // 強化加班判定：從多個來源確認
        const leaveTypeName = originalRequest.leave_type?.name || '';
        const leaveTypeCode = originalRequest.leave_type?.code || '';

        // 1. 檢查代碼是否為 OT, CO, ALC
        // 2. 檢查名稱是否包含「加班」、「折現」、「折算」
        // 3. 檢查原始申請原因是否有「加班」關鍵字
        const isOvertime =
            leaveTypeCode === 'OT' ||
            leaveTypeCode === 'CO' ||
            leaveTypeCode === 'ALC' ||
            leaveTypeName.includes('加班') ||
            leaveTypeName.includes('折現') ||
            leaveTypeName.includes('折算') ||
            originalRequest.reason?.includes('加班');

        console.log('ModificationRequestForm Calculation Start:', {
            requestId: originalRequest.id,
            leaveType: {
                id: originalRequest.leave_type_id,
                name: leaveTypeName,
                code: leaveTypeCode
            },
            isOvertime,
            startDateStr: `${startDate}T${startTime}`,
            endDateStr: `${endDate}T${endTime}`,
            hasSchedules: historicalSchedules.length > 0,
            originalRequestRaw: originalRequest
        });

        const startDateTimeStr = `${startDate}T${startTime}`;
        const endDateTimeStr = `${endDate}T${endTime}`;

        const manualBreak = parseFloat(manualBreakHours) || 0;

        // 如果是加班類型，使用驗證函數
        if (leaveTypeCode === 'OT') {
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
                setError('');
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

        console.log('ModificationRequestForm Calculation End:', {
            requestId: originalRequest.id,
            calculatedHours: detailed.finalHours
        });

        return detailed.finalHours;
    }, [startDate, startTime, endDate, endTime, employeeSchedule, originalRequest, historicalSchedules, manualBreakHours, isMakeupWorkday]);

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
                is_makeup_workday: isMakeupWorkday
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
                                        className="flex-[2] px-4 py-3 rounded-xl border border-blue-200 bg-white text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                    <input
                                        type="time"
                                        value={startTime}
                                        onChange={(e) => setStartTime(e.target.value)}
                                        required
                                        className="flex-1 px-4 py-3 rounded-xl border border-blue-200 bg-white text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                                    <input
                                        type="time"
                                        value={endTime}
                                        onChange={(e) => setEndTime(e.target.value)}
                                        required
                                        className="flex-1 px-4 py-3 rounded-xl border border-blue-200 bg-white text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

                            {/* 補行上班日開關 */}
                            <div className="md:col-span-2 bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 flex items-center justify-between animate-in fade-in slide-in-from-bottom-2">
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

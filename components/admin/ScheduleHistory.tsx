import React, { useEffect, useState } from 'react';
import { getEmployeeSchedules, addEmployeeSchedule } from '../../services/admin';
import { EmployeeSchedule } from '../../types';
import { Trash2, History, Plus, AlertCircle, X, Check, RotateCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ScheduleHistoryProps {
    employeeId: string;
    isAdmin?: boolean;
}

const ScheduleHistory: React.FC<ScheduleHistoryProps> = ({ employeeId, isAdmin = true }) => {
    const [schedules, setSchedules] = useState<EmployeeSchedule[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);

    // Form state for new record
    const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
    const [formIn, setFormIn] = useState('08:00');
    const [formOut, setFormOut] = useState('17:00');
    const [formBreakIn, setFormBreakIn] = useState('12:00');
    const [formBreakOut, setFormBreakOut] = useState('13:00');
    const [formBreak2In, setFormBreak2In] = useState('');
    const [formBreak2Out, setFormBreak2Out] = useState('');
    const [formBreak3In, setFormBreak3In] = useState('');
    const [formBreak3Out, setFormBreak3Out] = useState('');
    const [formStandardHours, setFormStandardHours] = useState<number>(8.0);
    const [formSalary, setFormSalary] = useState<'MONTHLY' | 'HOURLY'>('MONTHLY');
    const [formRestDays, setFormRestDays] = useState<number[]>([0, 6]);

    useEffect(() => {
        fetchSchedules();
    }, [employeeId]);

    const fetchSchedules = async () => {
        setLoading(true);
        const data = await getEmployeeSchedules(employeeId);
        setSchedules(data);
        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('確定要刪除此班表紀錄嗎？這可能會影響過去或未來的時數計算。')) return;

        try {
            const { error } = await supabase
                .from('employee_schedules')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchSchedules();
        } catch (error: any) {
            alert('刪除失敗：' + error.message);
        }
    };

    const handleSyncHours = () => {
        const getTimeMin = (t: string) => {
            if (!t) return 0;
            const [h, m] = t.split(':').map(Number);
            return h * 60 + m;
        };
        const workTotal = getTimeMin(formOut) - getTimeMin(formIn);
        const break1 = getTimeMin(formBreakOut) - getTimeMin(formBreakIn);
        const break2 = formBreak2In && formBreak2Out ? getTimeMin(formBreak2Out) - getTimeMin(formBreak2In) : 0;
        const break3 = formBreak3In && formBreak3Out ? getTimeMin(formBreak3Out) - getTimeMin(formBreak3In) : 0;
        const netMin = workTotal - break1 - break2 - break3;
        setFormStandardHours(Math.max(1, parseFloat((netMin / 60).toFixed(1))));
    };

    const handleAddSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await addEmployeeSchedule({
                employee_id: employeeId,
                effective_date: formDate,
                work_start_time: formIn,
                work_end_time: formOut,
                break_start_time: formBreakIn,
                break_end_time: formBreakOut,
                break2_start_time: formBreak2In || null,
                break2_end_time: formBreak2Out || null,
                break3_start_time: formBreak3In || null,
                break3_end_time: formBreak3Out || null,
                salary_type: formSalary,
                rest_days: formRestDays,
                standard_daily_hours: formStandardHours
            } as any);

            if (res.success) {
                setShowAddForm(false);
                fetchSchedules();
            } else {
                alert('新增失敗：' + res.error);
            }
        } catch (error: any) {
            alert('發生錯誤：' + error.message);
        }
    };

    const toggleRestDay = (day: number) => {
        setFormRestDays(prev =>
            prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
        );
    };

    if (loading) return <div className="text-center py-4 text-slate-400 text-xs font-bold">載入紀錄中...</div>;

    return (
        <div className="space-y-4 pb-20">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-blue-600" />
                    <h4 className="text-sm font-bold text-slate-900">班表與薪資異動歷史</h4>
                </div>
                {isAdmin && !showAddForm && (
                    <button
                        onClick={() => setShowAddForm(true)}
                        className="flex items-center gap-1 text-[11px] font-black bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-all shadow-sm"
                    >
                        <Plus className="h-3 w-3" />
                        新增異動紀錄
                    </button>
                )}
            </div>

            {showAddForm && (
                <div className="bg-slate-50 p-6 rounded-[32px] border border-blue-100 shadow-sm space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex justify-between items-center">
                        <span className="text-sm font-black text-blue-600 uppercase tracking-widest">新增班表與薪資規則</span>
                        <button onClick={() => setShowAddForm(false)} className="text-slate-400 hover:text-slate-600">
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <form onSubmit={handleAddSubmit} className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">生效日期</label>
                                <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} required max="9999-12-31" className="w-full text-sm p-3 rounded-xl border-slate-200 focus:ring-blue-500 focus:border-blue-500 bg-white" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">薪資類型</label>
                                <select value={formSalary} onChange={e => setFormSalary(e.target.value as any)} className="w-full text-sm p-3 rounded-xl border-slate-200 focus:ring-blue-500 focus:border-blue-500 bg-white">
                                    <option value="MONTHLY">月薪</option>
                                    <option value="HOURLY">時薪</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-5">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">上班時間</label>
                                <input type="time" value={formIn} onChange={e => setFormIn(e.target.value)} required className="w-full text-sm p-3 rounded-xl border-slate-200 focus:ring-blue-500 focus:border-blue-500 bg-white" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">下班時間</label>
                                <input type="time" value={formOut} onChange={e => setFormOut(e.target.value)} required className="w-full text-sm p-3 rounded-xl border-slate-200 focus:ring-blue-500 focus:border-blue-500 bg-white" />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-1">
                                <Check className="h-3 w-3 text-blue-500" />
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">主要休息時段</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-300 uppercase mb-1">開始</label>
                                    <input type="time" value={formBreakIn} onChange={e => setFormBreakIn(e.target.value)} required className="w-full text-sm p-3 rounded-xl border-slate-200 focus:ring-blue-500 focus:border-blue-500 bg-white" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-300 uppercase mb-1">結束</label>
                                    <input type="time" value={formBreakOut} onChange={e => setFormBreakOut(e.target.value)} required className="w-full text-sm p-3 rounded-xl border-slate-200 focus:ring-blue-500 focus:border-blue-500 bg-white" />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 opacity-70 hover:opacity-100 transition-opacity">
                            <div className="flex items-center gap-2 mb-1">
                                <Plus className="h-3 w-3 text-slate-400" />
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">第二組休息 (選填)</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <input type="time" value={formBreak2In} onChange={e => setFormBreak2In(e.target.value)} className="w-full text-sm p-3 rounded-xl border-slate-200 focus:ring-blue-500 focus:border-blue-500 bg-white" />
                                <input type="time" value={formBreak2Out} onChange={e => setFormBreak2Out(e.target.value)} className="w-full text-sm p-3 rounded-xl border-slate-200 focus:ring-blue-500 focus:border-blue-500 bg-white" />
                            </div>
                        </div>

                        <div className="space-y-4 opacity-70 hover:opacity-100 transition-opacity">
                            <div className="flex items-center gap-2 mb-1">
                                <Plus className="h-3 w-3 text-slate-400" />
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">第三組休息 (選填)</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <input type="time" value={formBreak3In} onChange={e => setFormBreak3In(e.target.value)} className="w-full text-sm p-3 rounded-xl border-slate-200 focus:ring-blue-500 focus:border-blue-500 bg-white" />
                                <input type="time" value={formBreak3Out} onChange={e => setFormBreak3Out(e.target.value)} className="w-full text-sm p-3 rounded-xl border-slate-200 focus:ring-blue-500 focus:border-blue-500 bg-white" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-5">
                            <div>
                                <div className="flex justify-between items-center mb-1.5">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">標準每日工時</label>
                                    <button
                                        type="button"
                                        onClick={handleSyncHours}
                                        className="flex items-center gap-1 text-[9px] font-black text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-1 rounded-lg transition-all"
                                    >
                                        <RotateCw className="h-2.5 w-2.5" />
                                        同步班表時數
                                    </button>
                                </div>
                                <input
                                    type="number"
                                    step="0.1"
                                    min="1"
                                    max="24"
                                    value={formStandardHours}
                                    onChange={(e) => setFormStandardHours(parseFloat(e.target.value))}
                                    className="w-full text-sm p-3 rounded-xl border-slate-200 focus:ring-blue-500 focus:border-blue-500 bg-blue-50/30 font-bold text-blue-700"
                                />
                                <p className="text-[9px] text-slate-400 mt-1 italic">此項設定將決定該週期內的特休「天數」如何轉換為「時數」。</p>
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">每週固定休息日</label>
                            <div className="flex flex-wrap gap-2">
                                {['日', '一', '二', '三', '四', '五', '六'].map((label, index) => (
                                    <button
                                        key={index}
                                        type="button"
                                        onClick={() => toggleRestDay(index)}
                                        className={`w-10 h-10 rounded-xl text-xs font-black transition-all border ${formRestDays.includes(index)
                                            ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100'
                                            : 'bg-white text-slate-400 border-slate-200 hover:border-blue-300'
                                            }`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="w-full bg-blue-600 text-white py-4 rounded-[20px] text-sm font-black shadow-xl shadow-blue-100 hover:bg-blue-700 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2"
                        >
                            <Check className="h-5 w-5" />
                            確認並儲存此異動紀錄
                        </button>
                    </form>
                </div>
            )}

            <div className="flex items-center justify-between px-1">
                <div className="text-[10px] text-slate-400 italic font-medium flex items-center gap-1.5">
                    <History className="h-3 w-3" />
                    系統會依生效日期自動套用對應的班表與薪資設定
                </div>
            </div>

            {schedules.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-[32px] border border-dashed border-slate-200">
                    <p className="text-sm text-slate-400 font-bold">尚無歷史紀錄，目前使用預設設定</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {schedules.map((s) => (
                        <div key={s.id} className="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />

                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg tracking-wider">生效日期</span>
                                        <span className="text-sm font-black text-slate-900">{s.effective_date}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                                        <span className="text-xs font-bold text-slate-500 uppercase">{s.salary_type === 'MONTHLY' ? '月薪制度' : '時薪制度'}</span>
                                    </div>
                                </div>
                                {isAdmin && (
                                    <button
                                        onClick={() => handleDelete(s.id)}
                                        className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                                        title="刪除紀錄"
                                    >
                                        <Trash2 className="h-5 w-5" />
                                    </button>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                                <div className="space-y-1">
                                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest block">上班時間</span>
                                    <span className="text-sm font-bold text-slate-700">{s.work_start_time} - {s.work_end_time}</span>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest block">標準每日工時</span>
                                    <span className="text-sm font-bold text-blue-600">{s.standard_daily_hours || 8.0}h</span>
                                </div>

                                <div className="col-span-2 space-y-2 pt-2 border-t border-slate-50">
                                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest block">休息時段</span>
                                    <div className="flex flex-wrap gap-2">
                                        <span className="text-[11px] font-bold text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                                            {s.break_start_time} - {s.break_end_time}
                                        </span>
                                        {s.break2_start_time && (
                                            <span className="text-[11px] font-bold text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                                                {s.break2_start_time} - {s.break2_end_time}
                                            </span>
                                        )}
                                        {s.break3_start_time && (
                                            <span className="text-[11px] font-bold text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                                                {s.break3_start_time} - {s.break3_end_time}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="col-span-2 space-y-2 pt-2 border-t border-slate-50">
                                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest block">每週休息日</span>
                                    <div className="flex gap-1.5">
                                        {['日', '一', '二', '三', '四', '五', '六'].map((label, idx) => (
                                            <span
                                                key={idx}
                                                className={`text-[11px] font-black w-7 h-7 flex items-center justify-center rounded-lg ${(s.rest_days || []).includes(idx)
                                                    ? 'bg-blue-600 text-white'
                                                    : 'bg-slate-50 text-slate-300'
                                                    }`}
                                            >
                                                {label}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="bg-amber-50 p-4 rounded-[24px] border border-amber-100 flex gap-3">
                <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-700 leading-relaxed font-bold">
                    提示：若要修正過去的時數（例如某員工在 8/1 前應為 17:00 下班），請點擊「新增異動紀錄」，設定正確的生效日期並輸入當時的班表規則。系統將自動重新計算受影響期間的時數。
                </p>
            </div>
        </div>
    );
};

export default ScheduleHistory;

import React, { useEffect, useState } from 'react';
import { getEmployeeSchedules, addEmployeeSchedule, deleteEmployeeSchedule } from '../../services/admin';
import { EmployeeSchedule } from '../../types';
import { Trash2, History, Plus, AlertCircle, X, Check, RotateCw, Edit2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import TimeInput24h from '../ui/TimeInput24h';

interface ScheduleHistoryProps {
    employeeId: string;
    isAdmin?: boolean;
}

const ScheduleHistory: React.FC<ScheduleHistoryProps> = ({ employeeId, isAdmin = true }) => {
    const [schedules, setSchedules] = useState<EmployeeSchedule[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);

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

    // Salary Form states
    const [formBaseSalary, setFormBaseSalary] = useState<number>(0);
    const [formHourlyRate, setFormHourlyRate] = useState<number>(0);
    const [formAllowanceManager, setFormAllowanceManager] = useState<number>(0);
    const [formAllowanceLicense, setFormAllowanceLicense] = useState<number>(0);
    const [formOtherAllowance, setFormOtherAllowance] = useState<number>(0);

    useEffect(() => {
        fetchSchedules();
    }, [employeeId]);

    const fetchSchedules = async () => {
        setLoading(true);
        const data = await getEmployeeSchedules(employeeId);
        setSchedules(data);
        setLoading(false);
    };

    const handleOpenAddForm = () => {
        const latest = schedules[0];
        setEditingScheduleId(null);
        setFormDate(new Date().toISOString().split('T')[0]);
        if (latest) {
            setFormSalary(latest.salary_type || 'MONTHLY');
            setFormIn(latest.work_start_time || '08:00');
            setFormOut(latest.work_end_time || '17:00');
            setFormBreakIn(latest.break_start_time || '12:00');
            setFormBreakOut(latest.break_end_time || '13:00');
            setFormBreak2In(latest.break2_start_time || '');
            setFormBreak2Out(latest.break2_end_time || '');
            setFormBreak3In(latest.break3_start_time || '');
            setFormBreak3Out(latest.break3_end_time || '');
            setFormStandardHours(latest.standard_daily_hours || 8.0);
            setFormRestDays(latest.rest_days || [0, 6]);
            setFormBaseSalary(latest.base_salary || 0);
            setFormHourlyRate(latest.hourly_rate || 0);
            setFormAllowanceManager(latest.allowance_manager || 0);
            setFormAllowanceLicense(latest.allowance_license || 0);
            setFormOtherAllowance(latest.other_allowance || 0);
        } else {
            setFormSalary('MONTHLY');
            setFormIn('08:00');
            setFormOut('17:00');
            setFormBreakIn('12:00');
            setFormBreakOut('13:00');
            setFormBreak2In('');
            setFormBreak2Out('');
            setFormBreak3In('');
            setFormBreak3Out('');
            setFormStandardHours(8.0);
            setFormRestDays([0, 6]);
            setFormBaseSalary(0);
            setFormHourlyRate(0);
            setFormAllowanceManager(0);
            setFormAllowanceLicense(0);
            setFormOtherAllowance(0);
        }
        setShowAddForm(true);
    };

    const handleEditClick = (sched: EmployeeSchedule) => {
        setEditingScheduleId(sched.id);
        setFormDate(sched.effective_date);
        setFormSalary(sched.salary_type || 'MONTHLY');
        setFormIn(sched.work_start_time || '08:00');
        setFormOut(sched.work_end_time || '17:00');
        setFormBreakIn(sched.break_start_time || '12:00');
        setFormBreakOut(sched.break_end_time || '13:00');
        setFormBreak2In(sched.break2_start_time || '');
        setFormBreak2Out(sched.break2_end_time || '');
        setFormBreak3In(sched.break3_start_time || '');
        setFormBreak3Out(sched.break3_end_time || '');
        setFormStandardHours(sched.standard_daily_hours || 8.0);
        setFormRestDays(sched.rest_days || [0, 6]);
        setFormBaseSalary(sched.base_salary || 0);
        setFormHourlyRate(sched.hourly_rate || 0);
        setFormAllowanceManager(sched.allowance_manager || 0);
        setFormAllowanceLicense(sched.allowance_license || 0);
        setFormOtherAllowance(sched.other_allowance || 0);
        setShowAddForm(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('確定要刪除此班表紀錄嗎？這可能會影響過去或未來的時數計算。')) return;

        try {
            const res = await deleteEmployeeSchedule(id, employeeId);

            if (!res.success) throw new Error(res.error);
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
            const payload: any = {
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
                standard_daily_hours: formStandardHours,
                base_salary: formBaseSalary,
                hourly_rate: formHourlyRate,
                allowance_manager: formAllowanceManager,
                allowance_license: formAllowanceLicense,
                other_allowance: formOtherAllowance
            };

            if (editingScheduleId) {
                payload.id = editingScheduleId;
            }

            const res = await addEmployeeSchedule(payload);

            if (res.success) {
                setShowAddForm(false);
                setEditingScheduleId(null);
                fetchSchedules();
            } else {
                alert(editingScheduleId ? '編輯失敗：' + res.error : '新增失敗：' + res.error);
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
                        onClick={handleOpenAddForm}
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
                        <span className="text-sm font-black text-blue-600 uppercase tracking-widest">
                            {editingScheduleId ? '編輯班表與薪資規則' : '新增班表與薪資規則'}
                        </span>
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
                                <TimeInput24h value={formIn} onChange={setFormIn} required />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">下班時間</label>
                                <TimeInput24h value={formOut} onChange={setFormOut} required />
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
                                    <TimeInput24h value={formBreakIn} onChange={setFormBreakIn} required />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-300 uppercase mb-1">結束</label>
                                    <TimeInput24h value={formBreakOut} onChange={setFormBreakOut} required />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 opacity-70 hover:opacity-100 transition-opacity">
                            <div className="flex items-center gap-2 mb-1">
                                <Plus className="h-3 w-3 text-slate-400" />
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">第二組休息 (選填)</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <TimeInput24h value={formBreak2In} onChange={setFormBreak2In} />
                                <TimeInput24h value={formBreak2Out} onChange={setFormBreak2Out} />
                            </div>
                        </div>

                        <div className="space-y-4 opacity-70 hover:opacity-100 transition-opacity">
                            <div className="flex items-center gap-2 mb-1">
                                <Plus className="h-3 w-3 text-slate-400" />
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">第三組休息 (選填)</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <TimeInput24h value={formBreak3In} onChange={setFormBreak3In} />
                                <TimeInput24h value={formBreak3Out} onChange={setFormBreak3Out} />
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

                        {/* Salary and Allowance fields */}
                        <div className="border-t border-slate-100 pt-5 space-y-4">
                            <span className="text-xs font-black text-blue-600 uppercase tracking-widest block">起薪與固定津貼設定</span>
                            
                            {formSalary === 'MONTHLY' ? (
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">月薪底薪</label>
                                    <input
                                        type="number"
                                        value={formBaseSalary}
                                        onChange={e => setFormBaseSalary(parseFloat(e.target.value) || 0)}
                                        className="w-full text-sm p-3 rounded-xl border-slate-200 focus:ring-blue-500 focus:border-blue-500 bg-white"
                                        placeholder="例如: 32000"
                                    />
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">基本時薪</label>
                                    <input
                                        type="number"
                                        value={formHourlyRate}
                                        onChange={e => setFormHourlyRate(parseFloat(e.target.value) || 0)}
                                        className="w-full text-sm p-3 rounded-xl border-slate-200 focus:ring-blue-500 focus:border-blue-500 bg-white"
                                        placeholder="例如: 190"
                                    />
                                </div>
                            )}

                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">主管加給</label>
                                    <input
                                        type="number"
                                        value={formAllowanceManager}
                                        onChange={e => setFormAllowanceManager(parseFloat(e.target.value) || 0)}
                                        className="w-full text-sm p-3 rounded-xl border-slate-200 focus:ring-blue-500 focus:border-blue-500 bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">證照加給</label>
                                    <input
                                        type="number"
                                        value={formAllowanceLicense}
                                        onChange={e => setFormAllowanceLicense(parseFloat(e.target.value) || 0)}
                                        className="w-full text-sm p-3 rounded-xl border-slate-200 focus:ring-blue-500 focus:border-blue-500 bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">其他津貼</label>
                                    <input
                                        type="number"
                                        value={formOtherAllowance}
                                        onChange={e => setFormOtherAllowance(parseFloat(e.target.value) || 0)}
                                        className="w-full text-sm p-3 rounded-xl border-slate-200 focus:ring-blue-500 focus:border-blue-500 bg-white"
                                    />
                                </div>
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
                            {editingScheduleId ? '確認並更新此紀錄' : '確認並儲存此異動紀錄'}
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
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="min-w-full divide-y divide-slate-100 text-left">
                            <thead className="bg-slate-50/50">
                                <tr>
                                    <th className="px-4 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">生效日期</th>
                                    <th className="px-4 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">制度</th>
                                    <th className="px-4 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">出勤時間</th>
                                    <th className="px-4 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">主要休息</th>
                                    <th className="px-4 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">每日工時</th>
                                    <th className="px-4 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">每週休息</th>
                                    <th className="px-4 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">薪資結構</th>
                                    <th className="px-4 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">固定津貼</th>
                                    <th className="px-4 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">備註</th>
                                    {isAdmin && <th className="px-4 py-4 text-right text-xs font-black text-slate-400 uppercase tracking-widest">操作</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {schedules.map((s) => {
                                    const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
                                    const restDaysStr = (s.rest_days || []).map(d => dayNames[d]).join(', ') || '無';
                                    return (
                                        <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-4 py-4 whitespace-nowrap text-sm font-bold text-slate-900">
                                                {s.effective_date}
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap text-xs">
                                                <span className={`inline-flex px-2 py-0.5 rounded-lg font-bold border ${s.salary_type === 'MONTHLY'
                                                    ? 'bg-blue-50 text-blue-600 border-blue-100'
                                                    : 'bg-amber-50 text-amber-600 border-amber-100'
                                                    }`}>
                                                    {s.salary_type === 'MONTHLY' ? '月薪' : '時薪'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-slate-600">
                                                {s.work_start_time} - {s.work_end_time}
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">
                                                <div>{s.break_start_time} - {s.break_end_time}</div>
                                                {(s.break2_start_time || s.break3_start_time) && (
                                                    <div className="text-[10px] text-slate-400 mt-0.5">
                                                        {s.break2_start_time && `② ${s.break2_start_time}-${s.break2_end_time}`}
                                                        {s.break3_start_time && ` ③ ${s.break3_start_time}-${s.break3_end_time}`}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap text-sm font-bold text-blue-600">
                                                {s.standard_daily_hours || 8.0}h
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap text-xs font-bold text-slate-500">
                                                {restDaysStr}
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-700">
                                                {s.salary_type === 'MONTHLY' ? (
                                                    <div>底薪: <span className="font-bold">{s.base_salary || 0}</span></div>
                                                ) : (
                                                    <div>時薪: <span className="font-bold">{s.hourly_rate || 0}</span></div>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap text-xs text-slate-500">
                                                <div className="space-y-0.5">
                                                    <div>主管: {s.allowance_manager || 0}</div>
                                                    <div>證照: {s.allowance_license || 0}</div>
                                                    <div>其他: {s.other_allowance || 0}</div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-xs text-slate-500 max-w-[150px] truncate" title={s.note || ''}>
                                                {s.note || '-'}
                                            </td>
                                            {isAdmin && (
                                                <td className="px-4 py-4 whitespace-nowrap text-right text-sm">
                                                    <div className="flex justify-end gap-1">
                                                        <button
                                                            onClick={() => handleEditClick(s)}
                                                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                            title="編輯紀錄"
                                                        >
                                                            <Edit2 className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(s.id)}
                                                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                                            title="刪除紀錄"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
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

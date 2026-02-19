import React, { useEffect, useState } from 'react';
import { getSenioritySuspensions, addSenioritySuspension, deleteSenioritySuspension } from '../../services/employee';
import { SenioritySuspension } from '../../types';
import { Trash2, History, Plus, AlertCircle, X, Check } from 'lucide-react';

interface SenioritySuspensionListProps {
    employeeId: string;
    isAdmin?: boolean;
}

const SenioritySuspensionList: React.FC<SenioritySuspensionListProps> = ({ employeeId, isAdmin = true }) => {
    const [suspensions, setSuspensions] = useState<SenioritySuspension[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);

    // Form state for new record
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reason, setReason] = useState('');

    useEffect(() => {
        fetchSuspensions();
    }, [employeeId]);

    const fetchSuspensions = async () => {
        setLoading(true);
        const data = await getSenioritySuspensions(employeeId);
        setSuspensions(data);
        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('確定要刪除此年資中斷紀錄嗎？這將會重新計算員工年資與特休額度。')) return;

        try {
            const res = await deleteSenioritySuspension(id);
            if (res.success) {
                fetchSuspensions();
            } else {
                alert('刪除失敗：' + res.error);
            }
        } catch (error: any) {
            alert('發生錯誤：' + error.message);
        }
    };

    const handleAddSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!startDate || !endDate) return;

        // Frontend validation: Check that start_date is not after end_date
        if (new Date(startDate) > new Date(endDate)) {
            alert('新增失敗：開始日期不能晚於結束日期。');
            return;
        }

        try {
            const res = await addSenioritySuspension({
                employee_id: employeeId,
                start_date: startDate,
                end_date: endDate,
                reason
            });

            if (res.success) {
                setShowAddForm(false);
                setStartDate('');
                setEndDate('');
                setReason('');
                fetchSuspensions();
            } else {
                alert('新增失敗：' + res.error);
            }
        } catch (error: any) {
            alert('發生錯誤：' + error.message);
        }
    };

    if (loading) return <div className="text-center py-4 text-slate-400 text-xs font-bold">載入紀錄中...</div>;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-indigo-600" />
                    <h4 className="text-sm font-bold text-slate-900">年資中斷 / 留職停薪歷史</h4>
                </div>
                {isAdmin && !showAddForm && (
                    <button
                        onClick={() => setShowAddForm(true)}
                        className="flex items-center gap-1 text-[11px] font-black bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-all shadow-sm"
                    >
                        <Plus className="h-3 w-3" />
                        新增中斷
                    </button>
                )}
            </div>

            {showAddForm && (
                <div className="bg-slate-50 p-5 rounded-3xl border border-indigo-100 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex justify-between items-center">
                        <span className="text-xs font-black text-indigo-600 uppercase tracking-widest">新增年資中斷紀錄</span>
                        <button onClick={() => setShowAddForm(false)} className="text-slate-400 hover:text-slate-600">
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    <form onSubmit={handleAddSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">開始日期</label>
                                <input type="date" value={startDate} onChange={e => {
                                    const newDate = e.target.value;
                                    setStartDate(newDate);
                                    setEndDate(newDate);
                                }} required max="9999-12-31" className="w-full text-xs p-2.5 rounded-xl border-slate-200 focus:ring-indigo-500 focus:border-indigo-500" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">結束日期</label>
                                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required max="9999-12-31" className="w-full text-xs p-2.5 rounded-xl border-slate-200 focus:ring-indigo-500 focus:border-indigo-500" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">中斷原因 (如：育嬰留停)</label>
                            <input type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="例：育嬰留職停薪" className="w-full text-xs p-2.5 rounded-xl border-slate-200 focus:ring-indigo-500 focus:border-indigo-500" />
                        </div>

                        <button
                            type="submit"
                            className="w-full bg-indigo-600 text-white py-3 rounded-2xl text-xs font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                        >
                            <Check className="h-4 w-4" />
                            確認新增紀錄
                        </button>
                    </form>
                </div>
            )}

            {suspensions.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <p className="text-xs text-slate-400 font-bold">尚無中斷紀錄</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {suspensions.map((s) => (
                        <div key={s.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded tracking-wider uppercase">中斷期間</span>
                                    <span className="text-xs font-black text-slate-900">{s.start_date} ~ {s.end_date}</span>
                                </div>
                                {isAdmin && (
                                    <button
                                        onClick={() => handleDelete(s.id)}
                                        className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                        title="刪除紀錄"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                            <div className="text-[11px] font-bold text-slate-500 italic">
                                原因：{s.reason || '未提供'}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="bg-amber-50 p-3 rounded-xl border border-amber-100 flex gap-2">
                <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-700 leading-relaxed font-medium">
                    提示：中斷期間的天數會從總年資中扣除，進而延後特休里程碑（如滿半年、滿一年）的達成時間。
                </p>
            </div>
        </div>
    );
};

export default SenioritySuspensionList;

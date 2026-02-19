import React, { useState, useEffect } from 'react';
import { requestService } from '../../services/requestService';

interface BalanceAdjustmentToolProps {
    employeeId: string;
    employeeName: string;
    currentDailyHours: number;
    remainingHours: number;
    onSuccess: () => void;
}

const BalanceAdjustmentTool: React.FC<BalanceAdjustmentToolProps> = ({
    employeeId,
    employeeName,
    currentDailyHours,
    remainingHours,
    onSuccess
}) => {
    const [oldHours, setOldHours] = useState(currentDailyHours);
    const [newHours, setNewHours] = useState(currentDailyHours);
    const [remainingDays, setRemainingDays] = useState(remainingHours / currentDailyHours);
    const [diffHours, setDiffHours] = useState(0);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // 當輸入變動時重新計算差額
    useEffect(() => {
        // 公式：剩餘天數 * (新工時 - 舊工時)
        const diff = remainingDays * (newHours - oldHours);
        setDiffHours(Number(diff.toFixed(2)));
    }, [oldHours, newHours, remainingDays]);

    const handleApply = async () => {
        if (diffHours === 0) return;

        if (!confirm(`確定要為 ${employeeName} 調整 ${diffHours} 小時的特休額度嗎？\n(原因：工時由 ${oldHours} 小時變更為 ${newHours} 小時)`)) {
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            const result = await requestService.addLeaveAdjustment({
                employee_id: employeeId,
                leave_type_code: 'ANNUAL',
                adjustment_type: 'CORRECTION',
                amount_hours: diffHours,
                reason: `工時變更補償 (${oldHours} -> ${newHours}), 剩餘 ${remainingDays} 天`
            });

            if (result.success) {
                setMessage({ type: 'success', text: `成功調整 ${diffHours} 小時！` });
                onSuccess();
            } else {
                setMessage({ type: 'error', text: result.error || '調整失敗' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: '系統錯誤' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-blue-50/50 rounded-3xl p-6 border border-blue-100 shadow-sm mt-8">
            <h4 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600">calculate</span>
                特休工時差額調整工具
            </h4>

            <p className="text-sm text-slate-500 font-bold mb-6">
                當員工的「標準每日工時」發生變動時，可用此工具計算特休小時差額，以維持原本的「剩餘天數」。
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
                <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">舊每日工時</label>
                    <input
                        type="number"
                        step="0.5"
                        value={oldHours}
                        onChange={(e) => setOldHours(Number(e.target.value))}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                    />
                </div>
                <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">新每日工時</label>
                    <input
                        type="number"
                        step="0.5"
                        value={newHours}
                        onChange={(e) => setNewHours(Number(e.target.value))}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-blue-600"
                    />
                </div>
                <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">剩餘天數 (參考)</label>
                    <input
                        type="number"
                        step="0.01"
                        value={remainingDays}
                        onChange={(e) => setRemainingDays(Number(e.target.value))}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">目前剩餘 {remainingHours} 小時</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-blue-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${diffHours >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                        <span className="material-symbols-outlined font-black">
                            {diffHours >= 0 ? 'add_circle' : 'remove_circle'}
                        </span>
                    </div>
                    <div>
                        <div className="text-xs text-slate-400 font-black uppercase tracking-widest">應調整時數</div>
                        <div className={`text-xl font-black ${diffHours >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {diffHours > 0 ? '+' : ''}{diffHours} 小時
                        </div>
                    </div>
                </div>

                <button
                    onClick={handleApply}
                    disabled={loading || diffHours === 0}
                    className="w-full sm:w-auto px-8 py-3 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
                >
                    {loading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                        <span className="material-symbols-outlined">sync_alt</span>
                    )}
                    套用時數修正
                </button>
            </div>

            {message && (
                <div className={`mt-4 p-4 rounded-2xl text-sm font-bold flex items-center gap-2 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                    <span className="material-symbols-outlined">{message.type === 'success' ? 'check_circle' : 'error'}</span>
                    {message.text}
                </div>
            )}
        </div>
    );
};

export default BalanceAdjustmentTool;

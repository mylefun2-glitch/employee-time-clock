import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { FourDayWorkweekPeriod } from '../../types';

interface FourDayWorkweekListProps {
    employeeId: string;
}

const FourDayWorkweekList: React.FC<FourDayWorkweekListProps> = ({ employeeId }) => {
    const [periods, setPeriods] = useState<FourDayWorkweekPeriod[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    
    // Form state
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    
    // Notification state
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        if (employeeId) {
            fetchData();
        }
    }, [employeeId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch periods for specific employee
            const { data: periodData, error: periodError } = await supabase
                .from('four_day_workweek_periods')
                .select('*')
                .eq('employee_id', employeeId)
                .order('start_date', { ascending: false });

            if (periodError) throw periodError;
            setPeriods(periodData || []);
            
        } catch (err: any) {
            console.error('Error fetching data:', err);
            showMessage('載入資料失敗: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const showMessage = (text: string, type: 'success' | 'error') => {
        setMessage({ text, type });
        setTimeout(() => setMessage(null), 3000);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!startDate || !endDate) {
            showMessage('請填寫所有必填欄位', 'error');
            return;
        }

        if (new Date(startDate) > new Date(endDate)) {
            showMessage('結束日期不能早於起始日期', 'error');
            return;
        }

        setSubmitting(true);
        try {
            const { error } = await supabase
                .from('four_day_workweek_periods')
                .insert({
                    employee_id: employeeId,
                    start_date: startDate,
                    end_date: endDate
                });

            if (error) throw error;
            
            showMessage('新增成功！請記得重新整理差勤額度才能生效', 'success');
            
            // Reset form
            setStartDate('');
            setEndDate('');
            
            // Refresh data
            fetchData();
        } catch (err: any) {
            console.error('Error adding period:', err);
            showMessage('新增失敗: ' + err.message, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!confirm('確定要刪除這筆紀錄嗎？')) return;

        try {
            const { error } = await supabase
                .from('four_day_workweek_periods')
                .delete()
                .eq('id', id);

            if (error) throw error;
            
            showMessage('刪除成功', 'success');
            fetchData();
        } catch (err: any) {
            console.error('Error deleting period:', err);
            showMessage('刪除失敗: ' + err.message, 'error');
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center px-6">
                <div>
                    <h2 className="text-lg font-black text-slate-800">週休三日期間管理</h2>
                    <p className="text-sm font-bold text-slate-500 mt-1">設定的「週休三日」期間將於計算特休餘額時生效。該期間內依據比例：0.8 折算員工能獲得的年資天數。</p>
                </div>
            </div>

            <div className="px-6">
                {message && (
                    <div className={`p-4 rounded-xl mb-6 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                        {message.text}
                    </div>
                )}

                <div className="space-y-6">
                    {/* Form block */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                        <h3 className="text-base font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100">新增期間</h3>
                        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4 items-end">
                            <div className="flex-1 w-full">
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">起始日期</label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-3 bg-slate-50/50 h-[46px]"
                                    max="9999-12-31"
                                    required
                                />
                            </div>
                            
                            <div className="flex-1 w-full">
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">結束日期</label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-3 bg-slate-50/50 h-[46px]"
                                    max="9999-12-31"
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full sm:w-auto h-[46px] px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50 flex justify-center items-center gap-2 shrink-0"
                            >
                                {submitting ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                        <span>處理中...</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined text-sm">add</span>
                                        <span>新增</span>
                                    </>
                                )}
                            </button>
                        </form>
                    </div>

                    {/* Table block */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                            <h3 className="font-bold text-slate-800">已建立期間列表</h3>
                            <span className="text-sm font-semibold px-2.5 py-1 bg-slate-200 text-slate-700 rounded-full">{periods.length} 筆</span>
                        </div>
                        
                        <div className="overflow-x-auto">
                            {periods.length === 0 ? (
                                <div className="p-8 text-center text-slate-500">
                                    <span className="material-symbols-outlined text-4xl mb-2 text-slate-300">calendar_add_on</span>
                                    <p>目前沒有任何週休三日期間設定</p>
                                </div>
                            ) : (
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                                            <th className="px-6 py-3 font-semibold w-1/3">起始日期</th>
                                            <th className="px-6 py-3 font-semibold w-1/3">結束日期</th>
                                            <th className="px-6 py-3 font-semibold text-right">操作</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {periods.map((period) => (
                                            <tr key={period.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4 font-mono text-slate-600">
                                                    {period.start_date}
                                                </td>
                                                <td className="px-6 py-4 font-mono text-slate-600">
                                                    {period.end_date}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => handleDelete(period.id, e)}
                                                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="刪除"
                                                    >
                                                        <span className="material-symbols-outlined text-lg">delete</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FourDayWorkweekList;

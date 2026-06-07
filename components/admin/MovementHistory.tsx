import React, { useEffect, useState } from 'react';
import { getEmployeeMovements, createEmployeeMovement } from '../../services/employeeMovementService';
import { EmployeeMovement } from '../../types';

interface MovementHistoryProps {
    employeeId: string;
    isAdmin?: boolean;
}

const MovementHistory: React.FC<MovementHistoryProps> = ({ employeeId, isAdmin = false }) => {
    const [movements, setMovements] = useState<EmployeeMovement[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);

    // Form state
    const [selectedTypes, setSelectedTypes] = useState<string[]>(['職務調整']);
    const [customType, setCustomType] = useState('');
    const [oldValue, setOldValue] = useState('');
    const [newValue, setNewValue] = useState('');
    const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
    const [reason, setReason] = useState('');

    const handleAddCustomType = () => {
        const trimmed = customType.trim();
        if (trimmed && !selectedTypes.includes(trimmed)) {
            setSelectedTypes([...selectedTypes, trimmed]);
            setCustomType('');
        }
    };

    useEffect(() => {
        fetchMovements();
    }, [employeeId]);

    const fetchMovements = async () => {
        setLoading(true);
        const data = await getEmployeeMovements(employeeId);
        setMovements(data);
        setLoading(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const finalType = selectedTypes.join(', ') || '其他';
        const res = await createEmployeeMovement({
            employee_id: employeeId,
            movement_type: finalType,
            old_value: oldValue,
            new_value: newValue,
            effective_date: effectiveDate,
            reason: reason,
        });

        if (res.success) {
            setShowForm(false);
            fetchMovements();
            // Reset form
            setSelectedTypes(['職務調整']);
            setCustomType('');
            setOldValue('');
            setNewValue('');
            setReason('');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest border-l-4 border-blue-600 pl-3">異動紀錄歷程</h3>
                {isAdmin && (
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="text-[10px] font-black uppercase tracking-wider px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-all border border-blue-100"
                    >
                        {showForm ? '取消' : '登記新異動'}
                    </button>
                )}
            </div>

            {showForm && isAdmin && (
                <form onSubmit={handleSubmit} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2 space-y-2">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">異動類型 (可複選)</label>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {['職務調整', '部門異動', '薪資調整', '晉升', '轉正'].map(type => {
                                    const isSelected = selectedTypes.includes(type);
                                    return (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => {
                                                if (isSelected) {
                                                    setSelectedTypes(selectedTypes.filter(t => t !== type));
                                                } else {
                                                    setSelectedTypes([...selectedTypes, type]);
                                                }
                                            }}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                                isSelected
                                                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                                                    : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'
                                            }`}
                                        >
                                            {type}
                                        </button>
                                    );
                                })}
                            </div>
                            
                            <div className="flex gap-2 items-center">
                                <input
                                    type="text"
                                    value={customType}
                                    onChange={(e) => setCustomType(e.target.value)}
                                    placeholder="輸入自訂異動類型..."
                                    className="flex-1 rounded-xl border-slate-200 text-xs p-2.5 focus:ring-blue-500 bg-white"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleAddCustomType();
                                        }
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={handleAddCustomType}
                                    className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 shrink-0 transition-all"
                                >
                                    新增自訂
                                </button>
                            </div>
                            
                            {selectedTypes.filter(t => !['職務調整', '部門異動', '薪資調整', '晉升', '轉正'].includes(t)).length > 0 && (
                                <div className="flex flex-wrap gap-1.5 pt-1 items-center">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">已選自訂:</span>
                                    {selectedTypes.filter(t => !['職務調整', '部門異動', '薪資調整', '晉升', '轉正'].includes(t)).map(type => (
                                        <span key={type} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-lg shadow-sm animate-in zoom-in-95">
                                            {type}
                                            <button
                                                type="button"
                                                onClick={() => setSelectedTypes(selectedTypes.filter(t => t !== type))}
                                                className="text-slate-400 hover:text-rose-500 font-bold"
                                            >
                                                ✕
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">生效日期</label>
                            <input
                                type="date"
                                value={effectiveDate}
                                onChange={(e) => setEffectiveDate(e.target.value)}
                                max="9999-12-31"
                                className="w-full rounded-xl border-slate-200 text-xs p-2.5 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">變更前值</label>
                            <input
                                type="text"
                                value={oldValue}
                                onChange={(e) => setOldValue(e.target.value)}
                                className="w-full rounded-xl border-slate-200 text-xs p-2.5 focus:ring-blue-500"
                                placeholder="如：專員"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">變更後值</label>
                            <input
                                type="text"
                                value={newValue}
                                onChange={(e) => setNewValue(e.target.value)}
                                className="w-full rounded-xl border-slate-200 text-xs p-2.5 focus:ring-blue-500"
                                placeholder="如：主任"
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">異動事由</label>
                            <textarea
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                className="w-full rounded-xl border-slate-200 text-xs p-2.5 focus:ring-blue-500"
                                rows={2}
                            />
                        </div>
                    </div>
                    <button type="submit" className="w-full py-2.5 bg-blue-600 text-xs font-bold text-white rounded-xl shadow-lg shadow-blue-100">
                        確認登記
                    </button>
                </form>
            )}

            <div className="relative">
                {movements.length === 0 ? (
                    <div className="text-center py-10 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                        <span className="material-symbols-outlined text-slate-200 text-4xl">history</span>
                        <p className="text-xs font-bold text-slate-400 mt-2">尚無異動紀錄</p>
                    </div>
                ) : (
                    <div className="space-y-4 before:content-[''] before:absolute before:left-4 before:top-4 before:bottom-4 before:w-0.5 before:bg-slate-100">
                        {movements.map((m) => (
                            <div key={m.id} className="relative pl-10">
                                <div className="absolute left-3 top-1.5 w-2 h-2 rounded-full bg-blue-500 ring-4 ring-white shadow-sm" />
                                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase tracking-wider mr-2">{m.movement_type}</span>
                                            <span className="text-xs font-black text-slate-900">{m.effective_date}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs font-bold text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-100">
                                        <div className="flex-1 text-center line-through opacity-50">{m.old_value || 'N/A'}</div>
                                        <span className="material-symbols-outlined text-slate-300">arrow_forward</span>
                                        <div className="flex-1 text-center text-blue-700">{m.new_value}</div>
                                    </div>
                                    {m.reason && (
                                        <p className="mt-2 text-[10px] font-medium text-slate-400 leading-relaxed italic border-t border-slate-50 pt-2">{m.reason}</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MovementHistory;

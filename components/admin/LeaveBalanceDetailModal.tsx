import React, { useState, useMemo } from 'react';
import { LeaveBalance, Employee } from '../../types';
import TableHeaderFilter from '../ui/TableHeaderFilter';

interface EmployeeLeaveStats extends Employee {
    leaveBalance: LeaveBalance | null;
}

interface Props {
    employee: EmployeeLeaveStats;
    onClose: () => void;
}

const LeaveBalanceDetailModal: React.FC<Props> = ({ employee, onClose }) => {
    const leaveBalance = employee.leaveBalance;

    // --- Anniversary Table Filtering & Sorting States ---
    const [columnFilters, setColumnFilters] = useState<{
        milestone: string[];
    }>({
        milestone: []
    });
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({
        key: 'start_date',
        direction: 'desc'
    });

    // --- Compensatory Table Filtering & Sorting States ---
    const [compColumnFilters, setCompColumnFilters] = useState<{
        milestone: string[];
    }>({
        milestone: []
    });
    const [compSortConfig, setCompSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({
        key: 'start_date',
        direction: 'desc'
    });

    const handleSort = (key: string) => {
        setSortConfig(prev => {
            if (prev?.key === key) {
                return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
            }
            return { key, direction: 'desc' };
        });
    };

    const handleCompSort = (key: string) => {
        setCompSortConfig(prev => {
            if (prev?.key === key) {
                return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
            }
            return { key, direction: 'desc' };
        });
    };

    const filteredAndSortedPeriods = useMemo(() => {
        if (!leaveBalance?.annual?.periods) return [];

        let result = [...leaveBalance.annual.periods];
        if (columnFilters.milestone.length > 0) {
            result = result.filter(p => columnFilters.milestone.map(v => v.trim()).includes(p.label.trim()));
        }
        if (sortConfig) {
            result.sort((a: any, b: any) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];
                if (typeof aValue === 'number' && typeof bValue === 'number') {
                    return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
                }
                const strA = String(aValue || '');
                const strB = String(bValue || '');
                return sortConfig.direction === 'asc' ? strA.localeCompare(strB, 'zh-TW') : strB.localeCompare(strA, 'zh-TW');
            });
        }
        return result;
    }, [leaveBalance, columnFilters, sortConfig]);

    const filteredAndSortedCompPeriods = useMemo(() => {
        if (!leaveBalance?.compensatory?.periods) return [];

        let result = [...leaveBalance.compensatory.periods];
        if (compColumnFilters.milestone.length > 0) {
            result = result.filter(p => compColumnFilters.milestone.map(v => v.trim()).includes(p.label.trim()));
        }
        if (compSortConfig) {
            result.sort((a: any, b: any) => {
                const aValue = a[compSortConfig.key];
                const bValue = b[compSortConfig.key];
                if (typeof aValue === 'number' && typeof bValue === 'number') {
                    return compSortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
                }
                const strA = String(aValue || '');
                const strB = String(bValue || '');
                return compSortConfig.direction === 'asc' ? strA.localeCompare(strB, 'zh-TW') : strB.localeCompare(strA, 'zh-TW');
            });
        }
        return result;
    }, [leaveBalance, compColumnFilters, compSortConfig]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
            <div className="relative bg-slate-50 w-full max-w-5xl max-h-[90vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 fade-in duration-300">
                {/* Header */}
                <div className="bg-white px-8 py-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                    <div>
                        <h3 className="text-xl font-black text-slate-900">
                            「{employee.name}」的差勤額度明細
                        </h3>
                        <p className="text-xs text-slate-500 font-bold mt-1">
                            檢視 {employee.department || '未分配'} 部門員工的特休與補休額度詳細歷史紀錄
                        </p>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-2xl hover:bg-slate-100 text-slate-400 transition-all">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Content */}
                <div className="p-8 overflow-y-auto custom-scrollbar flex-1 space-y-8">
                    {!leaveBalance ? (
                        <div className="text-center py-12 text-slate-400 font-bold">載入中或無資料...</div>
                    ) : (
                        <>
                            {/* Anniversary Breakdown List */}
                            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                                <div className="bg-slate-50/50 px-8 py-5 border-b border-slate-100 flex items-center gap-3">
                                    <span className="material-symbols-outlined text-blue-600 text-2xl">list_alt</span>
                                    <h4 className="font-black text-slate-900 text-lg">特休年資明細</h4>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-slate-100">
                                        <thead className="bg-slate-50/30">
                                            <tr>
                                                <TableHeaderFilter
                                                    columnKey="label"
                                                    label="里程碑"
                                                    values={leaveBalance.annual?.periods?.map(p => p.label) || []}
                                                    selectedValues={columnFilters.milestone}
                                                    onChange={(vals) => setColumnFilters({ ...columnFilters, milestone: vals })}
                                                    sortable
                                                    sortConfig={sortConfig}
                                                    onSort={() => handleSort('label')}
                                                    className="px-8 py-5"
                                                />
                                                <TableHeaderFilter
                                                    columnKey="start_date"
                                                    label="有效期間"
                                                    values={[]}
                                                    selectedValues={[]}
                                                    onChange={() => { }}
                                                    sortable
                                                    sortConfig={sortConfig}
                                                    onSort={() => handleSort('start_date')}
                                                    className="px-8 py-5"
                                                />
                                                <TableHeaderFilter
                                                    columnKey="entitlement"
                                                    label="應得時數"
                                                    values={[]}
                                                    selectedValues={[]}
                                                    onChange={() => { }}
                                                    sortable
                                                    sortConfig={sortConfig}
                                                    onSort={() => handleSort('entitlement')}
                                                    className="px-8 py-5"
                                                />
                                                <th className="px-8 py-5 text-[10px] font-black text-indigo-500 uppercase tracking-widest whitespace-nowrap">
                                                    遞延（前期）
                                                </th>
                                                <TableHeaderFilter
                                                    columnKey="used"
                                                    label="已用"
                                                    values={[]}
                                                    selectedValues={[]}
                                                    onChange={() => { }}
                                                    sortable
                                                    sortConfig={sortConfig}
                                                    onSort={() => handleSort('used')}
                                                    className="px-8 py-5"
                                                />
                                                <TableHeaderFilter
                                                    columnKey="cashout"
                                                    label="折現"
                                                    values={[]}
                                                    selectedValues={[]}
                                                    onChange={() => { }}
                                                    sortable
                                                    sortConfig={sortConfig}
                                                    onSort={() => handleSort('cashout')}
                                                    className="px-8 py-5"
                                                />
                                                <TableHeaderFilter
                                                    columnKey="remaining"
                                                    label="剩餘"
                                                    values={[]}
                                                    selectedValues={[]}
                                                    onChange={() => { }}
                                                    sortable
                                                    sortConfig={sortConfig}
                                                    onSort={() => handleSort('remaining')}
                                                    className="px-8 py-5 text-emerald-600"
                                                />
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {filteredAndSortedPeriods.length === 0 ? (
                                                <tr>
                                                    <td colSpan={7} className="px-8 py-12 text-center text-slate-400 font-bold italic">
                                                        {columnFilters.milestone.length > 0 ? '沒有符合篩選條件的資料' : '尚無年資里程碑資料'}
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredAndSortedPeriods.map((period, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                                                        <td className="px-8 py-5 whitespace-nowrap">
                                                            <span className="font-black text-slate-900">{period.label}</span>
                                                        </td>
                                                        <td className="px-8 py-5 whitespace-nowrap">
                                                            <div className="text-sm text-slate-500 font-bold bg-slate-100 px-3 py-1 rounded-lg inline-block">
                                                                {period.start_date} <span className="text-slate-300 mx-1">~</span> {period.end_date}
                                                            </div>
                                                        </td>
                                                        <td className="px-8 py-5 whitespace-nowrap text-center font-mono font-black text-slate-600">
                                                            <div className="font-mono font-black text-slate-600 leading-none">{period.entitlement}</div>
                                                        </td>
                                                        {/* 遞延（前期）欄 - 依第24-1條優先扣除 */}
                                                        <td className="px-8 py-5 whitespace-nowrap text-center">
                                                            {period.deferred_in > 0 ? (
                                                                <div className="inline-flex flex-col items-center gap-0.5">
                                                                    <span className="font-mono font-black text-indigo-600">+{period.deferred_in}</span>
                                                                    <span className="text-[9px] font-bold text-indigo-400 bg-indigo-50 px-1.5 py-0.5 rounded-full">優先扣除</span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-slate-300 font-mono">—</span>
                                                            )}
                                                        </td>
                                                        <td className="px-8 py-5 whitespace-nowrap text-center font-mono font-black text-orange-600">
                                                            <div>{period.used}</div>
                                                            {period.used_from_deferred > 0 && (
                                                                <div className="text-[9px] font-bold text-indigo-400 mt-0.5">含遞延 {period.used_from_deferred}</div>
                                                            )}
                                                        </td>
                                                        <td className="px-8 py-5 whitespace-nowrap text-center font-mono font-black text-rose-600">
                                                            {period.cashout}
                                                        </td>
                                                        <td className="px-8 py-5 whitespace-nowrap text-center font-mono font-black text-emerald-600">
                                                            <div>{period.remaining}</div>
                                                            {period.formula && (
                                                                <div className="text-[9px] text-slate-400 font-bold mt-0.5 opacity-70 max-w-[140px]">{period.formula}</div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Compensatory Breakdown List */}
                            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                                <div className="bg-slate-50/50 px-8 py-5 border-b border-slate-100 flex items-center gap-3">
                                    <span className="material-symbols-outlined text-orange-600 text-2xl">list_alt</span>
                                    <h4 className="font-black text-slate-900 text-lg">補休年度明細</h4>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-slate-100">
                                        <thead className="bg-slate-50/30">
                                            <tr>
                                                <TableHeaderFilter
                                                    columnKey="label"
                                                    label="年度"
                                                    values={leaveBalance.compensatory?.periods?.map(p => p.label) || []}
                                                    selectedValues={compColumnFilters.milestone}
                                                    onChange={(vals) => setCompColumnFilters({ ...compColumnFilters, milestone: vals })}
                                                    sortable
                                                    sortConfig={compSortConfig}
                                                    onSort={() => handleCompSort('label')}
                                                    className="px-8 py-5"
                                                />
                                                <TableHeaderFilter
                                                    columnKey="start_date"
                                                    label="有效期間"
                                                    values={[]}
                                                    selectedValues={[]}
                                                    onChange={() => { }}
                                                    sortable
                                                    sortConfig={compSortConfig}
                                                    onSort={() => handleCompSort('start_date')}
                                                    className="px-8 py-5"
                                                />
                                                <TableHeaderFilter
                                                    columnKey="entitlement"
                                                    label="合計生成"
                                                    values={[]}
                                                    selectedValues={[]}
                                                    onChange={() => { }}
                                                    sortable
                                                    sortConfig={compSortConfig}
                                                    onSort={() => handleCompSort('entitlement')}
                                                    className="px-8 py-5"
                                                />
                                                <th className="px-8 py-5 text-[10px] font-black text-indigo-500 uppercase tracking-widest whitespace-nowrap">
                                                    遞延（前期）
                                                </th>
                                                <TableHeaderFilter
                                                    columnKey="used"
                                                    label="合計已用"
                                                    values={[]}
                                                    selectedValues={[]}
                                                    onChange={() => { }}
                                                    sortable
                                                    sortConfig={compSortConfig}
                                                    onSort={() => handleCompSort('used')}
                                                    className="px-8 py-5"
                                                />
                                                <TableHeaderFilter
                                                    columnKey="cashout"
                                                    label="折算"
                                                    values={[]}
                                                    selectedValues={[]}
                                                    onChange={() => { }}
                                                    sortable
                                                    sortConfig={compSortConfig}
                                                    onSort={() => handleCompSort('cashout')}
                                                    className="px-8 py-5"
                                                />
                                                <TableHeaderFilter
                                                    columnKey="remaining"
                                                    label="剩餘"
                                                    values={[]}
                                                    selectedValues={[]}
                                                    onChange={() => { }}
                                                    sortable
                                                    sortConfig={compSortConfig}
                                                    onSort={() => handleCompSort('remaining')}
                                                    className="px-8 py-5 text-emerald-600"
                                                />
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {filteredAndSortedCompPeriods.length === 0 ? (
                                                <tr>
                                                    <td colSpan={7} className="px-8 py-12 text-center text-slate-400 font-bold italic">
                                                        {compColumnFilters.milestone.length > 0 ? '沒有符合篩選條件的資料' : '尚無補休年度資料'}
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredAndSortedCompPeriods.map((period, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                                                        <td className="px-8 py-5 whitespace-nowrap">
                                                            <span className="font-black text-slate-900">{period.label}</span>
                                                        </td>
                                                        <td className="px-8 py-5 whitespace-nowrap">
                                                            <div className="text-sm text-slate-500 font-bold bg-slate-100 px-3 py-1 rounded-lg inline-block">
                                                                {period.start_date} <span className="text-slate-300 mx-1">~</span> {period.end_date}
                                                            </div>
                                                        </td>
                                                        <td className="px-8 py-5 whitespace-nowrap text-center font-mono font-black text-slate-600">
                                                            <div className="font-mono font-black text-slate-600 leading-none">{period.entitlement}</div>
                                                        </td>
                                                        {/* 遞延（前期）欄 - 依第24-1條優先扣除 */}
                                                        <td className="px-8 py-5 whitespace-nowrap text-center">
                                                            {period.deferred_in > 0 ? (
                                                                <div className="inline-flex flex-col items-center gap-0.5">
                                                                    <span className="font-mono font-black text-indigo-600">+{period.deferred_in}</span>
                                                                    <span className="text-[9px] font-bold text-indigo-400 bg-indigo-50 px-1.5 py-0.5 rounded-full">優先扣除</span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-slate-300 font-mono">—</span>
                                                            )}
                                                        </td>
                                                        <td className="px-8 py-5 whitespace-nowrap text-center font-mono font-black text-orange-600">
                                                            <div>{period.used}</div>
                                                            {period.used_from_deferred > 0 && (
                                                                <div className="text-[9px] font-bold text-indigo-400 mt-0.5">含遞延 {period.used_from_deferred}</div>
                                                            )}
                                                        </td>
                                                        <td className="px-8 py-5 whitespace-nowrap text-center font-mono font-black text-rose-600">
                                                            {period.cashout}
                                                        </td>
                                                        <td className="px-8 py-5 whitespace-nowrap text-center font-mono font-black text-emerald-600">
                                                            <div>{period.remaining}</div>
                                                            {period.formula && (
                                                                <div className="text-[9px] text-slate-400 font-bold mt-0.5 opacity-70 max-w-[140px]">{period.formula}</div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LeaveBalanceDetailModal;

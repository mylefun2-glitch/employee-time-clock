import React, { useState, useRef, useEffect } from 'react';
import { Filter, X, Check, ArrowUpDown, ChevronUp, ChevronDown, Search } from 'lucide-react';

export interface TableHeaderFilterProps<T = string> {
    columnKey: string;
    label: string;
    values: T[];
    selectedValues: T[];
    onChange: (values: T[]) => void;
    sortable?: boolean;
    sortConfig?: { key: string; direction: 'asc' | 'desc' } | null;
    onSort?: () => void;
    valueFormatter?: (value: T) => string;
    className?: string;
}

export function TableHeaderFilter<T = string>({
    columnKey,
    label,
    values,
    selectedValues,
    onChange,
    sortable = false,
    sortConfig = null,
    onSort,
    valueFormatter = (v) => String(v),
    className = ''
}: TableHeaderFilterProps<T>) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    // 點擊外部關閉下拉選單
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node) &&
                buttonRef.current &&
                !buttonRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    // 關閉下拉選單時清除搜尋
    useEffect(() => {
        if (!isOpen) {
            setSearchTerm('');
        }
    }, [isOpen]);

    const uniqueValues = Array.from(new Set(values)).sort((a, b) => {
        const strA = valueFormatter(a);
        const strB = valueFormatter(b);
        return strA.localeCompare(strB);
    });

    const filteredValues = uniqueValues.filter(value =>
        valueFormatter(value).toLowerCase().includes(searchTerm.toLowerCase())
    );

    const isAllSelected = selectedValues.length === 0 || selectedValues.length === uniqueValues.length;
    const hasActiveFilter = selectedValues.length > 0 && selectedValues.length < uniqueValues.length;

    const handleToggleValue = (value: T) => {
        const isSelected = selectedValues.includes(value);
        if (isSelected) {
            const newValues = selectedValues.filter(v => v !== value);
            onChange(newValues.length === uniqueValues.length ? [] : newValues);
        } else {
            const newValues = [...selectedValues, value];
            onChange(newValues.length === uniqueValues.length ? [] : newValues);
        }
    };

    const handleSelectAll = () => {
        onChange([]);
    };

    const handleClearAll = () => {
        onChange([]);
    };

    const isSorted = sortConfig?.key === columnKey;

    return (
        <th className={`px-6 py-5 text-left text-xs font-black text-slate-400 uppercase tracking-widest ${className}`}>
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 flex-1">
                    {label}

                    {/* 排序圖示 */}
                    {sortable && onSort && (
                        <button
                            onClick={onSort}
                            className="p-0.5 hover:text-blue-600 transition-colors"
                            title="排序"
                        >
                            {isSorted ? (
                                sortConfig.direction === 'asc' ?
                                    <ChevronUp className="h-3 w-3" /> :
                                    <ChevronDown className="h-3 w-3" />
                            ) : (
                                <ArrowUpDown className="h-3 w-3 opacity-50" />
                            )}
                        </button>
                    )}
                </div>

                {/* 篩選按鈕 */}
                <div className="relative">
                    <button
                        ref={buttonRef}
                        onClick={() => setIsOpen(!isOpen)}
                        className={`p-1 rounded-lg transition-all ${hasActiveFilter
                                ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                                : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'
                            }`}
                        title="篩選"
                    >
                        <Filter className="h-3.5 w-3.5" />
                        {hasActiveFilter && (
                            <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-600 rounded-full"></span>
                        )}
                    </button>

                    {/* 下拉選單 */}
                    {isOpen && (
                        <div
                            ref={dropdownRef}
                            className="absolute top-full left-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
                        >
                            {/* 標題與操作 */}
                            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm font-black text-slate-700">篩選 {label}</span>
                                    <button
                                        onClick={() => setIsOpen(false)}
                                        className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-all"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>

                                {/* 搜尋框（當選項超過 10 個時顯示） */}
                                {uniqueValues.length > 10 && (
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        <input
                                            type="text"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            placeholder="搜尋..."
                                            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* 全選/清除 */}
                            <div className="p-2 border-b border-slate-100">
                                <button
                                    onClick={isAllSelected ? handleClearAll : handleSelectAll}
                                    className="w-full px-3 py-2 text-left text-sm font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition-all flex items-center gap-2"
                                >
                                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${isAllSelected
                                            ? 'bg-blue-600 border-blue-600'
                                            : 'border-slate-300'
                                        }`}>
                                        {isAllSelected && <Check className="h-3 w-3 text-white" />}
                                    </div>
                                    {isAllSelected ? '全部' : '全選'}
                                </button>
                            </div>

                            {/* 選項列表 */}
                            <div className="max-h-64 overflow-y-auto custom-scrollbar">
                                {filteredValues.length === 0 ? (
                                    <div className="p-4 text-center text-sm text-slate-400">
                                        沒有符合的選項
                                    </div>
                                ) : (
                                    <div className="p-2">
                                        {filteredValues.map((value, index) => {
                                            const isSelected = selectedValues.length === 0 || selectedValues.includes(value);
                                            const displayValue = valueFormatter(value);

                                            return (
                                                <button
                                                    key={index}
                                                    onClick={() => handleToggleValue(value)}
                                                    className="w-full px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg transition-all flex items-center gap-2"
                                                >
                                                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${isSelected
                                                            ? 'bg-blue-600 border-blue-600'
                                                            : 'border-slate-300'
                                                        }`}>
                                                        {isSelected && <Check className="h-3 w-3 text-white" />}
                                                    </div>
                                                    <span className="flex-1 truncate">{displayValue}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* 底部統計 */}
                            {hasActiveFilter && (
                                <div className="p-3 border-t border-slate-100 bg-slate-50/50">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-slate-500 font-medium">
                                            已選擇 {selectedValues.length} / {uniqueValues.length}
                                        </span>
                                        <button
                                            onClick={handleClearAll}
                                            className="text-blue-600 font-bold hover:text-blue-700 transition-colors"
                                        >
                                            清除篩選
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </th>
    );
}

export default TableHeaderFilter;

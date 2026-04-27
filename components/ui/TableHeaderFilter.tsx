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
    const [dropdownSide, setDropdownSide] = useState<'left' | 'right'>('left');
    const [dropdownVertical, setDropdownVertical] = useState<'top' | 'bottom'>('top');

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

            // 智慧定位邏輯
            if (buttonRef.current) {
                const rect = buttonRef.current.getBoundingClientRect();
                const vWidth = window.innerWidth;
                const vHeight = window.innerHeight;

                // 檢查右側空間 (w-64 = 256px)
                if (rect.left + 260 > vWidth) {
                    setDropdownSide('right');
                } else {
                    setDropdownSide('left');
                }

                // 檢查下方空間 (max-h-80 = 320px + header/footer ~ 400px)
                if (rect.bottom + 400 > vHeight && rect.top > 400) {
                    setDropdownVertical('bottom');
                } else {
                    setDropdownVertical('top');
                }
            }
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

    // 智慧去重與分組邏輯：將原始值按照格式化後的標籤進行分組
    const labelToValuesMap = values.reduce((acc, v) => {
        const label = String(valueFormatter(v)).trim();
        if (!acc.has(label)) {
            acc.set(label, []);
        }
        acc.get(label)!.push(v);
        return acc;
    }, new Map<string, T[]>());

    const uniqueLabels = Array.from(labelToValuesMap.keys()).sort((a, b) => a.localeCompare(b));

    const filteredLabels = uniqueLabels.filter(label =>
        label.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const isAllSelected = selectedValues.length === 0;
    const hasActiveFilter = selectedValues.length > 0;

    // 檢查某個顯示標籤是否已被選中（只要該組中任一原始值在 selectedValues 中即視為已選中）
    const isLabelSelected = (label: string) => {
        const groupValues = labelToValuesMap.get(label) || [];
        return groupValues.some(gv => 
            selectedValues.some(sv => String(sv).trim() === String(gv).trim())
        );
    };

    const handleToggleLabel = (label: string) => {
        const groupValues = labelToValuesMap.get(label) || [];
        const currentlySelected = isLabelSelected(label);

        if (currentlySelected) {
            // 從選中清單中移除該組的所有值
            const groupValueStrings = new Set(groupValues.map(gv => String(gv).trim()));
            const newValues = selectedValues.filter(sv => !groupValueStrings.has(String(sv).trim()));
            onChange(newValues);
        } else {
            // 將該組的所有原始值加入選中清單
            const newValues = [...selectedValues, ...groupValues];
            // 如果所有標籤代表的所有原始值都已選中，則視為「全部」，傳回空陣列
            const allPossibleOriginalValuesCount = values.length;
            // 這裡簡單判斷：如果要選取的數量等於總數，或者標籤全選了，就傳回 []
            // 但實務上使用者可能希望精確控制，所以我們先簡單合併
            onChange(newValues.length >= allPossibleOriginalValuesCount ? [] : newValues);
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
        <th className={`px-4 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-widest ${className}`}>
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
                        <Filter className="h-4 w-4" />
                        {hasActiveFilter && (
                            <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-600 rounded-full animate-pulse"></span>
                        )}
                    </button>

                    {/* 下拉選單 */}
                    {isOpen && (
                        <div
                            ref={dropdownRef}
                            className={`absolute z-[100] w-64 bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 ${dropdownVertical === 'top' ? 'top-full mt-2' : 'bottom-full mb-2'
                                } ${dropdownSide === 'left' ? 'left-0' : 'right-0'
                                }`}
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

                                {/* 搜尋框（當選項超過 8 個時顯示） */}
                                {uniqueLabels.length > 8 && (
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                        <input
                                            type="text"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            placeholder="搜尋..."
                                            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all placeholder:text-slate-300"
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
                                     <span className="font-black">{isAllSelected ? '全部' : '全選 / 清除'}</span>
                                 </button>
                             </div>

                             {/* 選項列表 */}
                             <div className="max-h-80 overflow-y-auto custom-scrollbar">
                                 {filteredLabels.length === 0 ? (
                                     <div className="p-8 text-center text-sm text-slate-400 font-bold italic">
                                         沒有符合的選項
                                     </div>
                                 ) : (
                                     <div className="p-2">
                                         {filteredLabels.map((label, index) => {
                                             const isSelected = isLabelSelected(label);

                                             return (
                                                 <button
                                                     key={index}
                                                     onClick={() => handleToggleLabel(label)}
                                                     className={`w-full px-3 py-2 text-left text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${isSelected ? 'text-blue-700 bg-blue-50/50' : 'text-slate-600 hover:bg-slate-50'
                                                         }`}
                                                 >
                                                     <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all shrink-0 ${isSelected
                                                         ? 'bg-blue-600 border-blue-600'
                                                         : 'border-slate-300'
                                                         }`}>
                                                         {isSelected && <Check className="h-3 w-3 text-white" />}
                                                     </div>
                                                     <span className="flex-1 truncate font-bold">{label}</span>
                                                 </button>
                                             );
                                         })}
                                     </div>
                                 )}
                             </div>

                            {/* 底部統計 */}
                            {hasActiveFilter && (
                                <div className="p-3 border-t border-slate-100 bg-slate-50/50">
                                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest px-1">
                                        <span className="text-slate-400">
                                            已選擇 {selectedValues.length} 項
                                        </span>
                                        <button
                                            onClick={handleClearAll}
                                            className="text-rose-600 hover:text-rose-700 transition-colors"
                                        >
                                            重設
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

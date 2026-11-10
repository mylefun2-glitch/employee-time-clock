import React, { useEffect, useRef, useState } from 'react';
import { buildHrReport, reportCsv, reportHtml, readStatisticsSources, taiwanDate, taiwanMinutes, monthBounds, genderGroup, genderLabel } from '../../lib/hrReport';
import { supabase } from '../../lib/supabase';
import { Employee } from '../../types';
import { AGE_RANGES, calculateAgeAsOf, getAgeRange, calculateSeniority, getSeniorityRange } from '../../lib/hrUtils';
import { Filter, Users, UserCheck, BarChart3 } from 'lucide-react';
import WorkHoursStatistics from '../../components/WorkHoursStatistics';

interface DeptStats {
    name: string;
    total: number;
    gender: { male: number; female: number; other: number };
    ageRanges: Record<string, number>;
    seniorityRanges: Record<string, number>;
    positions: Record<string, number>;
    avgCheckInTime: string;
    avgCheckOutTime: string;
    leaveTypeStats: Record<string, number>;
    employeeLeavePivot: {
        employeeName: string;
        department: string;
        leaves: Record<string, number>;
        totalHours: number;
    }[];
    activeLeaveTypes: string[];
}

const MultiSelectDropdown: React.FC<{
    label: string;
    icon: React.ReactNode;
    options: { value: string; label: string }[];
    selected: string[];
    onChange: (values: string[]) => void;
}> = ({ label, icon, options, selected, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);

    const toggleOption = (val: string) => {
        setIsOpen(false);
        if (val === 'ALL') {
            onChange(['ALL']);
        } else {
            let newSelected = selected.filter(v => v !== 'ALL');
            if (newSelected.includes(val)) {
                // Reset only through the explicit All option, never a repeated tap.
                if (newSelected.length === 1) return;
                newSelected = newSelected.filter(v => v !== val);
            } else {
                newSelected = [...newSelected, val];
            }
            onChange(newSelected);
        }
    };

    const displayLabel = selected.includes('ALL')
        ? '全部'
        : selected.length > 1
            ? `已選 ${selected.length} 項`
            : options.find(o => o.value === selected[0])?.label || selected[0];

    return (
        <div className="relative group min-w-[200px] flex-1">
            <div className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest mb-2 px-1">
                {icon}
                {label}
            </div>
            <button
                type="button"
                aria-label={label}
                aria-expanded={isOpen}
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-4 py-3 bg-white border border-slate-100 rounded-2xl text-sm font-bold text-slate-700 hover:border-slate-300 transition-all shadow-sm group-hover:shadow-md"
            >
                <span className="truncate">{displayLabel}</span>
                <span className={`material-symbols-outlined text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                    expand_more
                </span>
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl z-20 max-h-60 overflow-y-auto scrollbar-hide py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                        {options.map((opt) => (
                            <div
                                key={opt.value}
                                onClick={() => toggleOption(opt.value)}
                                className="px-4 py-2.5 hover:bg-slate-50 flex items-center gap-3 cursor-pointer group/item"
                            >
                                <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${selected.includes(opt.value)
                                    ? 'bg-slate-900 border-slate-900 text-white'
                                    : 'border-slate-200 group-hover/item:border-slate-400'
                                    }`}>
                                    {selected.includes(opt.value) && (
                                        <span className="material-symbols-outlined text-xs font-black">check</span>
                                    )}
                                </div>
                                <span className={`text-sm font-bold transition-colors ${selected.includes(opt.value) ? 'text-slate-900' : 'text-slate-500'
                                    }`}>
                                    {opt.label}
                                </span>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

const StatisticsPage: React.FC = () => {

    const [employees, setEmployees] = useState<Employee[]>([]);
    const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
    const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
    const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState(taiwanDate().slice(0, 7));
    const [detail, setDetail] = useState<{ kind: 'seniority' | 'age' | 'position' | 'headcount' | 'gender'; range: string } | null>(null);
    const [loadError, setLoadError] = useState('');
    const [loadedMonth, setLoadedMonth] = useState('');
    const [asOf, setAsOf] = useState(taiwanDate());
    const [namedExport, setNamedExport] = useState(false);
    const [exportError, setExportError] = useState('');
    const dialogRef = useRef<HTMLElement>(null);
    const detailTrigger = useRef<HTMLElement | null>(null);
    const requestSequence = useRef(0);

    // 複合篩選狀態
    const [filters, setFilters] = useState<{
        department: string[];
        position: string[];
        gender: string[];
    }>({
        department: ['ALL'],
        position: ['ALL'],
        gender: ['ALL']
    });

    useEffect(() => {
        fetchData();
        setDetail(null);
        return () => { requestSequence.current++; };
    }, [selectedMonth]);

    useEffect(() => {
        if (!detail) return;
        const previous = detailTrigger.current || document.activeElement as HTMLElement | null;
        const oldOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        dialogRef.current?.focus();
        const onEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') { event.preventDefault(); setDetail(null); }
            if (event.key === 'Tab') {
                const nodes = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex="0"]') || []);
                const first = nodes[0];
                if (!first) { event.preventDefault(); return; }
                // Explicitly advance focus: macOS WebKit can skip buttons in native Tab order.
                event.preventDefault();
                const index = nodes.indexOf(document.activeElement as HTMLElement);
                const next = index < 0 ? (event.shiftKey ? nodes.length - 1 : 0) : (index + (event.shiftKey ? -1 : 1) + nodes.length) % nodes.length;
                nodes[next].focus();
            }
        };
        window.addEventListener('keydown', onEscape);
        return () => { window.removeEventListener('keydown', onEscape); document.body.style.overflow = oldOverflow; if (previous?.isConnected) previous.focus(); };
    }, [detail]);

    const fetchData = async () => {
        const sequence = ++requestSequence.current;
        setLoading(true);
        setLoadError('');
        setLoadedMonth('');
        try {
            const result = await readStatisticsSources(supabase, selectedMonth);
            if (sequence !== requestSequence.current) return;
            setEmployees(result.employees);
            setAttendanceLogs(result.logs);
            setLeaveRequests(result.leaves);
            setLeaveTypes(result.types);
            setAsOf(taiwanDate());
            setLoadedMonth(selectedMonth);
        } catch {
            if (sequence !== requestSequence.current) return;
            setEmployees([]); setAttendanceLogs([]); setLeaveRequests([]); setLeaveTypes([]);
            setLoadError('資料讀取失敗，未顯示不完整統計；匯出已停用。請重試。');
        } finally {
            if (sequence === requestSequence.current) setLoading(false);
        }
    };

    // 選項列表
    const departments = ['ALL', ...Array.from(new Set(employees.map(e => e.department || '未分配')))];
    const positions = ['ALL', ...Array.from(new Set(employees.map(e => e.position || '未設定')))];
    const genders = [
        { value: 'ALL', label: '全部性別' },
        { value: 'MALE', label: '男' },
        { value: 'FEMALE', label: '女' },
        { value: 'OTHER', label: '其他／未填' }
    ];

    const filteredEmployees = employees.filter(e => {
            const matchesDept = filters.department.includes('ALL') || filters.department.includes(e.department || '未分配');
            const matchesPos = filters.position.includes('ALL') || filters.position.includes(e.position || '未設定');
            const matchesGender = filters.gender.includes('ALL') || filters.gender.includes(genderGroup(e));
            return matchesDept && matchesPos && matchesGender;
    });

    // Keep chart counts and drill-down members on the same filtered population and buckets.
    const ageGroup = (e: Employee) => getAgeRange(calculateAgeAsOf(e.birth_date, asOf));
    const seniorityGroup = (e: Employee) => e.join_date ? getSeniorityRange(calculateSeniority(e.join_date)) : '未知';
    const positionGroup = (e: Employee) => e.position || '未設定';
    const detailEmployees = detail
        ? filteredEmployees.filter(e => detail.kind === 'headcount' || (detail.kind === 'gender' ? genderGroup(e) : detail.kind === 'age' ? ageGroup(e) : detail.kind === 'position' ? positionGroup(e) : seniorityGroup(e)) === detail.range)
            .sort((a, b) => {
                if (detail.kind !== 'age' && detail.kind !== 'seniority') return a.name.localeCompare(b.name, 'zh-Hant');
                const value = (e: Employee) => detail.kind === 'age'
                    ? calculateAgeAsOf(e.birth_date, asOf) ?? -1
                    : e.join_date ? calculateSeniority(e.join_date) : -1;
                return value(b) - value(a) || a.name.localeCompare(b.name, 'zh-Hant');
            })
        : [];

    const getStats = (): DeptStats => {
        const filtered = filteredEmployees;
        const stats: DeptStats = {
            name: filters.department.length === 1 ? filters.department[0] : '多重選取',
            total: filtered.length,
            gender: { male: 0, female: 0, other: 0 },
            ageRanges: Object.fromEntries(AGE_RANGES.map(range => [range, 0])),
            seniorityRanges: {
                '0.25年以下': 0, '0.25年～0.5年以下': 0, '0.5年～1年': 0, '1年～2年': 0,
                '2年～3年': 0, '3年～4年': 0, '4年～5年': 0, '5年以上': 0, '10年以上': 0, '未知': 0
            },
            positions: {},
            avgCheckInTime: '--:--',
            avgCheckOutTime: '--:--',
            leaveTypeStats: {},
            employeeLeavePivot: [],
            activeLeaveTypes: []
        };

        const filteredIds = new Set(filtered.map(e => e.id));
        const employeeMap = new Map(filtered.map(e => [e.id, e]));

        // 扣薪假別清單
        const deductionLeaveNames = ['事假', '家庭照顧', '家庭照顧假', '病假', '生理假'];

        filtered.forEach(e => {
            if (e.gender === 'MALE') stats.gender.male++;
            else if (e.gender === 'FEMALE') stats.gender.female++;
            else stats.gender.other++;

            stats.ageRanges[ageGroup(e)]++;
            stats.seniorityRanges[seniorityGroup(e)]++;

            const pos = positionGroup(e);
            stats.positions[pos] = (stats.positions[pos] || 0) + 1;
        });

        // 計算平均上班時間
        const relevantLogs = attendanceLogs.filter(log => filteredIds.has(log.employee_id));
        const checkIns = relevantLogs.filter(log => log.check_type === 'IN');
        if (checkIns.length > 0) {
            const totalMinutes = checkIns.reduce((sum, log) => {
                return sum + taiwanMinutes(log.timestamp);
            }, 0);
            const avgMinutes = Math.round(totalMinutes / checkIns.length);
            stats.avgCheckInTime = `${Math.floor(avgMinutes / 60).toString().padStart(2, '0')}:${(avgMinutes % 60).toString().padStart(2, '0')}`;
        }

        // 計算平均下班時間
        const checkOuts = relevantLogs.filter(log => log.check_type === 'OUT');
        if (checkOuts.length > 0) {
            const totalMinutes = checkOuts.reduce((sum, log) => {
                return sum + taiwanMinutes(log.timestamp);
            }, 0);
            const avgMinutes = Math.round(totalMinutes / checkOuts.length);
            stats.avgCheckOutTime = `${Math.floor(avgMinutes / 60).toString().padStart(2, '0')}:${(avgMinutes % 60).toString().padStart(2, '0')}`;
        }

        // 計算差勤時數統計
        const relevantLeaves = leaveRequests.filter(req => filteredIds.has(req.employee_id));
        
        // 暫存每位員工各假別的時數加總
        const empLeaveTotals: Record<string, Record<string, number>> = {};

        relevantLeaves.forEach(req => {
            const typeName = req.leave_type?.name || '未知假別';
            const hours = req.hours || 0;
            
            // 全體統計
            stats.leaveTypeStats[typeName] = (stats.leaveTypeStats[typeName] || 0) + hours;

            // 個別統計 (僅針對扣薪假別)
            // 排除名稱中包含「公」字頭的（如公事假），並確保包含關鍵扣薪假別名稱
            const isOfficial = typeName.startsWith('公') || typeName.includes('公務') || typeName.includes('公假');
            if (!isOfficial && deductionLeaveNames.some(d => typeName.includes(d))) {
                if (!empLeaveTotals[req.employee_id]) {
                    empLeaveTotals[req.employee_id] = {};
                }
                empLeaveTotals[req.employee_id][typeName] = (empLeaveTotals[req.employee_id][typeName] || 0) + hours;
            }
        });

        // 構建員工假別明細列表 (樞紐分析格式)
        const activeLeaveTypeSet = new Set<string>();
        stats.employeeLeavePivot = Object.entries(empLeaveTotals).map(([empId, types]) => {
            const emp = employeeMap.get(empId);
            const leaves: Record<string, number> = {};
            let totalHours = 0;

            Object.entries(types).forEach(([leaveType, hours]) => {
                const roundedHours = parseFloat(hours.toFixed(1));
                leaves[leaveType] = roundedHours;
                totalHours += roundedHours;
                activeLeaveTypeSet.add(leaveType);
            });

            return {
                employeeName: emp?.name || '未知',
                department: emp?.department || '未分配',
                leaves,
                totalHours: parseFloat(totalHours.toFixed(1))
            };
        });

        stats.activeLeaveTypes = Array.from(activeLeaveTypeSet).sort();
        stats.employeeLeavePivot.sort((a, b) => b.totalHours - a.totalHours);

        // 將差勤時數百分比顯示保留一位小數
        Object.keys(stats.leaveTypeStats).forEach(key => {
            stats.leaveTypeStats[key] = parseFloat(stats.leaveTypeStats[key].toFixed(1));
        });

        return stats;
    };

    const currentStats = getStats();
    const exportReady = !loading && !loadError && loadedMonth === selectedMonth;
    const detailLabel = detail ? `${({ age: '年齡', seniority: '年資', position: '職務', headcount: '在職人數', gender: '性別' })[detail.kind]}・${detail.kind === 'gender' ? genderLabel(detail.range) : detail.range}` : '';
    const exportReport = (format: 'csv' | 'print', fromDetail = false) => {
        if (!exportReady || (fromDetail && !detail)) return;
        setExportError('');
        const people = fromDetail ? detailEmployees : filteredEmployees;
        const report = buildHrReport({ month: selectedMonth, asOf, filters, stats: currentStats,
            named: fromDetail || namedExport, detail: fromDetail ? detailLabel : undefined,
            roster: people.map(e => ({ name: e.name, department: e.department || '未分配', position: positionGroup(e), gender: genderLabel(genderGroup(e)), age: ageGroup(e), seniority: seniorityGroup(e) })) });
        if (format === 'csv') {
            const url = URL.createObjectURL(new Blob([reportCsv(report)], { type: 'text/csv;charset=utf-8' }));
            const link = document.createElement('a'); link.href = url; link.download = `人事統計-${selectedMonth}-${fromDetail ? '明細名單' : namedExport ? '具名' : '摘要'}.csv`;
            document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        } else {
            const printWindow = window.open('', '_blank');
            if (!printWindow) { setExportError('列印視窗被封鎖，請允許此網站開啟彈出式視窗後重試。'); return; }
            printWindow.opener = null;
            printWindow.document.open(); printWindow.document.write(reportHtml(report)); printWindow.document.close();
            printWindow.focus();
            // The preview's visible button also allows retrying print after fonts load.
            printWindow.setTimeout(() => { if (!printWindow.closed) printWindow.print(); }, 300);
        }
    };

    // Counts, percentages and drill-down share the same filtered employee set.
    const positionChartData = Object.entries(currentStats.positions)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, 'zh-Hant'));
    const maxPositionCount = Math.max(1, ...positionChartData.map(item => item.value));

    if (loading) return <div className="p-12 text-center text-slate-500 font-black text-xl">數據分析中...</div>;
    if (loadError) return <div role="alert" className="p-5 space-y-3"><p>{loadError}</p><button onClick={fetchData} className="rounded-lg border px-4 py-2">重新讀取</button><button disabled className="ml-2 text-slate-400">匯出已停用</button></div>;

    return (
        <div className="space-y-8 pb-12 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-col gap-2">
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">人事統計報表</h1>
                    <p className="text-slate-500 text-sm font-medium">人事：目前在職（含理事長）；打卡／差勤：所選月份</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <input
                            type="month"
                            value={selectedMonth}
                            aria-label="打卡與差勤月份"
                            onChange={(e) => { if (e.target.value) setSelectedMonth(e.target.value); }}
                            className="w-full min-w-0 max-w-full pl-5 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-base font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 shadow-sm appearance-none"
                        />
                        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">calendar_view_month</span>
                    </div>
                </div>
            </div>

            {/* 篩選工具列 */}
            <div className="flex flex-wrap items-center gap-2 text-sm">
                <label className="flex w-full flex-wrap items-center gap-2 sm:w-auto">匯出範圍<select aria-label="匯出範圍" value={namedExport ? 'named' : 'summary'} onChange={e => setNamedExport(e.target.value === 'named')} className="min-w-0 max-w-full rounded-lg border p-2 text-base"><option value="summary">僅摘要（預設）</option><option value="named">摘要＋具名名單／扣薪明細</option></select></label>
                <button disabled={!exportReady} onClick={() => exportReport('csv')} className="rounded-lg border px-3 py-2 disabled:opacity-40">匯出 CSV</button>
                <button disabled={!exportReady} onClick={() => exportReport('print')} className="rounded-lg border px-3 py-2 disabled:opacity-40">列印／另存 PDF</button>
                {exportError && <p role="alert" className="w-full text-red-700">{exportError}</p>}
            </div>
            <details className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-600">
                <summary className="cursor-pointer font-bold">口徑與來源・基準日 {asOf}・Asia/Taipei</summary>
                <div className="mt-2 space-y-1 break-words">
                    <p>employees：is_active=true，含理事長；人事／年齡／年資為目前資料，非所選月份歷史快照。年齡截至 {asOf}（Asia/Taipei），生日未填、無效或晚於基準日列為未知；年資沿用 hrUtils 計算及區間。</p>
                    <p>月份：{monthBounds(selectedMonth).start}（含）～{monthBounds(selectedMonth).end}（不含）。</p>
                    <p>attendance_logs.timestamp：所有 IN／OUT 分別平均，非每日首末筆；平均時間以台灣時區顯示。</p>
                    <p>leave_requests.start_date：核准 APPROVED 且 is_modified 為空或 false，按開始月份歸屬，不跨月攤提；假別來源 leave_types。僅沿用現有統計，未變更薪資／聘僱規則。</p>
                </div>
            </details>
            <div className="bg-slate-50/50 p-6 rounded-[2.5rem] border border-slate-100 flex flex-col md:flex-row items-center gap-6">
                {/* 部門篩選 */}
                <MultiSelectDropdown
                    label="部門篩選"
                    icon={<Filter className="h-4 w-4" />}
                    options={departments.map(d => ({ value: d, label: d === 'ALL' ? '全部部門' : d }))}
                    selected={filters.department}
                    onChange={(vals) => setFilters(prev => ({ ...prev, department: vals }))}
                />

                {/* 職務篩選 */}
                <MultiSelectDropdown
                    label="職務篩選"
                    icon={<Users className="h-4 w-4" />}
                    options={positions.map(p => ({ value: p, label: p === 'ALL' ? '全部職務' : p }))}
                    selected={filters.position}
                    onChange={(vals) => setFilters(prev => ({ ...prev, position: vals }))}
                />

                {/* 性別篩選 */}
                <MultiSelectDropdown
                    label="性別篩選"
                    icon={<UserCheck className="h-4 w-4" />}
                    options={genders}
                    selected={filters.gender}
                    onChange={(vals) => setFilters(prev => ({ ...prev, gender: vals }))}
                />
            </div>


            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                {/* 總計卡片 */}
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Users className="w-16 h-16" />
                    </div>
                    <span className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-2">篩選人數</span>
                    <button disabled={!currentStats.total} onClick={event => { detailTrigger.current = event.currentTarget; setDetail({ kind: 'headcount', range: '目前在職（含理事長）' }); }} aria-label={`查看篩選人數${currentStats.total}位員工`} className="relative text-4xl font-black text-blue-600 mb-1 tabular-nums rounded focus-visible:outline-2">{currentStats.total}</button>
                    <div className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                        在職成員
                    </div>
                </div>

                {/* 平均上班 */}
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center relative overflow-hidden group">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-2">平均上班</span>
                    <div className="text-4xl font-black text-emerald-600 mb-1 tabular-nums">{currentStats.avgCheckInTime}</div>
                    <div className="text-xs font-bold text-slate-400">本月紀錄</div>
                </div>

                {/* 平均下班 */}
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center relative overflow-hidden group">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-2">平均下班</span>
                    <div className="text-4xl font-black text-orange-600 mb-1 tabular-nums">{currentStats.avgCheckOutTime}</div>
                    <div className="text-xs font-bold text-slate-400">本月紀錄</div>
                </div>

                {/* 性別比例 (簡化版放在 Grid 中) */}
                <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">性別比例</h3>
                    <div className="flex items-center gap-4 h-full">
                        <div className="flex-1 space-y-3">
                            {[
                                { count: currentStats.gender.male, color: 'bg-blue-500' },
                                { count: currentStats.gender.female, color: 'bg-rose-500' },
                                { count: currentStats.gender.other, color: 'bg-slate-400' }
                            ].map((item, idx) => (
                                <div key={idx} className="h-2 w-full bg-slate-50 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full ${item.color}`}
                                        style={{ width: `${currentStats.total ? (item.count / currentStats.total * 100) : 0}%` }}
                                    />
                                </div>
                            ))}
                        </div>
                        <div className="text-right shrink-0">
                            {(['MALE', 'FEMALE', 'OTHER'] as const).map((gender, index) => {
                                const count = [currentStats.gender.male, currentStats.gender.female, currentStats.gender.other][index];
                                return <button key={gender} disabled={!count} onClick={event => { detailTrigger.current = event.currentTarget; setDetail({ kind: 'gender', range: gender }); }} aria-label={`查看${genderLabel(gender)}${count}位員工`} className="block min-h-9 text-xs font-bold text-slate-700 rounded focus-visible:outline-2">{genderLabel(gender)} {count}</button>;
                            })}
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* 差勤時數百分比 */}
                <div className="bg-white p-5 sm:p-8 rounded-3xl border border-slate-100 shadow-sm overflow-hidden min-w-0">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="p-1.5 bg-rose-50 rounded-lg">
                            <span className="material-symbols-outlined text-rose-600 text-xl font-black">event_available</span>
                        </div>
                        <h3 className="text-lg font-black text-slate-900 tracking-tight">差勤各項類別時數統計</h3>
                    </div>
                    <div className="space-y-4">
                        {Object.keys(currentStats.leaveTypeStats).length === 0 ? (
                            <div className="py-12 text-center text-slate-400 font-bold italic">本月尚無任何核准的差勤紀錄</div>
                        ) : (
                            Object.entries(currentStats.leaveTypeStats)
                                .sort((a, b) => b[1] - a[1])
                                .map(([type, hours]) => (
                                    <div key={type} className="flex items-center gap-2 sm:gap-5 group">
                                        <span className="text-sm font-black text-slate-500 w-20 sm:w-24 shrink-0 text-right tracking-tight group-hover:text-rose-600 transition-colors truncate">{type}</span>
                                        <div className="relative min-w-0 flex-1 h-8 bg-slate-50 rounded-xl overflow-hidden border border-slate-50 group-hover:border-slate-100 transition-all">
                                            <div
                                                className="absolute inset-y-0 left-0 bg-rose-100 border-r-4 border-rose-500 transition-all duration-1000 shadow-sm"
                                                style={{ width: `${(hours / Math.max(...Object.values(currentStats.leaveTypeStats), 1)) * 100}%` }}
                                            />
                                            <span className={`relative z-10 flex h-full items-center justify-end px-3 whitespace-nowrap text-base font-black tabular-nums ${hours > 0 ? 'text-rose-600' : 'text-slate-300'}`}>
                                                {hours > 0 ? `${hours} 小時` : '0'}
                                            </span>
                                        </div>
                                    </div>
                                ))
                        )}
                    </div>
                </div>

                {/* 職務人數與占比：長條方便比較，點選可查核名單 */}
                <div className="bg-white p-5 sm:p-8 rounded-3xl border border-slate-100 shadow-sm min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-1.5 bg-amber-50 rounded-lg">
                            <BarChart3 className="w-6 h-6 text-amber-600" />
                        </div>
                        <h3 className="text-lg font-black text-slate-900 tracking-tight">職務結構細分</h3>
                    </div>
                    <p className="mb-5 text-xs text-slate-500">目前在職・共 {currentStats.total} 人・點選職務查看人員</p>
                    <div className="space-y-2">
                        {positionChartData.length === 0 ? (
                            <p className="py-10 text-center text-sm text-slate-500">目前篩選條件下沒有在職人員</p>
                        ) : positionChartData.map(({ name, value }) => (
                            <button key={name} type="button" onClick={event => { detailTrigger.current = event.currentTarget; setDetail({ kind: 'position', range: name }); }}
                                aria-label={`查看${name}的${value}位員工`}
                                className="w-full rounded-xl px-3 py-2.5 text-left hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-amber-600 transition-colors">
                                <div className="flex items-start justify-between gap-3 text-sm">
                                    <span className="min-w-0 font-bold text-slate-800 break-words">{name}</span>
                                    <span className="shrink-0 font-black tabular-nums text-amber-800">{value} 人・{(value / currentStats.total * 100).toFixed(1)}%</span>
                                </div>
                                <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                                    <div className="h-full rounded-full bg-amber-500" style={{ width: `${value / maxPositionCount * 100}%` }} />
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* 年資分佈 (原有) */}
                <div className="bg-white p-5 sm:p-8 rounded-3xl border border-slate-100 shadow-sm min-w-0">
                    <div className="flex items-center gap-3 mb-8">
                        <BarChart3 className="w-6 h-6 text-blue-600" />
                        <h3 className="text-lg font-black text-slate-900 tracking-tight">年資結構分佈</h3>
                    </div>
                    <p className="mb-4 text-xs text-slate-500">點選有資料的區間查看人員名單</p>
                    <div className="space-y-4">
                        {Object.entries(currentStats.seniorityRanges).map(([range, count]) => (
                            <button type="button" key={range} disabled={count === 0} onClick={event => { detailTrigger.current = event.currentTarget; setDetail({ kind: 'seniority', range }); }}
                                aria-label={`查看年資${range}的${count}位員工`}
                                className="flex items-center gap-2 sm:gap-5 group w-full text-left disabled:cursor-default enabled:cursor-pointer enabled:focus-visible:outline-2 enabled:focus-visible:outline-blue-600 rounded-xl">
                                <span className="text-sm font-black text-slate-500 w-24 sm:w-32 shrink-0 text-right tracking-tight group-hover:text-blue-600 transition-colors">{range}</span>
                                <div className="relative min-w-0 flex-1 h-8 bg-slate-50 rounded-xl overflow-hidden border border-slate-50 group-hover:border-slate-100 transition-all">
                                    <div
                                        className="absolute inset-y-0 left-0 bg-blue-100 border-r-4 border-blue-500 transition-all duration-1000 shadow-sm"
                                        style={{ width: `${(count / Math.max(...Object.values(currentStats.seniorityRanges), 1)) * 100}%` }}
                                    />
                                    <span className={`relative z-10 flex h-full items-center justify-end px-3 whitespace-nowrap text-base font-black tabular-nums ${count > 0 ? 'text-blue-600' : 'text-slate-300'}`}>
                                        {count > 0 ? `${count} 人` : '0'}
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* 年齡分佈 (原有) */}
                <div className="bg-white p-5 sm:p-8 rounded-3xl border border-slate-100 shadow-sm min-w-0">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="p-1.5 bg-indigo-50 rounded-lg">
                            <span className="material-symbols-outlined text-indigo-600 text-xl font-black">cake</span>
                        </div>
                        <h3 className="text-lg font-black text-slate-900 tracking-tight">年齡結構分佈</h3>
                    </div>
                    <p className="mb-4 text-xs text-slate-500">點選有資料的區間查看人員名單</p>
                    <div className="space-y-4">
                        {Object.entries(currentStats.ageRanges).map(([range, count]) => (
                            <button type="button" key={range} disabled={count === 0} onClick={event => { detailTrigger.current = event.currentTarget; setDetail({ kind: 'age', range }); }}
                                aria-label={`查看年齡${range}的${count}位員工`}
                                className="flex items-center gap-2 sm:gap-5 group w-full text-left disabled:cursor-default enabled:cursor-pointer enabled:focus-visible:outline-2 enabled:focus-visible:outline-indigo-600 rounded-xl">
                                <span className="text-sm font-black text-slate-500 w-24 sm:w-32 shrink-0 text-right tracking-tight group-hover:text-indigo-600 transition-colors">{range}</span>
                                <div className="relative min-w-0 flex-1 h-10 bg-slate-50 rounded-xl overflow-hidden border border-slate-50 group-hover:border-slate-100 transition-all">
                                    <div
                                        className="absolute inset-y-0 left-0 bg-indigo-100 border-r-4 border-indigo-500 transition-all duration-1000 shadow-sm"
                                        style={{ width: `${(count / Math.max(...Object.values(currentStats.ageRanges), 1)) * 100}%` }}
                                    />
                                    <span className={`relative z-10 flex h-full items-center justify-end px-3 whitespace-nowrap text-base font-black tabular-nums ${count > 0 ? 'text-indigo-600' : 'text-slate-300'}`}>
                                        {count > 0 ? `${count} 人` : '0'}
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {detail && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3 sm:p-6" onClick={() => setDetail(null)}>
                    <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="stats-detail-title" onClick={e => e.stopPropagation()}
                        className="w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-5 sm:p-7 shadow-xl">
                        <div className="flex items-start justify-between gap-4 mb-2">
                            <h2 id="stats-detail-title" className="text-xl font-black text-slate-900">
                                {detailLabel}（{detailEmployees.length} 人）
                            </h2>
                            <button type="button" onClick={() => setDetail(null)} aria-label="關閉明細" className="rounded-lg px-3 py-1 text-slate-600 hover:bg-slate-100 focus-visible:outline-2">關閉</button>
                        </div>
                        <p className="mb-3 text-sm text-slate-500">目前在職（含理事長）・沿用頁面篩選・基準日 {asOf}</p>
                        <div className="mb-4 flex flex-wrap gap-2 text-sm"><button disabled={!exportReady} onClick={() => exportReport('csv', true)} className="rounded-lg border p-2">匯出此名單 CSV</button><button disabled={!exportReady} onClick={() => exportReport('print', true)} className="rounded-lg border p-2">此名單列印／另存 PDF</button></div>
                        {exportError && <p role="alert" className="text-sm text-red-700">{exportError}</p>}
                        <div className="space-y-2">
                            {detailEmployees.map(e => (
                                <div key={e.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3 sm:flex sm:items-center sm:gap-4">
                                    <div className="font-bold text-slate-900 sm:w-28">{e.name}</div>
                                    <div className="text-sm text-slate-600 sm:flex-1">{e.department || '未分配'}・{e.position || '未設定'}</div>
                                    {(detail.kind === 'age' || detail.kind === 'seniority') && (
                                        <div className="text-sm font-bold text-slate-700 sm:text-right">
                                            {detail.kind === 'age'
                                                ? calculateAgeAsOf(e.birth_date, asOf) !== null ? `${calculateAgeAsOf(e.birth_date, asOf)} 歲` : '年齡未知'
                                                : e.join_date ? `到職 ${e.join_date}・${calculateSeniority(e.join_date)} 年` : '到職日未填'}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            )}

            <WorkHoursStatistics month={selectedMonth} asOf={asOf} filters={filters} namedExport={namedExport} />

            {/* 員工扣薪假別統計明細 */}
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-slate-900 rounded-lg">
                            <span className="material-symbols-outlined text-white text-xl font-black">table_chart</span>
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-slate-900 tracking-tight">員工扣薪假別明細統計</h3>
                            <p className="text-xs font-bold text-slate-400 mt-0.5">事假、病假、生理假、家庭照顧假統計明細</p>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto -mx-8 px-8">
                    <table className="w-full text-left border-separate border-spacing-y-2">
                        <thead>
                            <tr className="text-sm font-black text-slate-500 uppercase tracking-tight">
                                <th className="px-6 py-3">員工姓名</th>
                                <th className="px-6 py-3">部門單位</th>
                                {currentStats.activeLeaveTypes.map(type => (
                                    <th key={type} className="px-6 py-3 text-center">{type}</th>
                                ))}
                                <th className="px-6 py-3 text-right">扣薪合計 (HR)</th>
                            </tr>
                        </thead>
                        <tbody className="text-base">
                            {currentStats.employeeLeavePivot.length === 0 ? (
                                <tr>
                                    <td colSpan={3 + currentStats.activeLeaveTypes.length} className="px-6 py-12 text-center text-slate-400 font-bold italic bg-slate-50/50 rounded-2xl">
                                        本月尚無相關假別紀錄
                                    </td>
                                </tr>
                            ) : (
                                currentStats.employeeLeavePivot.map((detail, idx) => (
                                    <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4 bg-slate-50/50 group-hover:bg-white rounded-l-2xl border-y border-transparent group-hover:border-slate-100 transition-all">
                                            <div className="font-black text-slate-900">{detail.employeeName}</div>
                                        </td>
                                        <td className="px-6 py-4 bg-slate-50/50 group-hover:bg-white border-y border-transparent group-hover:border-slate-100 transition-all text-xs font-black uppercase tracking-widest text-slate-300">
                                            {detail.department}
                                        </td>
                                        {currentStats.activeLeaveTypes.map(type => (
                                            <td key={type} className="px-6 py-4 bg-slate-50/50 group-hover:bg-white border-y border-transparent group-hover:border-slate-100 transition-all text-center">
                                                <span className={`font-black tabular-nums transition-colors ${detail.leaves[type] ? 'text-slate-900' : 'text-slate-200'}`}>
                                                    {detail.leaves[type] ? detail.leaves[type].toFixed(1) : '-'}
                                                </span>
                                            </td>
                                        ))}
                                        <td className="px-6 py-4 bg-slate-50/50 group-hover:bg-white rounded-r-2xl border-y border-transparent group-hover:border-slate-100 transition-all text-right">
                                            <span className="font-black text-rose-600 tabular-nums">
                                                {detail.totalHours.toFixed(1)}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {currentStats.employeeLeavePivot.length > 0 && (
                    <div className="mt-6 flex items-center gap-2 text-xs font-bold text-slate-400 italic">
                        <span className="material-symbols-outlined text-xs">info</span>
                        此表格僅列出在本月有「扣薪假別」核准紀錄的員工，方便人事進行薪資計算。
                    </div>
                )}
            </div>
        </div>
    );
};

export default StatisticsPage;

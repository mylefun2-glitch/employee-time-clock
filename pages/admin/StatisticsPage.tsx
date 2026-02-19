import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Employee } from '../../types';
import { calculateAge, getAgeRange, calculateSeniority, getSeniorityRange } from '../../lib/hrUtils';
import { Filter, Users, UserCheck, BarChart3, PieChart as PieIcon } from 'lucide-react';
import {
    PieChart,
    Pie,
    Cell,
    Tooltip,
    ResponsiveContainer,
    Legend,
    Sector
} from 'recharts';

interface DeptStats {
    name: string;
    total: number;
    gender: { male: number; female: number; other: number };
    ageRanges: Record<string, number>;
    seniorityRanges: Record<string, number>;
    positions: Record<string, number>;
}

const COLORS = [
    '#3b82f6', // blue
    '#6366f1', // indigo
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#f43f5e', // rose
    '#f59e0b', // amber
    '#10b981', // emerald
    '#06b6d4', // cyan
];

const MultiSelectDropdown: React.FC<{
    label: string;
    icon: React.ReactNode;
    options: { value: string; label: string }[];
    selected: string[];
    onChange: (values: string[]) => void;
}> = ({ label, icon, options, selected, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);

    const toggleOption = (val: string) => {
        if (val === 'ALL') {
            onChange(['ALL']);
        } else {
            let newSelected = selected.filter(v => v !== 'ALL');
            if (newSelected.includes(val)) {
                newSelected = newSelected.filter(v => v !== val);
                if (newSelected.length === 0) newSelected = ['ALL'];
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
    const [loading, setLoading] = useState(true);
    const [activeIndex, setActiveIndex] = useState(0);

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
        fetchEmployees();
    }, []);

    const fetchEmployees = async () => {
        const { data, error } = await supabase.from('employees').select('*').eq('is_active', true);
        if (data) setEmployees(data);
        setLoading(false);
    };

    // 選項列表
    const departments = ['ALL', ...Array.from(new Set(employees.map(e => e.department || '未分配')))];
    const positions = ['ALL', ...Array.from(new Set(employees.map(e => e.position || '未設定')))];
    const genders = [
        { value: 'ALL', label: '全部性別' },
        { value: 'MALE', label: '男' },
        { value: 'FEMALE', label: '女' },
        { value: 'OTHER', label: '其他' }
    ];

    const getStats = (): DeptStats => {
        const filtered = employees.filter(e => {
            const matchesDept = filters.department.includes('ALL') || filters.department.includes(e.department || '未分配');
            const matchesPos = filters.position.includes('ALL') || filters.position.includes(e.position || '未設定');
            const matchesGender = filters.gender.includes('ALL') || filters.gender.includes(e.gender || 'OTHER');
            return matchesDept && matchesPos && matchesGender;
        });

        const stats: DeptStats = {
            name: filters.department.length === 1 ? filters.department[0] : '多重選取',
            total: filtered.length,
            gender: { male: 0, female: 0, other: 0 },
            ageRanges: { '35歲以下': 0, '35歲～44歲': 0, '45歲～64歲': 0, '65歲以上': 0, '未知': 0 },
            seniorityRanges: {
                '0.25年以下': 0, '0.25年～0.5年以下': 0, '0.5年～1年': 0, '1年～2年': 0,
                '2年～3年': 0, '3年～4年': 0, '4年～5年': 0, '5年以上': 0, '10年以上': 0, '未知': 0
            },
            positions: {}
        };

        filtered.forEach(e => {
            if (e.gender === 'MALE') stats.gender.male++;
            else if (e.gender === 'FEMALE') stats.gender.female++;
            else stats.gender.other++;

            if (e.birth_date) {
                const age = calculateAge(e.birth_date);
                const range = getAgeRange(age);
                stats.ageRanges[range] = (stats.ageRanges[range] || 0) + 1;
            } else {
                stats.ageRanges['未知']++;
            }

            if (e.join_date) {
                const years = calculateSeniority(e.join_date);
                const range = getSeniorityRange(years);
                stats.seniorityRanges[range] = (stats.seniorityRanges[range] || 0) + 1;
            } else {
                stats.seniorityRanges['未知']++;
            }

            const pos = e.position || '未設定';
            stats.positions[pos] = (stats.positions[pos] || 0) + 1;
        });

        return stats;
    };

    const currentStats = getStats();

    // 格式化職務數據給 Recharts
    const positionChartData = Object.entries(currentStats.positions)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    const onPieEnter = (_: any, index: number) => {
        setActiveIndex(index);
    };

    const renderActiveShape = (props: any) => {
        const RADIAN = Math.PI / 180;
        const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
        const sin = Math.sin(-RADIAN * midAngle);
        const cos = Math.cos(-RADIAN * midAngle);
        const sx = cx + (outerRadius + 10) * cos;
        const sy = cy + (outerRadius + 10) * sin;
        const mx = cx + (outerRadius + 30) * cos;
        const my = cy + (outerRadius + 30) * sin;
        const ex = mx + (cos >= 0 ? 1 : -1) * 22;
        const ey = my;
        const textAnchor = cos >= 0 ? 'start' : 'end';

        return (
            <g>
                <text x={cx} y={cy} dy={8} textAnchor="middle" fill={fill} className="text-sm font-black uppercase">
                    {payload.name}
                </text>
                <Sector
                    cx={cx}
                    cy={cy}
                    innerRadius={innerRadius}
                    outerRadius={outerRadius}
                    startAngle={startAngle}
                    endAngle={endAngle}
                    fill={fill}
                />
                <Sector
                    cx={cx}
                    cy={cy}
                    startAngle={startAngle}
                    endAngle={endAngle}
                    innerRadius={outerRadius + 6}
                    outerRadius={outerRadius + 10}
                    fill={fill}
                />
                <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" />
                <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
                <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} textAnchor={textAnchor} fill="#333" className="text-xs font-black">{`${value} 人`}</text>
                <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} dy={18} textAnchor={textAnchor} fill="#999" className="text-[10px] uppercase font-bold">
                    {`(佔 ${(percent * 100).toFixed(1)}%)`}
                </text>
            </g>
        );
    };

    if (loading) return <div className="p-12 text-center text-slate-500 font-black text-xl">數據分析中...</div>;

    return (
        <div className="space-y-8 pb-12 animate-in fade-in duration-500">
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">人事統計報表</h1>
                <p className="text-slate-500 text-base font-medium">即時分析全會人力結構與分佈數據</p>
            </div>

            {/* 篩選工具列 */}
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


            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 總計與狀態卡片 */}
                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Users className="w-32 h-32" />
                    </div>
                    <span className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-3">當前篩選人數</span>
                    <div className="text-7xl font-black text-blue-600 mb-3 tabular-nums">{currentStats.total}</div>
                    <div className="flex items-center gap-2 text-sm font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                        <UserCheck className="w-4 h-4" />
                        在職成員
                    </div>
                </div>

                {/* 性別比例 */}
                <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                    <h3 className="text-base font-black text-slate-900 uppercase tracking-widest mb-8 border-l-4 border-blue-600 pl-4">性別結構比例</h3>
                    <div className="space-y-6">
                        {[
                            { label: '男性成員', count: currentStats.gender.male, color: 'bg-blue-500', icon: 'male' },
                            { label: '女性成員', count: currentStats.gender.female, color: 'bg-rose-500', icon: 'female' },
                            { label: '其他/未設定', count: currentStats.gender.other, color: 'bg-slate-400', icon: 'more_horiz' }
                        ].map(item => (
                            <div key={item.label} className="space-y-2">
                                <div className="flex justify-between items-end">
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-slate-400 text-lg">{item.icon}</span>
                                        <span className="text-sm font-black text-slate-600">{item.label}</span>
                                    </div>
                                    <span className="text-base font-black text-slate-900">
                                        {item.count} 人
                                        <span className="ml-2 text-blue-500 text-sm">({currentStats.total ? Math.round(item.count / currentStats.total * 100) : 0}%)</span>
                                    </span>
                                </div>
                                <div className="h-3 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                                    <div
                                        className={`h-full ${item.color} transition-all duration-1000 ease-out shadow-sm`}
                                        style={{ width: `${currentStats.total ? (item.count / currentStats.total * 100) : 0}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* 年資分佈 */}
                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-8">
                        <BarChart3 className="w-6 h-6 text-blue-600" />
                        <h3 className="text-lg font-black text-slate-900 tracking-tight">年資結構分佈</h3>
                    </div>
                    <div className="space-y-4">
                        {Object.entries(currentStats.seniorityRanges).map(([range, count]) => (
                            <div key={range} className="flex items-center gap-5 group">
                                <span className="text-xs font-black text-slate-500 w-32 text-right tracking-tight group-hover:text-blue-600 transition-colors">{range}</span>
                                <div className="flex-1 h-8 bg-slate-50 rounded-xl overflow-hidden flex items-center pr-3 border border-slate-50 group-hover:border-slate-100 transition-all">
                                    <div
                                        className="h-full bg-blue-100 border-r-4 border-blue-500 transition-all duration-1000 shadow-sm"
                                        style={{ width: `${(count / Math.max(...Object.values(currentStats.seniorityRanges), 1)) * 100}%` }}
                                    />
                                    <span className={`ml-3 text-sm font-black ${count > 0 ? 'text-blue-600' : 'text-slate-300'}`}>
                                        {count > 0 ? `${count} 人` : '0'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 年齡分佈 */}
                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="p-1.5 bg-indigo-50 rounded-lg">
                            <span className="material-symbols-outlined text-indigo-600 text-xl font-black">cake</span>
                        </div>
                        <h3 className="text-lg font-black text-slate-900 tracking-tight">年齡結構分佈</h3>
                    </div>
                    <div className="space-y-4">
                        {Object.entries(currentStats.ageRanges).map(([range, count]) => (
                            <div key={range} className="flex items-center gap-5 group">
                                <span className="text-xs font-black text-slate-500 w-32 text-right tracking-tight group-hover:text-indigo-600 transition-colors">{range}</span>
                                <div className="flex-1 h-10 bg-slate-50 rounded-xl overflow-hidden flex items-center pr-3 border border-slate-50 group-hover:border-slate-100 transition-all">
                                    <div
                                        className="h-full bg-indigo-100 border-r-4 border-indigo-500 transition-all duration-1000 shadow-sm"
                                        style={{ width: `${(count / Math.max(...Object.values(currentStats.ageRanges), 1)) * 100}%` }}
                                    />
                                    <span className={`ml-3 text-sm font-black ${count > 0 ? 'text-indigo-600' : 'text-slate-300'}`}>
                                        {count > 0 ? `${count} 人` : '0'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 職務結構圖表 */}
                <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <div className="p-1.5 bg-amber-50 rounded-lg">
                                <PieIcon className="w-6 h-6 text-amber-600" />
                            </div>
                            <h3 className="text-lg font-black text-slate-900 tracking-tight">職務結構細分圖表</h3>
                        </div>
                    </div>

                    <div className="flex flex-col lg:flex-row items-center gap-12">
                        {/* 圓餅圖 */}
                        <div className="w-full lg:w-1/2 h-[400px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        // @ts-ignore
                                        activeIndex={activeIndex}
                                        // @ts-ignore
                                        activeShape={renderActiveShape}
                                        data={positionChartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={80}
                                        outerRadius={120}
                                        fill="#8884d8"
                                        dataKey="value"
                                        onMouseEnter={onPieEnter}
                                    >
                                        {positionChartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        {/* 文字對照表 */}
                        <div className="w-full lg:w-1/2 grid grid-cols-2 gap-4">
                            {positionChartData.map((item, index) => (
                                <div key={item.name} className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 flex items-center gap-4 hover:bg-white hover:shadow-lg transition-all cursor-default">
                                    <div
                                        className="w-3 h-10 rounded-full flex-shrink-0 shadow-sm"
                                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                    />
                                    <div className="min-w-0">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">{item.name}</div>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-xl font-black text-slate-900">{item.value}</span>
                                            <span className="text-[10px] font-black text-slate-400">人</span>
                                            <span className="text-[10px] font-black text-blue-500 ml-auto">
                                                {((item.value / currentStats.total) * 100).toFixed(0)}%
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StatisticsPage;

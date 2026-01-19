import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Employee } from '../../types';
import { calculateAge, getAgeRange, calculateSeniority, getSeniorityRange } from '../../lib/hrUtils';
import { Filter, Users, UserCheck, BarChart3 } from 'lucide-react';

interface DeptStats {
    name: string;
    total: number;
    gender: { male: number; female: number; other: number };
    ageRanges: Record<string, number>;
    seniorityRanges: Record<string, number>;
    positions: Record<string, number>;
}

const StatisticsPage: React.FC = () => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);

    // 複合篩選狀態
    const [filters, setFilters] = useState({
        department: 'ALL',
        position: 'ALL',
        gender: 'ALL'
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
            const matchesDept = filters.department === 'ALL' || (e.department || '未分配') === filters.department;
            const matchesPos = filters.position === 'ALL' || (e.position || '未設定') === filters.position;
            const matchesGender = filters.gender === 'ALL' || (e.gender === filters.gender);
            return matchesDept && matchesPos && matchesGender;
        });

        const stats: DeptStats = {
            name: filters.department,
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

    if (loading) return <div className="p-12 text-center text-slate-500 font-black text-xl">數據分析中...</div>;

    return (
        <div className="space-y-8 pb-12">
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">人事統計報表</h1>
                <p className="text-slate-500 text-base font-medium">即時分析全會人力結構與分佈數據</p>
            </div>

            {/* 篩選工具列 */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-4">
                <div className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest px-1">
                    <Filter className="h-4 w-4" />
                    複合篩選
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <select
                        value={filters.department}
                        onChange={(e) => setFilters(prev => ({ ...prev, department: e.target.value }))}
                        className="block w-full pl-3 pr-10 py-2.5 border-slate-200 bg-slate-50/50 rounded-xl text-sm font-bold text-slate-700 focus:ring-blue-500 focus:border-blue-500 border transition-all"
                    >
                        <option value="ALL">全部部門</option>
                        {departments.filter(d => d !== 'ALL').map(dept => (
                            <option key={dept} value={dept}>{dept}</option>
                        ))}
                    </select>

                    <select
                        value={filters.position}
                        onChange={(e) => setFilters(prev => ({ ...prev, position: e.target.value }))}
                        className="block w-full pl-3 pr-10 py-2.5 border-slate-200 bg-slate-50/50 rounded-xl text-sm font-bold text-slate-700 focus:ring-blue-500 focus:border-blue-500 border transition-all"
                    >
                        <option value="ALL">全部職務</option>
                        {positions.filter(p => p !== 'ALL').map(pos => (
                            <option key={pos} value={pos}>{pos}</option>
                        ))}
                    </select>

                    <select
                        value={filters.gender}
                        onChange={(e) => setFilters(prev => ({ ...prev, gender: e.target.value }))}
                        className="block w-full pl-3 pr-10 py-2.5 border-slate-200 bg-slate-50/50 rounded-xl text-sm font-bold text-slate-700 focus:ring-blue-500 focus:border-blue-500 border transition-all"
                    >
                        {genders.map(g => (
                            <option key={g.value} value={g.value}>{g.label}</option>
                        ))}
                    </select>
                </div>
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

                {/* 職務結構細分 */}
                <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-8 border-l-4 border-blue-600 pl-4">職務結構細分</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
                        {Object.entries(currentStats.positions).sort((a, b) => b[1] - a[1]).map(([pos, count]) => (
                            <div key={pos} className="p-4 md:p-6 bg-slate-50/50 rounded-2xl border border-slate-100 text-center hover:bg-white hover:shadow-xl hover:scale-[1.02] transition-all duration-300">
                                <div className="text-[10px] font-black text-slate-400 mb-1 uppercase tracking-tight truncate">{pos}</div>
                                <div className="text-2xl md:text-3xl font-black text-slate-900 tabular-nums">{count}</div>
                                <div className="mt-2 inline-flex px-1.5 py-0.5 bg-blue-50 text-[9px] font-black text-blue-600 rounded uppercase tracking-widest border border-blue-100">
                                    佔 {Math.round(count / currentStats.total * 100)}%
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StatisticsPage;

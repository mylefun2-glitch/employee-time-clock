import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, UserCheck, Clock, AlertCircle } from 'lucide-react';
import { getDashboardStats, DashboardStats } from '../../services/admin';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { getCurrentUserEmployee } from '../../services/supervisorService';

const DashboardPage: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState<DashboardStats>({ totalEmployees: 0, activeEmployees: 0, todayAttendance: 0 });
    const [pendingStats, setPendingStats] = useState({
        leave: 0,
        makeup: 0,
        shift: 0,
        car: 0,
        resource: 0
    });
    const [currentEmployee, setCurrentEmployee] = useState<any>(null);
    const [employeeLoading, setEmployeeLoading] = useState(true);
    const [loading, setLoading] = useState(true);
    const [showChangelog, setShowChangelog] = useState(false);

    useEffect(() => {
        const loadEmployee = async () => {
            if (user?.email) {
                const emp = await getCurrentUserEmployee(user.email);
                setCurrentEmployee(emp);
            } else {
                setCurrentEmployee(null);
            }
            setEmployeeLoading(false);
        };
        loadEmployee();
    }, [user]);

    useEffect(() => {
        if (employeeLoading) return;

        const fetchData = async () => {
            try {
                let subIds: string[] = [];
                const isSuperAdmin = !currentEmployee;
                
                if (!isSuperAdmin && currentEmployee?.id) {
                    const { data: subordinates } = await supabase
                        .from('employees')
                        .select('id')
                        .eq('manager_id', currentEmployee.id);
                    subIds = (subordinates || []).map(s => s.id);
                }

                // 構建補登申請的 query
                let makeupQuery = supabase.from('makeup_attendance_requests').select('*', { count: 'exact', head: true }).eq('status', 'PENDING');
                if (!isSuperAdmin) {
                    if (subIds.length > 0) {
                        makeupQuery = makeupQuery.in('employee_id', subIds);
                    } else {
                        makeupQuery = makeupQuery.eq('employee_id', '00000000-0000-0000-0000-000000000000');
                    }
                }

                const [
                    statsData,
                    leaveRes,
                    makeupRes,
                    shiftRes,
                    carRes,
                    resourceRes
                ] = await Promise.all([
                    getDashboardStats(),
                    supabase.from('leave_requests').select('*', { count: 'exact', head: true }).in('status', ['PENDING', 'WITHDRAW_PENDING']),
                    makeupQuery,
                    supabase.from('shift_requests').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'),
                    supabase.from('car_usage_requests').select('*', { count: 'exact', head: true }).in('status', ['PENDING', 'WITHDRAW_PENDING']),
                    supabase.from('resource_requests').select('*', { count: 'exact', head: true }).eq('status', 'PENDING')
                ]);
                
                setStats(statsData);
                setPendingStats({
                    leave: leaveRes.count || 0,
                    makeup: makeupRes.count || 0,
                    shift: shiftRes.count || 0,
                    car: carRes.count || 0,
                    resource: resourceRes.count || 0
                });
            } catch (error) {
                console.error('Error fetching dashboard stats and pending approvals:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [user, currentEmployee, employeeLoading]);

    const totalPending = pendingStats.leave + pendingStats.makeup + pendingStats.shift + pendingStats.car + pendingStats.resource;

    const statCards = [
        { name: '總員工數', value: stats.totalEmployees, icon: Users, color: 'bg-blue-500' },
        { name: '在職員工', value: stats.activeEmployees, icon: UserCheck, color: 'bg-emerald-500' },
        { name: '今日打卡數', value: stats.todayAttendance, icon: Clock, color: 'bg-orange-500' },
        { name: '待審核申請', value: totalPending, icon: AlertCircle, color: 'bg-red-500', highlight: totalPending > 0 },
    ];

    const approvalCards = [
        {
            id: 'leave',
            name: '請假/出差審核',
            count: pendingStats.leave,
            icon: 'description',
            color: 'text-amber-600 bg-amber-50 hover:shadow-amber-100/50',
            path: '/admin/requests'
        },
        {
            id: 'makeup',
            name: '補登審核',
            count: pendingStats.makeup,
            icon: 'edit_calendar',
            color: 'text-blue-600 bg-blue-50 hover:shadow-blue-100/50',
            path: '/admin/makeup-requests'
        },
        {
            id: 'shift',
            name: '挪移審核',
            count: pendingStats.shift,
            icon: 'swap_calls',
            color: 'text-purple-600 bg-purple-50 hover:shadow-purple-100/50',
            path: '/admin/shift-requests'
        },
        {
            id: 'car',
            name: '公務車審核',
            count: pendingStats.car,
            icon: 'directions_car',
            color: 'text-emerald-600 bg-emerald-50 hover:shadow-emerald-100/50',
            path: '/admin/resource-manager',
            state: { activeTab: 'CAR_REQ' }
        },
        {
            id: 'resource',
            name: '公務資源審核',
            count: pendingStats.resource,
            icon: 'inventory_2',
            color: 'text-indigo-600 bg-indigo-50 hover:shadow-indigo-100/50',
            path: '/admin/resource-manager',
            state: { activeTab: 'RES_REQ' }
        }
    ];

    const handleCardClick = (card: any) => {
        if (card.state) {
            navigate(card.path, { state: card.state });
        } else {
            navigate(card.path);
        }
    };

    if (loading || employeeLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">管理儀表板</h1>
                    <p className="text-slate-500 font-medium">概覽系統狀態與近期營運數據。</p>
                </div>
                <div className="hidden sm:flex items-center gap-4">
                    {/* 版本更新紀錄按鈕 */}
                    <button
                        onClick={() => setShowChangelog(true)}
                        className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-100 text-slate-500 px-4 py-2.5 rounded-2xl text-xs font-black transition-all active:scale-95 cursor-pointer shadow-sm"
                    >
                        <span className="material-symbols-outlined text-sm">info</span>
                        v1.3.4
                    </button>
                    <div className="text-right">
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">最後更新時間</p>
                        <p className="text-sm font-bold text-slate-700">{new Date().toLocaleString('zh-TW')}</p>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {statCards.map((item) => (
                    <div
                        key={item.name}
                        className={`bg-white rounded-3xl p-6 border transition-all hover:shadow-lg hover:shadow-slate-100 ${item.highlight
                            ? 'border-red-200 bg-red-50/30'
                            : 'border-slate-100 shadow-sm'
                            }`}
                    >
                        <div className="flex items-center gap-4">
                            <div className={`${item.color} h-12 w-12 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-100`}>
                                <item.icon className="h-6 w-6 text-white" />
                            </div>
                            <div className="flex-1">
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{item.name}</p>
                                <div className="flex items-baseline gap-2">
                                    <p className="text-2xl font-black text-slate-900">{item.value}</p>
                                    {item.highlight && (
                                        <span className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-full font-bold animate-pulse">
                                            需處理
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* 各項待核准統計圖卡 */}
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">各項待核准統計</h3>
                    <span className="text-xs font-black text-blue-500 bg-blue-50 px-3 py-1.5 rounded-full uppercase tracking-wider">
                        系統即時更新
                    </span>
                </div>
                
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
                    {approvalCards.map((card) => (
                        <div
                            key={card.id}
                            onClick={() => handleCardClick(card)}
                            className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm transition-all duration-300 hover:shadow-xl hover:shadow-slate-100 hover:-translate-y-1 cursor-pointer flex flex-col items-center text-center justify-between group"
                        >
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-105 bg-slate-50 border border-slate-100 ${card.color.split(' ').slice(1).join(' ')}`}>
                                <span className={`material-symbols-outlined text-2xl font-bold ${card.color.split(' ')[0]}`}>
                                    {card.icon}
                                </span>
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-sm font-black text-slate-700">{card.name}</h4>
                                <p className="text-2xl font-black text-slate-900">{card.count}</p>
                            </div>
                            {card.count > 0 ? (
                                <span className="mt-4 px-3 py-1 bg-rose-50 text-rose-600 text-[10px] font-black rounded-full uppercase tracking-wider animate-pulse border border-rose-100">
                                    待處理
                                </span>
                            ) : (
                                <span className="mt-4 px-3 py-1 bg-slate-50 text-slate-400 text-[10px] font-bold rounded-full uppercase tracking-wider border border-slate-100">
                                    無待處理
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* 系統更新紀錄對話框 */}
            {showChangelog && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95 duration-300 relative max-h-[85vh] flex flex-col">
                        {/* 頂部 Header */}
                        <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                                    <span className="material-symbols-outlined text-xl">history</span>
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-900">系統更新紀錄</h2>
                                    <p className="text-xs text-slate-400 font-bold">查看 YAcc 平台的版本迭代歷程</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowChangelog(false)}
                                className="w-8 h-8 rounded-full hover:bg-slate-50 text-slate-400 flex items-center justify-center transition-colors"
                            >
                                <span className="material-symbols-outlined text-lg">close</span>
                            </button>
                        </div>

                        {/* 更新歷史時間軸內容 */}
                        <div className="flex-1 overflow-y-auto py-6 pr-2 space-y-8 scrollbar-thin">
                            {/* v1.3.4 */}
                            <div className="relative pl-6 border-l-2 border-blue-500/20 last:border-l-0">
                                <span className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-blue-500 border-2 border-white ring-4 ring-blue-50"></span>
                                <div className="space-y-2">
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-sm font-black text-slate-900">v1.3.4</span>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">2026-06-10</span>
                                    </div>
                                    <ul className="text-xs text-slate-500 font-bold space-y-1.5 list-disc pl-4 leading-relaxed">
                                        <li>📝 <b>薪資單明細與備註強化</b>：月薪制人員薪資條正式列出「請假扣薪計算公式」（底薪+固定加給/30/8×請假時數）及實際扣薪精算詳情。</li>
                                        <li>💬 <b>手動調整原因完整呈現</b>：薪資條與 PDF 薪資單會自動呈現調整津貼、扣除、補發與獎金時所填寫的備註說明。</li>
                                        <li>🎨 <b>PDF 跨平台字型加載修復</b>：優化 PDF 字型載入機制，採多重自動回退（Songti、Heiti、Arial Unicode）以避免部分環境下字型缺失導致編譯崩潰。</li>
                                    </ul>
                                </div>
                            </div>

                            {/* v1.3.3 */}
                            <div className="relative pl-6 border-l-2 border-blue-500/20 last:border-l-0">
                                <span className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-slate-300 border-2 border-white ring-4 ring-slate-50"></span>
                                <div className="space-y-2">
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-sm font-black text-slate-900">v1.3.3</span>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">2026-06-10</span>
                                    </div>
                                    <ul className="text-xs text-slate-500 font-bold space-y-1.5 list-disc pl-4 leading-relaxed">
                                        <li>🏦 <b>薪資系統直連 Supabase</b>：廢除薪資後端本地 SQLite，直接將薪資數據儲存於 Supabase 資料庫，優化網路延遲與冷啟動。</li>
                                        <li>🔒 <b>資料庫架構安全隔離</b>：利用專屬的 <code>payroll</code> schema 命名空間隔離薪資表，保障主系統 <code>public</code> 核心表不受更動影響。</li>
                                        <li>🔄 <b>修復員工銀行資料同步</b>：修正同步欄位漏洞，保證主系統更新的銀行名稱與帳號資訊能即時、完整地同步至薪資管理系統。</li>
                                    </ul>
                                </div>
                            </div>

                            {/* v1.3.2 */}
                            <div className="relative pl-6 border-l-2 border-blue-500/20 last:border-l-0">
                                <span className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-slate-300 border-2 border-white ring-4 ring-slate-50"></span>
                                <div className="space-y-2">
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-sm font-black text-slate-900">v1.3.2</span>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">2026-06-02</span>
                                    </div>
                                    <ul className="text-xs text-slate-500 font-bold space-y-1.5 list-disc pl-4 leading-relaxed">
                                        <li>📊 <b>介面大改版</b>：今日部門動態、最近申請動態重構為精美表格，新增前置個人 icon 與假別背景色塊。</li>
                                        <li>📑 <b>極簡分頁功能</b>：為兩大動態表格實裝前端分頁（每頁 5 筆），總頁數 &gt; 1 時自動顯示分頁器。</li>
                                        <li>⏳ <b>智慧時間格式</b>：同日請假自動簡化，並顯示精算請假時數（如：共1.3H）。</li>
                                        <li>👑 <b>主任級差勤規則</b>：天數 &lt; 5 日自動核准，&gt;= 5 日直簽理事長林文明審批。</li>
                                        <li>🧹 <b>版面細節優化</b>：移除今日部門動態中多餘重複的「部門」欄位，提升頁面極簡美感。</li>
                                    </ul>
                                </div>
                            </div>

                            {/* v1.2.0 */}
                            <div className="relative pl-6 border-l-2 border-blue-500/20 last:border-l-0">
                                <span className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-slate-300 border-2 border-white ring-4 ring-slate-50"></span>
                                <div className="space-y-2">
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-sm font-bold text-slate-800">v1.2.0</span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">2026-05-09</span>
                                    </div>
                                    <ul className="text-xs text-slate-500 font-medium space-y-1.5 list-disc pl-4 leading-relaxed">
                                        <li>🛠 <b>加班時數異常修正</b>：解決日曆介面與資料庫（Supabase）因非同步更新導致加班時數顯示不一致的問題。</li>
                                    </ul>
                                </div>
                            </div>

                            {/* v1.1.0 */}
                            <div className="relative pl-6 border-l-2 border-blue-500/20 last:border-l-0">
                                <span className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-slate-300 border-2 border-white ring-4 ring-slate-50"></span>
                                <div className="space-y-2">
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-sm font-bold text-slate-800">v1.1.0</span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">2026-01-18</span>
                                    </div>
                                    <ul className="text-xs text-slate-500 font-medium space-y-1.5 list-disc pl-4 leading-relaxed">
                                        <li>👥 <b>多層級審核</b>：新增多層級審核機制，支援「普通主管 ➡️ 理事長」的流暢行政簽核。</li>
                                    </ul>
                                </div>
                            </div>

                            {/* v1.0.0 */}
                            <div className="relative pl-6 border-l-2 border-blue-500/20 last:border-l-0">
                                <span className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-slate-300 border-2 border-white ring-4 ring-slate-50"></span>
                                <div className="space-y-2">
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-sm font-bold text-slate-800">v1.0.0</span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">2026-01-01</span>
                                    </div>
                                    <ul className="text-xs text-slate-500 font-medium space-y-1.5 list-disc pl-4 leading-relaxed">
                                        <li>🚀 <b>服務上線</b>：YAcc 員工服務打卡與差勤系統正式發布，啟用行動GPS打卡、補卡與請假模組。</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* 底部按鈕 */}
                        <div className="pt-4 border-t border-slate-100 shrink-0">
                            <button
                                onClick={() => setShowChangelog(false)}
                                className="w-full py-3.5 bg-slate-900 text-white rounded-2xl font-black text-sm transition-all hover:bg-slate-800 active:scale-[0.98]"
                            >
                                關閉更新紀錄
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DashboardPage;

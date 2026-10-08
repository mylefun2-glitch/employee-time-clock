import React from 'react';
import { Outlet, Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

type NavItem = { path: string; icon: string; label: string; isExternal?: boolean };

const navGroups: { label: string; icon: string; items: NavItem[] }[] = [
    { label: '人員與出勤', icon: 'groups', items: [
        { path: '/admin/employees', icon: 'badge', label: '員工管理' },
        { path: '/admin/attendance-calendar', icon: 'calendar_month', label: '出勤月曆' },
        { path: '/admin/important-activities', icon: 'event', label: '共同活動' }
    ] },
    { label: '申請與審核', icon: 'fact_check', items: [
        { path: '/admin/requests', icon: 'assignment', label: '差勤／公務車' },
        { path: '/admin/makeup-requests', icon: 'edit_calendar', label: '補登審核' },
        { path: '/admin/shift-requests', icon: 'swap_calls', label: '挪移審核' }
    ] },
    { label: '統計報表', icon: 'bar_chart', items: [
        { path: '/admin/stats', icon: 'monitoring', label: '人事統計' },
        { path: '/admin/leave-stats', icon: 'pie_chart', label: '差勤統計' }
    ] },
    { label: '資源與設定', icon: 'settings', items: [
        { path: '/admin/resource-manager', icon: 'inventory_2', label: '公務資源管理' },
        { path: '/admin/settings', icon: 'tune', label: '系統設定' }
    ] }
];

const matchesPath = (pathname: string, path: string) =>
    pathname === path || pathname.startsWith(`${path}/`);

const AdminLayout: React.FC = () => {
    const { user, loading } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
    const [isCollapsed, setIsCollapsed] = React.useState(false);
    const activeGroup = navGroups.find(group => group.items.some(item => matchesPath(location.pathname, item.path)))?.label;
    const [openGroup, setOpenGroup] = React.useState<string | null>(activeGroup || null);

    // Close menu when route changes
    React.useEffect(() => {
        setIsMobileMenuOpen(false);
        if (activeGroup) setOpenGroup(activeGroup);
    }, [location.pathname]);

    // Show loading state
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-slate-600">載入中...</p>
                </div>
            </div>
        );
    }

    // Redirect to login if not authenticated
    if (!user) {
        return <Navigate to="/admin/login" replace />;
    }

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/admin/login');
    };

    const payrollUrl = (import.meta as any).env.VITE_PAYROLL_URL || (import.meta.env.DEV ? 'http://localhost:3001' : '/payroll/');

    const renderNavItem = (item: NavItem, nested = false) => {
        const isSelected = !item.isExternal && matchesPath(location.pathname, item.path);
        const className = `flex items-center gap-3 rounded-xl font-bold transition-colors ${nested ? 'py-2.5 text-sm' : 'py-3'} ${
            isSelected ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
        } ${isCollapsed ? 'lg:justify-center lg:px-0 px-4' : 'px-4'}`;
        const content = <>
            <span className="material-symbols-outlined text-xl" aria-hidden="true">{item.icon}</span>
            <span className={isCollapsed ? 'lg:hidden' : ''}>{item.label}</span>
        </>;
        return item.isExternal ? (
            <a key={item.path} href={item.path} target="_blank" rel="noopener noreferrer" className={className} title={isCollapsed ? item.label : undefined}>{content}</a>
        ) : (
            <Link key={item.path} to={item.path} className={className} aria-current={isSelected ? 'page' : undefined} title={isCollapsed ? item.label : undefined}>{content}</Link>
        );
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
            {/* Mobile Header */}
            <header className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-50 print:hidden">
                <div className="flex items-center gap-3">
                    <img src="/logo.jpg" alt="Y'ACC" className="h-8 w-auto" />
                    <span className="text-sm font-black text-slate-700 tracking-tight">管理後台</span>
                </div>
                <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="p-2 rounded-lg text-slate-500 hover:bg-slate-50"
                >
                    <span className="material-symbols-outlined">{isMobileMenuOpen ? 'close' : 'menu'}</span>
                </button>
            </header>

            {/* Sidebar / Mobile Overlay */}
            <div className={`
                fixed inset-0 z-40 lg:relative lg:z-0
                ${isMobileMenuOpen ? 'visible' : 'invisible lg:visible'}
                print:hidden
            `}>
                {/* Backdrop */}
                <div
                    className={`absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${isMobileMenuOpen ? 'opacity-100' : 'opacity-0'}`}
                    onClick={() => setIsMobileMenuOpen(false)}
                />

                {/* Sidebar Content */}
                <aside className={`
                    absolute left-0 top-0 bottom-0 bg-white border-r border-slate-200 flex flex-col transform transition-all duration-300 ease-in-out shrink-0
                    ${isMobileMenuOpen ? 'translate-x-0 w-72' : '-translate-x-full lg:translate-x-0'}
                    ${isCollapsed ? 'lg:w-20' : 'lg:w-64'}
                    lg:static
                `}>
                    <div className={`p-6 border-b border-slate-100 hidden lg:flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
                        <div className={`flex flex-col items-center gap-2 ${isCollapsed ? 'hidden' : 'flex'}`}>
                            <img src="/logo.jpg" alt="Y'ACC Logo" className="h-16 w-auto object-contain" />
                            <span className="text-primary font-black text-xs tracking-[0.2em] uppercase whitespace-nowrap">管理後台系統</span>
                        </div>
                        <button
                            onClick={() => setIsCollapsed(!isCollapsed)}
                            className={`p-2 rounded-xl text-slate-400 hover:bg-slate-50 transition-all ${isCollapsed ? '' : 'ml-auto'}`}
                            title={isCollapsed ? '展開側邊欄' : '縮小側邊欄'}
                        >
                            <span className="material-symbols-outlined text-xl">
                                {isCollapsed ? 'last_page' : 'first_page'}
                            </span>
                        </button>
                    </div>

                    <nav className="flex-1 p-4 space-y-1 overflow-y-auto" aria-label="管理後台選單">
                        {renderNavItem({ path: '/admin/dashboard', icon: 'dashboard', label: '儀表板' })}
                        {navGroups.map(group => {
                            const isOpen = openGroup === group.label;
                            const containsActive = activeGroup === group.label;
                            return (
                                <div key={group.label}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (isCollapsed) setIsCollapsed(false);
                                            setOpenGroup(isOpen && !isCollapsed ? null : group.label);
                                        }}
                                        aria-expanded={isOpen && (!isCollapsed || isMobileMenuOpen)}
                                        title={isCollapsed ? group.label : undefined}
                                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${containsActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'} ${isCollapsed ? 'lg:justify-center lg:px-0' : ''}`}
                                    >
                                        <span className="material-symbols-outlined text-xl" aria-hidden="true">{group.icon}</span>
                                        <span className={`flex-1 text-left whitespace-nowrap ${isCollapsed ? 'lg:hidden' : ''}`}>{group.label}</span>
                                        <span className={`material-symbols-outlined text-lg ${isCollapsed ? 'lg:hidden' : ''}`} aria-hidden="true">{isOpen ? 'expand_less' : 'expand_more'}</span>
                                    </button>
                                    {isOpen && (!isCollapsed || isMobileMenuOpen) && (
                                        <div id={`admin-nav-${group.icon}`} className="ml-5 pl-2 border-l border-slate-200 mt-1 mb-2 space-y-0.5">
                                            {group.items.map(item => renderNavItem(item, true))}
                                            {group.label === '資源與設定' && renderNavItem({ path: payrollUrl, icon: 'payments', label: '薪資系統', isExternal: true }, true)}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </nav>

                    <div className="p-4 border-t border-slate-100 flex flex-col gap-1 bg-slate-50/50">
                        <div className={`px-4 py-3 mb-2 bg-white rounded-xl border border-slate-100 ${isCollapsed ? 'hidden' : 'block'}`}>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">登入帳號</p>
                            <p className="text-xs font-bold text-slate-600 truncate">{user?.email}</p>
                        </div>
                        <button
                            onClick={() => navigate('/')}
                            className={`w-full flex items-center gap-3 py-3 text-blue-600 hover:bg-blue-50 rounded-xl font-bold transition-all text-sm ${isCollapsed ? 'justify-center px-0' : 'px-4'}`}
                            title={isCollapsed ? '返回打卡系統' : ''}
                        >
                            <span className="material-symbols-outlined text-xl">grid_view</span>
                            {!isCollapsed && <span>返回打卡系統</span>}
                        </button>
                        <button
                            onClick={handleLogout}
                            className={`w-full flex items-center gap-3 py-3 text-rose-500 hover:bg-rose-50 rounded-xl font-bold transition-all text-sm ${isCollapsed ? 'justify-center px-0' : 'px-4'}`}
                            title={isCollapsed ? '登出系統' : ''}
                        >
                            <span className="material-symbols-outlined text-xl">logout</span>
                            {!isCollapsed && <span>登出系統</span>}
                        </button>
                    </div>
                </aside>
            </div>

            {/* Main Content */}
            <main className="flex-1 overflow-x-hidden print:overflow-visible">
                <div className="p-4 md:p-8 w-full mx-auto print:p-0 print:max-w-none">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default AdminLayout;

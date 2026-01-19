import React from 'react';
import { Outlet, Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const AdminLayout: React.FC = () => {
    const { user, loading } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

    // Close menu when route changes
    React.useEffect(() => {
        setIsMobileMenuOpen(false);
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

    const navItems = [
        { path: '/admin/dashboard', icon: 'dashboard', label: '儀表板' },
        { path: '/admin/employees', icon: 'groups', label: '員工管理' },
        { path: '/admin/stats', icon: 'bar_chart', label: '人事統計' },
        { path: '/admin/attendance', icon: 'event_note', label: '考勤記錄' },
        { path: '/admin/makeup-requests', icon: 'edit_calendar', label: '補登審核' },
        { path: '/admin/requests', icon: 'description', label: '請假申請' },
        { path: '/admin/leave-types', icon: 'category', label: '差勤類型' },
        { path: '/admin/company', icon: 'business', label: '公司管理' }
    ];

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
            {/* Mobile Header */}
            <header className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
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
            `}>
                {/* Backdrop */}
                <div
                    className={`absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${isMobileMenuOpen ? 'opacity-100' : 'opacity-0'}`}
                    onClick={() => setIsMobileMenuOpen(false)}
                />

                {/* Sidebar Content */}
                <aside className={`
                    absolute left-0 top-0 bottom-0 w-72 bg-white border-r border-slate-200 flex flex-col transform transition-transform duration-300 ease-in-out
                    ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                    lg:w-64 lg:static
                `}>
                    <div className="p-6 border-b border-slate-100 hidden lg:flex items-center justify-center">
                        <div className="flex flex-col items-center gap-2">
                            <img src="/logo.jpg" alt="Y'ACC Logo" className="h-16 w-auto object-contain" />
                            <span className="text-primary font-black text-xs tracking-[0.2em] uppercase">管理後台系統</span>
                        </div>
                    </div>

                    <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                        {navItems.map((item) => (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${location.pathname.startsWith(item.path)
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-100'
                                    : 'text-slate-500 hover:bg-slate-50'
                                    }`}
                            >
                                <span className="material-symbols-outlined text-xl">{item.icon}</span>
                                {item.label}
                            </Link>
                        ))}
                    </nav>

                    <div className="p-4 border-t border-slate-100 flex flex-col gap-1 bg-slate-50/50">
                        <div className="px-4 py-3 mb-2 bg-white rounded-xl border border-slate-100">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">登入帳號</p>
                            <p className="text-xs font-bold text-slate-600 truncate">{user?.email}</p>
                        </div>
                        <button
                            onClick={() => navigate('/')}
                            className="w-full flex items-center gap-3 px-4 py-3 text-blue-600 hover:bg-blue-50 rounded-xl font-bold transition-all text-sm"
                        >
                            <span className="material-symbols-outlined text-xl">grid_view</span>
                            返回打卡系統
                        </button>
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-4 py-3 text-rose-500 hover:bg-rose-50 rounded-xl font-bold transition-all text-sm"
                        >
                            <span className="material-symbols-outlined text-xl">logout</span>
                            登出系統
                        </button>
                    </div>
                </aside>
            </div>

            {/* Main Content */}
            <main className="flex-1 overflow-x-hidden">
                <div className="p-4 md:p-8 max-w-7xl mx-auto">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default AdminLayout;

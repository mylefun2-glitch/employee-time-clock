import React from 'react';
import { Outlet, Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const AdminLayout: React.FC = () => {
    const { user, loading } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

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
        { path: '/admin/requests', icon: 'description', label: '請假申請' },
        { path: '/admin/leave-types', icon: 'category', label: '差勤類型' },
        { path: '/admin/company', icon: 'business', label: '公司管理' }
    ];

    return (
        <div className="min-h-screen bg-slate-50 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
                <div className="p-6 border-b border-slate-100 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-2">
                        <img src="/logo.jpg" alt="Y'ACC Logo" className="h-16 w-auto object-contain" />
                        <span className="text-primary font-black text-xs tracking-[0.2em] uppercase">管理後台系統</span>
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-1">
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${location.pathname.startsWith(item.path)
                                ? 'bg-blue-50 text-blue-600'
                                : 'text-slate-500 hover:bg-slate-50'
                                }`}
                        >
                            <span className="material-symbols-outlined">{item.icon}</span>
                            {item.label}
                        </Link>
                    ))}
                </nav>

                <div className="p-4 border-t border-slate-100 flex flex-col gap-1">
                    <div className="px-4 py-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">登入帳號</p>
                        <p className="text-xs font-bold text-slate-600 truncate">{user?.email}</p>
                    </div>
                    <button
                        onClick={() => navigate('/')}
                        className="w-full flex items-center gap-3 px-4 py-3 text-blue-600 hover:bg-blue-50 rounded-xl font-bold transition-all"
                    >
                        <span className="material-symbols-outlined">grid_view</span>
                        返回打卡系統
                    </button>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 text-rose-500 hover:bg-rose-50 rounded-xl font-medium transition-all"
                    >
                        <span className="material-symbols-outlined">logout</span>
                        登出系統
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto">
                <div className="p-8">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default AdminLayout;

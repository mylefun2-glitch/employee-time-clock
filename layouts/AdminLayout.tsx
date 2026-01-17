import React, { useState } from 'react';
import { Outlet, Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LayoutDashboard, Users, History, LogOut, Menu, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { clsx } from 'clsx';

const AdminLayout: React.FC = () => {
    const { user, loading, signOut } = useAuth();
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-slate-50">Loading...</div>;
    }

    if (!user) {
        return <Navigate to="/admin/login" replace />;
    }

    const navigation = [
        { name: '儀表板', href: '/admin/dashboard', icon: LayoutDashboard },
        { name: '員工管理', href: '/admin/employees', icon: Users },
        { name: '出勤紀錄', href: '/admin/attendance', icon: History },
    ];

    return (
        <div className="min-h-screen bg-slate-50 flex">
            {/* Mobile sidebar overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-slate-900/50 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={cn(
                "fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0",
                isSidebarOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <div className="flex items-center justify-between h-16 px-4 bg-slate-950 border-b border-white/10">
                    <span className="text-xl font-bold tracking-tight">Admin Console</span>
                    <button
                        onClick={() => setIsSidebarOpen(false)}
                        className="p-1 rounded-md hover:bg-white/10 md:hidden"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <nav className="p-4 space-y-1">
                    {navigation.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname.startsWith(item.href);
                        return (
                            <Link
                                key={item.name}
                                to={item.href}
                                onClick={() => setIsSidebarOpen(false)}
                                className={clsx(
                                    "flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                                    isActive
                                        ? "bg-blue-600 text-white"
                                        : "text-slate-400 hover:text-white hover:bg-white/10"
                                )}
                            >
                                <Icon className="w-5 h-5 mr-3" />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>

                <div className="absolute bottom-0 w-full p-4 border-t border-white/10 bg-slate-950">
                    <div className="flex items-center gap-3 mb-4 px-2">
                        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold">
                            {user.email?.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{user.email}</p>
                            <p className="text-xs text-slate-500">Administrator</p>
                        </div>
                    </div>
                    <button
                        onClick={signOut}
                        className="w-full flex items-center px-3 py-2 text-sm font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors"
                    >
                        <LogOut className="w-5 h-5 mr-3" />
                        登出
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Mobile Header */}
                <header className="md:hidden bg-white border-b border-slate-200 h-16 flex items-center px-4">
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="p-2 -ml-2 rounded-md hover:bg-slate-100"
                    >
                        <Menu className="w-6 h-6 text-slate-600" />
                    </button>
                    <span className="ml-3 text-lg font-semibold text-slate-900">後台管理</span>
                </header>

                <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default AdminLayout;

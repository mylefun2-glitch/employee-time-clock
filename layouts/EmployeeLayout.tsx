import React from 'react';
import { Outlet, Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useEmployee } from '../contexts/EmployeeContext';

const EmployeeLayout: React.FC = () => {
    const { employee, loading, logout } = useEmployee();
    const navigate = useNavigate();
    const location = useLocation();

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

    if (!employee) {
        return <Navigate to="/employee/login" replace />;
    }

    const handleLogout = () => {
        logout();
        navigate('/employee/login');
    };

    const navItems = [
        { path: '/employee/dashboard', icon: 'dashboard', label: '首頁' },
        { path: '/employee/profile', icon: 'person', label: '個人資訊' },
        { path: '/employee/requests', icon: 'description', label: '申請記錄' },
        { path: '/employee/attendance', icon: 'event_note', label: '差勤統計' },
    ];

    // 主管額外選單 - 顯示請假審核
    if (employee.is_supervisor) {
        navItems.push({ path: '/employee/approvals', icon: 'rule', label: '請假審核' });
    }

    // 所有員工都可以看到補登審核（如果有下屬的話，會在頁面內判斷）
    navItems.push({ path: '/employee/makeup-approvals', icon: 'edit_calendar', label: '補登審核' });

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col sm:flex-row">
            {/* Sidebar (桌面版) */}
            <aside className="hidden sm:flex w-56 bg-white border-r border-slate-200 flex-col fixed inset-y-0 shadow-sm">
                <div className="p-4 border-b border-slate-100 flex flex-col items-center gap-2">
                    <img src="/logo.jpg" alt="Logo" className="h-14 w-auto object-contain" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">員工服務平台</span>
                </div>

                <div className="p-6 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-100">
                            <span className="text-white font-bold text-lg">
                                {employee.name.charAt(0)}
                            </span>
                        </div>
                        <div className="overflow-hidden">
                            <h1 className="text-sm font-bold text-slate-900 truncate">{employee.name}</h1>
                            <p className="text-xs text-slate-500 truncate">{employee.department}</p>
                        </div>
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

                <div className="p-4 border-t border-slate-100 flex flex-col gap-2">
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

            {/* 手機版頂部導航 */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-10 sm:hidden">
                <div className="px-4 h-16 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
                            {employee.name.charAt(0)}
                        </div>
                        <span className="font-bold text-slate-900">員工平台</span>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="p-2 text-rose-500"
                    >
                        <span className="material-symbols-outlined">logout</span>
                    </button>
                </div>
            </header>

            {/* 主要內容 */}
            <main className="flex-1 sm:ml-56 pb-20 sm:pb-0 min-h-screen">
                <div className="p-6 lg:p-8 max-w-7xl mx-auto">
                    <Outlet />
                </div>
            </main>

            {/* 底部導航 (手機版) */}
            <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 sm:hidden z-20 flex justify-around">
                {navItems.map((item) => (
                    <Link
                        key={item.path}
                        to={item.path}
                        className={`flex flex-col items-center justify-center py-2 px-1 flex-1 ${location.pathname.startsWith(item.path)
                            ? 'text-blue-600'
                            : 'text-slate-400'
                            }`}
                    >
                        <span className="material-symbols-outlined text-2xl">{item.icon}</span>
                        <span className="text-[10px] mt-0.5 font-medium">{item.label}</span>
                    </Link>
                ))}
            </nav>
        </div>
    );
};

export default EmployeeLayout;


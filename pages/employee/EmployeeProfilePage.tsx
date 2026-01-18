import React from 'react';
import { useEmployee } from '../../contexts/EmployeeContext';

const EmployeeProfilePage: React.FC = () => {
    const { employee } = useEmployee();

    if (!employee) return null;

    const infoItems = [
        { label: '姓名', value: employee.name, icon: 'person' },
        { label: '部門', value: employee.department || '未分配', icon: 'business' },
        { label: 'Email', value: employee.email || '未設定', icon: 'mail' },
        { label: '到職日期', value: employee.hire_date ? new Date(employee.hire_date).toLocaleDateString('zh-TW') : '未設定', icon: 'calendar_today' },
    ];

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-slate-900">個人資訊</h1>

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="px-8 py-10 bg-gradient-to-br from-blue-600 to-blue-700 relative">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <span className="material-symbols-outlined text-white text-9xl">person</span>
                    </div>
                    <div className="flex items-center gap-6 relative z-10">
                        <div className="w-24 h-24 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30 shadow-xl">
                            <span className="text-4xl font-bold text-white uppercase">
                                {employee.name.charAt(0)}
                            </span>
                        </div>
                        <div className="text-white">
                            <h2 className="text-3xl font-bold tracking-tight">{employee.name}</h2>
                            <p className="text-blue-100 mt-1 font-medium">{employee.department}</p>
                        </div>
                    </div>
                </div>

                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {infoItems.map((item) => (
                        <div key={item.label} className="flex items-center gap-4 p-4 rounded-xl border border-slate-50 hover:bg-slate-50 transition-colors bg-white">
                            <div className="flex-shrink-0 w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center shadow-sm">
                                <span className="material-symbols-outlined text-blue-600 text-2xl">{item.icon}</span>
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{item.label}</p>
                                <p className="text-base font-bold text-slate-900 truncate">{item.value}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default EmployeeProfilePage;


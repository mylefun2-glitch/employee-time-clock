import React from 'react';
import { useEmployee } from '../../contexts/EmployeeContext';
import MovementHistory from '../../components/admin/MovementHistory';
import { calculateAge, calculateSeniority } from '../../lib/hrUtils';

const EmployeeProfilePage: React.FC = () => {
    const { employee } = useEmployee();

    if (!employee) return null;

    const seniority = employee.join_date ? calculateSeniority(employee.join_date) : 0;
    const age = employee.birth_date ? calculateAge(employee.birth_date) : 0;

    const infoSections = [
        {
            title: '基本與聯繫',
            items: [
                { label: '姓名', value: employee.name, icon: 'person' },
                { label: '部門', value: employee.department || '未分配', icon: 'business' },
                { label: '職務', value: employee.position || '未設定', icon: 'badge' },
                { label: '手機/電話', value: employee.contact_phone || '未設定', icon: 'smartphone' },
                { label: 'Gmail', value: employee.gmail || '未設定', icon: 'mail' },
                { label: '通訊地址', value: employee.mailing_address || '未設定', icon: 'home_pin' },
            ]
        },
        {
            title: '個人與工作資訊',
            items: [
                { label: '性別', value: employee.gender === 'MALE' ? '男' : employee.gender === 'FEMALE' ? '女' : '其他', icon: 'wc' },
                { label: '出生日期', value: employee.birth_date || '未設定', icon: 'cake' },
                { label: '年齡', value: age > 0 ? `${age} 歲` : '未設定', icon: 'clinical_notes' },
                { label: '到職日期', value: employee.join_date || '未設定', icon: 'calendar_today' },
                { label: '目前年資', value: `${seniority} 年`, icon: 'hourglass_empty' },
            ]
        },
        {
            title: '保險與緊急聯絡',
            items: [
                { label: '加保日期', value: employee.insurance_start_date || '未設定', icon: 'verified_user' },
                { label: '緊急連絡人', value: employee.emergency_contact_name || '未設定', icon: 'contact_emergency' },
                { label: '聯絡人關係', value: employee.emergency_contact_relationship || '未設定', icon: 'family_history' },
                { label: '緊急電話', value: employee.emergency_contact_phone || '未設定', icon: 'call' },
            ]
        }
    ];

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">個人檔案</h1>
                <img src="/logo.jpg" alt="Logo" className="h-10 w-auto opacity-50 grayscale hover:grayscale-0 transition-all" />
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                {/* Header Banner */}
                <div className="px-8 py-10 bg-gradient-to-br from-blue-600 to-blue-800 relative overflow-hidden">
                    <div className="absolute -right-10 -bottom-10 opacity-10">
                        <span className="material-symbols-outlined text-white text-[200px] rotate-12">person</span>
                    </div>
                    <div className="flex items-center gap-6 relative z-10">
                        <div className="w-24 h-24 bg-white/20 backdrop-blur-xl rounded-3xl flex items-center justify-center border border-white/30 shadow-2xl">
                            <span className="text-4xl font-black text-white hover:scale-110 transition-transform cursor-default">
                                {employee.name.charAt(0)}
                            </span>
                        </div>
                        <div className="text-white">
                            <div className="flex items-center gap-3">
                                <h2 className="text-3xl font-black tracking-tight">{employee.name}</h2>
                                <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest border border-white/20">
                                    {employee.position || '成員'}
                                </span>
                            </div>
                            <p className="text-blue-100/80 mt-1 font-bold flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm">business</span>
                                {employee.department}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Info Grid */}
                <div className="p-8 space-y-10">
                    {infoSections.map((section) => (
                        <div key={section.title} className="space-y-4">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-50 pb-2">{section.title}</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {section.items.map((item) => (
                                    <div key={item.label} className="group flex items-center gap-4 transition-all">
                                        <div className="flex-shrink-0 w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100 group-hover:bg-blue-50 group-hover:border-blue-100 transition-colors">
                                            <span className="material-symbols-outlined text-slate-400 group-hover:text-blue-600 text-xl transition-colors">{item.icon}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">{item.label}</p>
                                            <p className="text-sm font-bold text-slate-800 truncate">{item.value}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Movement History Section */}
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                <MovementHistory employeeId={employee.id} isAdmin={false} />
            </div>
        </div>
    );
};

export default EmployeeProfilePage;

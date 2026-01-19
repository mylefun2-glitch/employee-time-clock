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
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">個人檔案</h1>
                    <p className="text-slate-500 text-sm font-medium mt-1">檢視並管理您的個人詳細資訊與職務資料。</p>
                </div>
            </div>

            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                {/* Header Banner */}
                <div className="px-10 py-12 bg-gradient-to-br from-blue-600 to-indigo-700 relative overflow-hidden">
                    <div className="absolute right-0 top-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
                    <div className="absolute left-1/2 bottom-0 w-96 h-32 bg-blue-400/20 rounded-full -translate-x-1/2 blur-3xl"></div>

                    <div className="absolute -right-6 -bottom-6 opacity-10">
                        <span className="material-symbols-outlined text-white text-[180px] rotate-12 select-none">account_circle</span>
                    </div>

                    <div className="flex flex-col md:flex-row items-center md:items-end gap-8 relative z-10 text-center md:text-left">
                        <div className="w-28 h-28 bg-white/20 backdrop-blur-2xl rounded-[2rem] flex items-center justify-center border border-white/30 shadow-2xl transform hover:rotate-3 transition-transform duration-500">
                            <span className="text-5xl font-black text-white cursor-default select-none">
                                {employee.name.charAt(0)}
                            </span>
                        </div>
                        <div className="text-white pb-2">
                            <div className="flex flex-col md:flex-row items-center gap-3">
                                <h2 className="text-4xl font-black tracking-tight">{employee.name}</h2>
                                <div className="px-4 py-1.5 bg-white/20 backdrop-blur-md rounded-xl text-[11px] font-black uppercase tracking-[0.2em] border border-white/20 shadow-sm">
                                    {employee.position || '成員'}
                                </div>
                            </div>
                            <div className="flex flex-wrap justify-center md:justify-start items-center gap-4 mt-3 text-blue-100/90 font-bold">
                                <span className="flex items-center gap-2 text-sm">
                                    <span className="material-symbols-outlined text-lg">business</span>
                                    {employee.department || '未分配部門'}
                                </span>
                                <div className="w-1 h-1 rounded-full bg-blue-300 hidden md:block"></div>
                                <span className="flex items-center gap-2 text-sm">
                                    <span className="material-symbols-outlined text-lg">verified</span>
                                    {employee.is_active ? '在職中' : '已離職'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Info Grid */}
                <div className="p-10 space-y-12 bg-slate-50/30">
                    {infoSections.map((section) => (
                        <div key={section.title} className="space-y-6">
                            <div className="flex items-center gap-3">
                                <div className="w-1 h-4 bg-blue-600 rounded-full"></div>
                                <h3 className="text-xs font-black text-slate-800 uppercase tracking-[0.2em]">{section.title}</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {section.items.map((item) => (
                                    <div key={item.label} className="group flex flex-col p-5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all duration-300">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 border border-blue-100/50">
                                                <span className="material-symbols-outlined text-xl">{item.icon}</span>
                                            </div>
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.label}</span>
                                        </div>
                                        <div className="pl-1">
                                            <p className="text-base font-bold text-slate-900 break-words line-clamp-2" title={item.value}>
                                                {item.value || (
                                                    <span className="text-slate-300 font-medium">未設定</span>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Movement History Section - Optional styling */}
            <div className="bg-white p-10 rounded-[2rem] border border-slate-100 shadow-sm">
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-1 h-4 bg-blue-600 rounded-full"></div>
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-[0.2em]">職務異動歷史</h3>
                </div>
                <MovementHistory employeeId={employee.id} isAdmin={false} />
            </div>
        </div>
    );
};

export default EmployeeProfilePage;

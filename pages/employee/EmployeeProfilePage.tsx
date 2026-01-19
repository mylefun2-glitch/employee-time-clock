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
                {/* Simple Header */}
                <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/30">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-lg">
                            <span className="text-2xl font-black text-white">
                                {employee.name.charAt(0)}
                            </span>
                        </div>
                        <div className="flex-1">
                            <h2 className="text-2xl font-black text-slate-900">{employee.name}</h2>
                            <div className="flex items-center gap-3 mt-1.5 text-sm text-slate-600 font-bold">
                                <span className="flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-base">business</span>
                                    {employee.department || '未分配部門'}
                                </span>
                                <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                                <span className="flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-base">badge</span>
                                    {employee.position || '成員'}
                                </span>
                                <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                                <span className={`flex items-center gap-1.5 ${employee.is_active ? 'text-emerald-600' : 'text-slate-400'}`}>
                                    <span className="material-symbols-outlined text-base">verified</span>
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

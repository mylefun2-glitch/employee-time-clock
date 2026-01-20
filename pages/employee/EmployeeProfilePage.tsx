import React, { useState } from 'react';
import { useEmployee } from '../../contexts/EmployeeContext';
import MovementHistory from '../../components/admin/MovementHistory';
import { calculateAge, calculateSeniority } from '../../lib/hrUtils';

type TabType = 'basic' | 'work' | 'emergency' | 'history';

const EmployeeProfilePage: React.FC = () => {
    const { employee } = useEmployee();
    const [activeTab, setActiveTab] = useState<TabType>('basic');

    if (!employee) return null;

    const seniority = employee.join_date ? calculateSeniority(employee.join_date) : 0;
    const age = employee.birth_date ? calculateAge(employee.birth_date) : 0;

    const tabs = [
        { id: 'basic' as TabType, label: '基本資料', icon: 'person' },
        { id: 'work' as TabType, label: '職務資訊', icon: 'work' },
        { id: 'emergency' as TabType, label: '緊急聯絡', icon: 'contact_emergency' },
        { id: 'history' as TabType, label: '異動歷史', icon: 'history' },
    ];

    const InfoItem = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 border border-blue-100">
                    <span className="material-symbols-outlined text-2xl">{icon}</span>
                </div>
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{label}</span>
            </div>
            <p className="text-lg font-bold text-slate-900 pl-1 break-words">
                {value || <span className="text-slate-300 font-medium">未設定</span>}
            </p>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">個人檔案</h1>
                <p className="text-slate-500 text-sm font-medium mt-1">檢視並管理您的個人詳細資訊與職務資料</p>
            </div>

            {/* Profile Card */}
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl shadow-xl p-8 text-white">
                <div className="flex items-center gap-6">
                    <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg border-2 border-white/30">
                        <span className="text-3xl font-black text-white">
                            {employee.name.charAt(0)}
                        </span>
                    </div>
                    <div className="flex-1">
                        <h2 className="text-3xl font-black mb-2">{employee.name}</h2>
                        <div className="flex flex-wrap items-center gap-4 text-sm font-bold text-white/90">
                            <span className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg backdrop-blur-sm">
                                <span className="material-symbols-outlined text-base">business</span>
                                {employee.department || '未分配部門'}
                            </span>
                            <span className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg backdrop-blur-sm">
                                <span className="material-symbols-outlined text-base">badge</span>
                                {employee.position || '成員'}
                            </span>
                            <span className={`flex items-center gap-2 px-3 py-1.5 rounded-lg backdrop-blur-sm ${employee.is_active ? 'bg-emerald-500/30' : 'bg-white/10'}`}>
                                <span className="material-symbols-outlined text-base">verified</span>
                                {employee.is_active ? '在職中' : '已離職'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                {/* Tab Headers */}
                <div className="flex border-b border-slate-100 overflow-x-auto">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-6 py-4 font-bold text-sm transition-all border-b-2 whitespace-nowrap ${activeTab === tab.id
                                    ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                                }`}
                        >
                            <span className="material-symbols-outlined text-xl">{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="p-8">
                    {/* 基本資料 */}
                    {activeTab === 'basic' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <h3 className="text-lg font-black text-slate-900 mb-6">基本與聯繫資訊</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <InfoItem icon="person" label="姓名" value={employee.name} />
                                <InfoItem
                                    icon="wc"
                                    label="性別"
                                    value={employee.gender === 'MALE' ? '男' : employee.gender === 'FEMALE' ? '女' : employee.gender === 'OTHER' ? '其他' : '未設定'}
                                />
                                <InfoItem icon="cake" label="出生日期" value={employee.birth_date || '未設定'} />
                                <InfoItem icon="clinical_notes" label="年齡" value={age > 0 ? `${age} 歲` : '未設定'} />
                                <InfoItem icon="smartphone" label="手機/電話" value={employee.contact_phone || '未設定'} />
                                <InfoItem icon="mail" label="Gmail" value={employee.gmail || '未設定'} />
                                <InfoItem
                                    icon="home_pin"
                                    label="通訊地址"
                                    value={employee.mailing_address || '未設定'}
                                />
                            </div>
                        </div>
                    )}

                    {/* 職務資訊 */}
                    {activeTab === 'work' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <h3 className="text-lg font-black text-slate-900 mb-6">職務與保險資訊</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <InfoItem icon="business" label="部門" value={employee.department || '未分配'} />
                                <InfoItem icon="badge" label="職務" value={employee.position || '未設定'} />
                                <InfoItem icon="calendar_today" label="到職日期" value={employee.join_date || '未設定'} />
                                <InfoItem icon="hourglass_empty" label="目前年資" value={`${seniority} 年`} />
                                <InfoItem icon="verified_user" label="加保日期" value={employee.insurance_start_date || '未設定'} />
                                <InfoItem icon="shield" label="退保日期" value={employee.insurance_end_date || '未設定'} />
                            </div>
                        </div>
                    )}

                    {/* 緊急聯絡 */}
                    {activeTab === 'emergency' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <h3 className="text-lg font-black text-slate-900 mb-6">緊急聯絡資訊</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <InfoItem icon="contact_emergency" label="緊急連絡人" value={employee.emergency_contact_name || '未設定'} />
                                <InfoItem icon="family_history" label="聯絡人關係" value={employee.emergency_contact_relationship || '未設定'} />
                                <InfoItem icon="call" label="緊急電話" value={employee.emergency_contact_phone || '未設定'} />
                            </div>

                            {/* 提示卡片 */}
                            <div className="mt-8 bg-amber-50 border border-amber-200 rounded-2xl p-6">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
                                        <span className="material-symbols-outlined text-amber-600 text-xl">info</span>
                                    </div>
                                    <div>
                                        <h4 className="font-black text-amber-900 mb-1">重要提醒</h4>
                                        <p className="text-sm text-amber-700 leading-relaxed">
                                            請確保緊急聯絡資訊保持最新狀態。如有變更，請聯繫人事部門更新資料。
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 異動歷史 */}
                    {activeTab === 'history' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <h3 className="text-lg font-black text-slate-900 mb-6">職務異動歷史</h3>
                            <MovementHistory employeeId={employee.id} isAdmin={false} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EmployeeProfilePage;

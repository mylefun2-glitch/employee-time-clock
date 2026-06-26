import React, { useState } from 'react';
import CompanyManagementPage from './CompanyManagementPage';
import LeaveTypesPage from './LeaveTypesPage';
import { Settings, Building2, CalendarDays } from 'lucide-react';

const SystemSettingsPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'company' | 'leave-types'>('company');

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* 頁面標題 */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <Settings className="h-7 w-7 text-blue-600" />
                        系統設定
                    </h1>
                    <p className="mt-1 text-sm text-slate-500 font-medium">
                        管理公司基本資訊、辦公地點與差勤假別
                    </p>
                </div>
            </div>

            {/* 頁籤 */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-1.5 inline-flex gap-1 overflow-x-auto w-full md:w-auto">
                <button
                    onClick={() => setActiveTab('company')}
                    className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold transition-all text-sm whitespace-nowrap ${
                        activeTab === 'company'
                            ? 'bg-blue-50 text-blue-700 shadow-sm'
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                    }`}
                >
                    <Building2 className="h-4 w-4" />
                    公司管理
                </button>
                <button
                    onClick={() => setActiveTab('leave-types')}
                    className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold transition-all text-sm whitespace-nowrap ${
                        activeTab === 'leave-types'
                            ? 'bg-blue-50 text-blue-700 shadow-sm'
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                    }`}
                >
                    <CalendarDays className="h-4 w-4" />
                    假別設定
                </button>
            </div>

            {/* 頁籤內容 */}
            <div className="animate-in fade-in duration-300">
                {activeTab === 'company' && <CompanyManagementPage isTabMode={true} />}
                {activeTab === 'leave-types' && <LeaveTypesPage isTabMode={true} />}
            </div>
        </div>
    );
};

export default SystemSettingsPage;

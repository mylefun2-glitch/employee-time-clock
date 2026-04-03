import React, { useState } from 'react';
import CarManagement from '../../components/admin/resources/CarManagement';
import ResourceManagement from '../../components/admin/resources/ResourceManagement';
import CarRequests from '../../components/admin/resources/CarRequests';
import ResourceRequests from '../../components/admin/resources/ResourceRequests';
import ResourceCalendar from '../../components/admin/resources/ResourceCalendar';

const ResourceManagerPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'CAR_MGMT' | 'RES_MGMT' | 'CAR_REQ' | 'RES_REQ' | 'CALENDAR'>('CAR_MGMT');

    const tabs = [
        { id: 'CAR_MGMT', label: '公務車清單', icon: 'directions_car' },
        { id: 'RES_MGMT', label: '資源清單', icon: 'inventory_2' },
        { id: 'CAR_REQ', label: '車輛審核', icon: 'car_repair' },
        { id: 'RES_REQ', label: '借用審核', icon: 'rate_review' },
        { id: 'CALENDAR', label: '預約月曆', icon: 'calendar_month' },
    ];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">公務資源管理中心</h1>
                    <p className="text-slate-500 text-sm font-medium mt-1">統一管理公司公務車、會議室及資源借用狀態</p>
                </div>
            </div>

            {/* Desktop Tabs */}
            <div className="bg-white p-2 rounded-[2rem] border border-slate-100 shadow-sm flex flex-wrap gap-1">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm transition-all ${activeTab === tab.id
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-100'
                            : 'text-slate-500 hover:bg-slate-50'
                            }`}
                    >
                        <span className="material-symbols-outlined text-[20px]">{tab.icon}</span>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                {activeTab === 'CAR_MGMT' && <CarManagement />}
                {activeTab === 'RES_MGMT' && <ResourceManagement />}
                {activeTab === 'CAR_REQ' && <CarRequests />}
                {activeTab === 'RES_REQ' && <ResourceRequests />}
                {activeTab === 'CALENDAR' && <ResourceCalendar />}
            </div>
        </div>
    );
};

export default ResourceManagerPage;

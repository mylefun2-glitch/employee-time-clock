import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { Employee } from '../../types';
import MovementHistory from './MovementHistory';

interface EmployeeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: Partial<Employee>) => Promise<void>;
    employee?: Employee | null;
    allEmployees?: Employee[];
}

const EmployeeModal: React.FC<EmployeeModalProps> = ({ isOpen, onClose, onSubmit, employee, allEmployees = [] }) => {
    // 基礎欄位
    const [name, setName] = useState('');
    const [pin, setPin] = useState('');
    const [department, setDepartment] = useState('');
    const [supervisorId, setSupervisorId] = useState<string>('');
    const [isActive, setIsActive] = useState(true);

    // 詳細資料欄位
    const [gender, setGender] = useState<'MALE' | 'FEMALE' | 'OTHER' | ''>('');
    const [position, setPosition] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [mailingAddress, setMailingAddress] = useState('');
    const [contactPhone, setContactPhone] = useState('');
    const [gmail, setGmail] = useState('');
    const [emergencyContactName, setEmergencyContactName] = useState('');
    const [emergencyContactRelationship, setEmergencyContactRelationship] = useState('');
    const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
    const [insuranceStartDate, setInsuranceStartDate] = useState('');
    const [insuranceEndDate, setInsuranceEndDate] = useState('');
    const [joinDate, setJoinDate] = useState('');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'basic' | 'personal' | 'work' | 'history'>('basic');

    useEffect(() => {
        if (employee && isOpen) {
            setName(employee.name || '');
            setPin(employee.pin || '');
            setDepartment(employee.department || '');
            setSupervisorId(employee.supervisor_id || '');
            setIsActive(employee.is_active ?? true);
            setGender(employee.gender || '');
            setPosition(employee.position || '');
            setBirthDate(employee.birth_date || '');
            setMailingAddress(employee.mailing_address || '');
            setContactPhone(employee.contact_phone || '');
            setGmail(employee.gmail || '');
            setEmergencyContactName(employee.emergency_contact_name || '');
            setEmergencyContactRelationship(employee.emergency_contact_relationship || '');
            setEmergencyContactPhone(employee.emergency_contact_phone || '');
            setInsuranceStartDate(employee.insurance_start_date || '');
            setInsuranceEndDate(employee.insurance_end_date || '');
            setJoinDate(employee.join_date || '');
        } else if (!employee && isOpen) {
            setName('');
            setPin('');
            setDepartment('');
            setSupervisorId('');
            setIsActive(true);
            setGender('');
            setPosition('');
            setBirthDate('');
            setMailingAddress('');
            setContactPhone('');
            setGmail('');
            setEmergencyContactName('');
            setEmergencyContactRelationship('');
            setEmergencyContactPhone('');
            setInsuranceStartDate('');
            setInsuranceEndDate('');
            setJoinDate(new Date().toISOString().split('T')[0]);
            setActiveTab('basic');
        }
        setError(null);
    }, [employee, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        if (pin.length !== 6) {
            setError('PIN 碼必須為 6 位數字');
            setLoading(false);
            return;
        }

        try {
            await onSubmit({
                name,
                pin,
                department,
                is_active: isActive,
                supervisor_id: supervisorId || null,
                gender: gender as any || null,
                position: position || null,
                birth_date: birthDate || null,
                mailing_address: mailingAddress || null,
                contact_phone: contactPhone || null,
                gmail: gmail || null,
                emergency_contact_name: emergencyContactName || null,
                emergency_contact_relationship: emergencyContactRelationship || null,
                emergency_contact_phone: emergencyContactPhone || null,
                insurance_start_date: insuranceStartDate || null,
                insurance_end_date: insuranceEndDate || null,
                join_date: joinDate || null
            });
            onClose();
        } catch (err: any) {
            setError(err.message || '發生錯誤');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={employee ? '編輯員工資料' : '新增員工資料'}
            maxWidth="max-w-2xl"
        >
            <div className="flex border-b border-slate-100 mb-6 overflow-x-auto whitespace-nowrap scrollbar-hide">
                {(['basic', 'personal', 'work', 'history'] as const).map((tab) => {
                    if (tab === 'history' && !employee) return null;
                    return (
                        <button
                            key={tab}
                            type="button"
                            onClick={() => setActiveTab(tab)}
                            className={`px-6 py-3 text-sm font-bold transition-all border-b-2 ${activeTab === tab
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-slate-400 hover:text-slate-600'
                                }`}
                        >
                            {tab === 'basic' ? '基本' : tab === 'personal' ? '個人與緊急' : tab === 'work' ? '職務保險' : '異動紀錄'}
                        </button>
                    );
                })}
            </div>

            {activeTab !== 'history' ? (
                <form onSubmit={handleSubmit} className="space-y-6">
                    {error && (
                        <div className="rounded-xl bg-rose-50 p-4 border border-rose-100 text-sm text-rose-600 font-bold">
                            {error}
                        </div>
                    )}

                    {activeTab === 'basic' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="sm:col-span-2">
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">姓名</label>
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-3 bg-slate-50/50"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">PIN 碼 (6位身分證後六碼)</label>
                                <input
                                    type="text"
                                    required
                                    maxLength={6}
                                    value={pin}
                                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                                    className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-3 bg-slate-50/50 font-mono"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">部門</label>
                                <input
                                    type="text"
                                    value={department}
                                    onChange={(e) => setDepartment(e.target.value)}
                                    className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-3 bg-slate-50/50"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">職務</label>
                                <input
                                    type="text"
                                    value={position}
                                    onChange={(e) => setPosition(e.target.value)}
                                    className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-3 bg-slate-50/50"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">直屬主管</label>
                                <select
                                    value={supervisorId}
                                    onChange={(e) => setSupervisorId(e.target.value)}
                                    className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-3 bg-slate-50/50"
                                >
                                    <option value="">無</option>
                                    {allEmployees
                                        .filter(emp => emp.id !== employee?.id)
                                        .map(emp => (
                                            <option key={emp.id} value={emp.id}>{emp.name}</option>
                                        ))
                                    }
                                </select>
                            </div>
                        </div>
                    )}

                    {activeTab === 'personal' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">性別</label>
                                <select
                                    value={gender}
                                    onChange={(e) => setGender(e.target.value as any)}
                                    className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-3 bg-slate-50/50"
                                >
                                    <option value="">請選擇</option>
                                    <option value="MALE">男</option>
                                    <option value="FEMALE">女</option>
                                    <option value="OTHER">其他</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">出生日期</label>
                                <input
                                    type="date"
                                    value={birthDate}
                                    onChange={(e) => setBirthDate(e.target.value)}
                                    className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-3 bg-slate-50/50"
                                />
                            </div>
                            <div className="items-center sm:col-span-2">
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">通訊地址</label>
                                <input
                                    type="text"
                                    value={mailingAddress}
                                    onChange={(e) => setMailingAddress(e.target.value)}
                                    className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-3 bg-slate-50/50"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">電話 / 手機</label>
                                <input
                                    type="text"
                                    value={contactPhone}
                                    onChange={(e) => setContactPhone(e.target.value)}
                                    className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-3 bg-slate-50/50"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Gmail</label>
                                <input
                                    type="email"
                                    value={gmail}
                                    onChange={(e) => setGmail(e.target.value)}
                                    className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-3 bg-slate-50/50"
                                />
                            </div>
                            <div className="sm:col-span-2 mt-4 pt-4 border-t border-slate-100">
                                <h4 className="text-sm font-bold text-slate-900 mb-4">緊急聯絡資訊</h4>
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">連絡人姓名</label>
                                <input
                                    type="text"
                                    value={emergencyContactName}
                                    onChange={(e) => setEmergencyContactName(e.target.value)}
                                    className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-3 bg-slate-50/50"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">關係</label>
                                <input
                                    type="text"
                                    value={emergencyContactRelationship}
                                    onChange={(e) => setEmergencyContactRelationship(e.target.value)}
                                    className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-3 bg-slate-50/50"
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">緊急聯絡電話</label>
                                <input
                                    type="text"
                                    value={emergencyContactPhone}
                                    onChange={(e) => setEmergencyContactPhone(e.target.value)}
                                    className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-3 bg-slate-50/50"
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'work' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="sm:col-span-2">
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">到職日期</label>
                                <input
                                    type="date"
                                    value={joinDate}
                                    onChange={(e) => setJoinDate(e.target.value)}
                                    className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-3 bg-slate-50/50"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">勞(健)加保日期</label>
                                <input
                                    type="date"
                                    value={insuranceStartDate}
                                    onChange={(e) => setInsuranceStartDate(e.target.value)}
                                    className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-3 bg-slate-50/50"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">退保日期</label>
                                <input
                                    type="date"
                                    value={insuranceEndDate}
                                    onChange={(e) => setInsuranceEndDate(e.target.value)}
                                    className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-3 bg-slate-50/50"
                                />
                            </div>

                            {employee && (
                                <div className="sm:col-span-2 mt-4 flex items-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                                    <input
                                        id="is_active"
                                        type="checkbox"
                                        checked={isActive}
                                        onChange={(e) => setIsActive(e.target.checked)}
                                        className="h-5 w-5 rounded-lg border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <label htmlFor="is_active" className="ml-3 block text-sm font-bold text-slate-700">
                                        帳號啟用狀態 (在職)
                                    </label>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex gap-3 pt-6 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-6 py-4 rounded-xl border border-slate-200 text-sm font-bold text-slate-500 hover:bg-slate-50 transition-all"
                        >
                            標消
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-[2] px-6 py-4 rounded-xl bg-blue-600 text-sm font-bold text-white shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all disabled:opacity-50"
                        >
                            {loading ? '儲存中...' : '儲存變更'}
                        </button>
                    </div>
                </form>
            ) : (
                <div className="max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                    <MovementHistory employeeId={employee?.id || ''} isAdmin={true} />
                </div>
            )}
        </Modal>
    );
};

export default EmployeeModal;

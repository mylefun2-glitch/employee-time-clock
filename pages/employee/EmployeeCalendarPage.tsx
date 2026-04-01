import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useEmployee } from '../../contexts/EmployeeContext';
import AttendanceCalendar from '../../components/AttendanceCalendar';
import { getSubordinates } from '../../services/supervisorService';
import { Users, User, ArrowLeft } from 'lucide-react';

const EmployeeCalendarPage: React.FC = () => {
    const { employee } = useEmployee();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const [subordinates, setSubordinates] = useState<any[]>([]);
    const [loadingSubs, setLoadingSubs] = useState(false);
    
    // 從 URL 取得初始員工 ID，預設為登入員工本人
    const targetId = searchParams.get('id') || employee?.id || '';

    useEffect(() => {
        if (employee?.is_supervisor) {
            fetchSubordinates();
        }
    }, [employee?.is_supervisor, employee?.id]);

    const fetchSubordinates = async () => {
        if (!employee?.id) return;
        setLoadingSubs(true);
        try {
            const data = await getSubordinates(employee.id);
            setSubordinates(data || []);
        } catch (error) {
            console.error('Error fetching subordinates:', error);
        } finally {
            setLoadingSubs(false);
        }
    };

    const handleEmployeeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = e.target.value;
        if (id === employee?.id) {
            setSearchParams({});
        } else {
            setSearchParams({ id });
        }
    };

    if (!employee) return null;

    const isSelf = targetId === employee.id;

    return (
        <div className="space-y-4">
            {/* 主管專用切換器 */}
            {employee.is_supervisor && (
                <div className="bg-white px-6 py-4 rounded-[1.5rem] border border-slate-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                            {isSelf ? <User className="h-5 w-5" /> : <Users className="h-5 w-5" />}
                        </div>
                        <div>
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">目前切換視角</p>
                            <h3 className="text-sm font-bold text-slate-900">{isSelf ? '個人紀錄' : '屬員紀錄'}</h3>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        {!isSelf && (
                            <button 
                                onClick={() => setSearchParams({})}
                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                                title="回到自己"
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </button>
                        )}
                        <div className="relative flex-1 sm:w-64">
                            <select
                                value={targetId}
                                onChange={handleEmployeeChange}
                                className="block w-full pl-4 pr-10 py-2.5 text-sm font-bold bg-slate-50 border border-slate-100 rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer"
                            >
                                <option value={employee.id}>自己 ({employee.name})</option>
                                <optgroup label="直屬屬員">
                                    {subordinates.map(sub => (
                                        <option key={sub.id} value={sub.id}>
                                            {sub.name} - {sub.department || '未分配'}
                                        </option>
                                    ))}
                                </optgroup>
                            </select>
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                <span className="material-symbols-outlined text-slate-400 text-sm">expand_more</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <AttendanceCalendar 
                targetEmployeeId={targetId} 
                readOnly={!isSelf} 
            />
        </div>
    );
};

export default EmployeeCalendarPage;

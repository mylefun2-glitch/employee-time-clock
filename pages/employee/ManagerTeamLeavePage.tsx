import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useEmployee } from '../../contexts/EmployeeContext';
import { getSubordinates } from '../../services/supervisorService';
import { getEmployeeLeaveBalances } from '../../services/employee';
import { LeaveBalance } from '../../types';
import { Calendar } from 'lucide-react';

interface SubordinateLeaveStats {
    id: string;
    name: string;
    department: string;
    leaveBalance: LeaveBalance | null;
}

const ManagerTeamLeavePage: React.FC = () => {
    const { employee } = useEmployee();
    const [subordinates, setSubordinates] = useState<SubordinateLeaveStats[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (employee?.id) {
            fetchTeamData(employee.id);
        }
    }, [employee?.id]);

    const fetchTeamData = async (supervisorId: string) => {
        setLoading(true);
        try {
            const teamMembers = await getSubordinates(supervisorId);

            const statsPromises = teamMembers.map(async (member: any) => {
                const balance = await getEmployeeLeaveBalances(member.id);
                return {
                    id: member.id,
                    name: member.name,
                    department: member.department,
                    leaveBalance: balance
                };
            });

            const results = await Promise.all(statsPromises);
            setSubordinates(results);
        } catch (error) {
            console.error('Error fetching team data:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500">載入中...</div>;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">團隊差勤額度</h1>
                <p className="mt-1 text-sm text-slate-500 font-medium">
                    檢視屬員的特休及補休剩餘額度。
                </p>
            </div>

            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="min-w-full divide-y divide-slate-100">
                        <thead className="bg-slate-50/50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest">姓名</th>
                                <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest">部門</th>
                                <th className="px-6 py-4 text-center text-xs font-black text-slate-400 uppercase tracking-widest">特休總額</th>
                                <th className="px-6 py-4 text-center text-xs font-black text-slate-400 uppercase tracking-widest">特休已用</th>
                                <th className="px-6 py-4 text-center text-xs font-black text-slate-400 uppercase tracking-widest">特休折現</th>
                                <th className="px-6 py-4 text-center text-xs font-black text-slate-400 uppercase tracking-widest text-emerald-600">特休剩餘</th>
                                <th className="px-6 py-4 text-center text-xs font-black text-slate-400 uppercase tracking-widest bg-slate-50">補休總額</th>
                                <th className="px-6 py-4 text-center text-xs font-black text-slate-400 uppercase tracking-widest bg-slate-50">補休已用</th>
                                <th className="px-6 py-4 text-center text-xs font-black text-slate-400 uppercase tracking-widest bg-slate-50">加班折算</th>
                                <th className="px-6 py-4 text-center text-xs font-black text-slate-400 uppercase tracking-widest bg-slate-50 text-purple-600">補休剩餘</th>
                                <th className="px-6 py-4 text-center text-xs font-black text-slate-400 uppercase tracking-widest">查看紀錄</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {subordinates.length === 0 ? (
                                <tr>
                                    <td colSpan={11} className="px-6 py-12 text-center text-slate-400 font-bold">
                                        尚無屬員資料
                                    </td>
                                </tr>
                            ) : (
                                subordinates.map((person) => (
                                    <tr key={person.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-900">
                                            {person.name}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-medium">
                                            {person.department || '-'}
                                        </td>
                                        {/* Special Leave */}
                                        <td className="px-6 py-4 whitespace-nowrap text-center font-mono text-slate-600">
                                            {person.leaveBalance ? person.leaveBalance.annual.entitlement : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center font-mono text-orange-600">
                                            {person.leaveBalance ? person.leaveBalance.annual.used : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center font-mono text-rose-600">
                                            {person.leaveBalance ? person.leaveBalance.annual.cashout : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center font-mono font-bold text-emerald-600">
                                            {person.leaveBalance ? person.leaveBalance.annual.remaining : '-'}
                                        </td>
                                        {/* Compensatory Leave */}
                                        <td className="px-6 py-4 whitespace-nowrap text-center font-mono text-slate-600 bg-slate-50/30">
                                            {person.leaveBalance ? person.leaveBalance.compensatory.entitlement : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center font-mono text-orange-600 bg-slate-50/30">
                                            {person.leaveBalance ? person.leaveBalance.compensatory.used : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center font-mono text-rose-600 bg-slate-50/30">
                                            {person.leaveBalance ? person.leaveBalance.compensatory.cashout : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center font-mono font-bold text-purple-600 bg-slate-50/30">
                                            {person.leaveBalance ? person.leaveBalance.compensatory.remaining : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <Link
                                                to={`/employee/calendar?id=${person.id}`}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-black hover:bg-blue-100 transition-all border border-blue-100 shadow-sm"
                                            >
                                                <Calendar className="h-3.5 w-3.5" />
                                                查看
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ManagerTeamLeavePage;

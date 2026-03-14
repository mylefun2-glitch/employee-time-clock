import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Employee } from '../../types';

interface EmployeeSelectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (employeeId: string) => void;
    title?: string;
}

const EmployeeSelectModal: React.FC<EmployeeSelectModalProps> = ({ isOpen, onClose, onSelect, title = '選擇員工' }) => {
    const [employees, setEmployees] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (isOpen) {
            loadEmployees();
        }
    }, [isOpen]);

    const loadEmployees = async () => {
        setLoading(true);
        const { data } = await supabase.from('employees').select('id, name, department, pin').eq('is_active', true).order('name');
        setEmployees(data || []);
        setLoading(false);
    };

    if (!isOpen) return null;

    const filteredEmployees = employees.filter(emp =>
        emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (emp.department && emp.department.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (emp.pin && emp.pin.includes(searchTerm))
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[80vh]">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center shrink-0">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <span className="material-symbols-outlined text-blue-600">person_search</span>
                        {title}
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div className="p-4 border-b border-slate-100 shrink-0 bg-slate-50/50">
                    <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                        <input
                            type="text"
                            placeholder="搜尋姓名、部門或 PIN..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                            autoFocus
                        />
                    </div>
                </div>
                <div className="overflow-y-auto flex-1 p-2 custom-scrollbar">
                    {loading ? (
                        <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
                    ) : filteredEmployees.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-sm font-bold">找不到符合的員工</div>
                    ) : (
                        <div className="space-y-1">
                            {filteredEmployees.map(emp => (
                                <button
                                    key={emp.id}
                                    onClick={() => onSelect(emp.id)}
                                    className="w-full flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-colors text-left group"
                                >
                                    <div>
                                        <div className="font-bold text-slate-800">{emp.name}</div>
                                        <div className="text-xs text-slate-500 mt-0.5">{emp.department || '未分配'}</div>
                                    </div>
                                    <span className="material-symbols-outlined text-slate-300 group-hover:text-blue-600 transition-colors">chevron_right</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
export default EmployeeSelectModal;

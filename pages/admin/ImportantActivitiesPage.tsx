import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { CalendarPlus, Pencil, Trash2, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useEmployee } from '../../contexts/EmployeeContext';
import TimeInput24h from '../../components/ui/TimeInput24h';
import { importantActivityService, ImportantActivity, ActivityScope } from '../../services/importantActivityService';

const today = () => new Date().toISOString().slice(0, 10);

const ImportantActivitiesPage: React.FC = () => {
    const { user } = useAuth();
    const { employee } = useEmployee();
    const location = useLocation();
    const activityDateFromCalendar = new URLSearchParams(location.search).get('date');
    const supervisorMode = location.pathname.startsWith('/employee/') && !!employee?.is_supervisor;
    const managedDepartment = employee?.department?.trim() || '';
    const [activities, setActivities] = useState<ImportantActivity[]>([]);
    const [departments, setDepartments] = useState<string[]>([]);
    const [employees, setEmployees] = useState<{ id: string; name: string; department?: string | null }[]>([]);
    const [editing, setEditing] = useState<ImportantActivity | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [startTime, setStartTime] = useState('08:00');
    const [endTime, setEndTime] = useState('09:00');

    const load = async () => {
        setLoading(true);
        try {
            const [items, units, people] = await Promise.all([
                importantActivityService.getAll(),
                importantActivityService.getDepartments(),
                importantActivityService.getEmployees()
            ]);
            const visibleItems = supervisorMode && managedDepartment
                ? items.filter(item => item.scope_type === 'ALL' || item.scope_type === 'EMPLOYEES' || item.departments?.some(d => d.trim() === managedDepartment))
                : items;
            setActivities(visibleItems);
            setDepartments(supervisorMode && managedDepartment ? [managedDepartment] : units);
            setEmployees(people);
            setError('');
        } catch (err: any) {
            setError(err?.message || '無法載入活動資料，請確認資料表已建立');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [supervisorMode, managedDepartment]);

    useEffect(() => {
        if (activityDateFromCalendar) {
            setEditing(null);
            setStartTime('08:00');
            setEndTime('09:00');
            setShowForm(true);
        }
    }, [supervisorMode, activityDateFromCalendar]);

    const openCreate = () => {
        setEditing(null);
        setStartTime('08:00');
        setEndTime('09:00');
        setShowForm(true);
        setError('');
    };

    const save = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const scope_type = supervisorMode ? 'DEPARTMENTS' : String(form.get('scope_type')) as ActivityScope;
        const selectedDepartments = supervisorMode ? [managedDepartment] : form.getAll('departments').map(String);
        const selectedEmployeeIds = supervisorMode ? [] : form.getAll('employee_ids').map(String);
        const payload = {
            title: String(form.get('title') || '').trim(),
            activity_date: String(form.get('activity_date') || ''),
            start_time: startTime,
            end_time: endTime,
            scope_type,
            departments: selectedDepartments,
            employee_ids: selectedEmployeeIds,
            created_by: user?.id || employee?.id || null
        };
        if (!payload.title || !payload.activity_date || !payload.start_time || !payload.end_time) {
            setError('請完整填寫活動名稱、日期與起訖時間');
            return;
        }
        if (payload.end_time <= payload.start_time) {
            setError('結束時間必須晚於開始時間');
            return;
        }
        if (scope_type === 'DEPARTMENTS' && selectedDepartments.length === 0) {
            setError('請至少選擇一個單位');
            return;
        }
        if (scope_type === 'EMPLOYEES' && selectedEmployeeIds.length === 0) {
            setError('請至少選擇一位人員');
            return;
        }
        setSaving(true);
        try {
            if (editing) await importantActivityService.update(editing.id, payload);
            else await importantActivityService.create(payload);
            setShowForm(false);
            await load();
        } catch (err: any) {
            setError(err?.message || '儲存失敗');
        } finally {
            setSaving(false);
        }
    };

    const remove = async (item: ImportantActivity) => {
        if (!window.confirm(`確定刪除「${item.title}」嗎？`)) return;
        try {
            await importantActivityService.remove(item.id);
            await load();
        } catch (err: any) {
            setError(err?.message || '刪除失敗');
        }
    };

    if (location.pathname.startsWith('/employee/') && employee && !employee.is_supervisor) {
        return <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-10 text-center text-slate-500 font-bold">此功能僅開放給單位主管</div>;
    }

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                        <CalendarPlus className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-900">共同活動</h1>
                        <p className="text-xs text-slate-400 font-bold mt-1">活動會顯示在符合對象的出勤月曆</p>
                    </div>
                </div>
                <button onClick={openCreate} className="px-4 py-3 bg-blue-600 text-white rounded-xl text-sm font-black shadow-md shadow-blue-100 hover:bg-blue-700">
                    新增活動
                </button>
            </div>

            {error && <div className="bg-rose-50 border border-rose-100 text-rose-700 rounded-2xl px-4 py-3 text-sm font-bold">{error}</div>}

            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                {loading ? <div className="p-8 text-center text-slate-400 font-bold">載入中...</div> : activities.length === 0 ?
                    <div className="p-10 text-center text-slate-400 font-bold">目前尚無共同活動</div> :
                    <div className="divide-y divide-slate-100">
                        {activities.map(item => <div key={item.id} className="px-5 py-4 flex items-center justify-between gap-4">
                            <div className="min-w-0">
                                <div className="font-black text-slate-900 truncate">{item.title}</div>
                                <div className="text-xs text-slate-500 font-bold mt-1">{item.activity_date}　{item.start_time.slice(0, 5)}–{item.end_time.slice(0, 5)}　<span className="text-blue-600">{item.scope_type === 'ALL' ? '全體人員' : item.scope_type === 'EMPLOYEES' ? `指定人員（${item.employee_ids?.length || 0} 人）` : item.departments?.join('、')}</span></div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                {(!supervisorMode || item.scope_type === 'DEPARTMENTS' && item.departments?.some(d => d.trim() === managedDepartment)) && <>
                                    <button onClick={() => { setEditing(item); setStartTime(item.start_time.slice(0, 5)); setEndTime(item.end_time.slice(0, 5)); setShowForm(true); setError(''); }} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="編輯"><Pencil className="h-4 w-4" /></button>
                                    <button onClick={() => remove(item)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg" title="刪除"><Trash2 className="h-4 w-4" /></button>
                                </>}
                            </div>
                        </div>)}
                    </div>}
            </div>

            {showForm && <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
                <form onSubmit={save} onClick={e => e.stopPropagation()} className="bg-white rounded-[2rem] shadow-2xl w-full max-w-xl overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between"><h2 className="text-xl font-black text-slate-900">{editing ? '編輯共同活動' : '新增共同活動'}</h2><button type="button" onClick={() => setShowForm(false)} className="p-2 text-slate-400 hover:bg-slate-50 rounded-lg"><X className="h-5 w-5" /></button></div>
                    <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
                        <label className="block"><span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">活動名稱</span><input name="title" placeholder="例如：A單位行政會議、個案研討會" defaultValue={editing?.title || ''} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold outline-none focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-400" required /></label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <label><span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">活動日期</span><input type="date" name="activity_date" defaultValue={editing?.activity_date || activityDateFromCalendar || today()} required className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20" /></label>
                            <label><span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">開始時間</span><TimeInput24h value={startTime} onChange={setStartTime} required /><input type="hidden" name="start_time" value={startTime} /></label>
                            <label><span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">結束時間</span><TimeInput24h value={endTime} onChange={setEndTime} required /><input type="hidden" name="end_time" value={endTime} /></label>
                        </div>
                        <div><span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">適用範圍</span>{supervisorMode ? <div className="text-sm font-bold text-blue-700 bg-blue-50 border border-blue-100 rounded-xl px-3 py-3">僅限本單位：{managedDepartment}</div> : <div className="flex gap-5 text-sm font-bold text-slate-700"><label className="flex items-center gap-2"><input type="radio" name="scope_type" value="ALL" defaultChecked={editing?.scope_type !== 'DEPARTMENTS' && editing?.scope_type !== 'EMPLOYEES'} />全體人員</label><label className="flex items-center gap-2"><input type="radio" name="scope_type" value="DEPARTMENTS" defaultChecked={editing?.scope_type === 'DEPARTMENTS'} />指定單位</label><label className="flex items-center gap-2"><input type="radio" name="scope_type" value="EMPLOYEES" defaultChecked={editing?.scope_type === 'EMPLOYEES'} />指定人員</label></div>}</div>
                        {!supervisorMode && <div><span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">指定單位（選擇指定單位時勾選）</span><div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-4 border border-slate-100">{departments.map(department => <label key={department} className="flex items-center gap-2 text-sm font-bold text-slate-700"><input type="checkbox" name="departments" value={department} defaultChecked={editing?.departments?.includes(department)} />{department}</label>)}</div></div>}
                        {!supervisorMode && <div><span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">指定人員（選擇指定人員時勾選）</span><div className="max-h-48 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-4 border border-slate-100">{employees.map(person => <label key={person.id} className="flex items-center gap-2 text-sm font-bold text-slate-700"><input type="checkbox" name="employee_ids" value={person.id} defaultChecked={editing?.employee_ids?.includes(person.id)} /><span>{person.name}</span><span className="text-xs text-slate-400">{person.department || '未分配'}</span></label>)}</div></div>}
                    </div>
                    <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3"><button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-black">取消</button><button type="submit" disabled={saving} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-black disabled:opacity-50">{saving ? '儲存中...' : '儲存活動'}</button></div>
                </form>
            </div>}
        </div>
    );
};

export default ImportantActivitiesPage;

import React, { useEffect, useState, useMemo } from 'react';
import { getResourceRequests, updateResourceRequestStatus } from '../../services/resourceService';
import { useAuth } from '../../contexts/AuthContext';
import { ResourceRequest } from '../../types';
import { format, startOfMonth, endOfMonth, isSameDay, parseISO, addMonths, subMonths, startOfWeek, getDay } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { isNationalHoliday } from '../../lib/holidays';

const AdminResourceCalendarPage: React.FC = () => {
    const { user } = useAuth();
    const [currentDate, setCurrentDate] = useState<Date>(new Date());
    const [requests, setRequests] = useState<ResourceRequest[]>([]);
    const [loading, setLoading] = useState(false);

    const rocYear = currentDate.getFullYear() - 1911;
    const monthStr = format(currentDate, 'M');

    const handleCancelRequest = async (e: React.MouseEvent, req: ResourceRequest) => {
        e.stopPropagation();
        if (!user) return;
        if (window.confirm(`確定要取消 ${req.employee?.name} 借用的「${req.resource?.name}」嗎？\n取消後將無法復原。`)) {
            try {
                setLoading(true);
                await updateResourceRequestStatus(req.id, user.id, 'REJECTED', '管理員於行事曆手動取消');
                await fetchData();
            } catch (error) {
                console.error('Error cancelling request', error);
                alert('取消失敗，請稍後再試');
            } finally {
                setLoading(false);
            }
        }
    };

    useEffect(() => {
        fetchData();
    }, [currentDate]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch all requests that aren't rejected/withdrawn to show tentative and confirmed bookings
            const allRequests = await getResourceRequests();
            const relevant = allRequests.filter(r => r.status === 'APPROVED' || r.status === 'PENDING');
            setRequests(relevant);
        } catch (err) {
            console.error('Error fetching calendar data:', err);
        } finally {
            setLoading(false);
        }
    };

    const weeks = useMemo(() => {
        const start = startOfMonth(currentDate);
        const end = endOfMonth(currentDate);
        const calendarStart = startOfWeek(start, { weekStartsOn: 1 });

        const weeksArray: Date[][] = [];
        let currentWeek: Date[] = [];
        let tempDate = new Date(calendarStart);

        for (let i = 0; i < 42; i++) {
            currentWeek.push(new Date(tempDate));
            if (currentWeek.length === 7) {
                weeksArray.push(currentWeek);
                currentWeek = [];
            }
            tempDate.setDate(tempDate.getDate() + 1);
            if (tempDate > end && currentWeek.length === 0) break;
        }
        return weeksArray;
    }, [currentDate]);

    const days = useMemo(() => {
        return weeks.flat().filter(d => d >= startOfMonth(currentDate) && d <= endOfMonth(currentDate));
    }, [weeks, currentDate]);

    const monthData = useMemo(() => {
        const data: { [key: string]: { requests: ResourceRequest[], holidayName?: string } } = {};

        days.forEach(day => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const holidayName = isNationalHoliday(day);

            const dayRequests = requests.filter(req => {
                const s = parseISO(req.start_time);
                const e = parseISO(req.end_time);
                const startOfDay = new Date(day);
                startOfDay.setHours(0, 0, 0, 0);
                const endOfDay = new Date(day);
                endOfDay.setHours(23, 59, 59, 999);
                return s <= endOfDay && e >= startOfDay;
            });

            data[dateKey] = { requests: dayRequests, holidayName };
        });

        return data;
    }, [days, requests]);

    const weekDays = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'];

    return (
        <div className="space-y-6 print:space-y-4 print:p-0">
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm print:shadow-none print:border-none print:p-0">
                <div className="flex flex-row items-center justify-between w-full gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center print:hidden">
                            <span className="material-symbols-outlined text-violet-600">event_available</span>
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-slate-900 tracking-tight">資源借用日曆</h1>
                            <div className="text-sm font-bold text-slate-500 mt-0.5">
                                檢視全公司已借用的物品與場地狀態
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 print:hidden">
                        <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-100">
                            <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-600">
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <div className="px-2 py-1 text-xs font-black text-slate-700 font-mono whitespace-nowrap">
                                {rocYear} / {monthStr}
                            </div>
                            <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-600">
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-lg overflow-hidden">
                <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/50">
                    {weekDays.map(day => (
                        <div key={day} className="py-4 text-center text-xs font-black text-slate-400 uppercase tracking-widest border-r last:border-r-0 border-slate-100">
                            {day}
                        </div>
                    ))}
                </div>
                <div className="divide-y divide-slate-100">
                    {weeks.map((week, weekIndex) => (
                        <div key={`week-${weekIndex}`} className="grid grid-cols-7">
                            {week.map(day => {
                                const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                                if (!isCurrentMonth) {
                                    return (
                                        <div key={day.toISOString()} className="min-h-[120px] bg-slate-50/20 border-r last:border-r-0 border-slate-100" />
                                    );
                                }

                                const dateKey = format(day, 'yyyy-MM-dd');
                                const dayInfo = monthData[dateKey];
                                const isToday = isSameDay(day, new Date());
                                const holidayName = dayInfo?.holidayName;
                                const isSaturday = getDay(day) === 6;
                                const isSunday = getDay(day) === 0;

                                return (
                                    <div
                                        key={dateKey}
                                        className={`min-h-[120px] p-2 sm:p-3 border-r last:border-r-0 border-slate-100 flex flex-col transition-colors relative group hover:bg-slate-50
                                            ${holidayName ? 'bg-rose-50/30' : ''} 
                                            ${isSaturday && !holidayName ? 'bg-amber-50/30' : ''} 
                                            ${isSunday && !holidayName ? 'bg-slate-100/40' : ''}`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex flex-col gap-0.5">
                                                <span className={`w-7 h-7 flex items-center justify-center text-sm font-black rounded-lg 
                                                    ${isToday ? 'bg-violet-600 text-white shadow-lg shadow-violet-100' :
                                                        holidayName ? 'text-rose-600' :
                                                            isSunday ? 'text-slate-400' :
                                                                'text-slate-600'
                                                    }`}>
                                                    {format(day, 'd')}
                                                </span>
                                                {holidayName && (
                                                    <span className="text-[10px] font-bold text-rose-500 truncate max-w-[60px]" title={holidayName}>
                                                        {holidayName}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex-1 space-y-1.5 overflow-y-auto max-h-[100px] scrollbar-hide">
                                            {dayInfo?.requests?.map(req => {
                                                const isVenue = req.resource?.type === 'VENUE';
                                                
                                                return (
                                                    <div
                                                        key={req.id}
                                                        onClick={(e) => handleCancelRequest(e, req)}
                                                        className={`px-2 py-1.5 rounded-md text-[10px] font-black border flex flex-col gap-0.5 shadow-sm group/item transition-all cursor-pointer hover:ring-2 hover:ring-rose-400
                                                            ${req.status === 'PENDING' ? 'bg-amber-50 text-amber-700 border-amber-100' : 
                                                            isVenue ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}
                                                        `}
                                                        title={`點擊取消此借用。\n用途：${req.purpose} (借用人：${req.employee?.name})`}
                                                    >
                                                        <div className="flex items-center gap-1 justify-between">
                                                            <div className="flex items-center gap-1 truncate">
                                                                <span className="material-symbols-outlined text-[10px]">
                                                                    {isVenue ? 'meeting_room' : 'inventory_2'}
                                                                </span>
                                                                <span className="truncate">{req.resource?.name}</span>
                                                            </div>
                                                            {req.status === 'PENDING' && (
                                                                <span className="shrink-0 text-[8px] opacity-70 border border-amber-200 px-1 rounded">待審</span>
                                                            )}
                                                            {req.quantity > 1 && (
                                                                <span className="shrink-0 text-[8px] opacity-70">x{req.quantity}</span>
                                                            )}
                                                        </div>
                                                        <div className="flex justify-between items-center opacity-80 mt-0.5">
                                                            <span className="text-[9px] truncate max-w-[40px]">{req.employee?.name}</span>
                                                            <span className="text-[8px] font-mono leading-none">
                                                                {isSameDay(parseISO(req.start_time), day) ? format(parseISO(req.start_time), 'HH:mm') : ''}
                                                                {isSameDay(parseISO(req.start_time), day) && isSameDay(parseISO(req.end_time), day) ? '-' : ''}
                                                                {isSameDay(parseISO(req.end_time), day) ? format(parseISO(req.end_time), 'HH:mm') : ''}
                                                                {!isSameDay(parseISO(req.start_time), day) && !isSameDay(parseISO(req.end_time), day) ? '全天' : ''}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
            
            {loading && (
                <div className="fixed inset-0 bg-white/50 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="bg-white p-4 rounded-2xl shadow-xl flex items-center gap-3">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
                        <span className="text-sm font-bold text-slate-600">載入中...</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminResourceCalendarPage;

import type { ResourceRequest } from '../types';

/** Order a day's bookings by the time they occupy that day, not by submission order. */
export const getDailyResourceRequests = (requests: ResourceRequest[], day: Date): ResourceRequest[] => {
    const startOfDay = new Date(day);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(day);
    endOfDay.setHours(23, 59, 59, 999);
    const dayStart = startOfDay.getTime();
    const dayEnd = endOfDay.getTime();

    return requests
        .filter(req => {
            const start = new Date(req.start_time).getTime();
            const end = new Date(req.end_time).getTime();
            return start <= dayEnd && end >= dayStart;
        })
        .sort((a, b) => {
            const startA = Math.max(new Date(a.start_time).getTime(), dayStart);
            const startB = Math.max(new Date(b.start_time).getTime(), dayStart);
            if (startA !== startB) return startA - startB;
            const endA = new Date(a.end_time).getTime();
            const endB = new Date(b.end_time).getTime();
            return endA - endB || (a.resource?.name || '').localeCompare(b.resource?.name || '', 'zh-TW') || a.id.localeCompare(b.id);
        });
};

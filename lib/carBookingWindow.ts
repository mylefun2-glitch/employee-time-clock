import { BOOKING_CALENDAR_CLOSED_DATES } from './carBookingCalendar';

export const CAR_BOOKING_WINDOW_HINT = '限前一個工作日 08:00 後申請（跳過週末及假日）';

/** Strict civil dates; UTC is used only for date arithmetic, never the host timezone. */
const parseDate = (value: string): Date => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000-')) {
        throw new Error('無效的日期，請使用 YYYY-MM-DD');
    }
    const date = new Date(`${value}T00:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
        throw new Error('無效的日期，請使用 YYYY-MM-DD');
    }
    return date;
};

/**
 * Booking-only DGPA calendar plus live institution closures. The complete daily
 * baseline includes official makeup weekends; personal request flags never apply.
 * No fixed lookback: consecutive holidays may cross years. Unknown years fail closed.
 */
export const getCarBookingOpening = (
    usageDate: string,
    holidayDates: Iterable<string>,
    calendars: Readonly<Record<string, readonly string[]>> = BOOKING_CALENDAR_CLOSED_DATES
): Date => {
    const day = parseDate(usageDate);
    const requireCalendar = (date: string): readonly string[] => {
        const year = date.slice(0, 4);
        if (!Object.prototype.hasOwnProperty.call(calendars, year)) {
            throw new Error(`年度工作日曆尚未設定（${year} 年），無法判斷前一個工作日 08:00 開放時間，請聯絡管理者。`);
        }
        return calendars[year];
    };
    requireCalendar(usageDate);
    const holidays = new Set<string>();
    for (const holiday of holidayDates) {
        parseDate(holiday);
        holidays.add(holiday);
    }
    let date: string;
    do {
        day.setUTCDate(day.getUTCDate() - 1);
        if (day.getUTCFullYear() < 1) throw new Error('日期超出可計算範圍');
        date = day.toISOString().slice(0, 10);
    } while (requireCalendar(date).includes(date) || holidays.has(date));

    return new Date(`${date}T08:00:00+08:00`);
};

export const getCarBookingWindowError = (
    usageDate: string,
    holidayDates: Iterable<string>,
    now: Date = new Date()
): string | null => {
    if (!Number.isFinite(now.getTime())) throw new Error('無效的目前時間');
    const opening = getCarBookingOpening(usageDate, holidayDates);
    if (now.getTime() >= opening.getTime()) return null;
    // Taipei 08:00 is UTC 00:00, so the civil date is identical here.
    const openingDate = opening.toISOString().slice(0, 10);
    return `公務車借用限於前一個工作日 08:00 後提出申請（跳過週末及假日）。您預計於 ${usageDate} 使用，最早可於 ${openingDate} 08:00 申請。`;
};

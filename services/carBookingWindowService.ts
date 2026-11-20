import { getHolidays } from '../lib/holidays';
import { getCarBookingOpening, getCarBookingWindowError } from '../lib/carBookingWindow';

/** Read live institution closures over the official booking-only baseline, never the old cache. */
export const validateCarBookingWindow = async (usageDate: string, now?: Date): Promise<string | null> => {
    try {
        // Check baseline coverage first, including any year crossed by the lookback.
        getCarBookingOpening(usageDate, []);
        const holidays = await getHolidays();
        return getCarBookingWindowError(usageDate, holidays.map(holiday => holiday.date), now);
    } catch (error) {
        if (error instanceof Error && error.message.startsWith('年度工作日曆尚未設定')) return error.message;
        return '無法確認假日資料或申請日期，暫時無法判斷前一個工作日 08:00 開放時間（跳過週末及假日），請稍後重試。';
    }
};

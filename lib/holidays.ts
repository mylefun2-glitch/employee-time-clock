import { format } from 'date-fns';

/**
 * 台灣國定假日與補假定義 (2025-2026)
 * 根據行政院人事行政總處調整，2026年起原則上不補班，只補假。
 */

interface Holiday {
    date: string; // yyyy-MM-dd
    name: string;
}

const HOLIDAYS_DATA: Holiday[] = [
    // 2025 年 (部分)
    { date: '2025-01-01', name: '元旦' },
    { date: '2025-01-27', name: '春節前一日' },
    { date: '2025-01-28', name: '除夕' },
    { date: '2025-01-29', name: '春節初一' },
    { date: '2025-01-30', name: '春節初二' },
    { date: '2025-01-31', name: '春節初三' },
    { date: '2025-02-01', name: '春節初四' },
    { date: '2025-02-02', name: '春節初五' },
    { date: '2025-02-28', name: '和平紀念日' },
    { date: '2025-04-03', name: '兒童節補假' },
    { date: '2025-04-04', name: '兒童節/節氣清明' },
    { date: '2025-05-01', name: '勞動節' },
    { date: '2025-05-30', name: '端午節前一日' },
    { date: '2025-05-31', name: '端午節' },
    { date: '2025-10-06', name: '中秋節' },
    { date: '2025-10-10', name: '國慶日' },

    // 2026 年
    { date: '2026-01-01', name: '元旦' },
    { date: '2026-02-16', name: '春節前一日(補假)' },
    { date: '2026-02-17', name: '除夕' },
    { date: '2026-02-18', name: '春節初一' },
    { date: '2026-02-19', name: '春節初二' },
    { date: '2026-02-20', name: '春節初三' },
    { date: '2026-02-21', name: '春節初四' },
    { date: '2026-02-22', name: '春節初五' },
    { date: '2026-02-27', name: '和平紀念日補假' },
    { date: '2026-02-28', name: '和平紀念日' },
    { date: '2026-04-03', name: '兒童節補假' },
    { date: '2026-04-04', name: '兒童節' },
    { date: '2026-04-05', name: '清明節' },
    { date: '2026-04-06', name: '清明節補假' },
    { date: '2026-05-01', name: '勞動節' },
    { date: '2026-06-19', name: '端午節' },
    { date: '2026-09-25', name: '中秋節' },
    { date: '2026-09-28', name: '孔子誕辰紀念日(教師節)' },
    { date: '2026-10-09', name: '國慶日補假' },
    { date: '2026-10-10', name: '國慶日' },
    { date: '2026-12-25', name: '行憲紀念日' },
];

const HOLIDAY_MAP = new Map(HOLIDAYS_DATA.map(h => [h.date, h.name]));

/**
 * 檢查是否為國定假日或補假
 */
export const isNationalHoliday = (date: Date): string | undefined => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return HOLIDAY_MAP.get(dateKey);
};

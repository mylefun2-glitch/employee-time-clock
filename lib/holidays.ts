import { format } from 'date-fns';
import { supabase } from './supabase';

/**
 * 台灣國定假日與補假定義
 * 
 * 此模組支援兩種資料來源：
 * 1. 資料庫 (holidays 表) — 管理者可透過介面管理
 * 2. 硬編碼預設值 (HOLIDAYS_DATA) — 作為 fallback 與種子資料
 * 
 * 系統優先使用資料庫中的資料，若資料庫查詢失敗或無資料則使用硬編碼預設值。
 */

// ============================================================
// 型別定義
// ============================================================

export type HolidayType = 'national_holiday' | 'typhoon' | 'custom';

export interface Holiday {
    id?: string;
    date: string; // yyyy-MM-dd
    name: string;
    type: HolidayType;
    description?: string;
    created_at?: string;
    updated_at?: string;
    created_by?: string;
}

// ============================================================
// 硬編碼預設假日 (Fallback / 種子資料)
// ============================================================

const HOLIDAYS_DATA: Holiday[] = [
    // 2025 年 (部分)
    { date: '2025-01-01', name: '元旦', type: 'national_holiday' },
    { date: '2025-01-27', name: '春節前一日', type: 'national_holiday' },
    { date: '2025-01-28', name: '除夕', type: 'national_holiday' },
    { date: '2025-01-29', name: '春節初一', type: 'national_holiday' },
    { date: '2025-01-30', name: '春節初二', type: 'national_holiday' },
    { date: '2025-01-31', name: '春節初三', type: 'national_holiday' },
    { date: '2025-02-01', name: '春節初四', type: 'national_holiday' },
    { date: '2025-02-02', name: '春節初五', type: 'national_holiday' },
    { date: '2025-02-28', name: '和平紀念日', type: 'national_holiday' },
    { date: '2025-04-03', name: '兒童節補假', type: 'national_holiday' },
    { date: '2025-04-04', name: '兒童節/節氣清明', type: 'national_holiday' },
    { date: '2025-05-01', name: '勞動節', type: 'national_holiday' },
    { date: '2025-05-30', name: '端午節前一日', type: 'national_holiday' },
    { date: '2025-05-31', name: '端午節', type: 'national_holiday' },
    { date: '2025-10-06', name: '中秋節', type: 'national_holiday' },
    { date: '2025-10-10', name: '國慶日', type: 'national_holiday' },
    { date: '2025-12-25', name: '行憲紀念日', type: 'national_holiday' },

    // 2026 年
    { date: '2026-01-01', name: '元旦', type: 'national_holiday' },
    { date: '2026-02-16', name: '春節前一日(補假)', type: 'national_holiday' },
    { date: '2026-02-17', name: '除夕', type: 'national_holiday' },
    { date: '2026-02-18', name: '春節初一', type: 'national_holiday' },
    { date: '2026-02-19', name: '春節初二', type: 'national_holiday' },
    { date: '2026-02-20', name: '春節初三', type: 'national_holiday' },
    { date: '2026-02-21', name: '春節初四', type: 'national_holiday' },
    { date: '2026-02-22', name: '春節初五', type: 'national_holiday' },
    { date: '2026-02-27', name: '和平紀念日補假', type: 'national_holiday' },
    { date: '2026-02-28', name: '和平紀念日', type: 'national_holiday' },
    { date: '2026-04-03', name: '兒童節補假', type: 'national_holiday' },
    { date: '2026-04-04', name: '兒童節', type: 'national_holiday' },
    { date: '2026-04-05', name: '清明節', type: 'national_holiday' },
    { date: '2026-04-06', name: '清明節補假', type: 'national_holiday' },
    { date: '2026-05-01', name: '勞動節', type: 'national_holiday' },
    { date: '2026-06-19', name: '端午節', type: 'national_holiday' },
    { date: '2026-09-25', name: '中秋節', type: 'national_holiday' },
    { date: '2026-09-28', name: '孔子誕辰紀念日(教師節)', type: 'national_holiday' },
    { date: '2026-10-09', name: '國慶日補假', type: 'national_holiday' },
    { date: '2026-10-10', name: '國慶日', type: 'national_holiday' },
    { date: '2026-12-25', name: '行憲紀念日', type: 'national_holiday' },
];

// ============================================================
// 假日快取系統
// ============================================================

/** 快取：date string → holiday name */
let holidayCache: Map<string, string> = new Map(HOLIDAYS_DATA.map(h => [h.date, h.name]));
/** 是否已從資料庫載入過 */
let dbLoaded = false;
/** 載入中的 Promise（避免重複請求） */
let loadingPromise: Promise<void> | null = null;

/**
 * 從資料庫載入假日資料並合併到快取中
 * DB 資料優先於硬編碼資料
 */
async function loadFromDB(): Promise<void> {
    if (dbLoaded) return;
    if (loadingPromise) return loadingPromise;

    loadingPromise = (async () => {
        try {
            const { data, error } = await supabase
                .from('holidays')
                .select('date, name')
                .order('date');

            if (error) {
                console.warn('Failed to load holidays from DB, using defaults:', error.message);
                return;
            }

            if (data && data.length > 0) {
                // 建立新快取：以 DB 資料為主，硬編碼為底
                const newCache = new Map(HOLIDAYS_DATA.map(h => [h.date, h.name]));
                data.forEach((h: { date: string; name: string }) => {
                    // 資料庫日期格式可能含時區，只取 yyyy-MM-dd
                    const dateStr = h.date.substring(0, 10);
                    newCache.set(dateStr, h.name);
                });
                holidayCache = newCache;
            }

            dbLoaded = true;
        } catch (err) {
            console.warn('Error loading holidays from DB:', err);
        } finally {
            loadingPromise = null;
        }
    })();

    return loadingPromise;
}

// 啟動時自動載入（非阻塞）
loadFromDB();

// ============================================================
// 公開查詢 API
// ============================================================

/**
 * 檢查是否為國定假日或補假
 * 優先使用資料庫資料，fallback 到硬編碼預設值
 */
export const isNationalHoliday = (date: Date): string | undefined => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return holidayCache.get(dateKey);
};

/**
 * 強制重新整理假日快取（從資料庫重新載入）
 * 在管理者新增/修改/刪除假日後呼叫
 */
export const refreshHolidayCache = async (): Promise<void> => {
    dbLoaded = false;
    loadingPromise = null;
    // 重置快取為硬編碼預設值
    holidayCache = new Map(HOLIDAYS_DATA.map(h => [h.date, h.name]));
    await loadFromDB();
};

// ============================================================
// 管理用 CRUD API
// ============================================================

/**
 * 取得假日列表（從資料庫）
 * @param year 指定年度（選填，不指定則取得全部）
 */
export const getHolidays = async (year?: number): Promise<Holiday[]> => {
    let query = supabase
        .from('holidays')
        .select('*')
        .order('date');

    if (year) {
        query = query
            .gte('date', `${year}-01-01`)
            .lte('date', `${year}-12-31`);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching holidays:', error);
        throw error;
    }

    return (data || []).map((h: any) => ({
        ...h,
        date: h.date.substring(0, 10), // 確保 yyyy-MM-dd 格式
    }));
};

/**
 * 新增假日
 */
export const addHoliday = async (holiday: Omit<Holiday, 'id' | 'created_at' | 'updated_at'>): Promise<Holiday> => {
    const { data, error } = await supabase
        .from('holidays')
        .insert({
            date: holiday.date,
            name: holiday.name,
            type: holiday.type,
            description: holiday.description || null,
        })
        .select()
        .single();

    if (error) {
        console.error('Error adding holiday:', error);
        throw error;
    }

    // 重新整理快取
    await refreshHolidayCache();
    return { ...data, date: data.date.substring(0, 10) };
};

/**
 * 更新假日
 */
export const updateHoliday = async (id: string, updates: Partial<Holiday>): Promise<Holiday> => {
    const { data, error } = await supabase
        .from('holidays')
        .update({
            ...(updates.date && { date: updates.date }),
            ...(updates.name && { name: updates.name }),
            ...(updates.type && { type: updates.type }),
            ...(updates.description !== undefined && { description: updates.description || null }),
        })
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating holiday:', error);
        throw error;
    }

    await refreshHolidayCache();
    return { ...data, date: data.date.substring(0, 10) };
};

/**
 * 刪除假日
 */
export const deleteHoliday = async (id: string): Promise<void> => {
    const { error } = await supabase
        .from('holidays')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting holiday:', error);
        throw error;
    }

    await refreshHolidayCache();
};

/**
 * 批次匯入假日（用於快速匯入某年度預設假日）
 * 會跳過已存在的日期
 */
export const importDefaultHolidays = async (year: number): Promise<{ imported: number; skipped: number }> => {
    const defaultsForYear = HOLIDAYS_DATA.filter(h => h.date.startsWith(`${year}-`));

    if (defaultsForYear.length === 0) {
        return { imported: 0, skipped: 0 };
    }

    // 取得該年已存在的假日
    const existing = await getHolidays(year);
    const existingDates = new Set(existing.map(h => h.date));

    const toInsert = defaultsForYear
        .filter(h => !existingDates.has(h.date))
        .map(h => ({
            date: h.date,
            name: h.name,
            type: h.type,
            description: '系統預設匯入',
        }));

    if (toInsert.length === 0) {
        return { imported: 0, skipped: defaultsForYear.length };
    }

    const { error } = await supabase
        .from('holidays')
        .insert(toInsert);

    if (error) {
        console.error('Error importing holidays:', error);
        throw error;
    }

    await refreshHolidayCache();
    return { imported: toInsert.length, skipped: defaultsForYear.length - toInsert.length };
};

/**
 * 取得預設假日列表（硬編碼資料，用於參考或匯入）
 */
export const getDefaultHolidays = (year?: number): Holiday[] => {
    if (year) {
        return HOLIDAYS_DATA.filter(h => h.date.startsWith(`${year}-`));
    }
    return [...HOLIDAYS_DATA];
};

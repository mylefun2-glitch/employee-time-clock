import { genderGroup, genderLabel, monthBounds, taiwanTimestamp } from './hrReport';
import type { HrReport } from './hrReport';

export interface HourlyScheduleSources { employees: Record<string, any>[]; services: Record<string, any>[] }
export interface HourlyScheduleFilters { department: string[]; position: string[]; gender: string[] }
export interface HourlyScheduleRow {
    employee: { id: string; name: string; department: string; position: string; gender: string; is_active: boolean };
    hours: number | null; status: 'known' | 'no-data' | 'invalid'; serviceRows: number;
}
export interface HourlyScheduleBucket {
    key: string; label: string; minExclusive: number | null; maxInclusive: number | null;
    count: number; rows: HourlyScheduleRow[];
}
export const HOURLY_SCHEDULE_DEFINITIONS = [
    '班表工時來源：出勤月曆 monthly_salary_schedules；所選完整月份所有 service_mins 加總後除以 60，包含正常班、休息日班、國定假日等所有班別；同日多筆逐筆加總，不去重、不重複加入其他工時。',
    '包含整月未來已排班日期，不受實際工時基準日截斷；不使用打卡、差勤聯集、正常實際工時或加班，也不代表完成服務、核准出勤或薪資計算。',
    '母體依目前人員主檔 salary_type = HOURLY，排除理事長；納入目前在職者及所選月份有班表紀錄的非在職者。部門、職務、性別均依目前主檔篩選，非歷史計薪身分快照。',
    '90 小時以下包含 0 與 90；其後每 10 小時一組，左開右閉（超過 90～100、超過 100～110，依此類推），每人僅計入一組。',
    '沒有月份班表列為「未登錄班表」，不視為零；有紀錄且合計為零才列入 90 小時以下。任何一筆分鐘缺漏、空白、負數或非有限數字，整人列為「班表資料異常」，不以部分資料分組。'
];
// Exactly sum decimal minutes before comparing boundaries: 0.1 + 0.2 must not
// nudge an employee into a different bucket. Stored numeric strings stay decimal.
function decimalMinutes(value: unknown): { units: bigint; scale: number } | null {
    if (typeof value !== 'string' && typeof value !== 'number') return null;
    const raw = String(value).trim();
    const text = raw.replace(/^\+?\./, '0.');
    if (!text || !Number.isFinite(Number(text)) || Number(text) < 0) return null;
    const match = /^\+?(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(text);
    if (!match) return null;
    const exponent = Number(match[3] || 0);
    // Finite JS numeric range; reject adversarial exponents even on zero strings.
    if (Math.abs(exponent) > 400 || text.length > 1000) return null;
    let units = BigInt(match[1] + (match[2] || ''));
    let scale = (match[2] || '').length - exponent;
    if (scale < 0) { units *= 10n ** BigInt(-scale); scale = 0; }
    return { units, scale };
}
function validDate(value: unknown): value is string {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(value + 'T00:00:00Z');
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
const MAX_BUCKET_UPPER = 2090; // 200 ten-hour bands, then explicit overflow; no hours discarded.
export function buildHourlyScheduleReport(sources: HourlyScheduleSources, options: { month: string; filters: HourlyScheduleFilters }) {
    const { month } = options;
    const { start, end } = monthBounds(month);
    if (!Array.isArray(sources?.employees) || !Array.isArray(sources?.services)) throw new Error('班表來源未完整載入');
    const filters = { department: [...(options.filters.department || [])], position: [...(options.filters.position || [])], gender: [...(options.filters.gender || [])] };
    const byEmployee = new Map<string, Record<string, any>[]>();
    for (const service of sources.services) {
        // Ignore valid out-of-month dates, but never silently drop an unplaceable row.
        if (!validDate(service.service_date)) throw new Error('班表日期無效，無法確認月份範圍');
        if (service.service_date < start.slice(0, 10) || service.service_date >= end.slice(0, 10)) continue;
        const key = String(service.employee_id);
        const group = byEmployee.get(key) || []; group.push(service); byEmployee.set(key, group);
    }
    const seen = new Set<string>();
    const exactTotals = new Map<string, { units: bigint; scale: number }>();
    const rows: HourlyScheduleRow[] = [];
    for (const e of sources.employees) {
        if (e.salary_type !== 'HOURLY' || e.is_chairman === true) continue;
        if (e.id == null || String(e.id).trim() === '') throw new Error('人員識別資料缺漏');
        const id = String(e.id);
        if (seen.has(id)) throw new Error('人員主檔識別重複');
        seen.add(id);
        const services = byEmployee.get(id) || [];
        if (e.is_active !== true && !services.length) continue;
        const matches = (key: keyof HourlyScheduleFilters, value: string) => !filters[key].length || filters[key].includes('ALL') || filters[key].includes(value);
        if (!matches('department', e.department ?? '') || !matches('position', e.position ?? '') || !matches('gender', genderGroup(e))) continue;
        const employee = { id, name: String(e.name ?? ''), department: String(e.department ?? ''), position: String(e.position ?? ''), gender: genderGroup(e), is_active: e.is_active === true };
        let units = 0n, scale = 0, invalid = false;
        for (const service of services) {
            const value = decimalMinutes(service.service_mins);
            if (!value) { invalid = true; continue; }
            const nextScale = Math.max(scale, value.scale);
            units = units * 10n ** BigInt(nextScale - scale) + value.units * 10n ** BigInt(nextScale - value.scale);
            scale = nextScale;
        }
        const hours = Number(`${units}e-${scale}`) / 60;
        if (!Number.isFinite(hours)) invalid = true;
        const status = !services.length ? 'no-data' : invalid ? 'invalid' : 'known';
        rows.push({ employee, hours: status === 'known' ? hours : null, status, serviceRows: services.length });
        if (status === 'known') exactTotals.set(id, { units, scale });
    }
    const buckets: HourlyScheduleBucket[] = [];
    const addBucket = (key: string, label: string, minExclusive: number | null, maxInclusive: number | null) => buckets.push({ key, label, minExclusive, maxInclusive, count: 0, rows: [] });
    addBucket('le-90', '90小時以下', null, 90);
    let upper = 110;
    for (const { units, scale } of exactTotals.values()) {
        const divisor = 600n * 10n ** BigInt(scale);
        const roundedTen = ((units + divisor - 1n) / divisor) * 10n;
        upper = Math.max(upper, Number(roundedTen > BigInt(MAX_BUCKET_UPPER) ? BigInt(MAX_BUCKET_UPPER) : roundedTen));
    }
    for (let hi = 100; hi <= upper; hi += 10) addBucket(`${hi - 10}-${hi}`, `超過${hi - 10}～${hi}小時`, hi - 10, hi);
    const exceeds = [...exactTotals.values()].some(({ units, scale }) => units > BigInt(MAX_BUCKET_UPPER * 60) * 10n ** BigInt(scale));
    const warnings = exceeds ? [`為避免異常大數產生過多分組，超過${MAX_BUCKET_UPPER}小時以溢出組顯示，請核對來源；未截斷工時。`] : [];
    if (exceeds) addBucket('overflow', `超過${MAX_BUCKET_UPPER}小時（請核對）`, MAX_BUCKET_UPPER, null);
    for (const row of rows) if (row.status === 'known') {
        const { units, scale } = exactTotals.get(row.employee.id)!;
        const bucket = buckets.find(b => b.maxInclusive === null || units <= BigInt(b.maxInclusive * 60) * 10n ** BigInt(scale))!;
        bucket.rows.push(row); bucket.count++;
    }
    const known = rows.filter(r => r.status === 'known').length;
    const noData = rows.filter(r => r.status === 'no-data').length;
    const invalid = rows.filter(r => r.status === 'invalid').length;
    const bucketed = buckets.reduce((sum, b) => sum + b.count, 0);
    const counts = { eligible: rows.length, known, noData, invalid, bucketed, auditValid: bucketed === known && known + noData + invalid === rows.length };
    if (!counts.auditValid) throw new Error('班表人數核對不一致');
    return { month, filters, rows, buckets, counts, warnings, definitions: [...HOURLY_SCHEDULE_DEFINITIONS] };
}
export type HourlyScheduleReport = ReturnType<typeof buildHourlyScheduleReport>;
export const hourlyScheduleStatus = (status: HourlyScheduleRow['status']) => ({ known: '已知班表工時', 'no-data': '未登錄班表', invalid: '班表資料異常' }[status]);
export function hourlyScheduleGroup(report: HourlyScheduleReport, key: string) {
    const special = key === 'no-data' || key === 'invalid';
    const bucket = report.buckets.find(b => b.key === key);
    if (!special && !bucket) throw new Error('未知班表分組');
    return special ? { label: key === 'no-data' ? '未登錄班表' : '班表資料異常', rows: report.rows.filter(r => r.status === key) } : bucket!;
}
export function buildHourlyScheduleExport(report: HourlyScheduleReport, options: { named: boolean; detailBucket?: string; producedAt?: Date }): HrReport {
    const detail = options.detailBucket !== undefined ? hourlyScheduleGroup(report, options.detailBucket) : null;
    if (detail && !options.named) throw new Error('此組名單匯出須明確選擇具名');
    const tables: HrReport['tables'] = [];
    if (!detail) tables.push({ title: '班表工時人數摘要', headers: ['分組', '人數'], rows: [
        ['目前篩選母體', report.counts.eligible], ['已知班表工時', report.counts.known],
        ...report.buckets.map(b => [b.label, b.count] as [string, number]),
        ['未登錄班表', report.counts.noData], ['班表資料異常', report.counts.invalid],
        ['人數核對', report.counts.auditValid ? '一致：各工時組＋未登錄＋異常＝母體' : '不一致']
    ] });
    if (options.named) tables.push({ title: `${detail?.label || '全部符合篩選'}名單（${(detail?.rows || report.rows).length}人）`, headers: ['姓名', '部門', '職務', '性別', '班表工時（小時）', '資料狀態', '班表筆數'], rows: (detail?.rows || report.rows).map(r => [r.employee.name, r.employee.department, r.employee.position, genderLabel(r.employee.gender), r.hours, hourlyScheduleStatus(r.status), r.serviceRows]) });
    const { start, end } = monthBounds(report.month);
    return { title: `時薪制班表工時人數分布${detail ? '・' + detail.label : ''}`, metadata: [
        ['產製時間', taiwanTimestamp(options.producedAt)], ['所選完整月份', report.month], ['月份範圍（Asia/Taipei）', `${start} ≤ 班表日期 < ${end}`],
        ...(['department', 'position', 'gender'] as const).map((key, i): [string, string] => [[ '部門篩選', '職務篩選', '性別篩選'][i], !report.filters[key].length || report.filters[key].includes('ALL') ? '全部' : report.filters[key].map(v => key === 'gender' ? genderLabel(v) : v).join('、')]),
        ['匯出範圍', detail ? `此組具名名單・${detail.rows.length}人` : options.named ? '摘要＋具名名單' : '僅摘要（不含姓名）'],
        ...report.definitions.map((text, i): [string, string] => [`定義${i + 1}`, text]), ...report.warnings.map((text): [string, string] => ['警示', text])
    ], tables };
}

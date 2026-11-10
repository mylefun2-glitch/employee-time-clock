import { genderLabel, taiwanTimestamp } from './hrReport';
import type { HrReport } from './hrReport';

export interface WorkHoursFilters { department: string[]; position: string[]; gender: string[] }
export interface WorkHoursDay {
    date: string; punches: string[]; punchTypes?: string[]; normalHours: number | null; overtimeHours: number | null;
    totalHours: number | null; serviceHours: number; knownOvertimeHours?: number; issues: string[]; source: string;
}
export interface WorkHoursRow {
    employee: { id: string; name: string; department?: string; position?: string; gender?: string; is_active?: boolean };
    normalHours: number | null; overtimeHours: number | null; totalHours: number | null;
    knownNormalHours: number; knownOvertimeHours: number; knownTotalHours: number;
    serviceHours: number; pendingDays: number; status: string; days: WorkHoursDay[];
}
export interface WorkHoursResult {
    rows: WorkHoursRow[]; month: string; asOf: string; notes: string[];
    summary: { normalHours: number; overtimeHours: number; totalHours: number; pendingPeople: number; noDataPeople: number };
}
export const workHoursStatus = (status: string) => ({ complete: '已確認', pending: '待確認', 'no-data': '無資料' }[status] || '待確認');
export const workHoursValue = (hours: number | null) => hours == null ? '未確認' : String(Number(hours.toFixed(2)));
export const WORK_HOURS_DEFINITIONS = [
    '正常工時：打卡實際工作區間依有效班表認列，扣除休息、核准非工作假及加班區間；不含薪資給付時數、補足或津貼。',
    '核准加班：僅有效 APPROVED 且假別代碼 OT 的儲存核准時數，不以申請起訖時間推估。',
    '合計認列工時＝正常工時＋核准加班；任一項未確認時合計仍為未確認。已確認工時小計僅加總已知部分，不代表完整總工時。',
    '僅檢視所選月份截至基準日（Asia/Taipei）的已觀測日期，不推算缺勤日；未確認不等於 0。',
    '服務匯入參考：service_mins 換算時數，不能證明完成或排除重疊，不納入任何認列工時合計。',
    '人員範圍：目前在職及所選月有紀錄的離職人員，排除理事長；部門、職務、性別採目前主檔，非歷史快照。',
    '僅供工作時數核對，不連動薪資，不作薪資計算依據。'
];

// Search before paging. Exports consume matchingRows, never the page slice.
export function selectWorkHoursRows(rows: WorkHoursRow[], search = '', page = 1, pageSize = 20) {
    const query = search.trim().toLocaleLowerCase('zh-TW');
    const matchingRows = rows.filter(row => !query || row.employee.name.toLocaleLowerCase('zh-TW').includes(query));
    const pages = Math.max(1, Math.ceil(matchingRows.length / pageSize));
    const currentPage = Math.max(1, Math.min(pages, page));
    return { matchingRows, pageRows: matchingRows.slice((currentPage - 1) * pageSize, currentPage * pageSize), page: currentPage, pages, count: matchingRows.length };
}
export function workHoursSubtotal(rows: WorkHoursRow[]) {
    return rows.reduce((sum, row) => ({
        normalHours: sum.normalHours + row.knownNormalHours,
        overtimeHours: sum.overtimeHours + row.knownOvertimeHours,
        totalHours: sum.totalHours + row.knownTotalHours,
        pendingPeople: sum.pendingPeople + Number(row.status === 'pending'),
        noDataPeople: sum.noDataPeople + Number(row.status === 'no-data')
    }), { normalHours: 0, overtimeHours: 0, totalHours: 0, pendingPeople: 0, noDataPeople: 0 });
}
const issueLabels: Record<string, string> = {
    'invalid-service-minutes': '服務匯入分鐘無效', 'ambiguous-schedule': '同日生效班表重複，待釐清',
    'ambiguous-override': '當日班表例外重複，待釐清', 'invalid-break': '休息區間無效',
    'missing-ot-hours': '未提供有效的儲存核准加班時數', 'unallocatable-ot': '加班跨日、跨月或區間無效，無法分配',
    'overlapping-ot': '核准加班區間重疊', 'invalid-punch-sequence': '打卡缺漏、重複或順序無效',
    'unknown-leave-type': '假別代碼未確認', 'unknown-effective-schedule': '無法確認當日有效班表',
    'no-punch-evidence': '無實際打卡佐證', 'unapproved-restday-work': '休息日打卡未有可認列的核准加班',
    'work-request-not-actual-evidence': '工作申請不能證明實際完成', 'service-punch-ambiguity': '服務匯入與打卡可能重疊，待核對',
    'service-not-actual-evidence': '服務匯入不能證明實際完成'
};
const sourceLabels: Record<string, string> = { punches: '打卡', 'approved-requests': '核准申請', 'service-reference': '服務匯入參考', override: '當日班表例外', 'schedule-history': '歷史生效班表', 'employee-effective-default': '員工生效預設班表' };
export const workHoursDayCells = (day: WorkHoursDay) => {
    const reasons = day.issues.map(issue => issueLabels[issue] || issue);
    if (day.overtimeHours === null && (day.knownOvertimeHours ?? 0) > 0) reasons.push(`已知核准加班 ${workHoursValue(day.knownOvertimeHours!)} 小時（非完整小計）`);
    const punches = day.punches.map((value, index) => {
        const text = /(?:Z|[+-]\d\d(?::?\d\d)?)$/i.test(value) ? value : value.replace(' ', 'T') + '+08:00';
        const parsed = new Date(text);
        const time = Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(parsed);
        const kind = day.punchTypes?.[index];
        return `${kind === 'IN' ? '上班 ' : kind === 'OUT' ? '下班 ' : kind ? `${kind} ` : ''}${time}`;
    }).join('；') || '無打卡紀錄';
    return [day.date, punches, workHoursValue(day.normalHours), workHoursValue(day.overtimeHours), workHoursValue(day.totalHours), workHoursValue(day.serviceHours), day.source.split('+').map(source => sourceLabels[source] || source).join('＋') || '未提供', reasons.join('；') || '無'];
};
export const WORK_HOURS_DAY_HEADERS = ['日期', '打卡紀錄', '正常工時', '核准加班', '合計認列工時', '服務匯入參考（不計入）', '來源', '待確認原因'];

export function buildWorkHoursExport(report: WorkHoursResult, options: { filters: WorkHoursFilters; named?: boolean; rows?: WorkHoursRow[]; detail?: WorkHoursRow; producedAt?: Date; search?: string }): HrReport {
    const { detail, filters } = options;
    const named = Boolean(options.named || detail); // Explicit individual detail action is named intent.
    const rows = detail ? [detail] : options.rows ?? report.rows;
    const summary = workHoursSubtotal(rows);
    const describe = (values: string[], gender = false) => !values.length || values.includes('ALL') ? '全部' : values.map(value => gender ? genderLabel(value) : value).join('、');
    const tables: HrReport['tables'] = detail ? [] : [{ title: '已確認工時小計（非完整總工時）', headers: ['項目', '值', '單位'], rows: [
        ['符合人數', rows.length, '人'], ['正常工時', workHoursValue(summary.normalHours), '小時'], ['核准加班', workHoursValue(summary.overtimeHours), '小時'], ['合計認列工時', workHoursValue(summary.totalHours), '小時'], ['待確認', summary.pendingPeople, '人'], ['無資料', summary.noDataPeople, '人']
    ] }];
    if (named) tables.push({ title: `每月工作時數名單（${rows.length} 人）`, headers: ['姓名', '部門', '職務', '正常工時', '核准加班', '合計認列工時', '狀態', '服務匯入參考（不計入）'], rows: rows.map(row => [row.employee.name, row.employee.department || '未設定', row.employee.position || '未設定', workHoursValue(row.normalHours), workHoursValue(row.overtimeHours), workHoursValue(row.totalHours), workHoursStatus(row.status), workHoursValue(row.serviceHours)]) });
    if (detail) tables.push({ title: '每日明細（與畫面所列日期相同）', headers: WORK_HOURS_DAY_HEADERS, rows: detail.days.map(workHoursDayCells) });
    return { title: detail ? '每月工作時數・個人每日明細' : '每月工作時數', metadata: [
        ['產製時間', taiwanTimestamp(options.producedAt)], ['月份', report.month], ['截至基準日', `${report.asOf}（Asia/Taipei）`],
        ['部門篩選', describe(filters.department)], ['職務篩選', describe(filters.position)], ['性別篩選', describe(filters.gender, true)],
        ['姓名搜尋', options.search?.trim() ? named ? options.search.trim() : '已套用（摘要不輸出搜尋文字）' : '未套用'],
        ['匯出範圍', detail ? '明確指定個人每日明細' : named ? '全部符合搜尋與篩選結果，含具名名單（非本頁）' : '全部符合搜尋與篩選結果，僅摘要（無姓名）'],
        ...WORK_HOURS_DEFINITIONS.map((text, index): [string, string] => [`定義與限制 ${index + 1}`, text]),
        ...report.notes.map((text, index): [string, string] => [`來源備註 ${index + 1}`, text])
    ], tables };
}

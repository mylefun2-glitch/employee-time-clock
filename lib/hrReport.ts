// Read-only statistics/report contract. No payroll policy is defined here.
export const taiwanDate = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
export const taiwanTimestamp = (date = new Date()) => new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(date) + ' Asia/Taipei';
export function monthBounds(month: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('月份格式錯誤');
    const [year, m] = month.split('-').map(Number);
    const next = new Date(Date.UTC(year, m, 1)).toISOString().slice(0, 7);
    return { start: `${month}-01T00:00:00+08:00`, end: `${next}-01T00:00:00+08:00` };
}
export function taiwanMinutes(timestamp: string) {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(timestamp));
    return Number(parts.find(p => p.type === 'hour')?.value) * 60 + Number(parts.find(p => p.type === 'minute')?.value);
}
export const genderGroup = (employee: { gender?: string }) => employee.gender === 'MALE' ? 'MALE' : employee.gender === 'FEMALE' ? 'FEMALE' : 'OTHER';
export const genderLabel = (value: string) => ({ MALE: '男', FEMALE: '女', OTHER: '其他／未填' }[value] || value);

// A fresh stable-ordered query per page; throw on any failed or malformed page.
export async function readAllPages(query: () => any, pageSize = 500): Promise<any[]> {
    const rows: any[] = [];
    for (let offset = 0; ; offset += pageSize) {
        const response = await query().order('id', { ascending: true }).range(offset, offset + pageSize - 1);
        if (response.error || !Array.isArray(response.data)) throw new Error('來源讀取失敗');
        rows.push(...response.data);
        if (response.data.length < pageSize) return rows;
    }
}
export async function readStatisticsSources(client: any, month: string) {
    const { start, end } = monthBounds(month);
    const [employees, logs, leaves, types] = await Promise.all([
        readAllPages(() => client.from('employees').select('*').eq('is_active', true)),
        readAllPages(() => client.from('attendance_logs').select('*').gte('timestamp', start).lt('timestamp', end)),
        readAllPages(() => client.from('leave_requests').select('*, leave_type:leave_types(*)').eq('status', 'APPROVED').or('is_modified.is.null,is_modified.eq.false').gte('start_date', start).lt('start_date', end)),
        readAllPages(() => client.from('leave_types').select('*'))
    ]);
    return { employees, logs, leaves, types };
}
export type ReportCell = string | number | null | undefined;
export interface ReportTable { title: string; headers: string[]; rows: ReportCell[][] }
export interface HrReport { title: string; metadata: [string, string][]; tables: ReportTable[] }
export interface ReportInput {
    month: string; asOf: string; filters: { department: string[]; position: string[]; gender: string[] };
    stats: any; roster: { name: string; department: string; position: string; gender: string; age: string; seniority: string }[];
    named: boolean; detail?: string; producedAt?: Date;
}
export function buildHrReport(input: ReportInput): HrReport {
    const { stats, named } = input;
    const tables: ReportTable[] = [];
    if (!input.detail) {
        tables.push({ title: '統計摘要', headers: ['項目', '值', '單位'], rows: [
            ['目前在職（含理事長）', stats.total, '人'], ['男', stats.gender.male, '人'], ['女', stats.gender.female, '人'], ['其他／未填', stats.gender.other, '人'],
            ['平均上班（Asia/Taipei）', stats.avgCheckInTime, '時:分'], ['平均下班（Asia/Taipei）', stats.avgCheckOutTime, '時:分']
        ] });
        for (const [title, values, unit] of [['職務', stats.positions, '人'], ['年齡', stats.ageRanges, '人'], ['年資', stats.seniorityRanges, '人'], ['核准差勤合計', stats.leaveTypeStats, '小時']] as const) {
            tables.push({ title, headers: ['分類', '合計', '單位'], rows: Object.entries(values).map(([key, value]) => [key, value as number, unit]) });
        }
    }
    if (named) {
        tables.push({ title: `人員名單（${input.roster.length} 人）`, headers: ['姓名', '部門', '職務', '性別', '年齡區間', '年資區間'], rows: input.roster.map(e => [e.name, e.department, e.position, e.gender, e.age, e.seniority]) });
        if (!input.detail) tables.push({ title: '扣薪假別時數（沿用原統計規則，非薪資計算）', headers: ['姓名', '部門', ...stats.activeLeaveTypes, '合計小時'], rows: stats.employeeLeavePivot.map((e: any) => [e.employeeName, e.department, ...stats.activeLeaveTypes.map((type: string) => e.leaves[type] ?? 0), e.totalHours]) });
    }
    const { start, end } = monthBounds(input.month);
    return { title: input.detail ? `人事統計明細・${input.detail}` : '人事統計報表', metadata: [
        ['產製時間', taiwanTimestamp(input.producedAt)], ['人事基準日', `${input.asOf}（目前在職含理事長；年齡／年資截至當日，非所選月份歷史快照；沿用 hrUtils 區間）`],
        ['所選月份', input.month], ['月份範圍', `${start} ≤ 時間 < ${end}`],
        ['部門篩選', input.filters.department.includes('ALL') ? '全部' : input.filters.department.join('、')],
        ['職務篩選', input.filters.position.includes('ALL') ? '全部' : input.filters.position.join('、')],
        ['性別篩選', input.filters.gender.includes('ALL') ? '全部' : input.filters.gender.map(genderLabel).join('、')],
        ['匯出範圍', input.detail ? `明細名單・${input.roster.length} 人` : named ? '摘要＋具名名單＋扣薪假別樞紐' : '僅摘要（不含姓名與扣薪樞紐）'],
        ['人事來源', 'employees：is_active = true（含理事長）'],
        ['打卡來源', 'attendance_logs：timestamp 落於所選月；所有 IN／OUT 紀錄分別平均，非每日首末筆；Asia/Taipei'],
        ['差勤來源', 'leave_requests：APPROVED、is_modified 為空或 false；start_date 落於所選月（非跨月攤提）'],
        ['假別來源', 'leave_types（核准差勤關聯假別）；未改動任何扣薪／聘僱規則']
    ], tables };
}
export function csvCell(value: ReportCell) {
    let text = value == null ? '' : String(value);
    // Prefix even leading whitespace/control characters before a formula operator.
    if (/^[\s\u0000-\u001f]*[=+@-]/u.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
}
export function reportCsv(report: HrReport) {
    const rows: ReportCell[][] = [[report.title], ...report.metadata, []];
    for (const table of report.tables) rows.push([table.title], table.headers, ...table.rows, []);
    return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
}
const html = (value: ReportCell) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export function reportHtml(report: HrReport) {
    return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><title>${html(report.title)}</title><style>@page{size:A4;margin:12mm}body{font:12px system-ui,sans-serif;color:#111;line-height:1.5}h1{font-size:20px}h2{font-size:15px;margin:18px 0 6px;break-after:avoid;page-break-after:avoid}p{margin:3px 0;overflow-wrap:anywhere}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #aaa;padding:5px;text-align:left;overflow-wrap:anywhere}thead{display:table-header-group}tr{break-inside:avoid}button{padding:10px;margin:8px 0}@media print{button{display:none}}</style></head><body><button onclick="window.print()">列印／另存 PDF</button><h1>${html(report.title)}</h1>${report.metadata.map(([key, value]) => `<p><b>${html(key)}：</b>${html(value)}</p>`).join('')}${report.tables.map(table => `<h2>${html(table.title)}</h2><table><thead><tr>${table.headers.map(c => `<th>${html(c)}</th>`).join('')}</tr></thead><tbody>${table.rows.map(row => `<tr>${row.map(c => `<td>${html(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`).join('')}</body></html>`;
}

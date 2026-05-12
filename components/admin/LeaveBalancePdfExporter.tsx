import React from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { LeaveBalance, Employee } from '../../types';

// ── 對外型別 ──────────────────────────────────────────────
export interface LeaveDetailRecord {
    leave_type_name: string;
    leave_type_code: string;
    start_date: string;
    start_time: string;
    end_date: string;
    end_time: string;
    description: string;
    hours: number;
    record_type: 'request' | 'adjustment';
}

// ── 工具函式 ──────────────────────────────────────────────
const fmt = (d: string) => (!d ? '' : d.substring(0, 10));
const today = () => new Date().toISOString().substring(0, 10);

const FONT = '"Microsoft JhengHei", "PingFang TC", "Noto Sans TC", sans-serif';
const W = 1122; // A4 橫向 @ 96dpi

/**
 * FIFO 分配：依時間順序將紀錄填入各期間。
 * 「使用」類紀錄（ANNUAL / TOIL）依 period.used 時數配額 FIFO 分配；
 * 「折現/折算」類紀錄（ALC / CO）依日期落點分配到對應期間。
 */
const distributeRecordsFIFO = (
    periods: LeaveBalance['annual']['periods'],
    allRecords: LeaveDetailRecord[],
    usageCodes: string[],
    cashoutCodes: string[],
): Map<string, LeaveDetailRecord[]> => {
    const bucket = new Map<string, LeaveDetailRecord[]>(
        periods.map(p => [p.label, []])
    );

    // 依 start_date 由舊到新排序期間
    const sortedPeriods = [...periods].sort((a, b) =>
        a.start_date.localeCompare(b.start_date)
    );

    // 1. 「使用」紀錄：FIFO 填入最舊期間 → 直到 used 配額耗盡
    const usageRecs = [...allRecords]
        .filter(r => usageCodes.includes(r.leave_type_code))
        .sort((a, b) => a.start_date.localeCompare(b.start_date));

    let ri = 0;
    for (const p of sortedPeriods) {
        let quota = p.used;
        while (ri < usageRecs.length && quota > 0) {
            bucket.get(p.label)!.push(usageRecs[ri]);
            quota -= usageRecs[ri].hours;
            ri++;
        }
    }
    // 剩餘紀錄歸入最後一個期間（理論上不應發生）
    if (ri < usageRecs.length) {
        const last = sortedPeriods[sortedPeriods.length - 1];
        if (last) {
            bucket.get(last.label)!.push(...usageRecs.slice(ri));
        }
    }

    // 2. 「折現/折算」紀錄：依日期落點分配到對應期間
    const cashoutRecs = allRecords.filter(r => cashoutCodes.includes(r.leave_type_code));
    for (const rec of cashoutRecs) {
        const d = rec.start_date.substring(0, 10);
        let placed = false;
        for (const p of sortedPeriods) {
            if (d >= p.start_date && d <= p.end_date) {
                bucket.get(p.label)!.push(rec);
                placed = true;
                break;
            }
        }
        // 日期不在任何期間內 → 放到最近一個期間
        if (!placed && sortedPeriods.length > 0) {
            bucket.get(sortedPeriods[sortedPeriods.length - 1].label)!.push(rec);
        }
    }

    // 3. 每個 bucket 內部依日期排序
    for (const [label, recs] of bucket) {
        bucket.set(label, [...recs].sort((a, b) => a.start_date.localeCompare(b.start_date)));
    }

    return bucket;
};

// ── 共用樣式 ─────────────────────────────────────────────
const th: React.CSSProperties = {
    padding: '4px 6px',
    fontSize: '10px',
    fontWeight: 800,
    color: '#64748b',
    textAlign: 'left',
    borderBottom: '1px solid #cbd5e1',
    whiteSpace: 'nowrap',
    backgroundColor: '#f8fafc',
};
const td: React.CSSProperties = {
    padding: '4px 6px',
    fontSize: '10.5px',
    color: '#334155',
    verticalAlign: 'top',
};

// ── 年資段摘要 + 明細表格 ─────────────────────────────────
interface PeriodBlockProps {
    period: LeaveBalance['annual']['periods'][number];
    records: LeaveDetailRecord[];
    employeeName: string;
    accentColor: string;
    isCashout: boolean; // true → 折現；false → 折算
}

const PeriodBlock: React.FC<PeriodBlockProps> = ({
    period, records, employeeName, accentColor, isCashout
}) => (
    <div style={{ marginBottom: '4px' }}>
        {/* 摘要列 */}
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#f1f5f9' }}>
            <tbody>
                <tr>
                    {[
                        { label: '年資', value: period.label, color: '#0f172a', w: '13%', bold: true },
                        { label: '期間', value: `${fmt(period.start_date)} ～ ${fmt(period.end_date)}`, color: '#475569', w: '30%' },
                        { label: '應得時數', value: String(period.entitlement), color: '#334155', w: '10%' },
                        { label: '已用', value: String(period.used), color: '#ea580c', w: '9%' },
                        { label: isCashout ? '折現' : '折算', value: String(period.cashout), color: '#e11d48', w: '9%' },
                        { label: '剩餘', value: String(period.remaining), color: '#16a34a', w: '9%', bold: true },
                    ].map(col => (
                        <td key={col.label} style={{ width: col.w, padding: '6px 8px', verticalAlign: 'top' }}>
                            <div style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 700 }}>{col.label}</div>
                            <div style={{ fontSize: '12px', fontWeight: col.bold ? 900 : 700, color: col.color }}>
                                {col.value}
                            </div>
                        </td>
                    ))}
                    <td style={{ width: '20%' }} />
                </tr>
            </tbody>
        </table>

        {/* 明細表格 */}
        {records.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr>
                        <th style={{ ...th, width: '7%' }}>姓名</th>
                        <th style={{ ...th, width: '9%' }}>出差勤項目</th>
                        <th style={{ ...th, width: '10%' }}>起始日期</th>
                        <th style={{ ...th, width: '7%' }}>起始時間</th>
                        <th style={{ ...th, width: '10%' }}>結束日期</th>
                        <th style={{ ...th, width: '7%' }}>結束時間</th>
                        <th style={{ ...th, width: 'auto' }}>說明</th>
                        <th style={{ ...th, width: '8%', textAlign: 'right' }}>小計(H)</th>
                    </tr>
                </thead>
                <tbody>
                    {records.map((rec, i) => (
                        <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                            <td style={td}>{employeeName}</td>
                            <td style={td}>{rec.leave_type_name}</td>
                            <td style={td}>{fmt(rec.start_date)}</td>
                            <td style={td}>{rec.start_time || '—'}</td>
                            <td style={td}>{fmt(rec.end_date)}</td>
                            <td style={td}>{rec.end_time || '—'}</td>
                            <td style={{ ...td, wordBreak: 'break-all', whiteSpace: 'normal' }}>
                                {rec.description || '—'}
                            </td>
                            <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>
                                {rec.hours || '—'}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        ) : (
            <div style={{ padding: '5px 10px', color: '#94a3b8', fontSize: '10px', fontStyle: 'italic', borderBottom: '1px solid #f1f5f9' }}>
                此期間無請假申請記錄
            </div>
        )}
    </div>
);

// ── 區塊標題列 ───────────────────────────────────────────
const SectionHeader: React.FC<{ title: string; color: string }> = ({ title, color }) => (
    <div style={{
        backgroundColor: color,
        color: '#fff',
        fontWeight: 900,
        fontSize: '13px',
        padding: '8px 14px',
        borderRadius: '6px 6px 0 0',
        marginBottom: '2px',
    }}>
        {title}
    </div>
);

// ── PDF 第一頁（封面 + 摘要 + 特休） ─────────────────────
interface TemplateProps {
    employee: Employee & { leaveBalance: LeaveBalance | null };
    records: LeaveDetailRecord[];
}

export const AnnualTemplate = React.forwardRef<HTMLDivElement, TemplateProps>(
    ({ employee, records }, ref) => {
        const lb = employee.leaveBalance;
        const annualPeriods = lb?.annual?.periods || [];
        const allocation = distributeRecordsFIFO(
            annualPeriods, records, ['ANNUAL'], ['ALC']
        );

        return (
            <div ref={ref} style={{ width: `${W}px`, backgroundColor: '#fff', fontFamily: FONT, fontSize: '11px', color: '#1e293b', padding: '36px 44px', boxSizing: 'border-box' }}>
                {/* 封面標題 */}
                <div style={{ marginBottom: '20px', borderBottom: '2px solid #334155', paddingBottom: '14px' }}>
                    <div style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a' }}>差勤額度統計明細報表</div>
                    <div style={{ display: 'flex', gap: '28px', color: '#64748b', fontSize: '11px', fontWeight: 600, marginTop: '4px' }}>
                        <span>員工：{employee.name}</span>
                        <span>部門：{employee.department || '未分配'}</span>
                        <span>匯出日期：{today()}</span>
                    </div>
                </div>

                {/* 摘要卡片 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
                    {/* 特休 */}
                    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '12px 16px' }}>
                        <div style={{ fontWeight: 900, color: '#1d4ed8', fontSize: '12px', marginBottom: '8px' }}>特休額度摘要</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)' }}>
                            {[['總額', lb?.annual.entitlement], ['已用', lb?.annual.used], ['折現', lb?.annual.cashout], ['剩餘', lb?.annual.remaining]].map(([l, v]) => (
                                <div key={String(l)} style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>{l}</div>
                                    <div style={{ fontSize: '15px', fontWeight: 900, color: '#1d4ed8' }}>{v ?? '-'}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                    {/* 補休 */}
                    <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '8px', padding: '12px 16px' }}>
                        <div style={{ fontWeight: 900, color: '#7e22ce', fontSize: '12px', marginBottom: '8px' }}>補休額度摘要</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)' }}>
                            {[['總額', lb?.compensatory.entitlement], ['已用', lb?.compensatory.used], ['折算', lb?.compensatory.cashout], ['剩餘', lb?.compensatory.remaining]].map(([l, v]) => (
                                <div key={String(l)} style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>{l}</div>
                                    <div style={{ fontSize: '15px', fontWeight: 900, color: '#7e22ce' }}>{v ?? '-'}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 特休年資明細 */}
                <SectionHeader title="特休年資明細" color="#1d4ed8" />
                {annualPeriods.length === 0
                    ? <div style={{ padding: '12px', color: '#94a3b8', fontSize: '11px' }}>尚無年資里程碑資料</div>
                    : [...annualPeriods]
                        .sort((a, b) => a.start_date.localeCompare(b.start_date))
                        .map((p, i) => (
                            <PeriodBlock
                                key={i}
                                period={p}
                                records={allocation.get(p.label) || []}
                                employeeName={employee.name}
                                accentColor="#1d4ed8"
                                isCashout={true}
                            />
                        ))
                }

                <div style={{ marginTop: '20px', borderTop: '1px solid #e2e8f0', paddingTop: '6px', color: '#94a3b8', fontSize: '10px', textAlign: 'right' }}>
                    本報表由系統自動產生 · {today()} （特休部分）
                </div>
            </div>
        );
    }
);
AnnualTemplate.displayName = 'AnnualTemplate';

// ── PDF 第二頁起（補休） ──────────────────────────────────
export const CompTemplate = React.forwardRef<HTMLDivElement, TemplateProps>(
    ({ employee, records }, ref) => {
        const lb = employee.leaveBalance;
        const compPeriods = lb?.compensatory?.periods || [];
        const allocation = distributeRecordsFIFO(
            compPeriods, records, ['TOIL', 'OT'], ['CO']
        );

        return (
            <div ref={ref} style={{ width: `${W}px`, backgroundColor: '#fff', fontFamily: FONT, fontSize: '11px', color: '#1e293b', padding: '36px 44px', boxSizing: 'border-box' }}>
                {/* 次頁標題 */}
                <div style={{ marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                    <div style={{ fontSize: '15px', fontWeight: 900, color: '#0f172a' }}>差勤額度統計明細報表（補休部分）</div>
                    <div style={{ display: 'flex', gap: '28px', color: '#64748b', fontSize: '11px', fontWeight: 600, marginTop: '3px' }}>
                        <span>員工：{employee.name}</span>
                        <span>部門：{employee.department || '未分配'}</span>
                        <span>匯出日期：{today()}</span>
                    </div>
                </div>

                {/* 補休年度明細 */}
                <SectionHeader title="補休年度明細" color="#7e22ce" />
                {compPeriods.length === 0
                    ? <div style={{ padding: '12px', color: '#94a3b8', fontSize: '11px' }}>尚無補休年度資料</div>
                    : [...compPeriods]
                        .sort((a, b) => a.start_date.localeCompare(b.start_date))
                        .map((p, i) => (
                            <PeriodBlock
                                key={i}
                                period={p}
                                records={allocation.get(p.label) || []}
                                employeeName={employee.name}
                                accentColor="#7e22ce"
                                isCashout={false}
                            />
                        ))
                }

                <div style={{ marginTop: '20px', borderTop: '1px solid #e2e8f0', paddingTop: '6px', color: '#94a3b8', fontSize: '10px', textAlign: 'right' }}>
                    本報表由系統自動產生 · {today()} （補休部分）
                </div>
            </div>
        );
    }
);
CompTemplate.displayName = 'CompTemplate';

// ══════════════════════════════════════════════════════════
//  核心匯出函式
// ══════════════════════════════════════════════════════════

/** 將一個 HTML 元素截圖後分頁寫入 PDF（A4 橫向） */
async function renderSectionToPages(
    pdf: jsPDF,
    el: HTMLElement,
    isFirstSection: boolean,
): Promise<void> {
    const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: el.scrollWidth,
        height: el.scrollHeight,
        windowWidth: el.scrollWidth,
        windowHeight: el.scrollHeight,
    });

    const A4_W = 297;  // mm
    const A4_H = 210;  // mm

    // canvas scale=2，實際 px → mm
    const pxPerMm = (canvas.width / 2) / A4_W;
    const totalHeightMm = (canvas.height / 2) / pxPerMm;

    let pageMmOffset = 0;
    let firstPage = true;

    while (pageMmOffset < totalHeightMm) {
        if (!isFirstSection || !firstPage) {
            pdf.addPage();
        }
        firstPage = false;

        // 截取此頁對應的 canvas 區塊
        const srcY = Math.round(pageMmOffset * pxPerMm * 2);
        const srcH = Math.min(Math.round(A4_H * pxPerMm * 2), canvas.height - srcY);

        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = srcH;
        const ctx = pageCanvas.getContext('2d')!;
        ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);

        const imgData = pageCanvas.toDataURL('image/jpeg', 0.93);
        const imgHMm = (srcH / 2) / pxPerMm;
        pdf.addImage(imgData, 'JPEG', 0, 0, A4_W, imgHMm);

        pageMmOffset += A4_H;
    }
}

/** 動態渲染 React 元素到隱藏容器並返回其 DOM 節點 */
async function renderToHiddenEl(
    reactEl: React.ReactElement,
): Promise<{ el: HTMLElement; cleanup: () => void }> {
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;top:-9999px;left:-9999px;z-index:-1;pointer-events:none;';
    document.body.appendChild(container);

    const { createRoot } = await import('react-dom/client');
    const root = createRoot(container);

    await new Promise<void>(resolve => {
        root.render(reactEl);
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    return {
        el: container.firstChild as HTMLElement,
        cleanup: () => {
            root.unmount();
            document.body.removeChild(container);
        },
    };
}

export interface ExportOptions {
    employee: Employee & { leaveBalance: LeaveBalance | null };
    records: LeaveDetailRecord[];
    onDone?: () => void;
}

export const exportLeaveBalancePdf = async ({
    employee, records, onDone,
}: ExportOptions): Promise<void> => {
    const annualCodes = ['ANNUAL'];
    const compCodes = ['TOIL', 'OT', 'CO'];

    const annualRecords = records.filter(r =>
        [...annualCodes, 'ALC'].includes(r.leave_type_code)
    );
    const compRecords = records.filter(r =>
        compCodes.includes(r.leave_type_code)
    );

    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    // ── 第一部分：封面 + 摘要 + 特休 ──
    const { el: annualEl, cleanup: cleanupAnnual } = await renderToHiddenEl(
        React.createElement(AnnualTemplate, { employee, records: annualRecords })
    );
    try {
        await renderSectionToPages(pdf, annualEl, true);
    } finally {
        cleanupAnnual();
    }

    // ── 第二部分（新頁起）：補休 ──
    const { el: compEl, cleanup: cleanupComp } = await renderToHiddenEl(
        React.createElement(CompTemplate, { employee, records: compRecords })
    );
    try {
        await renderSectionToPages(pdf, compEl, false); // false = 會先 addPage
    } finally {
        cleanupComp();
    }

    pdf.save(`${employee.name}_差勤額度統計明細.pdf`);
    onDone?.();
};

export default AnnualTemplate;

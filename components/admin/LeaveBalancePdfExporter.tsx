import React, { useRef } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { LeaveBalance, Employee } from '../../types';

// ── 從 Supabase 撈取後傳入的請假明細結構 ──
export interface LeaveDetailRecord {
    leave_type_name: string; // 出差勤項目（特休、補休等）
    leave_type_code: string; // ANNUAL / TOIL / ALC / CO ...
    start_date: string;      // e.g. "2024-10-15"
    start_time: string;      // e.g. "08:00"
    end_date: string;
    end_time: string;
    description: string;     // 說明/原因
    hours: number;           // 小計（小時）
    record_type: 'request' | 'adjustment'; // 請假申請 或 折現調整
}

interface Props {
    employee: Employee & { leaveBalance: LeaveBalance | null };
    records: LeaveDetailRecord[];
}

// ── 工具函式 ──
const fmt = (dateStr: string): string => {
    if (!dateStr) return '';
    // 截取前 10 碼，統一輸出 YYYY-MM-DD（處理含時間戳的 ISO 格式）
    return dateStr.substring(0, 10);
};

// 判斷某筆 record 屬於哪個年資段（start_date 落在 period 的 start_date ~ end_date）
const getRecordPeriodLabel = (
    recordDate: string,
    periods: LeaveBalance['annual']['periods']
): string | null => {
    for (const p of periods) {
        if (recordDate >= p.start_date && recordDate <= p.end_date) {
            return p.label;
        }
    }
    return null;
};

// ── PDF 預覽用的隱藏 HTML 元件 ──
const PdfTemplate = React.forwardRef<HTMLDivElement, Props>(
    ({ employee, records }, ref) => {
        const leaveBalance = employee.leaveBalance;
        const annualPeriods = leaveBalance?.annual?.periods || [];
        const compPeriods = leaveBalance?.compensatory?.periods || [];

        // 依假別 code 過濾
        const annualCodes = ['ANNUAL', 'ALC'];
        const compCodes = ['TOIL', 'OT', 'CO'];

        const annualRecords = records.filter(r => annualCodes.includes(r.leave_type_code));
        const compRecords = records.filter(r => compCodes.includes(r.leave_type_code));

        const today = new Date().toISOString().substring(0, 10); // YYYY-MM-DD

        return (
            <div
                ref={ref}
                style={{
                    width: '1122px', // A4 橫向 @ 96dpi
                    backgroundColor: '#fff',
                    fontFamily: '"Microsoft JhengHei", "PingFang TC", "Noto Sans TC", sans-serif',
                    fontSize: '12px',
                    color: '#1e293b',
                    padding: '40px 48px',
                    boxSizing: 'border-box',
                }}
            >
                {/* ── 封面標題 ── */}
                <div style={{ marginBottom: '24px', borderBottom: '2px solid #334155', paddingBottom: '16px' }}>
                    <div style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', marginBottom: '4px' }}>
                        差勤額度統計明細報表
                    </div>
                    <div style={{ display: 'flex', gap: '32px', color: '#64748b', fontSize: '11px', fontWeight: 600 }}>
                        <span>員工：{employee.name}</span>
                        <span>部門：{employee.department || '未分配'}</span>
                        <span>匯出日期：{today}</span>
                    </div>
                </div>

                {/* ── 總覽摘要 ── */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px',
                    marginBottom: '28px',
                }}>
                    {/* 特休摘要 */}
                    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '12px 16px' }}>
                        <div style={{ fontWeight: 900, color: '#1d4ed8', fontSize: '12px', marginBottom: '8px' }}>特休額度摘要</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                            {[
                                ['總額', leaveBalance?.annual.entitlement ?? '-'],
                                ['已用', leaveBalance?.annual.used ?? '-'],
                                ['折現', leaveBalance?.annual.cashout ?? '-'],
                                ['剩餘', leaveBalance?.annual.remaining ?? '-'],
                            ].map(([label, val]) => (
                                <div key={String(label)} style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>{label}</div>
                                    <div style={{ fontSize: '14px', fontWeight: 900, color: '#1d4ed8' }}>{val}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                    {/* 補休摘要 */}
                    <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '8px', padding: '12px 16px' }}>
                        <div style={{ fontWeight: 900, color: '#7e22ce', fontSize: '12px', marginBottom: '8px' }}>補休額度摘要</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                            {[
                                ['總額', leaveBalance?.compensatory.entitlement ?? '-'],
                                ['已用', leaveBalance?.compensatory.used ?? '-'],
                                ['折算', leaveBalance?.compensatory.cashout ?? '-'],
                                ['剩餘', leaveBalance?.compensatory.remaining ?? '-'],
                            ].map(([label, val]) => (
                                <div key={String(label)} style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>{label}</div>
                                    <div style={{ fontSize: '14px', fontWeight: 900, color: '#7e22ce' }}>{val}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── 特休年資明細 ── */}
                <SectionBlock
                    title="特休年資明細"
                    accentColor="#1d4ed8"
                    periods={annualPeriods}
                    allRecords={annualRecords}
                    employeeName={employee.name}
                    isAnnual={true}
                />

                <div style={{ height: '24px' }} />

                {/* ── 補休年度明細 ── */}
                <SectionBlock
                    title="補休年度明細"
                    accentColor="#7e22ce"
                    periods={compPeriods}
                    allRecords={compRecords}
                    employeeName={employee.name}
                    isAnnual={false}
                />

                <div style={{ marginTop: '24px', borderTop: '1px solid #e2e8f0', paddingTop: '8px', color: '#94a3b8', fontSize: '10px', textAlign: 'right' }}>
                    本報表由系統自動產生 · {new Date().toISOString().substring(0, 10)}
                </div>
            </div>
        );
    }
);
PdfTemplate.displayName = 'PdfTemplate';

// ── 年資段區塊 ──
interface SectionBlockProps {
    title: string;
    accentColor: string;
    periods: LeaveBalance['annual']['periods'];
    allRecords: LeaveDetailRecord[];
    employeeName: string;
    isAnnual: boolean;
}

const SectionBlock: React.FC<SectionBlockProps> = ({
    title, accentColor, periods, allRecords, employeeName, isAnnual
}) => {
    if (periods.length === 0) return null;

    return (
        <div>
            {/* Section 標題 */}
            <div style={{
                backgroundColor: accentColor,
                color: '#fff',
                fontWeight: 900,
                fontSize: '13px',
                padding: '8px 12px',
                borderRadius: '6px 6px 0 0',
                marginBottom: 0,
            }}>
                {title}
            </div>

            {/* 各年資段 */}
            {periods.map((period, idx) => {
                // 找出屬於此段的紀錄
                const periodRecords = allRecords.filter(r => {
                    const rd = r.start_date;
                    return rd >= period.start_date && rd <= period.end_date;
                });

                return (
                    <div key={idx} style={{ marginBottom: '2px' }}>
                        {/* 段落摘要列 */}
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <tbody>
                                <tr style={{ backgroundColor: '#f1f5f9' }}>
                                    <SummaryCell label="年資" value={period.label} bold color="#0f172a" width="14%" />
                                    <SummaryCell label="期間" value={`${period.start_date} ~ ${period.end_date}`} width="32%" color="#475569" />
                                    <SummaryCell label="應得時數" value={String(period.entitlement)} width="12%" color="#334155" />
                                    <SummaryCell label="已用" value={String(period.used)} width="10%" color="#ea580c" />
                                    <SummaryCell label={isAnnual ? '折現' : '折算'} value={String(period.cashout)} width="10%" color="#e11d48" />
                                    <SummaryCell label="剩餘" value={String(period.remaining)} width="10%" color="#16a34a" bold />
                                    <td style={{ width: '12%' }} />
                                </tr>
                            </tbody>
                        </table>

                        {/* 明細列標題 */}
                        {periodRecords.length > 0 && (
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                        {['姓名', '出差勤項目', '起始日期', '起始時間', '結束日期', '結束時間', '說明', '小計(以小時計)'].map(h => (
                                            <th key={h} style={{
                                                padding: '4px 8px',
                                                fontSize: '10px',
                                                fontWeight: 800,
                                                color: '#64748b',
                                                textAlign: 'left',
                                                borderBottom: '1px solid #cbd5e1',
                                                whiteSpace: 'nowrap',
                                            }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {periodRecords.map((rec, rIdx) => (
                                        <tr key={rIdx} style={{
                                            backgroundColor: rIdx % 2 === 0 ? '#fff' : '#f8fafc',
                                            borderBottom: '1px solid #f1f5f9',
                                        }}>
                                            <DetailCell value={employeeName} />
                                            <DetailCell value={rec.leave_type_name} />
                                            <DetailCell value={fmt(rec.start_date)} />
                                            <DetailCell value={rec.start_time || '—'} />
                                            <DetailCell value={fmt(rec.end_date)} />
                                            <DetailCell value={rec.end_time || '—'} />
                                            <DetailCell value={rec.description || '—'} maxWidth="240px" />
                                            <DetailCell value={rec.hours > 0 ? String(rec.hours) : '—'} align="right" bold />
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}

                        {/* 無明細提示 */}
                        {periodRecords.length === 0 && (
                            <div style={{
                                padding: '6px 12px',
                                color: '#94a3b8',
                                fontSize: '11px',
                                borderBottom: '1px solid #f1f5f9',
                                fontStyle: 'italic',
                            }}>
                                此期間無請假申請記錄
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

// ── 小幫手元件 ──
const SummaryCell: React.FC<{
    label: string; value: string; width?: string;
    color?: string; bold?: boolean;
}> = ({ label, value, width, color = '#1e293b', bold }) => (
    <td style={{ width, padding: '6px 10px', verticalAlign: 'middle' }}>
        <div style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 700, marginBottom: '1px' }}>{label}</div>
        <div style={{ fontSize: '12px', fontWeight: bold ? 900 : 700, color }}>{value}</div>
    </td>
);

const DetailCell: React.FC<{
    value: string; align?: 'left' | 'right'; bold?: boolean; maxWidth?: string;
}> = ({ value, align = 'left', bold, maxWidth }) => (
    <td style={{
        padding: '4px 8px',
        fontSize: '11px',
        color: '#334155',
        fontWeight: bold ? 800 : 500,
        textAlign: align,
        maxWidth,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    }}>
        {value}
    </td>
);

// ══════════════════════════════════════════════════════════
//  匯出函式（hook / utility）
// ══════════════════════════════════════════════════════════

interface ExportOptions {
    employee: Employee & { leaveBalance: LeaveBalance | null };
    records: LeaveDetailRecord[];
    onDone?: () => void;
}

/**
 * 在不可見的 DOM 容器中渲染 PdfTemplate，
 * 用 html2canvas 截圖後填入 A4 橫向 PDF 並觸發下載。
 */
export const exportLeaveBalancePdf = async ({
    employee,
    records,
    onDone,
}: ExportOptions): Promise<void> => {
    // 1. 建立臨時容器（螢幕外）
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '-9999px';
    container.style.left = '-9999px';
    container.style.zIndex = '-1';
    container.style.pointerEvents = 'none';
    document.body.appendChild(container);

    try {
        // 2. 動態渲染 React 元素到容器
        const { createRoot } = await import('react-dom/client');
        const root = createRoot(container);

        await new Promise<void>((resolve) => {
            root.render(
                React.createElement(PdfTemplate, { employee, records }),
            );
            // 等待瀏覽器繪製
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });

        const templateEl = container.firstChild as HTMLElement;
        if (!templateEl) throw new Error('Template element not found');

        // 3. html2canvas 截圖
        const canvas = await html2canvas(templateEl, {
            scale: 2,          // 2x 解析度，印刷清晰
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
            width: templateEl.scrollWidth,
            height: templateEl.scrollHeight,
            windowWidth: templateEl.scrollWidth,
            windowHeight: templateEl.scrollHeight,
        });

        // 4. 計算 PDF 尺寸（A4 橫向 = 297 × 210 mm）
        const A4_W = 297;  // mm
        const A4_H = 210;  // mm

        const imgW = canvas.width;
        const imgH = canvas.height;

        // 依寬度縮放至 A4 橫向
        const ratio = A4_W / (imgW / 2); // canvas scale=2，換算回 96dpi 點
        const pdfImgW = A4_W;
        const pdfImgH = (imgH / 2) * ratio;

        const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4',
        });

        // 5. 若高度超過一頁，進行分頁
        const pageHeight = A4_H;
        let yOffset = 0;

        while (yOffset < pdfImgH) {
            if (yOffset > 0) pdf.addPage();

            // 計算此頁要截取的 canvas 區塊
            const srcY = (yOffset / ratio) * 2; // 回換 canvas 座標
            const srcH = Math.min((pageHeight / ratio) * 2, imgH - srcY);

            // 建立此頁的臨時 canvas
            const pageCanvas = document.createElement('canvas');
            pageCanvas.width = imgW;
            pageCanvas.height = srcH;
            const ctx = pageCanvas.getContext('2d')!;
            ctx.drawImage(canvas, 0, srcY, imgW, srcH, 0, 0, imgW, srcH);

            const pageImgData = pageCanvas.toDataURL('image/jpeg', 0.95);
            const pageImgH = srcH / 2 * ratio;
            pdf.addImage(pageImgData, 'JPEG', 0, 0, pdfImgW, pageImgH);

            yOffset += pageHeight;
        }

        // 6. 觸發下載
        pdf.save(`${employee.name}_差勤額度統計明細.pdf`);
    } finally {
        document.body.removeChild(container);
        onDone?.();
    }
};

export default PdfTemplate;

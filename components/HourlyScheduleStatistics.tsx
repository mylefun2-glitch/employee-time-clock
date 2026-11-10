import React, { useMemo, useState } from 'react';
import { buildHourlyScheduleReport, buildHourlyScheduleExport, hourlyScheduleStatus } from '../lib/hourlyScheduleReport';
import type { HourlyScheduleSources, HourlyScheduleFilters } from '../lib/hourlyScheduleReport';
import { reportCsv, reportHtml } from '../lib/hrReport';

interface Props { sources: HourlyScheduleSources; month: string; filters: HourlyScheduleFilters; namedExport?: boolean }
const buttonClass = 'max-w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm font-semibold whitespace-normal [overflow-wrap:anywhere]';
export default function HourlyScheduleStatistics({ sources, month, filters, namedExport = false }: Props) {
    const [actionError, setActionError] = useState('');
    const filterKey = JSON.stringify(filters);
    const result = useMemo(() => {
        try { return { report: buildHourlyScheduleReport(sources, { month, filters }), error: '' }; }
        catch { return { report: null, error: '班表來源無法完整判讀，已停止統計與匯出，請重新載入來源。' }; }
    }, [sources, month, filterKey]);
    const report = result.report;
    function exportReport(format: 'csv' | 'print', detailBucket?: string) {
        if (!report) return;
        setActionError('');
        try {
            // A bucket action is an intentional named export of the exact shown list.
            const model = buildHourlyScheduleExport(report, { named: detailBucket !== undefined || namedExport, detailBucket });
            if (format === 'csv') {
                const url = URL.createObjectURL(new Blob([reportCsv(model)], { type: 'text/csv;charset=utf-8;' }));
                const anchor = document.createElement('a'); anchor.href = url;
                anchor.download = `班表工時-${month}-${detailBucket !== undefined ? `${detailBucket}-具名名單` : namedExport ? '具名名單' : '摘要'}.csv`;
                document.body.appendChild(anchor); anchor.click(); anchor.remove();
                window.setTimeout(() => URL.revokeObjectURL(url), 1000);
            } else {
                const popup = window.open('', '_blank');
                if (!popup) { setActionError('列印視窗遭封鎖，請允許此網站的彈出視窗後再按「班表工時列印／另存 PDF」。'); return; }
                popup.opener = null;
                popup.document.open(); popup.document.write(reportHtml(model)); popup.document.close();
                popup.focus(); popup.setTimeout(() => { if (!popup.closed) popup.print(); }, 300);
            }
        } catch { setActionError('班表工時匯出失敗，請重試；列印請確認瀏覽器允許彈出視窗。'); }
    }
    const groups = report ? [...report.buckets, { key: 'no-data', label: '未登錄班表', count: report.counts.noData, rows: report.rows.filter(r => r.status === 'no-data') }, { key: 'invalid', label: '班表資料異常', count: report.counts.invalid, rows: report.rows.filter(r => r.status === 'invalid') }] : [];
    return <section aria-labelledby="hourly-schedule-heading" className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="hourly-schedule-heading" className="text-lg font-bold">時薪制班表工時人數分布</h2>
            <div className="flex flex-wrap gap-2">
                <button type="button" disabled={!report} className={buttonClass} onClick={() => exportReport('csv')}>班表工時 CSV</button>
                <button type="button" disabled={!report} className={buttonClass} onClick={() => exportReport('print')}>班表工時列印／另存 PDF</button>
            </div>
        </div>
        <p className="text-xs text-slate-600">{month} 整月班表（含未來已排班日期），非實際出勤或薪資計算。依目前主檔時薪制及目前篩選統計，不宣稱歷史計薪身分。{namedExport ? '整體匯出含具名名單。' : '整體匯出預設僅摘要，不含姓名。'}</p>
        {result.error && <p role="alert" className="text-sm text-red-700">{result.error}</p>}
        {actionError && <p role="alert" className="text-sm text-red-700">{actionError}</p>}
        {report && <>
            <p className="text-sm">目前篩選母體 <strong>{report.counts.eligible}</strong> 人・已知 <strong>{report.counts.known}</strong> 人・未登錄班表 <strong>{report.counts.noData}</strong> 人・異常 <strong>{report.counts.invalid}</strong> 人</p>
            <p className="text-xs text-slate-600">人數核對：各工時組 {report.counts.bucketed} ＋未登錄 {report.counts.noData} ＋異常 {report.counts.invalid} ＝ {report.counts.eligible} 人。未登錄不等於零。</p>
            {report.warnings.map(warning => <p key={warning} role="status" className="text-xs text-amber-800">{warning}</p>)}
            <details className="text-xs text-slate-600">
                <summary className="cursor-pointer font-semibold">班表來源與分組定義</summary>
                <ul className="mt-2 list-disc pl-4 space-y-1">{report.definitions.map(text => <li key={text}>{text}</li>)}</ul>
            </details>
            <div key={month + filterKey} className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {groups.map(group => <details key={group.key} className="min-w-0 self-start rounded-lg border border-slate-200 p-2">
                    <summary className="cursor-pointer text-sm [overflow-wrap:anywhere]">
                        <span className="font-semibold">{group.label}</span> <strong>{group.count} 人</strong><span className="text-xs text-slate-500">・展開名單</span>
                    </summary>
                    <div className="mt-2 min-w-0 space-y-2">
                        <p className="text-xs text-slate-600">此組名單與匯出均為以下 {group.count} 人；匯出將包含姓名。</p>
                        <button type="button" className={buttonClass} onClick={() => exportReport('csv', group.key)}>匯出此組名單 CSV</button>
                        {!group.count && <p className="text-xs text-slate-500">此組無人員。</p>}
                        <ul className="divide-y divide-slate-200 text-sm">{group.rows.map(row => <li key={row.employee.id} className="min-w-0 py-2 [overflow-wrap:anywhere]">
                            <p className="font-semibold">{row.employee.name}</p>
                            <p className="text-xs text-slate-600">{row.employee.department || '未設定部門'}／{row.employee.position || '未設定職務'}</p>
                            <p className="text-xs">{row.hours === null ? hourlyScheduleStatus(row.status) : `${row.hours.toLocaleString('zh-TW', { maximumFractionDigits: 8 })} 小時`}・{row.serviceRows} 筆班表</p>
                        </li>)}</ul>
                    </div>
                </details>)}
            </div>
        </>}
    </section>;
}

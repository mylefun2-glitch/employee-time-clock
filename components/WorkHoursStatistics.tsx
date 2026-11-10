import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { buildWorkHoursReport, readWorkHoursSources } from '../lib/workHoursReport';
import { reportCsv, reportHtml } from '../lib/hrReport';
import { buildWorkHoursExport, selectWorkHoursRows, workHoursSubtotal, workHoursValue, workHoursStatus, workHoursDayCells, WORK_HOURS_DAY_HEADERS, WORK_HOURS_DEFINITIONS } from '../lib/workHoursExport';
import type { WorkHoursFilters, WorkHoursResult, WorkHoursRow } from '../lib/workHoursExport';

interface Props { month: string; asOf: string; filters: WorkHoursFilters; namedExport?: boolean }
const buttonClass = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed';

export default function WorkHoursStatistics({ month, asOf, filters, namedExport = false }: Props) {
    const [loaded, setLoaded] = useState<{ month: string; sources: Awaited<ReturnType<typeof readWorkHoursSources>> } | null>(null);
    const [loadError, setLoadError] = useState('');
    const [actionError, setActionError] = useState('');
    const [retry, setRetry] = useState(0);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const request = useRef(0);
    useEffect(() => {
        const version = ++request.current;
        let cancelled = false;
        setLoaded(null); setLoadError(''); setActionError('');
        readWorkHoursSources(supabase, month).then(sources => {
            if (!cancelled && request.current === version) setLoaded({ month, sources });
        }).catch(() => {
            if (!cancelled && request.current === version) setLoadError('工時來源未完整載入，已停止顯示與匯出。請重試。');
        });
        return () => { cancelled = true; };
    }, [month, retry]);
    const filterKey = JSON.stringify(filters);
    useEffect(() => { setPage(1); }, [month, asOf, filterKey, search]);
    const result = useMemo((): { report: WorkHoursResult | null; error: string } => {
        if (!loaded || loaded.month !== month) return { report: null, error: '' };
        try { return { report: buildWorkHoursReport(loaded.sources, { month, asOf, filters }), error: '' }; }
        catch { return { report: null, error: '工時資料無法完整判讀，已停用匯出。請重新載入。' }; }
    }, [loaded, month, asOf, filterKey]);
    const report = result.report;
    const selection = selectWorkHoursRows(report?.rows ?? [], search, page);
    const summary = workHoursSubtotal(selection.matchingRows);
    const error = loadError || result.error;
    const ready = Boolean(report && !error);

    function exportReport(format: 'csv' | 'print', detail?: WorkHoursRow) {
        if (!report || !ready) return;
        setActionError('');
        const model = buildWorkHoursExport(report, { filters, named: namedExport, rows: selection.matchingRows, detail, search });
        try {
            if (format === 'csv') {
                const url = URL.createObjectURL(new Blob([reportCsv(model)], { type: 'text/csv;charset=utf-8;' }));
                const anchor = document.createElement('a');
                anchor.href = url;
                anchor.download = `工時-${month}${detail ? '-個人每日明細' : namedExport ? '-具名名單' : '-摘要'}.csv`;
                document.body.appendChild(anchor); anchor.click(); anchor.remove();
                window.setTimeout(() => URL.revokeObjectURL(url), 1000);
            } else {
                const popup = window.open('', '_blank');
                if (!popup) { setActionError('列印視窗遭封鎖，請允許此網站的彈出視窗後再按「工時列印／另存 PDF」。'); return; }
                popup.opener = null;
                popup.document.open(); popup.document.write(reportHtml(model)); popup.document.close();
                popup.focus();
                popup.setTimeout(() => { if (!popup.closed) popup.print(); }, 300);
            }
        } catch { setActionError('工時匯出失敗，請重試；列印請確認瀏覽器允許彈出視窗。'); }
    }

    return <section aria-labelledby="work-hours-heading" className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="work-hours-heading" className="text-lg font-bold">每月工作時數</h2>
            <div className="flex flex-wrap gap-2">
                <button type="button" className={buttonClass} disabled={!ready} onClick={() => exportReport('csv')}>工時 CSV</button>
                <button type="button" className={buttonClass} disabled={!ready} onClick={() => exportReport('print')}>工時列印／另存 PDF</button>
            </div>
        </div>
        <p className="text-xs text-slate-600">{month}・截至 {asOf}（Asia/Taipei）。僅已觀測日期；未確認不等於 0，不推算缺勤，不連動薪資。{namedExport ? ' 匯出含具名名單。' : ' 預設匯出僅摘要，不含姓名。'}匯出涵蓋全部符合搜尋結果，非僅本頁。</p>
        <details className="text-xs text-slate-600">
            <summary className="cursor-pointer font-semibold">來源、認列定義與限制</summary>
            <ul className="mt-2 list-disc pl-4 space-y-1">{WORK_HOURS_DEFINITIONS.map(text => <li key={text}>{text}</li>)}{report?.notes.map((note, index) => <li key={`note-${index}`} className="break-words">{note}</li>)}</ul>
        </details>
        {error ? <div role="alert" className="text-sm text-red-700">{error} <button type="button" className={buttonClass} onClick={() => setRetry(value => value + 1)}>重新載入工時</button></div> : !ready ? <p role="status" className="text-sm text-slate-500">正在完整載入工時來源…</p> : null}
        {actionError && <p role="alert" className="text-sm text-red-700">{actionError}</p>}
        {ready && <>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="min-w-0 text-sm">姓名搜尋 <input type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} className="ml-1 w-40 max-w-full rounded-lg border border-slate-300 p-2 text-base" placeholder="輸入姓名" /></label>
                <span className="text-xs text-slate-600">符合 {selection.count} 人</span>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
                <h3 className="text-sm font-bold">已確認工時小計（非完整總工時）</h3>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                    <div>正常工時 <strong>{workHoursValue(summary.normalHours)}</strong> 小時</div>
                    <div>核准加班 <strong>{workHoursValue(summary.overtimeHours)}</strong> 小時</div>
                    <div>合計認列工時 <strong>{workHoursValue(summary.totalHours)}</strong> 小時</div>
                </div>
                <p className="mt-2 text-xs text-slate-600">待確認 {summary.pendingPeople} 人・無資料 {summary.noDataPeople} 人；僅加總已知部分，未確認部分不當成零。</p>
            </div>
            <div className="divide-y divide-slate-200">
                {selection.pageRows.map(row => <details key={row.employee.id} className="py-2 min-w-0">
                    <summary className="cursor-pointer list-none rounded-lg p-1 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                            <span className="font-semibold break-all">{row.employee.name} <span className="text-xs font-normal text-slate-500">{row.employee.department || '未設定'}／{row.employee.position || '未設定'}</span></span>
                            <span className="text-xs text-slate-600">{workHoursStatus(row.status)}{row.pendingDays > 0 ? `・${row.pendingDays} 日待確認` : ''}・展開明細 ▾</span>
                        </div>
                        <div className="mt-1 grid grid-cols-3 gap-1 text-xs sm:text-sm">
                            <span>正常工時<br /><strong>{workHoursValue(row.normalHours)}</strong></span>
                            <span>核准加班<br /><strong>{workHoursValue(row.overtimeHours)}</strong></span>
                            <span>合計認列工時<br /><strong>{workHoursValue(row.totalHours)}</strong></span>
                        </div>
                        {row.serviceHours !== 0 && <p className="mt-1 text-xs text-amber-800">服務匯入參考 {workHoursValue(row.serviceHours)} 小時：未證明完成或排除重疊，不計入工時。</p>}
                    </summary>
                    <div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-2">
                        <p className="text-xs text-slate-600">每日明細（小時）。以下個人匯出將含姓名與畫面相同日期，不受「僅摘要」設定限制。</p>
                        <div className="flex flex-wrap gap-2">
                            <button type="button" className={buttonClass} disabled={!ready} onClick={() => exportReport('csv', row)}>個人工時 CSV（具名）</button>
                            <button type="button" className={buttonClass} disabled={!ready} onClick={() => exportReport('print', row)}>個人工時列印／另存 PDF（具名）</button>
                        </div>
                        {row.days.length === 0 && <p className="text-sm">無已觀測日期，不能視為零工時。</p>}
                        {row.days.map(day => <div key={day.date} className="rounded border border-slate-200 bg-white p-2 text-xs">
                            <dl className="grid grid-cols-1 gap-1 sm:grid-cols-2">{workHoursDayCells(day).map((value, index) => <div key={index} className="min-w-0 break-words"><dt className="inline font-semibold">{WORK_HOURS_DAY_HEADERS[index]}：</dt><dd className="inline whitespace-pre-wrap [overflow-wrap:anywhere]">{value}</dd></div>)}</dl>
                        </div>)}
                    </div>
                </details>)}
                {!selection.count && <p className="py-4 text-sm text-slate-500">沒有符合條件的人員。</p>}
            </div>
            <nav aria-label="工時名單分頁" className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span>每頁 20 人・第 {selection.page}／{selection.pages} 頁・{selection.count ? (selection.page - 1) * 20 + 1 : 0}–{Math.min(selection.page * 20, selection.count)}／{selection.count} 人</span>
                <div className="flex gap-1">
                    <button type="button" className={buttonClass} disabled={selection.page <= 1} onClick={() => setPage(1)}>首頁</button>
                    <button type="button" className={buttonClass} disabled={selection.page <= 1} onClick={() => setPage(selection.page - 1)}>上頁</button>
                    <button type="button" className={buttonClass} disabled={selection.page >= selection.pages} onClick={() => setPage(selection.page + 1)}>下頁</button>
                    <button type="button" className={buttonClass} disabled={selection.page >= selection.pages} onClick={() => setPage(selection.pages)}>末頁</button>
                </div>
            </nav>
        </>}
    </section>;
}

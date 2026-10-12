// Isolated synthetic UI fixture: no Supabase calls, auth, or attendance writes.
// Run from the repository root: node ui-tests/attendance-anomaly-ui.mjs
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const records = [
    ['a', '測試甲', '行政組', '2026-10-10', 'LATE', 'MEDIUM', '遲到', '08:35', '08:30'],
    ['a', '測試甲', '行政組', '2026-10-10', 'EARLY_LEAVE', 'MEDIUM', '早退', '17:20', '17:30'],
    ['a', '測試甲', '行政組', '2026-10-09', 'ABSENT', 'HIGH', '當日無打卡紀錄'],
    ['b', '測試乙長姓名', '很長的照顧服務單位', '2026-10-10', 'MISSING_CHECK', 'HIGH', '缺少下班打卡'],
    ['b', '測試乙長姓名', '很長的照顧服務單位', '2026-10-10', 'OVERTIME', 'LOW', '超時待確認', '20:00', '17:30'],
].map(([employeeId, employeeName, department, date, type, severity, description, actualTime, expectedTime], index) => ({ id: String(index), employeeId, employeeName, department, date, type, severity, description, actualTime, expectedTime, status: 'PENDING' }));
const bundle = await build({
    stdin: { contents: `import React from 'react'; import { createRoot } from 'react-dom/client'; import Dashboard from './components/AttendanceAnomalyDashboard'; createRoot(document.getElementById('root')).render(<Dashboard />);`, resolveDir: process.cwd(), loader: 'tsx' },
    bundle: true, write: false, format: 'iife', define: { 'process.env.NODE_ENV': '"development"' },
    plugins: [{ name: 'isolated-service', setup(plugin) {
        plugin.onResolve({ filter: /services\/anomalyDetectionService$/ }, () => ({ path: 'fixture-service', namespace: 'fixture' }));
        plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `const records = ${JSON.stringify(records)}; export const anomalyDetectionService = { async detectAnomalies(start, end) { window.fixtureCalls = (window.fixtureCalls || []).concat({start,end}); const days = Math.round((new Date(end)-new Date(start))/86400000)+1; await new Promise(r=>setTimeout(r,days===30?150:20)); if(days===14) throw new Error('Synthetic fixture error'); return days===3?[]:records; } };`, loader: 'js' }));
    } }],
});
const tailwindResponse = await fetch('https://cdn.tailwindcss.com');
assert.ok(tailwindResponse.ok, 'Tailwind CDN retrieval must succeed for meaningful layout verification');
const tailwind = await tailwindResponse.text();
const html = `<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script src="/tailwind.js"></script><style>body{margin:0;background:#f1f5f9;font-family:Arial,sans-serif}#root{max-width:1120px;margin:24px auto;padding:0 12px}</style><div id="root"></div><script src="/fixture.js"></script></html>`;
const server = createServer((request, response) => {
    response.setHeader('Content-Type', request.url === '/' ? 'text/html' : 'application/javascript');
    response.end(request.url === '/fixture.js' ? bundle.outputFiles[0].text : request.url === '/tailwind.js' ? tailwind : html);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const output = resolve('/Users/mylefun/.hermes/cache/scratch/attendance-anomaly-ui');
await mkdir(output, { recursive: true });
const report = [];
try {
    for (const width of [1280, 390, 320]) {
        const page = await browser.newPage({ viewport: { width, height: 900 } });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(`http://127.0.0.1:${server.address().port}`);
        const status = page.getByRole('status');
        await status.filter({ hasText: '區間合計' }).waitFor();
        assert.match(await status.textContent(), /2 人・3 異常人日・5 筆異常/);
        const employee = page.getByRole('button', { name: /測試甲/ });
        assert.equal(await employee.getAttribute('aria-expanded'), 'false');
        assert.match(await employee.textContent(), /2 天・3 筆/);
        if (width === 1280) {
            const y = await employee.locator('span').evaluateAll(spans => spans.slice(0, 3).map(s => s.getBoundingClientRect().y));
            assert.ok(Math.max(...y) - Math.min(...y) < 8, 'Desktop name, department, counts must share one row');
        }
        await employee.click();
        assert.equal(await employee.getAttribute('aria-expanded'), 'true');
        assert.equal(await page.locator('time').count(), 2, 'Three anomalies must group into two employee-date detail rows');
        assert.ok(await page.getByText('應 08:30／實 08:35', { exact: true }).isVisible());
        assert.equal(await page.getByText('曠職', { exact: true }).count(), 0);
        await page.getByRole('button', { name: /測試乙長姓名/ }).click();
        assert.equal(await page.locator('time').count(), 3);
        assert.ok(await page.getByText('應 17:30／實 20:00', { exact: true }).isVisible());
        await page.screenshot({ path: resolve(output, `expanded-${width}.png`), fullPage: true });
        const overflow = await page.evaluate(() => {
            const root = document.documentElement;
            return { viewport: innerWidth, document: root.scrollWidth, overflowing: [...document.querySelectorAll('section *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).map(e => e.tagName) };
        });
        assert.ok(overflow.document <= overflow.viewport && overflow.overflowing.length === 0, JSON.stringify(overflow));
        await page.getByRole('textbox').fill('行政');
        assert.match(await status.textContent(), /1 人・2 異常人日・3 筆異常/);
        await page.getByLabel('異常類型', { exact: true }).selectOption('ABSENT');
        assert.match(await status.textContent(), /1 人・1 異常人日・1 筆異常/);
        await page.getByRole('textbox').fill('no-match');
        assert.ok(await page.getByText('沒有符合篩選條件的異常').isVisible());
        await page.getByRole('button', { name: '清除篩選', exact: true }).first().click();
        await page.getByLabel('異常程度', { exact: true }).selectOption('LOW');
        assert.match(await status.textContent(), /1 人・1 異常人日・1 筆異常/);
        await page.getByRole('button', { name: '清除篩選', exact: true }).click();
        await page.getByLabel('查詢日期範圍').selectOption('3');
        await page.getByText('此區間未偵測到需確認的異常').waitFor();
        assert.ok(await page.getByLabel('查詢日期範圍').isVisible());
        await page.getByLabel('查詢日期範圍').selectOption('14');
        await page.getByRole('alert').waitFor();
        assert.ok(await page.getByLabel('查詢日期範圍').isVisible());
        await page.screenshot({ path: resolve(output, `error-${width}.png`), fullPage: true });
        const beforeRetry = await page.evaluate(() => window.fixtureCalls.length);
        await page.getByRole('button', { name: '重新讀取' }).click();
        await page.getByRole('alert').waitFor();
        assert.equal(await page.evaluate(() => window.fixtureCalls.length), beforeRetry + 1);
        await page.getByLabel('查詢日期範圍').selectOption('30');
        assert.ok(await page.getByLabel('查詢日期範圍').isVisible());
        await page.getByLabel('查詢日期範圍').selectOption('3');
        await page.getByText('此區間未偵測到需確認的異常').waitFor();
        await page.waitForTimeout(220);
        assert.ok(await page.getByText('此區間未偵測到需確認的異常').isVisible(), 'Stale range response must not replace current result');
        assert.deepEqual(errors, []);
        report.push({ width, result: 'PASS', checks: 'counts, collapsed defaults, grouped dates, expected/actual, search/type/LOW filters, zero matches, empty/error/loading controls, retry, stale response, no horizontal overflow' });
        await page.close();
    }
    console.log(JSON.stringify({ syntheticFixture: true, report, screenshots: output }, null, 2));
} finally {
    await browser.close();
    await new Promise(r => server.close(r));
}

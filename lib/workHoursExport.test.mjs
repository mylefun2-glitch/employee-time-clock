import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const transpile = file => ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;
const dataUrl = code => 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
const sharedUrl = dataUrl(transpile('./hrReport.ts'));
const h = await import(sharedUrl);
const w = await import(dataUrl(transpile('./workHoursExport.ts').replace("'./hrReport'", JSON.stringify(sharedUrl))));
const filters = { department: ['ALL'], position: ['ALL'], gender: ['ALL'] };
const row = (index = 1) => ({ employee: { id: `SECRET_ID_${index}`, name: `姓名${index}`, department: '測試單位', position: '員工', gender: 'OTHER', is_active: true, pin: 'SECRET_PIN', birth_date: 'SECRET_BIRTH', phone: 'SECRET_PHONE' }, normalHours: null, overtimeHours: 2, totalHours: null, knownNormalHours: 7.5, knownOvertimeHours: 2, knownTotalHours: 9.5, serviceHours: 10, pendingDays: 1, status: 'pending', days: [{ date: '2026-11-01', punches: ['IN 08:00', 'OUT 16:30'], normalHours: 7.5, overtimeHours: 0, totalHours: 7.5, serviceHours: 0, issues: [], source: '打卡＋班表' }, { date: '2026-11-02', punches: ['IN 08:00'], normalHours: null, overtimeHours: 2, totalHours: null, serviceHours: 10, issues: ['缺下班卡'], source: '打卡＋核准加班' }] });
const fixture = () => ({ month: '2026-11', asOf: '2026-11-10', rows: Array.from({ length: 45 }, (_, index) => row(index + 1)), summary: { normalHours: 337.5, overtimeHours: 90, totalHours: 427.5, pendingPeople: 45, noDataPeople: 0 }, notes: ['來源完整；仍可能有待確認日'] });
const opts = extra => ({ filters, producedAt: new Date('2026-11-10T00:00:00Z'), ...extra });

test('default privacy: summaries only, no names, IDs, private data, or raw name query', () => {
    const report = w.buildWorkHoursExport(fixture(), opts({ search: '姓名', named: false }));
    assert.equal(report.tables.length, 1);
    for (const output of [h.reportCsv(report), h.reportHtml(report)]) {
        for (const secret of ['姓名1', 'SECRET_ID', 'SECRET_PIN', 'SECRET_BIRTH', 'SECRET_PHONE']) assert.ok(!output.includes(secret));
        assert.ok(output.includes('已確認工時小計')); assert.ok(output.includes('非完整總工時'));
        assert.ok(output.includes('2026-11-10')); assert.ok(output.includes('不連動薪資'));
    }
    assert.equal(report.metadata.find(([key]) => key === '姓名搜尋')[1], '已套用（摘要不輸出搜尋文字）');
});
test('named whitelist and null distinct from zero; reference excluded from known totals', () => {
    const report = w.buildWorkHoursExport(fixture(), opts({ named: true }));
    assert.equal(report.tables[1].rows.length, 45);
    assert.deepEqual(report.tables[1].rows[0], ['姓名1', '測試單位', '員工', '未確認', '2', '未確認', '待確認', '10']);
    assert.equal(w.workHoursValue(0), '0');
    assert.deepEqual(w.workHoursSubtotal([row()]), { normalHours: 7.5, overtimeHours: 2, totalHours: 9.5, pendingPeople: 1, noDataPeople: 0 });
    for (const output of [h.reportCsv(report), h.reportHtml(report)]) for (const forbidden of ['SECRET_ID', 'SECRET_PIN', 'SECRET_BIRTH', 'SECRET_PHONE']) assert.ok(!output.includes(forbidden));
});
test('no-data is unknown, not zero; translated daily reasons shared with export', () => {
    const source = fixture(); const empty = row();
    Object.assign(empty, { days: [], status: 'no-data', normalHours: null, overtimeHours: null, totalHours: null, knownNormalHours: 0, knownOvertimeHours: 0, knownTotalHours: 0, serviceHours: 0, pendingDays: 0 });
    source.rows = [empty];
    const report = w.buildWorkHoursExport(source, opts({ named: true }));
    assert.deepEqual(report.tables[1].rows[0].slice(3, 7), ['未確認', '未確認', '未確認', '無資料']);
    assert.equal(report.tables[0].rows.find(row => row[0] === '無資料')[1], 1);
    const day = { ...row().days[1], source: 'punches+service-reference', issues: ['service-punch-ambiguity'] };
    assert.equal(w.workHoursDayCells(day)[6], '打卡＋服務匯入參考');
    assert.equal(w.workHoursDayCells(day)[7], '服務匯入與打卡可能重疊，待核對');
});
test('explicit detail overrides summary privacy and uses exactly displayed days and shared cells', () => {
    const detail = row(); detail.days = [detail.days[1]];
    const report = w.buildWorkHoursExport(fixture(), opts({ named: false, detail }));
    assert.equal(report.tables.length, 2);
    assert.deepEqual(report.tables[1].rows, detail.days.map(w.workHoursDayCells));
    assert.ok(h.reportCsv(report).includes('姓名1')); assert.ok(!h.reportCsv(report).includes('姓名2'));
    assert.ok(!h.reportCsv(report).includes('2026-11-01')); assert.ok(h.reportCsv(report).includes('缺下班卡'));
});
test('search before page, clamped bounded pagination, export entire matching set', () => {
    const source = fixture();
    const view = w.selectWorkHoursRows(source.rows, '', 2);
    assert.equal(view.pageRows.length, 20); assert.equal(view.pageRows[0].employee.name, '姓名21');
    assert.equal(view.matchingRows.length, 45); assert.equal(view.pages, 3);
    const report = w.buildWorkHoursExport(source, opts({ named: true, rows: view.matchingRows }));
    assert.equal(report.tables[1].rows.length, 45);
    const searched = w.selectWorkHoursRows(source.rows, '姓名2', 99);
    assert.equal(searched.count, 11); assert.equal(searched.page, 1);
    const exported = w.buildWorkHoursExport(source, opts({ named: true, rows: searched.matchingRows, search: '姓名2' }));
    assert.deepEqual(exported.tables[1].rows.map(row => row[0]), searched.matchingRows.map(row => row.employee.name));
    assert.equal(exported.tables[0].rows[0][1], 11);
    assert.equal(w.selectWorkHoursRows(source.rows, '無此人', -1).pageRows.length, 0);
});
test('shared serializers: CSV formula defense, BOM, HTML escaping and identical model content', () => {
    const source = fixture(); source.rows = [row()]; source.rows[0].employee.name = ' \t=1+1,"中文"\n<script>x</script>';
    const report = w.buildWorkHoursExport(source, opts({ named: true }));
    const csv = h.reportCsv(report); const html = h.reportHtml(report);
    assert.equal(Buffer.from(csv).subarray(0, 3).toString('hex'), 'efbbbf');
    assert.ok(csv.includes('"\' \t=1+1,""中文""\n<script>x</script>"'));
    assert.ok(!html.includes('<script>')); assert.ok(html.includes('&lt;script&gt;'));
    assert.ok(html.includes('size:A4')); assert.ok(html.includes('thead{display:table-header-group}'));
    assert.ok(csv.includes('service_mins')); assert.ok(html.includes('service_mins'));
});

test('daily punches show Taipei local clock and direction; unknown OT exposes known subtotal', () => {
    const day = { date: '2026-10-01', punches: ['2026-10-01T00:11:42.589+00:00', '2026-10-01T09:24:24.485Z'], punchTypes: ['IN', 'OUT'], normalHours: 7.8, overtimeHours: null, knownOvertimeHours: 1.5, totalHours: null, serviceHours: 0, issues: ['missing-ot-hours'], source: 'punches' };
    const cells = w.workHoursDayCells(day);
    assert.equal(cells[1], '上班 08:11:42；下班 17:24:24');
    assert.ok(cells[7].includes('已知核准加班 1.5 小時'));
    assert.ok(!cells[1].includes('+00:00'));
});

// Execute the real component with a minimal hook runner. No network or UI stub
// replaces its loading, stale guards, search, paging, or export event handlers.
async function componentHarness() {
    const React = await import('react');
    const actualReact = React.default;
    const values = [], deps = [], effects = []; let cursor = 0;
    const equal = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
    const mockReact = { ...actualReact,
        useState(initial) { const index = cursor++; if (!(index in values)) values[index] = initial; return [values[index], next => { values[index] = typeof next === 'function' ? next(values[index]) : next; }]; },
        useRef(initial) { const index = cursor++; return values[index] ?? (values[index] = { current: initial }); },
        useMemo(fn, nextDeps) { const index = cursor++; if (!equal(deps[index], nextDeps)) { values[index] = fn(); deps[index] = nextDeps; } return values[index]; },
        useEffect(fn, nextDeps) { const index = cursor++; if (!equal(deps[index], nextDeps)) { values[index]?.(); effects.push(() => { values[index] = fn(); }); deps[index] = nextDeps; } }
    };
    const loads = [];
    const read = (_, month) => new Promise((resolve, reject) => loads.push({ month, resolve, reject }));
    const build = (sources, input) => ({ ...sources, ...input });
    const source = transpile('../components/WorkHoursStatistics.tsx').replace(/^import .*?;\n/gm, '').replace('export default function WorkHoursStatistics', 'function WorkHoursStatistics');
    const component = new Function('React', 'useEffect', 'useMemo', 'useRef', 'useState', 'supabase', 'buildWorkHoursReport', 'readWorkHoursSources', 'reportCsv', 'reportHtml', ...Object.keys(w), source + '\nreturn WorkHoursStatistics;')(mockReact, mockReact.useEffect, mockReact.useMemo, mockReact.useRef, mockReact.useState, {}, build, read, h.reportCsv, h.reportHtml, ...Object.values(w));
    return { loads, render(props) { cursor = 0; const tree = component(props); effects.splice(0).forEach(effect => effect()); return tree; } };
}
const nodes = tree => tree == null || typeof tree !== 'object' ? [] : [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)];
const text = tree => tree == null || typeof tree === 'boolean' ? '' : typeof tree !== 'object' ? String(tree) : [tree.props?.children].flat(Infinity).map(text).join('');
const settle = () => new Promise(resolve => setImmediate(resolve));
test('real component: exports disabled on loading/failure/month change; late old source discarded', async () => {
    const harness = await componentHarness();
    const props = { month: '2026-10', asOf: '2026-11-10', filters };
    let tree = harness.render(props);
    assert.ok(nodes(tree).find(node => text(node) === '工時 CSV').props.disabled);
    const next = { ...props, month: '2026-11' };
    tree = harness.render(next);
    harness.loads[1].resolve(fixture()); await settle(); tree = harness.render(next);
    assert.equal(nodes(tree).find(node => text(node) === '工時 CSV').props.disabled, false);
    harness.loads[0].resolve({ ...fixture(), rows: [row(999)] }); await settle(); tree = harness.render(next);
    assert.ok(!text(tree).includes('姓名999')); assert.ok(text(tree).includes('符合 45 人'));
    const december = { ...next, month: '2026-12' };
    tree = harness.render(december); assert.ok(nodes(tree).find(node => text(node) === '工時 CSV').props.disabled);
    harness.loads[2].reject(new Error('later page failure')); await settle(); tree = harness.render(december);
    assert.ok(text(tree).includes('來源未完整載入')); assert.ok(!text(tree).includes('姓名1'));
});
test('real component search resets page; popup block visible; opener nulled and same print model', async () => {
    const harness = await componentHarness(); const props = { month: '2026-11', asOf: '2026-11-10', filters };
    harness.render(props); harness.loads[0].resolve(fixture()); await settle();
    let tree = harness.render(props);
    nodes(tree).find(node => node.type === 'button' && text(node) === '下頁').props.onClick(); tree = harness.render(props);
    assert.ok(text(tree).includes('第 2／3 頁'));
    nodes(tree).find(node => node.type === 'input').props.onChange({ target: { value: '姓名2' } }); tree = harness.render(props);
    assert.ok(text(tree).includes('第 1／1 頁')); assert.ok(text(tree).includes('符合 11 人'));
    const previousWindow = globalThis.window; let written = '', printInvoked = false; const popup = { opener: 'old', closed: false, focus() {}, setTimeout(fn) { fn(); }, print() { printInvoked = true; }, document: { open() {}, write(html) { written = html; }, close() {} } };
    try {
        globalThis.window = { open: () => null };
        nodes(tree).find(node => node.type === 'button' && text(node) === '工時列印／另存 PDF').props.onClick();
        tree = harness.render(props); assert.ok(text(tree).includes('列印視窗遭封鎖'));
        globalThis.window = { open: () => popup };
        nodes(tree).find(node => node.type === 'button' && text(node) === '工時列印／另存 PDF').props.onClick();
        assert.equal(popup.opener, null); assert.equal(printInvoked, true); assert.ok(written.includes('已確認工時小計')); assert.ok(!written.includes('姓名2</td>'));
    } finally { globalThis.window = previousWindow; }
});

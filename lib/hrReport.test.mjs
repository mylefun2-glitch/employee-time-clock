import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const code = ts.transpileModule(fs.readFileSync(new URL('./hrReport.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const h = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const fixture = () => ({ month: '2026-11', asOf: '2026-11-10', producedAt: new Date('2026-11-09T16:01:00Z'), filters: { department: ['A,單位'], position: ['ALL'], gender: ['OTHER'] }, named: false,
    stats: { total: 1, gender: { male: 0, female: 0, other: 1 }, avgCheckInTime: '--:--', avgCheckOutTime: '00:00', positions: { 未設定: 1 }, ageRanges: { 未知: 1 }, seniorityRanges: { 未知: 1 }, leaveTypeStats: { 病假: 0 }, activeLeaveTypes: ['病假'], employeeLeavePivot: [{ employeeName: '保密姓名', department: 'A', leaves: { 病假: 0 }, totalHours: 0 }] },
    roster: [{ name: '=1+1,"測試"\n中文', department: 'A,單位', position: '未設定', gender: '其他／未填', age: '未知', seniority: '未知', birth_date: 'SECRET_BIRTH', id: 'SECRET_ID', pin: 'SECRET_PIN', phone: 'SECRET_PHONE' }] });
// RFC4180 parser: tests actual cell contents, including embedded newlines.
function parseCsv(text) { const rows = []; let row = [], cell = '', quote = false; text = text.replace(/^\uFEFF/, ''); for (let i = 0; i < text.length; i++) { const c = text[i]; if (c === '"') { if (quote && text[i + 1] === '"') { cell += '"'; i++; } else quote = !quote; } else if (!quote && c === ',') { row.push(cell); cell = ''; } else if (!quote && c === '\r' && text[i + 1] === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i++; } else cell += c; } row.push(cell); rows.push(row); return rows; }
test('CSV BOM, RFC quoting, formula protection, Chinese, zero and missing', () => {
    const raw = h.reportCsv({ title: '測試', metadata: [], tables: [{ title: '表', headers: ['值'], rows: [['a,"b"\nc'], [0], [null], ['=SUM(A1)'], [' \t+1'], ['@a'], ['-2'], ['\ttext']] }] });
    assert.equal(raw.charCodeAt(0), 0xfeff);
    const cells = parseCsv(raw).flat();
    for (const value of ['a,"b"\nc', '0', '', "'=SUM(A1)", "' \t+1", "'@a", "'-2", "'\ttext"]) assert.ok(cells.includes(value), value);
});
test('summary privacy; explicit roster/pivot; same model for both formats', () => {
    const input = fixture(); const summary = h.buildHrReport(input);
    assert.equal(summary.tables.length, 5);
    for (const output of [h.reportCsv(summary), h.reportHtml(summary)]) { assert.ok(!output.includes('保密姓名')); assert.ok(!output.includes('=1+1')); assert.ok(output.includes('A,單位')); assert.ok(output.includes('其他／未填')); }
    input.named = true; const report = h.buildHrReport(input);
    assert.equal(report.tables.length, 7);
    const csv = h.reportCsv(report), html = h.reportHtml(report);
    assert.ok(parseCsv(csv).some(row => row[0] === "'=1+1,\"測試\"\n中文"));
    for (const output of [csv, html]) for (const forbidden of ['SECRET_BIRTH', 'SECRET_ID', 'SECRET_PIN', 'SECRET_PHONE']) assert.ok(!output.includes(forbidden));
    assert.ok(html.includes('size:A4')); assert.ok(html.includes('列印／另存 PDF')); assert.ok(html.includes('&quot;測試&quot;'));
    for (const [key, value] of report.metadata) { assert.ok(parseCsv(csv).some(row => row[0] === key && row[1] === value)); }
});
test('detail exports exact input list and no broader summary or pivot', () => {
    const input = fixture(); input.named = true; input.detail = '性別・其他／未填';
    const report = h.buildHrReport(input);
    assert.equal(report.tables.length, 1); assert.equal(report.tables[0].rows.length, input.roster.length);
    assert.equal(report.tables[0].rows[0][0], input.roster[0].name);
    assert.ok(!h.reportCsv(report).includes('保密姓名'));
    input.roster = []; assert.equal(h.buildHrReport(input).tables[0].rows.length, 0);
});
test('print escapes active HTML including metadata and names', () => {
    const report = { title: '<script>attack</script>', metadata: [['<x>', '"<&']], tables: [{ title: '<img>', headers: ['<h>'], rows: [['</td><script>x</script>']] }] };
    const html = h.reportHtml(report); assert.ok(!html.includes('<script>')); assert.ok(html.includes('&lt;script&gt;')); assert.ok(!html.includes('<img>'));
});
test('Taiwan month rollover and minutes independent of host timezone', () => {
    assert.deepEqual(h.monthBounds('2026-12'), { start: '2026-12-01T00:00:00+08:00', end: '2027-01-01T00:00:00+08:00' });
    assert.throws(() => h.monthBounds('2026-13'));
    assert.equal(h.taiwanDate(new Date('2026-11-09T16:01:00Z')), '2026-11-10');
    assert.equal(h.taiwanMinutes('2026-11-09T16:01:00Z'), 1);
    assert.equal(h.genderGroup({ gender: 'unknown' }), 'OTHER'); assert.equal(h.genderGroup({}), 'OTHER');
});
function mockClient({ failTable, failOffset } = {}) {
    const calls = []; const data = Object.fromEntries(['employees', 'attendance_logs', 'leave_requests', 'leave_types'].map(table => [table, Array.from({ length: 1001 }, (_, id) => ({ id, table }))]));
    return { calls, from(table) { const events = []; const query = { select(...a) { events.push(['select', ...a]); return query; }, eq(...a) { events.push(['eq', ...a]); return query; }, or(...a) { events.push(['or', ...a]); return query; }, gte(...a) { events.push(['gte', ...a]); return query; }, lt(...a) { events.push(['lt', ...a]); return query; }, order(...a) { events.push(['order', ...a]); return query; }, async range(start, end) { calls.push({ table, events, start, end }); return table === failTable && start === failOffset ? { data: null, error: { message: 'failed' } } : { data: data[table].slice(start, end + 1), error: null }; } }; return query; } };
}
test('all four sources paginate with stable order and original conditions', async () => {
    const client = mockClient(); const result = await h.readStatisticsSources(client, '2026-11');
    for (const rows of Object.values(result)) assert.equal(rows.length, 1001);
    assert.equal(client.calls.length, 12);
    for (const call of client.calls) assert.ok(call.events.some(event => event[0] === 'order' && event[1] === 'id' && event[2].ascending));
    for (const table of ['employees', 'attendance_logs', 'leave_requests', 'leave_types']) assert.deepEqual(client.calls.filter(c => c.table === table).map(c => c.start), [0, 500, 1000]);
    const leaves = client.calls.find(c => c.table === 'leave_requests').events;
    assert.ok(leaves.some(e => e[0] === 'eq' && e[1] === 'status' && e[2] === 'APPROVED'));
    assert.ok(leaves.some(e => e[0] === 'or' && e[1] === 'is_modified.is.null,is_modified.eq.false'));
    assert.ok(leaves.some(e => e[0] === 'gte' && e[1] === 'start_date' && e[2] === '2026-11-01T00:00:00+08:00'));
});
test('later page failure rejects entire source bundle; malformed data rejects', async () => {
    await assert.rejects(h.readStatisticsSources(mockClient({ failTable: 'attendance_logs', failOffset: 500 }), '2026-11'));
    await assert.rejects(h.readAllPages(() => ({ order() { return this; }, range: async () => ({ data: null, error: null }) })));
});

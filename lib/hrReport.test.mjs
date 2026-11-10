import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const code = ts.transpileModule(fs.readFileSync(new URL('./hrReport.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const h = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const utilsCode = ts.transpileModule(fs.readFileSync(new URL('./hrUtils.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const u = await import('data:text/javascript;base64,' + Buffer.from(utilsCode).toString('base64'));
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
test('exclusive age buckets cover 34/35/44/45/64/65/69/70 and exact birthdays', () => {
    assert.deepEqual(u.AGE_RANGES, ['未滿35歲', '35歲～44歲', '45歲～64歲', '65歲～69歲', '70歲以上', '未知']);
    for (const [age, range] of [[34, '未滿35歲'], [35, '35歲～44歲'], [44, '35歲～44歲'], [45, '45歲～64歲'], [64, '45歲～64歲'], [65, '65歲～69歲'], [69, '65歲～69歲'], [70, '70歲以上']]) {
        const birth = `${2026 - age}-11-10`;
        assert.equal(u.calculateAgeAsOf(birth, '2026-11-10'), age);
        assert.equal(u.calculateAgeAsOf(birth, '2026-11-09'), age - 1);
        assert.equal(u.calculateAgeAsOf(birth, '2026-11-11'), age);
        assert.equal(u.getAgeRange(u.calculateAgeAsOf(birth, '2026-11-10')), range);
    }
    assert.equal(u.calculateAgeAsOf('2026-11-10', '2026-11-10'), 0);
    assert.equal(u.getAgeRange(0), '未滿35歲');
});
test('missing, malformed, impossible and future birth dates are unknown, never young', () => {
    for (const birth of [null, undefined, '', ' ', 'not-a-date', '1991-2-03', '1991/02/03', '0000-01-01', '1991-00-10', '1991-13-10', '1991-11-00', '1991-11-31', '1991-02-29', '1900-02-29', '2000-02-30', '1991-11-10T00:00:00Z', '2026-11-11', '2030-01-01']) {
        assert.equal(u.calculateAgeAsOf(birth, '2026-11-10'), null, String(birth));
        assert.equal(u.getAgeRange(u.calculateAgeAsOf(birth, '2026-11-10')), '未知', String(birth));
    }
    for (const age of [null, undefined, NaN, Infinity, -Infinity, -1, 34.5]) assert.equal(u.getAgeRange(age), '未知');
    for (const asOf of ['', 'invalid', '2026-02-30']) assert.equal(u.calculateAgeAsOf('1991-11-10', asOf), null);
    assert.equal(u.calculateAgeAsOf('2000-02-29', '2026-02-28'), 25);
    assert.equal(u.calculateAgeAsOf('2000-02-29', '2026-03-01'), 26);
});
test('age cutoff uses Taiwan calendar across UTC midnight and ignores later clock changes', () => {
    const before = h.taiwanDate(new Date('2026-11-09T15:59:59Z'));
    const asOf = h.taiwanDate(new Date('2026-11-09T16:00:00Z'));
    assert.equal(u.getAgeRange(u.calculateAgeAsOf('1991-11-10', before)), '未滿35歲');
    assert.equal(u.getAgeRange(u.calculateAgeAsOf('1991-11-10', asOf)), '35歲～44歲');
    assert.equal(u.calculateAgeAsOf('1991-11-11', asOf), 34);
});

// Execute the page's actual grouping, chart aggregation, drill-down selection and
// export roster expression. This catches wiring drift, not just helper behavior.
const pageSource = fs.readFileSync(new URL('../pages/admin/StatisticsPage.tsx', import.meta.url), 'utf8');
const pageAst = ts.createSourceFile('StatisticsPage.tsx', pageSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function pageExpression(name, property = false) {
    let expression;
    function visit(node) {
        if ((property ? ts.isPropertyAssignment(node) : ts.isVariableDeclaration(node)) && node.name?.getText(pageAst) === name) expression = node.initializer.getText(pageAst);
        ts.forEachChild(node, visit);
    }
    visit(pageAst);
    assert.ok(expression, `page expression ${name} exists`);
    return expression;
}
function pageAgeModel(people, asOf, detail) {
    const declarations = ['ageGroup', 'seniorityGroup', 'positionGroup', 'detailEmployees', 'getStats'].map(name => `const ${name} = ${pageExpression(name)};`).join('\n');
    const body = `const filteredEmployees = people; const filters = { department: ['ALL'] }; const attendanceLogs = []; const leaveRequests = []; ${declarations}\nreturn { stats: getStats(), detailEmployees, roster: ${pageExpression('roster', true)} };`;
    const compiled = ts.transpileModule(body, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const helpers = { ...u, genderGroup: h.genderGroup, genderLabel: h.genderLabel };
    return new Function(...Object.keys(helpers), 'people', 'asOf', 'detail', compiled)(...Object.values(helpers), people, asOf, detail);
}
test('page chart, every age drill-down and CSV/print exports agree on the same cutoff and exclusive groups', () => {
    const ages = [34, 35, 44, 45, 64, 65, 69, 70];
    const births = [...ages.map(age => `${2026 - age}-11-10`), null, '', 'invalid', '1991-02-29', '2026-11-11'];
    const people = births.map((birth_date, i) => ({ id: i, name: `測試${i}`, birth_date, department: 'A', gender: 'OTHER' }));
    const asOf = h.taiwanDate(new Date('2026-11-09T16:00:00Z'));
    const model = pageAgeModel(people, asOf, null);
    assert.deepEqual(Object.keys(model.stats.ageRanges), u.AGE_RANGES);
    assert.deepEqual(Object.values(model.stats.ageRanges), [1, 2, 2, 2, 1, 5]);
    assert.equal(Object.values(model.stats.ageRanges).reduce((a, b) => a + b, 0), people.length);
    const input = { ...fixture(), asOf, stats: model.stats, roster: model.roster, named: true };
    const report = h.buildHrReport(input);
    assert.deepEqual(report.tables.find(t => t.title === '年齡').rows, Object.entries(model.stats.ageRanges).map(([range, count]) => [range, count, '人']));
    assert.deepEqual(report.tables.find(t => t.title.startsWith('人員名單')).rows.map(row => row[4]), model.roster.map(row => row.age));
    const csv = parseCsv(h.reportCsv(report));
    for (const range of u.AGE_RANGES) {
        const detail = pageAgeModel(people, asOf, { kind: 'age', range });
        assert.equal(detail.detailEmployees.length, model.stats.ageRanges[range], range);
        const namedMembers = detail.detailEmployees.map(e => e.name).sort();
        assert.deepEqual(model.roster.filter(e => e.age === range).map(e => e.name).sort(), namedMembers);
        assert.ok(csv.some(row => row[0] === range && row[1] === String(namedMembers.length)));
        assert.ok(h.reportHtml(report).includes(range));
        const detailModel = pageAgeModel(detail.detailEmployees, asOf, null);
        const detailReport = h.buildHrReport({ ...input, detail: `年齡・${range}`, roster: detailModel.roster });
        assert.deepEqual(detailReport.tables[0].rows.map(row => row[0]).sort(), namedMembers);
        assert.ok(detailReport.tables[0].rows.every(row => row[4] === range));
        assert.deepEqual(parseCsv(h.reportCsv(detailReport)).filter(row => namedMembers.includes(row[0])).map(row => row[0]).sort(), namedMembers);
    }
    // The drill-down display/sort must not revert to the legacy clock-based helper.
    assert.ok(!/\bcalculateAge\(/.test(pageSource));
    assert.ok(pageSource.includes("calculateAgeAsOf(e.birth_date, asOf) !== null"));
    assert.ok(report.metadata.find(([key]) => key === '人事基準日')[1].includes(asOf));
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

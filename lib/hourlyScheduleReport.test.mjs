import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const transpile = path => ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;
const dataURL = code => 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
const hrURL = dataURL(transpile('./hrReport.ts'));
const reportURL = dataURL(transpile('./hourlyScheduleReport.ts').replaceAll("'./hrReport'", JSON.stringify(hrURL)));
const { buildHourlyScheduleReport: build, buildHourlyScheduleExport: exportModel, hourlyScheduleGroup: group } = await import(reportURL);
const { reportCsv, reportHtml } = await import(hrURL);
const options = { month: '2026-11', filters: { department: ['ALL'], position: ['ALL'], gender: ['ALL'] } };
const employee = extra => ({ id: 'e', name: '測試人員', department: 'A', position: '照服員', gender: 'FEMALE', salary_type: 'HOURLY', is_active: true, ...extra });
const service = extra => ({ id: 's', employee_id: 'e', service_date: '2026-11-01', service_mins: 60, shift_type: '正常班', ...extra });
const fixture = minutes => ({ employees: [employee()], services: minutes === undefined ? [] : [service({ service_mins: minutes })] });
const bucketOf = report => report.buckets.find(b => b.count)?.key;

test('90/90.01/100/100.01/110 exact mutually exclusive boundaries and minimum bands', () => {
    for (const [minutes, expected] of [[5400,'le-90'],[5400.6,'90-100'],[6000,'90-100'],[6000.6,'100-110'],[6600,'100-110']]) {
        const report = build(fixture(minutes), options);
        assert.equal(bucketOf(report), expected);
        assert.equal(report.counts.bucketed, 1);
        assert.equal(report.buckets.length, 3);
        assert.equal(report.counts.auditValid, true);
    }
});
test('5 and 15 decimal minutes preserve fractions, never integer-coerced', () => {
    const f = fixture('5.5'); f.services.push(service({service_mins:'15.25'}));
    assert.equal(build(f,options).rows[0].hours, 20.75 / 60);
    assert.equal(build(fixture(5),options).rows[0].hours,5/60);
    assert.equal(build(fixture(15),options).rows[0].hours,0.25);
});
test('exact decimal summation at boundary and smallest material fraction above', () => {
    const f=fixture('5399.7'); f.services.push(service({service_mins:0.1}),service({service_mins:0.2}));
    assert.equal(bucketOf(build(f,options)),'le-90');
    f.services.push(service({service_mins:'0.00000001'}));
    assert.equal(bucketOf(build(f,options)),'90-100');
});
test('all shift labels sum; legitimate same-ID and same-day multiple rows are not deduped', () => {
    const f=fixture(); f.services=['正常班','休息日班','國定假日'].map(shift_type=>service({shift_type,service_mins:120}));
    const r=build(f,options).rows[0]; assert.equal(r.hours,6); assert.equal(r.serviceRows,3);
    f.services.push({...f.services[0]}); assert.equal(build(f,options).rows[0].hours,8);
});
test('no punches, OT, schedule history, paid credits or asOf are used', () => {
    const f=fixture(120);
    for(const key of ['logs','leaves','schedules','overrides','duties','holidays','companyHolidays','types']) Object.defineProperty(f,key,{get(){throw new Error('must not read '+key);}});
    assert.equal(build(f,{...options,asOf:'2026-11-01'}).rows[0].hours,2);
});
test('full month including future last date; valid previous/next month ignored', () => {
    const f=fixture(60); f.services.push(service({service_date:'2026-11-30',service_mins:120}),service({service_date:'2026-10-31',service_mins:null}),service({service_date:'2026-12-01',service_mins:999}));
    const r=build(f,{...options,asOf:'2026-11-01'}).rows[0]; assert.equal(r.hours,3);assert.equal(r.serviceRows,2);
});
test('invalid month and malformed/impossible service dates fail closed', () => {
    for(const month of ['2026-13','2026-1','bad']) assert.throws(()=>build(fixture(),{...options,month}),/月份/);
    for(const service_date of ['2026-11-31','2026-11-00','2026-11-01T00:00:00Z','bad',null]) {
        const f=fixture(60);f.services[0].service_date=service_date;assert.throws(()=>build(f,options),/日期/);
    }
    assert.equal(build({employees:[employee()],services:[service({service_date:'2028-02-29'})]},{...options,month:'2028-02'}).counts.known,1);
});
test('missing is null, genuine stored zero is known and in <=90', () => {
    const missing=build(fixture(),options); assert.equal(missing.rows[0].hours,null);assert.equal(missing.rows[0].status,'no-data');assert.equal(missing.counts.noData,1);assert.equal(missing.counts.bucketed,0);
    for(const minutes of [0,'0','0.0']) {const r=build(fixture(minutes),options);assert.equal(r.rows[0].hours,0);assert.equal(r.rows[0].status,'known');assert.equal(bucketOf(r),'le-90');}
});
test('any malformed minute makes entire employee invalid without partial bucketing', () => {
    for(const value of [null,undefined,'','  ',-1,'-0.1',NaN,Infinity,'Infinity','bad',true,{},'0x10','1e999','0e999999']) {
        const f=fixture(6000);f.services.push(service({service_mins:value}));const r=build(f,options);
        assert.equal(r.rows[0].hours,null,String(value));assert.equal(r.rows[0].status,'invalid');assert.equal(r.counts.invalid,1);assert.equal(r.counts.bucketed,0);assert.equal(r.rows[0].serviceRows,2);
    }
});
test('only current exact HOURLY, active plus inactive month service evidence, never chairman', () => {
    const f=fixture();f.employees.push(employee({id:'inactive',is_active:false}),employee({id:'past',is_active:false}),employee({id:'chair',is_chairman:true}),employee({id:'salary',salary_type:'MONTHLY'}),employee({id:'lowercase',salary_type:'hourly'}));
    f.services.push(service({employee_id:'inactive'}),service({employee_id:'past',service_date:'2026-10-31'}),service({employee_id:'chair'}),service({employee_id:'salary'}));
    assert.deepEqual(build(f,options).rows.map(r=>r.employee.id),['e','inactive']);
});
test('all current master filter arrays combine, OTHER gender and ALL wins', () => {
    const f=fixture(60);f.employees.push(employee({id:'b',department:'B',position:'行政',gender:null}));
    const run=filters=>build(f,{...options,filters}).rows.map(r=>r.employee.id);
    assert.deepEqual(run({department:['A','B'],position:['行政'],gender:['OTHER']}),['b']);
    assert.deepEqual(run({department:['A'],position:[],gender:[]}),['e']);
    assert.deepEqual(run({department:['ALL','missing'],position:['ALL'],gender:['ALL']}),['e','b']);
    assert.deepEqual(run({department:['A'],position:['行政'],gender:['FEMALE']}),[]);
});
test('unique employee identity and whitelisted projection, no raw personnel secrets', () => {
    const f=fixture(60); Object.assign(f.employees[0],{pin:'SECRET_PIN',phone:'SECRET_PHONE',birth_date:'SECRET_BIRTH'});
    const r=build(f,options);assert.ok(!JSON.stringify(r).includes('SECRET'));assert.deepEqual(Object.keys(r.rows[0].employee),['id','name','department','position','gender','is_active']);
    f.employees.push({...f.employees[0]});assert.throws(()=>build(f,options),/重複/);
    assert.throws(()=>build({employees:[employee({id:null})],services:[]},options),/識別/);
});
test('dynamic 10h buckets continue to known largest and retain exact top boundary', () => {
    for(const [hours,last] of [[110,110],[110.01,120],[200,200],[255,260]]) {
        const r=build(fixture(hours*60),options); assert.equal(r.buckets.at(-1).maxInclusive,last); assert.equal(r.buckets.at(-1).count,1);
    }
});
test('huge finite input uses bounded explicit overflow, nonfinite sum invalid', () => {
    const r=build(fixture('1e300'),options);assert.equal(r.buckets.length,202);assert.equal(r.buckets.at(-1).key,'overflow');assert.equal(r.buckets.at(-1).count,1);assert.equal(r.warnings.length,1);
    const f=fixture('1e308');f.services.push(service({service_mins:'1e308'}));assert.equal(build(f,options).counts.invalid,1);
});
test('headcount audit includes known, missing, invalid; each appears once', () => {
    const f=fixture(5400);f.employees.push(employee({id:'missing'}),employee({id:'invalid'}));f.services.push(service({employee_id:'invalid',service_mins:null}));
    const r=build(f,options);assert.deepEqual(r.counts,{eligible:3,known:1,noData:1,invalid:1,bucketed:1,auditValid:true});
    assert.equal(group(r,'no-data').rows[0].employee.id,'missing');assert.equal(group(r,'invalid').rows[0].employee.id,'invalid');
});
test('default CSV/HTML summaries omit names and every employee ID; named lists whitelist columns', () => {
    const f=fixture(60);f.employees[0].id='PRIVATE_ID';f.employees[0].name='PRIVATE_NAME';f.employees[0].pin='PRIVATE_PIN';f.services[0].employee_id='PRIVATE_ID';
    const r=build(f,options);const summary=exportModel(r,{named:false});
    for(const output of [JSON.stringify(summary),reportCsv(summary),reportHtml(summary)]) assert.ok(!/PRIVATE/.test(output));
    const named=exportModel(r,{named:true});assert.ok(reportCsv(named).includes('PRIVATE_NAME'));assert.ok(!/PRIVATE_ID|PRIVATE_PIN/.test(JSON.stringify(named)));
    assert.equal(named.tables.at(-1).rows[0][4],1);assert.ok(summary.metadata.some(([k,v])=>k==='所選完整月份'&&v==='2026-11'));
});
test('explicit bucket export is exact displayed roster, never another bucket or partial unknown hours', () => {
    const f=fixture(6000);f.employees.push(employee({id:'other',name:'OTHER_NAME'}));const r=build(f,options);
    const model=exportModel(r,{named:true,detailBucket:'90-100',producedAt:new Date('2026-11-01T00:00:00Z')});
    assert.equal(model.tables.length,1);assert.equal(model.tables[0].rows.length,group(r,'90-100').rows.length);assert.equal(model.tables[0].rows[0][0],'測試人員');assert.ok(!JSON.stringify(model).includes('OTHER_NAME'));
    assert.throws(()=>exportModel(r,{named:false,detailBucket:'90-100'}),/具名/);assert.throws(()=>exportModel(r,{named:true,detailBucket:'bad'}),/未知/);
    const missing=exportModel(r,{named:true,detailBucket:'no-data'});assert.equal(missing.tables[0].rows[0][4],null);
});
test('CSV BOM/CRLF/formula protection and HTML escaping share normalized model', () => {
    const f=fixture(0);f.employees[0].name=' =SUM(1,2)';f.employees[0].department='<script>"&';
    const model=exportModel(build(f,options),{named:true});const csv=reportCsv(model),html=reportHtml(model);
    assert.equal(Buffer.from(csv).subarray(0,3).toString('hex'),'efbbbf');assert.ok(csv.includes('\r\n'));assert.ok(csv.includes('"\' =SUM(1,2)"'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('@page{size:A4'));
});
test('missing loaded source arrays reject without pretending to have zero people', () => {
    for(const sources of [{employees:[],services:null},{employees:null,services:[]},{}])assert.throws(()=>build(sources,options),/來源/);
    assert.equal(build({employees:[],services:[]},options).counts.eligible,0);
});
// SSR exercises the actual component; handler policy checks below are source-level,
// not a claim of trusted browser popup or phone visual verification.
const componentSource=fs.readFileSync(new URL('../components/HourlyScheduleStatistics.tsx',import.meta.url),'utf8');
const componentCode=transpile('../components/HourlyScheduleStatistics.tsx')
    .replaceAll("'../lib/hourlyScheduleReport'",JSON.stringify(reportURL))
    .replaceAll("'../lib/hrReport'",JSON.stringify(hrURL))
    .replaceAll("'react'",JSON.stringify(import.meta.resolve('react')));
const {default:Component}=await import(dataURL(componentCode));
test('actual component renders compact native details, counts and explicit export labels', () => {
    const html=renderToStaticMarkup(React.createElement(Component,{sources:fixture(6000),...options}));
    for(const text of ['時薪制班表工時人數分布','班表工時 CSV','班表工時列印／另存 PDF','匯出此組名單 CSV','目前篩選母體','未登錄不等於零','測試人員','100 小時'])assert.ok(html.includes(text),text);
    assert.ok(html.includes('<details'));assert.ok(html.includes('<ul'));assert.ok(!html.includes('<table'));assert.ok(!html.includes('overflow-x-auto'));assert.ok(html.includes('grid-cols-1'));
});
test('component failure disables exports; popup blocked error, opener isolation, focus and delay are explicit', () => {
    const html=renderToStaticMarkup(React.createElement(Component,{sources:{employees:[],services:null},...options}));
    assert.ok(html.includes('role="alert"'));assert.equal((html.match(/disabled=""/g)||[]).length,2);
    for(const code of ['if (!popup)','列印視窗遭封鎖','popup.opener = null','popup.focus()','popup.print()','}, 300)','detailBucket !== undefined || namedExport'])assert.ok(componentSource.includes(code),code);
    assert.ok(!/supabase|fetch\(/.test(componentSource));
});

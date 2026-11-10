import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { spawnSync } from 'node:child_process';
const transpile = path => ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const dataURL = code => 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
const helperURL = dataURL(transpile('./hrReport.ts'));
const moduleURL = dataURL(transpile('./workHoursReport.ts').replace("'./hrReport'", JSON.stringify(helperURL)));
const { readWorkHoursSources: read, buildWorkHoursReport: build } = await import(moduleURL);
const options = { month: '2026-11', asOf: '2026-11-30', filters: { department: ['ALL'], position: [], gender: [] } };
const employee = extra => ({ id: 'e', name: 'Test', department: 'A', position: 'Worker', gender: 'FEMALE', is_active: true, schedule_effective_date: '2026-01-01', work_start_time: '08:00', work_end_time: '17:00', break_start_time: '12:00', break_end_time: '13:00', rest_days: [0,6], ...extra });
const fixture = () => ({ employees: [employee()], logs: [], leaves: [], types: [{id:'ot',code:'OT'}, {id:'leave',code:'SL'}, ...['CO','TOIL','ALC'].map(code=>({id:code,code}))], schedules: [], overrides: [], duties: [], holidays: [], companyHolidays: [], services: [] });
const time = (clock, date='2026-11-02') => `${date}T${clock}:00+08:00`;
const punches = (f, clocks=['08:00','17:00'], date='2026-11-02') => { f.logs.push(...clocks.map((clock,i)=>({id:`${date}-${i}`,employee_id:'e', check_type:i%2?'OUT':'IN',timestamp:time(clock,date)}))); return f; };
const request = extra => ({id:'r',employee_id:'e', type:'LEAVE',leave_type_id:'ot',start_date:time('17:00'),end_date:time('18:00'),hours:1,status:'APPROVED',...extra});
const row = f => build(f,options).rows[0];

test('no-data is null, summaries known zero; only current active plus inactive evidence, no chairman',()=>{
    const f=fixture(); f.employees.push(employee({id:'inactive',is_active:false}),employee({id:'old',is_active:false}),employee({id:'chair',is_chairman:true}));
    f.services.push({employee_id:'old',service_date:'2026-11-03',service_mins:90});
    const r=build(f,options); assert.deepEqual(r.rows.map(r=>r.employee.id),['e','old']);
    assert.equal(r.rows[0].normalHours,null); assert.equal(r.rows[0].overtimeHours,null); assert.equal(r.rows[0].totalHours,null); assert.equal(r.rows[0].status,'no-data');
    assert.deepEqual(r.summary,{normalHours:0,overtimeHours:0,totalHours:0,pendingPeople:1,noDataPeople:1});
});
test('multiple sessions and all three overlapping breaks are unioned; no double subtraction',()=>{
    const f=punches(fixture(),['08:00','12:00','13:00','17:00']); Object.assign(f.employees[0],{break2_start_time:'10:00',break2_end_time:'10:30',break3_start_time:'10:15',break3_end_time:'10:45'});
    assert.equal(row(f).normalHours,7.25); assert.equal(row(f).status,'complete');
});
test('same day strict sessions reject missing, duplicate, nonalternating, cross-day bridging',()=>{
    for(const clocks of [['08:00'],['08:00','08:00'],['08:00','09:00','10:00']]) {const f=punches(fixture(),clocks); assert.equal(row(f).normalHours,null); assert.equal(row(f).status,'pending');}
    const f=punches(fixture()); f.logs[1].check_type='IN'; assert.equal(row(f).normalHours,null);
    f.logs[1].check_type='OUT'; f.logs[1].timestamp=time('07:00','2026-11-03'); assert.ok(row(f).days.every(d=>d.normalHours===null));
});
test('ordinary early/late punches clip normal, audit is informational not pending',()=>{
    const f=punches(fixture(),['07:59','17:01']); const r=row(f); assert.equal(r.normalHours,8); assert.equal(r.overtimeHours,0); assert.equal(r.totalHours,8); assert.equal(r.status,'complete'); assert.ok(r.days[0].issues.includes('班外打卡不自動認列加班'));
});
test('effective OT only, stored zero valid; missing hours unknown without duration fallback',()=>{
    const f=punches(fixture(),['08:00','18:00']); f.leaves.push(request({hours:0})); assert.equal(row(f).overtimeHours,0); assert.equal(row(f).normalHours,8);
    for (const hours of [null,undefined,'',-1,Infinity,'bad']) { f.leaves[0].hours=hours; const r=row(f); assert.equal(r.overtimeHours,null); assert.equal(r.normalHours,8); assert.equal(r.knownTotalHours,8); assert.equal(build(f,options).summary.totalHours,8); }
    f.leaves[0].hours='1.25'; assert.equal(row(f).overtimeHours,1.25);
});
test('superseded, rejected, modified and CO/ALC conversions never counted as OT or removed from normal',()=>{
    for(const extra of [{is_modified:true},{modified_by_request_id:'new'},{status:'PENDING'},...['CO','ALC'].map(leave_type_id=>({leave_type_id}))]) {
        const f=punches(fixture()); f.leaves.push(request({start_date:time('14:00'),end_date:time('15:00'),hours:99,...extra})); assert.equal(row(f).overtimeHours,0); assert.equal(row(f).normalHours,8);
    }
});
test('OT intersecting ordinary window removed from normal; approved nonworkleave also subtracted',()=>{
    const f=punches(fixture()); f.leaves.push(request({start_date:time('14:00'),end_date:time('16:00'),hours:2}), request({id:'l',leave_type_id:'leave',start_date:time('09:00'),end_date:time('10:00')}));
    const r=row(f); assert.equal(r.normalHours,5); assert.equal(r.overtimeHours,2); assert.equal(r.totalHours,7);
});
test('cross-day/crossmonth OT is unknown on affected observed dates, never whole record sum',()=>{
    for(const [start_date,end_date] of [[time('23:00'),time('01:00','2026-11-03')],[time('23:00','2026-10-31'),time('01:00','2026-11-01')],[time('23:00','2026-11-30'),time('01:00','2026-12-01')]]) {
        const f=fixture(); f.leaves.push(request({start_date,end_date,hours:2})); const r=row(f); assert.ok(r.days.length); assert.ok(r.days.every(d=>d.overtimeHours===null)); assert.equal(r.knownOvertimeHours,0); assert.equal(r.overtimeHours,null);
    }
});
test('overlapping OT fail closed instead of sum; touching OT allowed',()=>{
    const f=punches(fixture()); f.leaves.push(request(), request({id:'r2',start_date:time('17:30'),end_date:time('18:30')})); assert.equal(row(f).overtimeHours,null);
    f.leaves[1].start_date=time('18:00'); assert.equal(row(f).overtimeHours,2);
});
test('known OT subtotal retains independent valid records beside missing hours on same day',()=>{
    const f=punches(fixture()); f.leaves.push(request(),request({id:'missing',start_date:time('18:00'),end_date:time('19:00'),hours:null}));
    const r=row(f); assert.equal(r.overtimeHours,null); assert.equal(r.knownOvertimeHours,1); assert.equal(r.knownTotalHours,9); assert.equal(build(f,options).summary.totalHours,9);
});
test('full approved leave can prove normal zero without punches, partial leave cannot',()=>{
    const f=fixture(); f.leaves.push(request({leave_type_id:'leave',start_date:time('08:00'),end_date:time('17:00'),hours:8})); assert.equal(row(f).normalHours,0);
    f.leaves[0].end_date=time('10:00'); assert.equal(row(f).normalHours,null);
});
test('duration-only service remains reference; alone and with punches are normal unknown',()=>{
    for(const withPunch of [false,true]) {const f=withPunch?punches(fixture()):fixture(); f.services.push({employee_id:'e',service_date:'2026-11-02',service_mins:270}); const r=row(f); assert.equal(r.normalHours,null); assert.equal(r.serviceHours,4.5); assert.equal(r.knownTotalHours,0); assert.equal(r.status,'pending');}
});
test('work request without logs does not invent actual hours',()=>{
    const f=fixture(); f.leaves.push(request({type:'BUSINESS_TRIP',leave_type_id:null,start_date:time('08:00'),end_date:time('17:00'),hours:8})); assert.equal(row(f).normalHours,null); assert.equal(row(f).status,'pending');
});
test('effective history before day, not current/future fallback; override preserves extra breaks',()=>{
    const f=punches(fixture()); f.employees[0].schedule_effective_date='2026-11-10'; assert.equal(row(f).normalHours,null);
    f.schedules.push({employee_id:'e',id:'s',effective_date:'2026-10-01',work_start_time:'09:00',work_end_time:'17:00',break_start_time:'12:00',break_end_time:'13:00',break2_start_time:'15:00',break2_end_time:'15:30',rest_days:[0,6]});
    f.schedules.push({employee_id:'e',id:'future',effective_date:'2026-11-20',work_start_time:'07:00',work_end_time:'20:00'}); assert.equal(row(f).normalHours,6.5);
    f.overrides.push({employee_id:'e',override_date:'2026-11-02',day_type:'CUSTOM_HOURS',work_start_time:'08:00',work_end_time:'16:00',break_start_time:'12:00',break_end_time:'12:30'}); assert.equal(row(f).normalHours,7);
});
test('holidays/company holidays/rest weekdays normal zero; approvedOT only; explicit work override wins',()=>{
    for(const kind of ['national','company','rest']) {
        const f=punches(fixture()); if(kind==='national') f.holidays.push({date:'2026-11-02'}); if(kind==='company') f.companyHolidays.push({holiday_date:'2026-11-02',is_active:true}); if(kind==='rest') f.employees[0].rest_days=[1];
        assert.equal(row(f).normalHours,0); assert.equal(row(f).overtimeHours,null); assert.equal(row(f).totalHours,null); assert.equal(row(f).status,'pending');
        f.overrides.push({employee_id:'e',override_date:'2026-11-02',day_type:'WORKDAY'}); assert.equal(row(f).normalHours,8); assert.equal(row(f).status,'complete');
    }
    const f=punches(fixture(),['08:00','10:00']); f.holidays.push({date:'2026-11-02'}); f.leaves.push(request({start_date:time('08:00'),end_date:time('10:00'),hours:2})); assert.equal(row(f).totalHours,2);
});
test('lunch duty 心安居 08–17 actual 7.5 at 16 or16:30, not credited8',()=>{
    for(const end of ['16:00','16:30']) {const f=punches(fixture(),['08:00',end]); f.employees[0].department='心安居'; f.duties.push({employee_id:'e',duty_date:'2026-11-02',enabled:true}); assert.equal(row(f).normalHours,7.5); assert.equal(row(f).status,'complete');}
    const f=punches(fixture(),['08:00','16:00']); f.duties.push({employee_id:'e',duty_date:'2026-11-02',enabled:true}); assert.equal(row(f).normalHours,7);
});
test('asOf/month pruning and exact filters, no fabricated calendar dates; output privacy',()=>{
    const f=punches(fixture()); punches(f,['08:00','17:00'],'2026-11-10'); punches(f,['08:00','17:00'],'2026-12-01'); f.employees[0].pin='SECRET'; f.employees[0].gender=null;
    const r=build(f,{...options,asOf:'2026-11-03',filters:{department:['A'],position:['Worker'],gender:['OTHER']}}); assert.equal(r.rows[0].days.length,1); assert.ok(!JSON.stringify(r).includes('SECRET')); assert.equal(r.summary.totalHours,8);
    assert.equal(build(f,{...options,filters:{department:['B'],position:[],gender:[]}}).rows.length,0);
});
test('known subtotal survives unknown day but aggregate actual hours remain null',()=>{
    const f=punches(fixture()); punches(f,['08:00'],'2026-11-03'); const r=row(f); assert.equal(r.normalHours,null); assert.equal(r.totalHours,null); assert.equal(r.knownNormalHours,8); assert.equal(build(f,options).summary.totalHours,8); assert.equal(r.pendingDays,1);
});
test('approved work-related leave codes preserve punches but alone never prove actual work; OL and TOIL remain nonwork',()=>{
    for(const code of ['OB','HV','MTG','AA','IS','SI','INT','BUSINESS_TRIP']) for(const withPunch of [false,true]) {
        const f=withPunch?punches(fixture()):fixture(); f.types.push({id:code,code});
        f.leaves.push(request({leave_type_id:code,start_date:time('08:00'),end_date:time('17:00'),hours:8}));
        assert.equal(row(f).normalHours,withPunch?8:null,code);
        assert.equal(row(f).overtimeHours,0);
        if(!withPunch) assert.ok(row(f).days[0].issues.includes('work-request-not-actual-evidence'));
    }
    for(const code of ['OL','TOIL','TOIL1']) {
        const f=punches(fixture()); f.types.push({id:code,code});
        f.leaves.push(request({leave_type_id:code,start_date:time('14:00'),end_date:time('15:00'),hours:99}));
        assert.equal(row(f).normalHours,7,code); assert.equal(row(f).overtimeHours,0);
    }
    const f=punches(fixture()); f.leaves.push(request({leave_type_id:'missing',start_date:time('14:00'),end_date:time('15:00')}));
    assert.equal(row(f).normalHours,null); assert.ok(row(f).days[0].issues.includes('unknown-leave-type'));
});
test('lunch duty never overrides any explicit override, holiday or rest day',()=>{
    for(const kind of ['WORKDAY','CUSTOM','CUSTOM_HOURS','REST_DAY','national','company','rest','ambiguous']) {
        const f=punches(fixture()); f.employees[0].department='心安居';
        f.duties.push({employee_id:'e',duty_date:'2026-11-02',enabled:true});
        if(['WORKDAY','CUSTOM','CUSTOM_HOURS','REST_DAY'].includes(kind)) f.overrides.push({employee_id:'e',override_date:'2026-11-02',day_type:kind});
        if(kind==='ambiguous') for(let i=0;i<2;i++) f.overrides.push({employee_id:'e',override_date:'2026-11-02',day_type:'WORKDAY'});
        if(kind==='national') f.holidays.push({date:'2026-11-02'});
        if(kind==='company') f.companyHolidays.push({holiday_date:'2026-11-02',is_active:true});
        if(kind==='rest') f.employees[0].rest_days=[1];
        assert.equal(row(f).normalHours,kind==='ambiguous'?null:['REST_DAY','national','company','rest'].includes(kind)?0:8,kind);
    }
});
test('positive leave intervals are half-open at day and month boundaries, including existing next-day punches',()=>{
    for(const [a,b,dates] of [
        [time('23:00'),time('00:00','2026-11-03'),['2026-11-02']],
        [time('23:00','2026-10-31'),time('00:00','2026-11-01'),[]],
        [time('23:00','2026-11-30'),time('00:00','2026-12-01'),['2026-11-30']]
    ]) {const f=fixture(); f.leaves.push(request({start_date:a,end_date:b})); assert.deepEqual(row(f).days.map(d=>d.date),dates);}
    const f=punches(fixture(),['08:00','17:00'],'2026-11-03');
    f.leaves.push(request({start_date:time('23:00'),end_date:time('00:00','2026-11-03')}));
    const d=row(f).days.find(d=>d.date==='2026-11-03'); assert.equal(d.overtimeHours,0); assert.equal(d.normalHours,8); assert.ok(!d.source.includes('approved-requests'));
});
test('invalid/reversed leave intervals do not pollute valid days; zero-duration stored OT explicitly allowed',()=>{
    for(const extra of [{start_date:'bad'},{end_date:'bad'},{start_date:time('19:00'),end_date:time('17:00')}]) {
        const f=punches(fixture()); f.leaves.push(request(extra)); assert.equal(row(f).overtimeHours,0); assert.equal(row(f).normalHours,8);
    }
    const f=fixture(); f.leaves.push(request({end_date:time('17:00'),hours:0})); assert.equal(row(f).days.length,1); assert.equal(row(f).overtimeHours,0);
    f.leaves[0].leave_type_id='leave'; assert.equal(row(f).days.length,0);
});
test('only boolean true excludes chairman; malformed punches fail visibly rather than disappearing',()=>{
    const f=fixture(); f.employees[0].is_chairman='false'; assert.equal(build(f,options).rows.length,1);
    for(const timestamp of ['bad','2026-11-02Tbad',null]) {const f=punches(fixture()); f.logs[1].timestamp=timestamp; assert.throws(()=>build(f,options),/invalid-punch-timestamp/);}
});
test('daily known OT subtotal is explicit and sums into row beside unknown or overlapping OT',()=>{
    const f=punches(fixture()); f.leaves.push(request(),request({id:'missing',start_date:time('18:00'),end_date:time('19:00'),hours:null}));
    punches(f,['08:00','17:00'],'2026-11-03'); f.leaves.push(request({id:'next',start_date:time('17:00','2026-11-03'),end_date:time('18:00','2026-11-03'),hours:2}));
    const r=row(f); assert.deepEqual(r.days.map(d=>d.knownOvertimeHours),[1,2]); assert.equal(r.knownOvertimeHours,3); assert.equal(r.overtimeHours,null);
    f.leaves.push(request({id:'overlap',start_date:time('17:30'),end_date:time('18:30')})); assert.equal(row(f).days[0].knownOvertimeHours,0); assert.equal(row(f).knownOvertimeHours,2);
});
function mockClient({failTable,malformed=false}={}) {
    const calls=[]; const counts={attendance_logs:1001,employee_lunch_duties:501,employees:40};
    return {calls,from(table){ const call={table,ops:[]}; calls.push(call); const q={}; for(const op of ['select','eq','gte','lt','order'])q[op]=(...args)=>{call.ops.push([op,...args]);return q;}; q.range=async(a,b)=>{call.range=[a,b]; if(table===failTable&&a===500)return malformed?{data:null}:{error:{message:'failed'}}; return {data:Array.from({length:Math.max(0,Math.min(b-a+1,(counts[table]??0)-a))},(_,i)=>({id:a+i}))};}; return q;}};
}
test('all paginated sources whitelist exact fields, overlap/time bounds, historical dates, composite duty paging, no writes',async()=>{
    const c=mockClient(); const s=await read(c,'2026-11'); assert.equal(s.logs.length,1001); assert.equal(s.employees.length,40); assert.equal(s.duties.length,501); assert.equal(Object.keys(s).length,10);
    assert.deepEqual(c.calls.filter(c=>c.table==='attendance_logs').map(c=>c.range),[[0,499],[500,999],[1000,1499]]);
    for(const call of c.calls) {const projection=call.ops.find(o=>o[0]==='select')[1]; assert.ok(!/\*|pin|phone|bank|contact/.test(projection)); assert.ok(call.ops.some(o=>o[0]==='order'));}
    const duty=c.calls.find(c=>c.table==='employee_lunch_duties'); assert.deepEqual(duty.ops.filter(o=>o[0]==='order').map(o=>o[1]),['employee_id','duty_date']);
    const schedule=c.calls.find(c=>c.table==='employee_schedules'); assert.ok(schedule.ops.some(o=>o[0]==='lt'&&o[1]==='effective_date'&&o[2]==='2026-12-01')); assert.ok(!schedule.ops.some(o=>o[0]==='gte'));
    const leave=c.calls.find(c=>c.table==='leave_requests'); assert.ok(leave.ops.some(o=>o[0]==='lt'&&o[1]==='start_date')); assert.ok(leave.ops.some(o=>o[0]==='gte'&&o[1]==='end_date')); assert.ok(!c.calls.find(c=>c.table==='leave_types').ops.some(o=>o[0]==='eq'));
});
test('later source page failure/malformed data reject complete report, including duties without id',async()=>{
    for(const failTable of ['attendance_logs','employee_lunch_duties'])for(const malformed of [false,true]) await assert.rejects(read(mockClient({failTable,malformed}),'2026-11'));
    assert.throws(()=>build({...fixture(),services:null},options));
});
test('Taipei grouping and hours identical under UTC, Taipei, US host timezone',()=>{
    const script=`import {buildWorkHoursReport as b} from ${JSON.stringify(moduleURL)}; const f=${JSON.stringify(punches(fixture()))}; f.logs[0].timestamp='2026-11-02T00:00:00Z'; console.log(JSON.stringify(b(f,${JSON.stringify(options)})));`;
    const results=['UTC','Asia/Taipei','America/Los_Angeles'].map(TZ=>{const r=spawnSync(process.execPath,['--input-type=module','-e',script],{env:{...process.env,TZ},encoding:'utf8'}); assert.equal(r.status,0,r.stderr);return r.stdout;}); assert.equal(results[0],results[1]);assert.equal(results[0],results[2]);
});

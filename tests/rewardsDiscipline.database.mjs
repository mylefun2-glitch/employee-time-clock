// Isolated PostgreSQL-engine integration; never connects to a remote DB.
// Install @electric-sql/pglite OUTSIDE repo, then:
// REWARDS_PGLITE_MODULE=/absolute/path/node_modules/@electric-sql/pglite/dist/index.js node --test tests/rewardsDiscipline.database.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const modulePath=process.env.REWARDS_PGLITE_MODULE;
if (!modulePath) throw new Error('REWARDS_PGLITE_MODULE must point to an isolated installed PGlite module');
const {PGlite}=await import(pathToFileURL(modulePath).href);
const db=new PGlite();
const admin='11111111-1111-4111-8111-111111111111', other='22222222-2222-4222-8222-222222222222';
const emp='33333333-3333-4333-8333-333333333333';
const migration=readFileSync(new URL('../supabase/migrations/202611260001_employee_rewards_discipline.sql',import.meta.url),'utf8');
async function value(sql,args=[]) {return (await db.query(sql,args)).rows[0]?.v;}
async function rpc(name,args=[],casts=[]) {return value(`select public.${name}(${args.map((_,i)=>`$${i+1}${casts[i]?'::'+casts[i]:''}`).join(',')}) as v`,args);}
async function owner() {await db.exec('reset role');}
async function identity(role,id='') {await owner(); await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]); await db.exec(`set role ${role}`);}
async function rejects(fn,code) {await assert.rejects(fn,e=>{assert.equal(e.code,code, e.message);return true;});}
const initial=async()=>{
 await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth; create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  grant usage on schema auth to anon,authenticated,service_role;
  grant execute on function auth.uid() to anon,authenticated,service_role;
  create table public.employees(id uuid primary key,name text,department text,is_active boolean,pin text,birth_date date,email text);
  alter default privileges grant all on tables to anon,authenticated,service_role;
  alter default privileges grant all on sequences to anon,authenticated,service_role;
  alter default privileges grant all on functions to anon,authenticated,service_role;
 `);
 await db.query('insert into auth.users values($1),($2)',[admin,other]);
 await db.query("insert into public.employees values($1,'Synthetic Employee','Synthetic Unit',true,'NEVER_RETURN',null,'NEVER_RETURN')",[emp]);
};
await initial();
let subject,record,imported,sourceCapture;
const trimCodePoints=[0x0009,0x000a,0x000b,0x000c,0x000d,0x0020,0x00a0,0x1680,
 0x2000,0x2001,0x2002,0x2003,0x2004,0x2005,0x2006,0x2007,0x2008,0x2009,0x200a,
 0x2028,0x2029,0x202f,0x205f,0x3000,0xfeff];
const blankTexts=['',' ','\t\n\r',...trimCodePoints.map(cp=>String.fromCodePoint(cp)),String.fromCodePoint(...trimCodePoints)];
async function rollbackOnly(action) {
 await db.exec('begin');
 try {return await action();} finally {await owner();await db.exec('rollback');await identity('authenticated',admin);}
}
async function rejectBlankTexts(action,code='22023') {
 await rollbackOnly(async()=>{
  for(const text of blankTexts) {
   assert.equal(text.trim(),'');await db.exec('savepoint whitespace_case');
   try {await rejects(()=>action(text),code);} finally {await db.exec('rollback to savepoint whitespace_case');}
  }
 });
}

test('isolated migration and authorization/domain/RPC contract',async t=>{
 try {
  await t.test('migration executes transactionally under hostile default grants',async()=>{t.diagnostic(await value('select version() as v'));await db.exec(migration);});
  await t.test('allowlist empty; authenticated login and metadata cannot authorize',async()=>{
   assert.equal(await value('select count(*)::int as v from rewards_private.rd_admins'),0);
   await identity('authenticated',other); assert.equal(await rpc('rd_permission'),false);
   await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({app_metadata:{role:'admin'},user_metadata:{admin:true}})]);
   await rejects(()=>rpc('rd_list_records'), '42501');
  });
  await t.test('anon/PIN/supervisor cannot execute public RPC or read private tables',async()=>{
   for (const id of ['',other]) {await identity('anon',id);await rejects(()=>rpc('rd_permission'),'42501');await rejects(()=>value('select count(*) as v from rewards_private.rd_sources'),'42501');}
   await identity('authenticated',other);
   for(const table of ['rd_admins','rd_subjects','rd_subject_origins','rd_types','rd_records','rd_sources','rd_audit']) await rejects(()=>value(`select count(*) as v from rewards_private.${table}`),'42501');
   await rejects(()=>value('select rewards_private.rd_import_subject($1::jsonb) as v',[{}]),'42501');
  });
  await t.test('all public read/write endpoints deny nonallowlisted JWT before validation',async()=>{
   for(const [name,args,casts] of [
    ['rd_list_types'],['rd_get_record',[emp],['uuid']],['rd_list_records',[{}],['jsonb']],['rd_subject_history',[emp,{}],['uuid','jsonb']],
    ['rd_subject_picker'],['rd_employee_picker'],['rd_record_audit',[emp],['uuid']],
    ['rd_create_subject',['Synthetic']],['rd_link_subject',[emp,1,null,'review'],['uuid','int','uuid','text']],
    ['rd_create_record',[{}],['jsonb']],['rd_update_record',[emp,1,{}],['uuid','int','jsonb']],
    ['rd_void_record',[emp,1,'reason'],['uuid','int','text']],['rd_save_type',['warning',1,'warning','-0.5',true],['text','int','text','text','boolean']]
   ]) await rejects(()=>rpc(name,args,casts),'42501');
  });
  await t.test('owner explicit one-time grant authorizes only exact auth.uid',async()=>{
   await owner();await db.query('insert into rewards_private.rd_admins(user_id,grant_reason) values($1,$2)',[admin,'Synthetic explicit grant']);
   await identity('authenticated',admin);assert.equal(await rpc('rd_permission'),true);
   assert.equal((await rpc('rd_list_types')).length,7);
  });
  await t.test('new subjects and employee picker expose minimal domain fields',async()=>{
   const p=await rpc('rd_employee_picker');assert.equal(p.total,1);assert.deepEqual(Object.keys(p.items[0]).sort(),['department','id','name']);
   subject=await rpc('rd_create_subject',['Synthetic Historical Person']);assert.equal(subject.employee_id,null);
   assert.equal((await rpc('rd_subject_picker',['Historical'])).total,1);
  });
  await t.test('server creates half-point score and atomic audit with correct actor',async()=>{
   record=await rpc('rd_create_record',[{subject_id:subject.id,application_date:'2026-01-02',type_code:'warning',quantity:3,reason:'Synthetic <b>text</b> %_'}],['jsonb']);
   assert.equal(record.total_points,'-1.5');assert.equal(record.status,'recorded');assert.equal(record.event_date,null);
   const a=await rpc('rd_record_audit',[record.id],['uuid']);assert.equal(a.total,1);assert.equal(a.items[0].actor_id,admin);assert.equal(a.items[0].before,null);assert.equal(a.items[0].after.total_points,'-1.5');
  });
  await t.test('create reason rejects every ECMAScript-whitespace-only value',async()=>{
   await rejectBlankTexts(reason=>rpc('rd_create_record',[{subject_id:subject.id,application_date:'2026-01-02',type_code:'commendation',quantity:1,reason}],['jsonb']));
  });
  await t.test('update reason rejects every ECMAScript-whitespace-only value',async()=>{
   await rejectBlankTexts(reason=>rpc('rd_update_record',[record.id,record.version,{reason}],['uuid','int','jsonb']));
  });
  await t.test('void reason rejects every ECMAScript-whitespace-only value',async()=>{
   await rejectBlankTexts(reason=>rpc('rd_void_record',[record.id,record.version,reason],['uuid','int','text']));
  });
  await t.test('link reason rejects every ECMAScript-whitespace-only value',async()=>{
   await rejectBlankTexts(reason=>rpc('rd_link_subject',[subject.id,subject.version,emp,reason],['uuid','int','uuid','text']));
  });
  await t.test('subject label rejects every ECMAScript-whitespace-only value',async()=>{
   await rejectBlankTexts(label=>rpc('rd_create_subject',[label]));
  });
  await t.test('catalogue label rejects every ECMAScript-whitespace-only value',async()=>{
   await rejectBlankTexts(label=>rpc('rd_save_type',['commendation',1,label,'0.5',true],['text','int','text','text','boolean']));
  });
  await t.test('private import required text uses the same whitespace rule',async()=>{
   await rejectBlankTexts(async label=>{await owner();return value('select rewards_private.rd_import_subject($1::jsonb) as v',[{spreadsheet_id:'synthetic-whitespace',gid:'1',person_id:'synthetic-person',label,raw:{}}]);});
  });
  await t.test('all former direct btrim required-text CHECKs independently reject blank Unicode text',async()=>{
   for(const [sql,args] of [
    ['update rewards_private.rd_admins set grant_reason=$1 where user_id=$2',[admin]],
    ['update rewards_private.rd_subjects set label=$1 where id=$2',[subject.id]],
    ["update rewards_private.rd_types set label=$1 where code=$2",['commendation']],
    ['update rewards_private.rd_records set type_label=$1 where id=$2',[record.id]],
    ["update rewards_private.rd_records set status='voided',void_reason=$1 where id=$2",[record.id]],
    ['update rewards_private.rd_records set reason=$1 where id=$2',[record.id]],
   ]) await rejectBlankTexts(async text=>{await owner();return db.query(sql,[text,...args]);},'23514');
  });
  await t.test('nonblank padded multiline text is stored verbatim on every affected path',async()=>{
   await rollbackOnly(async()=>{
    const text=' \t\n\u00a0\u3000\ufeffSynthetic first line\r\nsecond line \t\n\u00a0\u3000\ufeff';
    const s=await rpc('rd_create_subject',[text]);assert.equal(s.label,text);
    let r=await rpc('rd_create_record',[{subject_id:s.id,application_date:'2026-01-02',type_code:'commendation',quantity:1,reason:text}],['jsonb']);assert.equal(r.reason,text);assert.equal(r.subject_label,text);
    const edited=text+'\nSynthetic edited\ufeff';
    r=await rpc('rd_update_record',[r.id,r.version,{reason:edited}],['uuid','int','jsonb']);assert.equal(r.reason,edited);
    r=await rpc('rd_void_record',[r.id,r.version,text],['uuid','int','text']);assert.equal(r.void_reason,text);
    assert.equal((await rpc('rd_record_audit',[r.id],['uuid'])).items[0].reason,text);
    const linked=await rpc('rd_link_subject',[s.id,s.version,emp,text],['uuid','int','uuid','text']);assert.equal(linked.label,text);
    assert.equal((await rpc('rd_save_type',['commendation',1,text,'0.5',true],['text','int','text','text','boolean'])).label,text);
    await owner();
    assert.equal(await value("select reason as v from rewards_private.rd_audit where entity_kind='subject' and entity_id=$1 and action='link'",[s.id]),text);
    await db.query('insert into rewards_private.rd_admins(user_id,grant_reason) values($1,$2)',[other,text]);
    assert.equal(await value('select grant_reason as v from rewards_private.rd_admins where user_id=$1',[other]),text);
    const origin={spreadsheet_id:'synthetic-whitespace',gid:'1',person_id:'synthetic-person',label:text,raw:{}};
    const importedText=await value('select rewards_private.rd_import_record($1::jsonb,$2::jsonb,$3::jsonb) as v',[
     {spreadsheet_id:'synthetic-whitespace',gid:'2',record_id:'synthetic-record',raw:{}},
     {type_label:text,total_points:'0.5',reason:''},origin]);
    const historical=await rpc('rd_get_record',[importedText.id],['uuid']);assert.equal(historical.type_label,text);assert.equal(historical.subject_label,text);assert.equal(historical.reason,'');
    // These characters are NOT ECMAScript trim whitespace; do not over-reject them.
    for(const content of ['\u0085','\u180e','\u200b']) {
     assert.notEqual(content.trim(),'');assert.equal(await value('select rewards_private.rd_text($1,200,true) as v',[content]),content);
    }
   });
  });
  await t.test('forged points/status/actor/source and invalid counts/dates rejected',async()=>{
   for(const field of ['actor_id','total_points','source','status','version','subject_label']) await rejects(()=>rpc('rd_update_record',[record.id,1,{[field]:'forged'}],['uuid','int','jsonb']),'22023');
   for(const quantity of [0,1.5,'2',null]) await rejects(()=>rpc('rd_update_record',[record.id,1,{quantity}],['uuid','int','jsonb']),'22023');
   await rejects(()=>rpc('rd_update_record',[record.id,1,{application_date:null}],['uuid','int','jsonb']),'22023');
   await rejects(()=>rpc('rd_update_record',[record.id,1,{reason:{text:'not string'}}],['uuid','int','jsonb']),'22023');
  });
  await t.test('catalogue edits never recalculate old snapshots',async()=>{
   await rpc('rd_save_type',['warning',1,'Synthetic Warning','-2',true],['text','int','text','text','boolean']);
   let r=await rpc('rd_get_record',[record.id],['uuid']);assert.equal(r.total_points,'-1.5');assert.equal(r.type_label,'警告');
   r=await rpc('rd_update_record',[record.id,1,{notes:'Changed'}],['uuid','int','jsonb']);assert.equal(r.total_points,'-1.5');assert.equal(r.version,2);
   r=await rpc('rd_update_record',[record.id,2,{quantity:4}],['uuid','int','jsonb']);assert.equal(r.total_points,'-8');assert.equal(r.type_label,'Synthetic Warning');record=r;
   await rejects(()=>rpc('rd_update_record',[record.id,2,{notes:'Stale'}],['uuid','int','jsonb']),'40001');
  });
  await t.test('inactive types reject new/repriced records and invalid decimals do not mutate catalogue',async()=>{
   await rpc('rd_save_type',['major_demerit',1,'Synthetic inactive','-2',false],['text','int','text','text','boolean']);
   await rejects(()=>rpc('rd_create_record',[{subject_id:subject.id,application_date:'2026-03-01',type_code:'major_demerit',quantity:1,reason:'Synthetic invalid inactive'}],['jsonb']),'22023');
   await rejects(()=>rpc('rd_update_record',[record.id,record.version,{type_code:'major_demerit'}],['uuid','int','jsonb']),'22023');
   await rejects(()=>rpc('rd_save_type',['major_demerit',2,'Synthetic','-0.1',true],['text','int','text','text','boolean']),'22023');
   await rejects(()=>rpc('rd_save_type',['major_demerit',1,'Synthetic','-2',true],['text','int','text','text','boolean']),'40001');
   assert.equal((await rpc('rd_get_record',[record.id],['uuid'])).version,record.version);
   assert.equal((await rpc('rd_list_types')).find(x=>x.code==='major_demerit').version,2);
  });
  await t.test('literal search, full-population totals, years and history pagination',async()=>{
   const p=await rpc('rd_list_records',[{year:2026,search:'%_',page_size:1}],['jsonb']);assert.equal(p.total,1);assert.equal(p.summary.total_points,'-8');
   assert.equal((await rpc('rd_list_records',[{year:2025}],['jsonb'])).total,0);
   assert.equal((await rpc('rd_subject_history',[subject.id,{page:2,page_size:1}],['uuid','jsonb'])).total,1);
   for(const f of [{unknown:true},{page:0},{page_size:101},{year:'2026'},{status:'approved'},{from_date:'2026-02-02',to_date:'2026-01-01'}]) await rejects(()=>rpc('rd_list_records',[f],['jsonb']),'22023');
  });
  await t.test('owner-only import preserves raw source, original points, unlinked subjects',async()=>{
   await owner();
   const src={spreadsheet_id:'synthetic-ledger',gid:'1',record_id:'synthetic-row',raw:{person_id:'SYNTHETIC_PRIVATE_ID'},source_updated_raw:'original-update'};
   const person={spreadsheet_id:'synthetic-roster',gid:'2',person_id:'SYNTHETIC_PRIVATE_ID',label:'Synthetic Import Person',raw:{identity:'SYNTHETIC_PRIVATE_ID'}};
   imported=await value('select rewards_private.rd_import_record($1::jsonb,$2::jsonb,$3::jsonb) as v',[src,{application_date:'2025-04-01',type_code:'warning',type_label:'Historical Warning',quantity:2,total_points:'-0.5',reason:''},person]);
   assert.equal(imported.inserted,true);
   sourceCapture=await value('select to_jsonb(s) as v from rewards_private.rd_sources s where record_id=$1',[imported.id]);
   await identity('authenticated',admin);const r=await rpc('rd_get_record',[imported.id],['uuid']);
   assert.equal(r.total_points,'-0.5');assert.equal(r.unit_points,null);assert.equal(r.origin,'import');assert.equal(r.event_date,null);
   assert.equal((await rpc('rd_subject_picker',['Synthetic Import'])).items[0].employee_id,null);
   const a=await rpc('rd_record_audit',[imported.id],['uuid']);assert.equal(a.items[0].action,'import');assert.ok(!JSON.stringify(a).includes('SYNTHETIC_PRIVATE_ID'));
   await rpc('rd_update_record',[imported.id,1,{notes:'UI edit survives rerun'}],['uuid','int','jsonb']);
   await owner();const again=await value('select rewards_private.rd_import_record($1::jsonb,$2::jsonb,$3::jsonb) as v',[{...src,raw:{changed:true}}, {}, {}]);
   assert.equal(again.inserted,false);assert.equal(again.id,imported.id);
   assert.deepEqual(await value('select to_jsonb(s) as v from rewards_private.rd_sources s where record_id=$1',[imported.id]),sourceCapture);
   await identity('authenticated',admin);assert.equal((await rpc('rd_get_record',[imported.id],['uuid'])).notes,'UI edit survives rerun');
   assert.equal((await rpc('rd_record_audit',[imported.id],['uuid'])).total,2);
  });
  await t.test('158 synthetic historical events and 85 subjects reconcile without employee links; rerun untouched',async()=>{
   await owner();await db.exec('begin');
   try {
    const payloads=Array.from({length:158},(_,i)=>[
     {spreadsheet_id:'synthetic-batch-ledger',gid:'1',record_id:`row-${i}`,raw:{row:i},source_updated_raw:`update-${i}`},
     {application_date:i%2?'2024-01-01':null,type_code:null,type_label:'Synthetic legacy label',quantity:i%3+1,total_points:i%2?'0.5':'-0.5',reason:''},
     {spreadsheet_id:'synthetic-batch-roster',gid:'1',person_id:`person-${i%85}`,label:`Synthetic historical person ${i%85}`,raw:{synthetic:true}},
     {spreadsheet_id:'synthetic-batch-roster',gid:'1',person_id:`person-${(i+1)%85}`,label:`Synthetic historical person ${(i+1)%85}`,raw:{synthetic:true}},
    ]);
    for(const payload of payloads) assert.equal((await value('select rewards_private.rd_import_record($1::jsonb,$2::jsonb,$3::jsonb,$4::jsonb) as v',payload)).inserted,true);
    assert.equal(await value("select count(*)::int as v from rewards_private.rd_sources where spreadsheet_id='synthetic-batch-ledger'"),payloads.length);
    assert.equal(await value("select count(*)::int as v from rewards_private.rd_subject_origins where spreadsheet_id='synthetic-batch-roster'"),85);
    assert.equal(await value("select count(*)::int as v from rewards_private.rd_subjects s join rewards_private.rd_subject_origins o on o.subject_id=s.id where o.spreadsheet_id='synthetic-batch-roster' and s.employee_id is not null"),0);
    assert.equal(await value("select trim_scale(sum(r.total_points))::text as v from rewards_private.rd_records r join rewards_private.rd_sources s on s.record_id=r.id where s.spreadsheet_id='synthetic-batch-ledger'"),'0');
    const firstPage=await rpc('rd_list_records',[{search:'Synthetic legacy label',page_size:1}],['jsonb']);
    const secondPage=await rpc('rd_list_records',[{search:'Synthetic legacy label',page:2,page_size:1}],['jsonb']);
    assert.equal(firstPage.total,payloads.length);assert.equal(firstPage.items.length,1);assert.equal(firstPage.summary.total_points,'0');
    assert.notEqual(firstPage.items[0].id,secondPage.items[0].id);assert.equal(secondPage.total,firstPage.total);
    assert.ok(firstPage.items[0].application_date); // dated rows sort before unknown dates
    const dated=await rpc('rd_list_records',[{year:2024,search:'Synthetic legacy label',page_size:1}],['jsonb']);
    assert.equal(dated.total,payloads.filter(p=>p[1].application_date!==null).length);assert.equal(dated.summary.total_points,String(dated.total/2));
    const auditCount=await value('select count(*)::int as v from rewards_private.rd_audit');
    for(const payload of payloads) assert.equal((await value('select rewards_private.rd_import_record($1::jsonb,$2::jsonb,$3::jsonb,$4::jsonb) as v',payload)).inserted,false);
    assert.equal(await value('select count(*)::int as v from rewards_private.rd_audit'),auditCount);
   } finally {await owner();await db.exec('rollback');await identity('authenticated',admin);}
  });
  await t.test('void retains row and excludes points; repeat/edit require rejection',async()=>{
   await rejects(()=>rpc('rd_void_record',[record.id,record.version,' '],['uuid','int','text']),'22023');
   const r=await rpc('rd_void_record',[record.id,record.version,'Synthetic void reason'],['uuid','int','text']);assert.equal(r.status,'voided');
   const p=await rpc('rd_list_records',[{year:2026}],['jsonb']);assert.equal(p.total,1);assert.equal(p.summary.total_points,'0');assert.equal(p.summary.voided_count,1);
   await rejects(()=>rpc('rd_update_record',[r.id,r.version,{notes:'forbidden'}],['uuid','int','jsonb']),'22023');
   await rejects(()=>rpc('rd_void_record',[r.id,r.version,'again'],['uuid','int','text']),'22023');
  });
  await t.test('original source, identity, business deletion and audit are immutable even to owner DML',async()=>{
   await owner();
   for(const sql of ["update rewards_private.rd_sources set raw='{}'",'delete from rewards_private.rd_subject_origins','delete from rewards_private.rd_records',"update rewards_private.rd_audit set reason='forged'",'delete from rewards_private.rd_audit']) await rejects(()=>db.exec(sql),'42501');
  });
  await t.test('link requires version and reviewed reason and preserves record label snapshot',async()=>{
   await identity('authenticated',admin);
   const s=await rpc('rd_link_subject',[subject.id,1,emp,'Synthetic manually reviewed mapping'],['uuid','int','uuid','text']);assert.equal(s.employee_id,emp);assert.equal(s.version,2);
   await owner();
   const linkEvents=await db.query("select reason from rewards_private.rd_audit where entity_kind='subject' and entity_id=$1 and action='link'",[subject.id]);
   assert.equal(linkEvents.rows.length,1);assert.equal(linkEvents.rows[0].reason,'Synthetic manually reviewed mapping');
   await identity('authenticated',admin);
   assert.equal((await rpc('rd_get_record',[record.id],['uuid'])).subject_label,'Synthetic Historical Person');
   await rejects(()=>rpc('rd_link_subject',[subject.id,1,null,'stale'],['uuid','int','uuid','text']),'40001');
  });
  await t.test('failed audit insert rolls back business mutation atomically',async()=>{
   await owner();await db.exec("create function rewards_private.synthetic_audit_fail() returns trigger language plpgsql as $$begin raise exception 'Synthetic audit failure'; end$$;create trigger synthetic_failure before insert on rewards_private.rd_audit for each row execute function rewards_private.synthetic_audit_fail()");
   await identity('authenticated',admin);await rejects(()=>rpc('rd_update_record',[imported.id,2,{notes:'must rollback'}],['uuid','int','jsonb']),'P0001');
   assert.equal((await rpc('rd_get_record',[imported.id],['uuid'])).version,2);
   await owner();await db.exec('drop trigger synthetic_failure on rewards_private.rd_audit;drop function rewards_private.synthetic_audit_fail()');
  });
  await t.test('all objects have expected ACLs and RLS; no service-role backdoor',async()=>{
   await owner();
   assert.equal(await value("select count(*)::int as v from pg_tables where schemaname='rewards_private' and not rowsecurity"),0);
   const grants=await db.query("select n.nspname,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='rewards_private' or (n.nspname='public' and left(p.proname,3)='rd_')) and (has_function_privilege('anon',p.oid,'execute') or has_function_privilege('service_role',p.oid,'execute'))");assert.equal(grants.rows.length,0);
   assert.equal(await value("select has_schema_privilege('authenticated','rewards_private','usage') as v"),false);
   const tableGrants=await db.query("select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='rewards_private' and c.relkind='r' and (has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') or has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') or has_table_privilege('service_role',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))");
   assert.equal(tableGrants.rows.length,0);
  });
  await t.test('RLS independently rejects nonadmin if SELECT/schema grants are accidentally widened',async()=>{
   await owner();await db.exec('begin; grant usage on schema rewards_private to authenticated;grant select on all tables in schema rewards_private to authenticated;grant execute on function rewards_private.rd_is_admin() to authenticated;');
   await identity('authenticated',other);assert.equal(await value('select count(*)::int as v from rewards_private.rd_records'),0);assert.equal(await value('select count(*)::int as v from rewards_private.rd_subject_origins'),0);assert.equal(await value('select count(*)::int as v from rewards_private.rd_admins'),0);
   await owner();await db.exec('rollback');
  });
  await t.test('migration rerun preserves catalogue edits, data and no grants drift',async()=>{
   await owner();await db.exec(migration);
   await identity('authenticated',admin);assert.equal((await rpc('rd_list_types')).find(x=>x.code==='warning').points,'-2');
   assert.equal((await rpc('rd_list_records')).total,2);
   await owner();await db.query('delete from rewards_private.rd_admins where user_id=$1',[admin]);
   await identity('authenticated',admin);assert.equal(await rpc('rd_permission'),false);await rejects(()=>rpc('rd_get_record',[imported.id],['uuid']),'42501');
  });
 } finally {await db.close();}
});

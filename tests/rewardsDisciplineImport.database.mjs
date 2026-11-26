// Synthetic-only PG17 exercise of the importer, not a production connection.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {buildImport,applyImport,readBack,reconcileImport,makeOwnerSQL,HEADERS} from '../scripts/rewards-discipline-import.mjs';
const mod=process.env.REWARDS_PGLITE_MODULE;
if(!mod)throw new Error('REWARDS_PGLITE_MODULE required; isolated PGlite only');
const {PGlite}=await import(pathToFileURL(mod).href);
const actor='11111111-1111-4111-8111-111111111111';
const metadata={spreadsheet_id:'synthetic-ledger',gid:'123',tab:'獎懲'};
const source={values:[HEADERS,...Array.from({length:8},(_,i)=>[`synthetic-${i}`,'2024/2/29',`person-${(i+1)%3}`,`Synthetic ${(i+1)%3}`,`person-${i%3}`,`Synthetic ${i%3}`,' padded basis ','嘉獎','2',i%2?'1':'-0.5',' padded\nreason ',`unparsed ${i}`])]};
test('synthetic owner adapter: PG17 full-field reconciliation, rollback, replay and SQL artifact',async t=>{
 const db=new PGlite();try{
  await db.exec(`create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;
  create schema auth;create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
  create table public.employees(id uuid primary key,name text,department text,is_active boolean);`);
  await db.exec(readFileSync(new URL('../supabase/migrations/202611260001_employee_rewards_discipline.sql',import.meta.url),'utf8'));
  const batch=buildImport(source,metadata);
  await t.test('actor must already be allowlisted; no auto grant',async()=>{await assert.rejects(()=>applyImport(db,batch,{apply:true,actor}),/ACTOR_NOT_ALLOWLISTED/);assert.equal((await db.query('select count(*)::int as n from rewards_private.rd_records')).rows[0].n,0);});
  await db.query('insert into auth.users values($1)',[actor]);await db.query('insert into rewards_private.rd_admins(user_id,grant_reason) values($1,$2)',[actor,'Synthetic explicit fixture grant']);
  await t.test('failed audit rolls back entire batch',async()=>{
   await db.exec("create function rewards_private.synthetic_fail() returns trigger language plpgsql as $$begin if (select count(*) from rewards_private.rd_records)>3 then raise exception 'synthetic';end if;return new;end$$;create trigger synthetic_fail before insert on rewards_private.rd_audit for each row execute function rewards_private.synthetic_fail()");
   await assert.rejects(()=>applyImport(db,batch,{apply:true,actor}));assert.equal((await db.query('select count(*)::int as n from rewards_private.rd_records')).rows[0].n,0);
   assert.equal((await db.query('select count(*)::int as n from rewards_private.rd_subjects')).rows[0].n,0);
   await db.exec('drop trigger synthetic_fail on rewards_private.rd_audit;drop function rewards_private.synthetic_fail()');
  });
  await t.test('fresh import full field compare and independent postcommit read',async()=>{const r=await applyImport(db,batch,{apply:true,actor});assert.equal(r.inserted_count,8);assert.equal(r.postcommit_verified,true);assert.equal(reconcileImport(batch,await readBack(db,metadata)).mismatch_count,0);});
  await t.test('rerun never overwrites UI edit, changed catalogue or immutable captures',async()=>{
   const rows=await readBack(db,metadata);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[actor]);
   await db.query("select public.rd_update_record($1::uuid,1,'{\"notes\":\"Synthetic edited fixture\"}'::jsonb)",[rows[0].record_uuid]);
   await db.query("select public.rd_save_type('commendation',1,'Synthetic changed', '3',false)");
   const before=await readBack(db,metadata);const audits=(await db.query('select count(*)::int as n from rewards_private.rd_audit')).rows[0].n;
   const r=await applyImport(db,batch,{apply:true,actor});assert.equal(r.inserted_count,0);assert.equal(r.replayed_count,8);assert.equal(r.existing_unchanged,true);
   assert.deepEqual(await readBack(db,metadata),before);assert.equal((await db.query('select count(*)::int as n from rewards_private.rd_audit')).rows[0].n,audits);
   assert.equal((await db.query('select count(*)::int as n from rewards_private.rd_subjects where employee_id is not null')).rows[0].n,0);
   assert.equal((await db.query('select count(*)::int as n from public.employees')).rows[0].n,0);
  });
  await t.test('generated owner SQL is executable but replay-only and preserves edits',async()=>{const before=await readBack(db,metadata);await db.exec(makeOwnerSQL(batch,actor));assert.deepEqual(await readBack(db,metadata),before);});
  // Each generated artifact is sent in ONE db.exec request, just like an owner
  // management API. A SET inside the artifact cannot fix its initial parse mode.
  for(const setting of ['on','off']) {
   await t.test(`single-request SQL preserves opaque unicode escapes with session ${setting}`,async()=>{
    const m={...metadata,spreadsheet_id:`synthetic-unicode-${setting}`};
    const originalRow=[String.raw`opaque\u0041`,'2024/2/29','synthetic-person','Synthetic Person','synthetic-person','Synthetic Person','basis','嘉獎','2','-0.5',String.raw`literal\u0042`,'unparsed update'];
    const b=buildImport({values:[HEADERS,originalRow]},m);
    await db.exec(`SET standard_conforming_strings=${setting}`);
    assert.equal((await db.query('show standard_conforming_strings')).rows[0].standard_conforming_strings,setting);
    await db.exec(makeOwnerSQL(b,actor));
    const rows=await readBack(db,m),r=reconcileImport(b,rows);
    assert.equal(r.mismatch_count,0,JSON.stringify({missing:r.missing_count,extra:r.extra_count,mismatches:r.mismatch_count}));
    assert.equal(rows[0].source_record_id,originalRow[0]);assert.equal(rows[0].record.reason,originalRow[10]);assert.deepEqual(rows[0].raw.values,originalRow);
   });
   await t.test(`single-request SQL preserves raw controls quotes and SQL-shaped strings with session ${setting}`,async()=>{
    const tricky=String.raw`literal\u0042\n\t\r\b\f\\ \' ' " ; SELECT 'not executed'; -- $$ $rd_owner_gate$ /* text */`+'\nactual newline\tactual tab\ractual CR';
    const m={...metadata,spreadsheet_id:`synthetic-escaping-${setting} '${String.raw`\u0053`}`};
    const originalRow=[`opaque-${tricky}`,'2024/2/29',`applicant-${tricky}`,`Applicant ${tricky}`,`recipient-${tricky}`,`Recipient ${tricky}`,`Basis ${tricky}`,'嘉獎','2','-0.5',`Reason ${tricky}`,`Update ${tricky}`];
    const b=buildImport({values:[HEADERS,originalRow]},m);assert.equal(b.report.invalid_count,0);
    await db.exec(`SET standard_conforming_strings=${setting}`);
    const sql=makeOwnerSQL(b,actor);
    // Prove all four JSON literals parse verbatim WITHOUT any in-artifact SET,
    // including while the session is off; then exercise the entire artifact once.
    const literals=[...sql.matchAll(/(E'(?:''|[^'])*')::jsonb/g)].map(m=>m[1]);assert.equal(literals.length,4);
    for(const [i,value] of [b.payloads[0].source,b.payloads[0].record,b.payloads[0].subject,b.payloads[0].applicant].entries())assert.deepEqual((await db.query(`select ${literals[i]}::jsonb as value`)).rows[0].value,value);
    await db.exec(sql);
    const before=await readBack(db,m),r=reconcileImport(b,before);assert.equal(r.mismatch_count,0);assert.equal(r.compared_count,1);
    assert.equal(before[0].source_record_id,originalRow[0]);assert.deepEqual(before[0].raw,{headers:HEADERS,values:originalRow});
    assert.equal(before[0].record.reason,originalRow[10]);assert.equal(before[0].source_updated_raw,originalRow[11]);
    const audit=(await db.query('select actor_id from rewards_private.rd_audit where entity_id=$1',[before[0].record_uuid])).rows;assert.equal(audit.length,1);assert.equal(audit[0].actor_id,actor);
    const auditCount=(await db.query('select count(*)::int as n from rewards_private.rd_audit')).rows[0].n;
    await db.exec(`SET standard_conforming_strings=${setting}`);await db.exec(sql);
    assert.deepEqual(await readBack(db,m),before);assert.equal((await db.query('select count(*)::int as n from rewards_private.rd_audit')).rows[0].n,auditCount);
   });
  }
  t.diagnostic((await db.query('select version() as v')).rows[0].v);
 }finally{await db.close();}
});

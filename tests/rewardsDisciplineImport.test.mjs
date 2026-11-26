import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildImport, reconcileImport, applyImport, makeOwnerSQL, HEADERS, TYPE_CODES} from '../scripts/rewards-discipline-import.mjs';
const metadata={spreadsheet_id:'synthetic-ledger',gid:'123',tab:'獎懲'};
const row=['synthetic-event','2024/2/29','synthetic-person',' Synthetic Person ','synthetic-person',' Synthetic Person ',' Synthetic basis ','嘉獎','2','-0.5',' Synthetic\nreason ','unparsed update'];
const source=(rows=[row])=>({values:[HEADERS,...rows]});
const build=(rows=[row])=>buildImport(source(rows),metadata);
test('synthetic strings, all twelve columns, historical points and shared identity are exact',()=>{
 const b=build();assert.equal(b.report.valid_count,1);assert.equal(b.report.invalid_count,0);assert.equal(b.report.subject_count,1);
 const p=b.payloads[0];assert.equal(p.record.total_points,'-0.5');assert.equal(p.record.application_date,'2024-02-29');assert.equal(p.record.event_date,null);
 assert.deepEqual(p.source.raw,{headers:HEADERS,values:row});assert.deepEqual(p.subject,p.applicant);assert.equal(p.subject.label,row[5]);
 assert.equal(b.report.total_points,'-0.5');assert.match(b.capture_sha256,/^[a-f0-9]{64}$/);
 assert.equal(p.record.type_code,'commendation');assert.equal(TYPE_CODES['大過'],'major_demerit');
});
test('fail closed on duplicates, malformed dates, empty IDs, unsafe decimals, shape and namespace',()=>{
 const dup=build([row,[...row]]);assert.equal(dup.report.invalid_count,2);assert.equal(dup.report.valid_count,0);
 for(const [i,value] of [[0,''],[1,'24/2/29'],[1,'2023/2/29'],[1,'2024-02-30'],[2,' '],[4,123],[7,'unknown'],[8,'01'],[8,'1.5'],[9,'NaN'],[9,'0.1'],[9,'-0'],[9,'1e2'],[11,null],[10,'\u0000']]) {
  const r=[...row];r[i]=value;const b=build([r]);assert.equal(b.report.invalid_count,1,`column ${i}`);
 }
 assert.throws(()=>buildImport(source(),{...metadata,gid:123}));
 assert.throws(()=>buildImport({values:[['wrong'],row]},metadata));
 const blank=[...row];blank[10]='';assert.equal(build([blank]).report.valid_count,1);
});
test('no silent truncation, identifier normalization or conflicting person labels',()=>{
 const r=[...row];r[0]=' 000-id ';assert.equal(build([r]).payloads[0].source.record_id,r[0]);
 const conflict=[...row];conflict[0]='second';conflict[5]='different';assert.equal(build([row,conflict]).report.invalid_count,2);
 assert.equal(build([[...row,'extra']]).report.invalid_count,1);
});
test('reconciliation rejects per-field, missing and extra row mismatches without logging values',()=>{
 const b=build();const p=b.payloads[0];const actual={source_record_id:p.source.record_id,record:p.record,subject:p.subject,applicant:p.applicant,raw:p.source.raw,source_updated_raw:p.source.source_updated_raw,origin:'import',unit_points:null,status:'recorded',void_reason:null,version:1,employee_id:null,applicant_employee_id:null};
 assert.equal(reconcileImport(b,[actual]).mismatch_count,0);
 assert.equal(reconcileImport(b,[]).missing_count,1);
 for(const f of Object.keys(p.record)) assert.ok(reconcileImport(b,[{...actual,record:{...p.record,[f]:'wrong'}}]).mismatch_count>0);
 assert.ok(reconcileImport(b,[{...actual,employee_id:'unexpected'}]).mismatch_count>0);
 assert.equal(reconcileImport(b,[actual,actual]).duplicate_count,1);
 assert.equal(reconcileImport(b,[actual,{...actual,source_record_id:'extra'}]).extra_count,1);
});
test('owner transaction rolls back failures and explicit approval required before connection use',async()=>{
 const client={query:async()=>{throw new Error('synthetic failure');}};
 await assert.rejects(()=>applyImport(client,build(),{}),/APPLY_APPROVAL_REQUIRED/);
 const invalid=build([row,row]);await assert.rejects(()=>applyImport(client,invalid,{apply:true,actor:'11111111-1111-4111-8111-111111111111'}),/INVALID_SOURCE/);
 const sql=makeOwnerSQL(build(),'11111111-1111-4111-8111-111111111111');assert.ok(sql.startsWith('BEGIN;'));assert.ok(sql.endsWith('COMMIT;\n'));assert.ok(!sql.includes('exec_sql'));assert.ok(sql.includes('set_config'));assert.ok(!sql.includes('INSERT INTO rewards_private.rd_admins'));assert.ok(sql.includes("set_config('request.jwt.claim.sub',E'11111111-1111-4111-8111-111111111111',true)"));assert.equal([...sql.matchAll(/E'(?:''|[^'])*'::jsonb/g)].length,4);
});

#!/usr/bin/env node
// Owner-only historical importer. Default is OFFLINE validation; no network I/O.
import {createHash} from 'node:crypto';
import {readFile, lstat, mkdir, open, realpath, access} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
export const HEADERS=['獎懲ID','申請日期','申請人ID','申請人','被獎懲人ID','被獎懲人','依據','獎懲種類','次數','積分','事由','update'];
// Exact seed codes from 202611260001_employee_rewards_discipline.sql; no fuzzy mapping.
export const TYPE_CODES=Object.freeze({'嘉獎':'commendation','小功':'minor_merit','大功':'major_merit','警告':'warning','申誡':'reprimand','小過':'minor_demerit','大過':'major_demerit'});
const fail=code=>{throw new Error(code);};
const text=(v,max,required=false)=>typeof v==='string'&&!v.includes('\0')&&[...v].length<=max&&(!required||v.trim().length>0);
const half=v=>{
 if(typeof v!=='string'||v.length>30||! /^(0|[1-9][0-9]*)(\.[05])?$|^-[1-9][0-9]*(\.[05])?$|^-0\.5$/.test(v)) fail('INVALID_POINTS');
 const negative=v.startsWith('-'),s=negative?v.slice(1):v,[i,d='0']=s.split('.');const n=BigInt(i)*2n+(d==='5'?1n:0n);
 if(n>2000000000000000n) fail('INVALID_POINTS');return negative?-n:n;
};
const decimal=n=>`${n<0n?'-':''}${(n<0n?-n:n)/2n}${(n<0n?-n:n)%2n?'.5':''}`;
export const sha256=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
export function civilDate(s) {
 // Two explicitly supported Gregorian formats; never Date.parse/ROC conversion/timezone guessing.
 const m=typeof s==='string'&&(s.match(/^([0-9]{4})\/([0-9]{1,2})\/([0-9]{1,2})$/)||s.match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/));
 if(!m) fail('INVALID_DATE');const [y,mo,d]=m.slice(1).map(Number),leap=y%4===0&&(y%100!==0||y%400===0);
 if(y<1||mo<1||mo>12||d<1||d>[31,leap?29:28,31,30,31,30,31,31,30,31,30,31][mo-1]) fail('INVALID_DATE');
 return `${m[1]}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
function validateMetadata(m) {
 if(!m||!text(m.spreadsheet_id,300,true)||!text(m.gid,100,true)||! /^[0-9]+$/.test(m.gid)||m.tab!=='獎懲'||Object.keys(m).some(k=>!['spreadsheet_id','gid','tab'].includes(k))) fail('INVALID_METADATA');
}
export function buildImport(source,metadata) {
 validateMetadata(metadata);
 if(!source||!Array.isArray(source.values)||!isDeepStrictEqual(source.values[0],HEADERS)) fail('INVALID_HEADERS');
 const rows=source.values.slice(1),issues=rows.map(()=>new Set()),idRows=new Map(),people=new Map();
 const issue=(i,code)=>issues[i].add(code);
 rows.forEach((r,i)=>{
  if(!Array.isArray(r)||r.length!==12){issue(i,'ROW_WIDTH');return;}
  const limits=[300,20,300,200,300,200,2000,200,7,30,4000,4000];
  r.forEach((v,j)=>{if(!text(v,limits[j],[0,1,2,3,4,5,7,8,9].includes(j)))issue(i,`COLUMN_${j+1}`);});
  if(typeof r[0]==='string'){const a=idRows.get(r[0])||[];a.push(i);idRows.set(r[0],a);}
  try {civilDate(r[1]);}catch{issue(i,'APPLICATION_DATE');}
  if(!Object.hasOwn(TYPE_CODES,r[7]))issue(i,'TYPE_UNMAPPED');
  if(typeof r[8]!=='string'||!/^[1-9][0-9]{0,6}$/.test(r[8])||Number(r[8])>1000000)issue(i,'QUANTITY');
  try {half(r[9]);}catch{issue(i,'POINTS');}
  for(const [id,label] of [[r[4],r[5]],[r[2],r[3]]]) {
   if(typeof id!=='string'||typeof label!=='string')continue;
   const p=people.get(id)||{labels:new Set(),rows:new Set()};p.labels.add(label);p.rows.add(i);people.set(id,p);
  }
 });
 for(const indexes of idRows.values())if(indexes.length>1)for(const i of indexes)issue(i,'DUPLICATE_RECORD_ID');
 for(const p of people.values())if(p.labels.size>1)for(const i of p.rows)issue(i,'PERSON_LABEL_CONFLICT');
 const payloads=[],exceptions=[];
 const person=(id,label)=>({spreadsheet_id:metadata.spreadsheet_id,gid:metadata.gid,person_id:id,label,raw:{person_id:id,label}});
 rows.forEach((r,i)=>{
  if(issues[i].size){exceptions.push({source_row:i+2,codes:[...issues[i]].sort()});return;}
  payloads.push({source:{spreadsheet_id:metadata.spreadsheet_id,gid:metadata.gid,record_id:r[0],raw:{headers:[...HEADERS],values:[...r]},source_updated_raw:r[11]},record:{application_date:civilDate(r[1]),event_date:null,type_code:TYPE_CODES[r[7]],type_label:r[7],quantity:Number(r[8]),total_points:r[9],basis:r[6],reason:r[10],notes:''},subject:person(r[4],r[5]),applicant:person(r[2],r[3])});
 });
 const dates=payloads.map(p=>p.record.application_date).sort(),codes={};for(const p of payloads)codes[p.record.type_code]=(codes[p.record.type_code]||0)+1;
 const capture_sha256=sha256(source),report={source_count:rows.length,valid_count:payloads.length,invalid_count:exceptions.length,subject_count:new Set(payloads.flatMap(p=>[p.subject.person_id,p.applicant.person_id])).size,all_subjects_unlinked:true,application_date_min:dates[0]??null,application_date_max:dates.at(-1)??null,total_points:decimal(payloads.reduce((n,p)=>n+half(p.record.total_points),0n)),points_provenance:'source column 10 (積分); no recalculation',event_date_null_count:payloads.length,unit_points_null_count:payloads.length,type_counts:codes,capture_sha256};
 return {metadata:{...metadata},capture_sha256,payloads,exceptions,report};
}
function requireValid(batch){if(!batch?.report||batch.report.invalid_count||batch.payloads.length!==batch.report.source_count||!batch.payloads.length)fail('INVALID_SOURCE');}
const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const personComparable=p=>p&&({spreadsheet_id:p.spreadsheet_id,gid:p.gid,person_id:p.person_id,label:p.label,raw:p.raw});
export function reconcileImport(batch,actual,{allowExtra=false}={}) {
 const expected=new Map(batch.payloads.map(p=>[p.source.record_id,p])),seen=new Set(),exceptions=[];let compared=0,missing=0,extra=0,duplicates=0,fields=0;
 for(const a of actual) {
  const id=a.source_record_id,p=expected.get(id);if(seen.has(id)){duplicates++;continue;}seen.add(id);
  if(!p){extra++;continue;}
  compared++;
  const checks={...Object.fromEntries(Object.entries(p.record).map(([k,v])=>[`record.${k}`,[v,a.record?.[k]]])),subject:[personComparable(p.subject),personComparable(a.subject)],applicant:[personComparable(p.applicant),personComparable(a.applicant)],raw:[p.source.raw,a.raw],source_updated_raw:[p.source.source_updated_raw,a.source_updated_raw],origin:['import',a.origin],unit_points:[null,a.unit_points],status:['recorded',a.status],void_reason:[null,a.void_reason],version:[1,a.version],employee_id:[null,a.employee_id],applicant_employee_id:[null,a.applicant_employee_id]};
  for(const [field,[wanted,got]] of Object.entries(checks)){fields++;const equal=field==='record.total_points'?(()=>{try{return half(wanted)===half(got);}catch{return false;}})():isDeepStrictEqual(wanted,got);if(!equal)exceptions.push({source_record_id:id,field});}
 }
 for(const id of expected.keys())if(!seen.has(id))missing++;
 return {expected_count:expected.size,compared_count:compared,compared_field_count:fields,missing_count:missing,extra_count:extra,duplicate_count:duplicates,mismatch_count:exceptions.length+missing+duplicates+(allowExtra?0:extra),exceptions};
}
// A dedicated connected owner client is required. No transaction pooling/shared client.
const OWNER_CHECK=`select (c.relowner=(select oid from pg_roles where rolname=current_user) or (select rolsuper from pg_roles where rolname=current_user)) as owner_ok from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='rewards_private' and c.relname='rd_sources'`;
export async function readBack(client,metadata) {
 const q=await client.query(`select s.source_record_id,s.raw,s.source_updated_raw,
 jsonb_build_object('application_date',to_char(r.application_date,'YYYY-MM-DD'),'event_date',to_char(r.event_date,'YYYY-MM-DD'),'type_code',r.type_code,'type_label',r.type_label,'quantity',r.quantity,'total_points',trim_scale(r.total_points)::text,'basis',r.basis,'reason',r.reason,'notes',r.notes) as record,
 jsonb_build_object('spreadsheet_id',so.spreadsheet_id,'gid',so.gid,'person_id',so.person_id,'label',r.subject_label,'raw',so.raw) as subject,
 case when r.applicant_subject_id is null then null else jsonb_build_object('spreadsheet_id',ao.spreadsheet_id,'gid',ao.gid,'person_id',ao.person_id,'label',r.applicant_label,'raw',ao.raw) end as applicant,
 sub.employee_id,app.employee_id as applicant_employee_id,r.origin,r.unit_points::text,r.status,r.void_reason,r.version,
 r.id as record_uuid,r.subject_id,r.applicant_subject_id,r.created_at::text,r.updated_at::text,s.captured_at::text
 from rewards_private.rd_sources s join rewards_private.rd_records r on r.id=s.record_id
 join rewards_private.rd_subjects sub on sub.id=r.subject_id join rewards_private.rd_subject_origins so on so.subject_id=sub.id
 left join rewards_private.rd_subjects app on app.id=r.applicant_subject_id left join rewards_private.rd_subject_origins ao on ao.subject_id=app.id
 where s.spreadsheet_id=$1 and s.gid=$2 order by s.source_record_id`,[metadata.spreadsheet_id,metadata.gid]);
 return q.rows;
}
export async function applyImport(client,batch,{apply=false,actor}={}) {
 if(!apply||!uuid(actor))fail('APPLY_APPROVAL_REQUIRED');requireValid(batch);
 await client.query('BEGIN');let committed=false;
 try {
  if(!(await client.query(OWNER_CHECK)).rows[0]?.owner_ok)fail('OWNER_REQUIRED');
  await client.query("select set_config('request.jwt.claim.sub',$1,true)",[actor]);
  if(!(await client.query('select public.rd_permission() as allowed')).rows[0]?.allowed)fail('ACTOR_NOT_ALLOWLISTED');
  const before=await readBack(client,batch.metadata),prior=new Map(before.map(r=>[r.source_record_id,r]));let inserted=0;
  for(const p of batch.payloads){const result=(await client.query('select rewards_private.rd_import_record($1::jsonb,$2::jsonb,$3::jsonb,$4::jsonb) as result',[p.source,p.record,p.subject,p.applicant].map(v=>JSON.stringify(v)))).rows[0].result;if(result.inserted)inserted++;}
  const after=await readBack(client,batch.metadata),newPayloads=batch.payloads.filter(p=>!prior.has(p.source.record_id)),newActual=after.filter(a=>newPayloads.some(p=>p.source.record_id===a.source_record_id));
  const reconciliation=reconcileImport({...batch,payloads:newPayloads},newActual);
  const unchanged=before.every(b=>isDeepStrictEqual(b,after.find(a=>a.source_record_id===b.source_record_id)));
  if(reconciliation.mismatch_count||!unchanged||inserted!==newPayloads.length)fail('RECONCILIATION_FAILED');
  await client.query('COMMIT');committed=true;
  // Independent post-commit read: do not claim durable success based only on in-transaction reads.
  const persisted=await readBack(client,batch.metadata);
  if(!isDeepStrictEqual(after,persisted))fail('POSTCOMMIT_VERIFY_FAILED');
  return {inserted_count:inserted,replayed_count:batch.payloads.length-inserted,existing_unchanged:unchanged,postcommit_verified:true,new_row_reconciliation:{...reconciliation,exceptions:undefined}};
 }catch(e){if(!committed)await client.query('ROLLBACK');throw e;}
}
// Escape strings must be parse-safe BEFORE any statement in the artifact runs.
// E'' always decodes backslashes: double them first, then double single quotes.
// An in-artifact SET cannot control parsing of the enclosing multi-statement request.
const literal=v=>`E'${String(v).replaceAll('\\','\\\\').replaceAll("'","''")}'`;
export function makeOwnerSQL(batch,actor) {
 requireValid(batch);if(!uuid(actor))fail('INVALID_ACTOR');
 // Non-executing private artifact for an already-approved trusted owner management API.
 // Reject non-owner/nonallowlisted actor; NEVER insert allowlist or grant privileges here.
 // Retain the LOCAL GUC only for backend runtime helpers using U&'' literals.
 // Payload/actor parse safety comes from E'' escaping, never from this SET.
 return `BEGIN;\nSET LOCAL standard_conforming_strings=on;\nDO $rd_owner_gate$ BEGIN IF NOT coalesce((${OWNER_CHECK}),false) THEN RAISE EXCEPTION 'OWNER_REQUIRED'; END IF; END $rd_owner_gate$;\nSELECT set_config('request.jwt.claim.sub',${literal(actor)},true);\nSELECT rewards_private.rd_require_admin();\n${batch.payloads.map(p=>`SELECT rewards_private.rd_import_record(${[p.source,p.record,p.subject,p.applicant].map(v=>literal(JSON.stringify(v))+'::jsonb').join(',')});`).join('\n')}\nCOMMIT;\n`;
}
export async function readPrivateJSON(file) {
 if(file==='-'){let s='';for await(const chunk of process.stdin)s+=chunk;return JSON.parse(s);}
 const st=await lstat(file);if(!st.isFile()||st.isSymbolicLink()||(st.mode&0o777)!==0o600||st.uid!==process.getuid())fail('INPUT_MUST_BE_OWNED_PRIVATE_0600');return JSON.parse(await readFile(file,'utf8'));
}
export async function writePrivate(file,value) {
 const parent=path.dirname(path.resolve(file));await mkdir(parent,{recursive:true,mode:0o700});const dir=await realpath(parent);const st=await lstat(dir);if((st.mode&0o777)!==0o700||st.uid!==process.getuid())fail('OUTPUT_DIRECTORY_MUST_BE_PRIVATE_0700');
 let check=dir;while(true){try{await access(path.join(check,'.git'));fail('PRIVATE_OUTPUT_INSIDE_REPOSITORY');}catch(e){if(e.message==='PRIVATE_OUTPUT_INSIDE_REPOSITORY')throw e;if(e.code!=='ENOENT')throw e;}const up=path.dirname(check);if(up===check)break;check=up;}
 const handle=await open(path.join(dir,path.basename(file)),'wx',0o600);try{await handle.writeFile(typeof value==='string'?value:JSON.stringify(value,null,2));}finally{await handle.close();}
}
async function cli() {
 const args=process.argv.slice(2),opts={};const allowed=['source','metadata','payload-out','exceptions-out','sql-out','actor','apply','connection-file','pg-module'];
 for(let i=0;i<args.length;i++){const k=args[i].replace(/^--/,'');if(!args[i].startsWith('--')||!allowed.includes(k)||Object.hasOwn(opts,k))fail('INVALID_ARGUMENTS');opts[k]=k==='apply'?true:args[++i];if(opts[k]===undefined)fail('MISSING_ARGUMENT');}
 if(!opts.source||!opts.metadata||(opts.source==='-'&&opts.metadata==='-'))fail('SOURCE_AND_METADATA_REQUIRED');
 if(!opts.apply&&(opts['connection-file']||opts['pg-module']))fail('CONNECTION_REQUIRES_EXPLICIT_APPLY');
 const batch=buildImport(await readPrivateJSON(opts.source),await readPrivateJSON(opts.metadata));
 console.log(JSON.stringify({mode:opts.apply?'apply-requested':'offline-dry-run',...batch.report}));
 if(opts['exceptions-out'])await writePrivate(opts['exceptions-out'],batch.exceptions);
 requireValid(batch);
 if(opts['payload-out'])await writePrivate(opts['payload-out'],batch);
 if(opts['sql-out'])await writePrivate(opts['sql-out'],makeOwnerSQL(batch,opts.actor));
 if(opts.apply){
  if(!uuid(opts.actor)||!opts['connection-file'])fail('APPLY_APPROVAL_REQUIRED');
  // node-postgres is optional, loaded only on explicit apply; credentials never in argv/output.
  const pg=await import(opts['pg-module']?pathToFileURL(path.resolve(opts['pg-module'])).href:'pg');const Client=pg.Client||pg.default?.Client;
  const client=new Client(await readPrivateJSON(opts['connection-file']));
  try{await client.connect();console.log(JSON.stringify(await applyImport(client,batch,{apply:true,actor:opts.actor})));}finally{await client.end();}
 }
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)cli().catch(()=>{console.error('IMPORT_NOT_VERIFIED: inspect private inputs and owner prerequisites; an apply may already be committed if post-commit verification failed; no raw error/DSN emitted');process.exitCode=1;});

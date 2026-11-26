// SYNTHETIC browser fixture only. Never imported by application code.
import { REWARD_TYPES, calculatePoints, pointsToHalfUnits, halfUnitsToPoints } from '../../lib/rewardsDiscipline.mjs';
const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
let mode=new URLSearchParams(location.search).get('permission')||'allowed';
const listeners=new Set(), delays={}, failures={};
let records=Array.from({length:45},(_,i)=>({
 id:uuid(i+1),subject_id:uuid(100+i%3),subject_label:`模擬人物${i%3+1}`,applicant_subject_id:null,applicant_label:null,
 application_date:i===44?null:`2026-11-${String(26-i%26).padStart(2,'0')}`,event_date:null,type_code:'commendation',type_label:'嘉獎',quantity:1,unit_points:i===1?null:'0.5',total_points:i===1?'3':'0.5',
 reason:i===0?'完整長文事由\n'+('安全文字 <img src=x onerror=alert(1)>；忠實呈現，不執行HTML。'.repeat(60)):`模擬事由${i+1}`,
 basis:'完整依據\n測試條文與段落',notes:'模擬備註',origin:i===1?'import':'manual',status:i===2?'voided':'recorded',void_reason:i===2?'模擬重複登錄':null,version:1,created_at:'2026-11-26T01:00:00Z',updated_at:'2026-11-26T01:00:00Z'
}));
const types=REWARD_TYPES.map(t=>({...t,active:true,version:1})).concat({code:'retired',label:'歷史停用種類',points:'1',active:false,version:1});
let subjects=Array.from({length:45},(_,i)=>({id:uuid(100+i),label:`模擬人物${i+1}`,employee_id:null,version:1}));
const employees=Array.from({length:45},(_,i)=>({id:uuid(1000+i),name:`模擬現職${i+1}`,department:'模擬單位'}));
const audits=[];
const calls=[];
const session=()=>mode==='none'?null:{access_token:'synthetic-not-a-real-jwt',user:{id:uuid(mode==='allowed'?9000:9001),email:'synthetic@example.invalid'}};
function page(items,p=1,size=20){return {items:items.slice((p-1)*size,p*size),total:items.length,page:p,page_size:size};}
function list(filter={},subject){
 const items=records.filter(r=>(!subject||r.subject_id===subject)&&(!filter.subject_id||r.subject_id===filter.subject_id)&&(!filter.year||r.application_date?.startsWith(`${filter.year}-`))&&(!filter.type_code||r.type_code===filter.type_code)&&(!filter.status||r.status===filter.status)&&(!filter.from_date||r.application_date>=filter.from_date)&&(!filter.to_date||(r.application_date&&r.application_date<=filter.to_date))&&(!filter.search||[r.subject_label,r.type_label,r.reason].some(s=>s.includes(filter.search)))).sort((a,b)=>(b.application_date||'').localeCompare(a.application_date||'')||b.id.localeCompare(a.id));
 const recorded=items.filter(r=>r.status==='recorded');
 return {...page(items,filter.page,filter.page_size),summary:{recorded_count:recorded.length,voided_count:items.length-recorded.length,total_points:halfUnitsToPoints(recorded.reduce((n,r)=>n+pointsToHalfUnits(r.total_points),0))}};
}
function run(name,args,permissionAtStart){
 if(name==='rd_permission')return permissionAtStart==='error'?{data:null,error:{code:'FIXTURE'}}:{data:permissionAtStart==='allowed'||permissionAtStart==='pending',error:null};
 if(mode!=='allowed'&&mode!=='pending')return {data:null,error:{code:'42501'}};
 if(failures[name]){const code=failures[name];delete failures[name];if(code==='40001'&&args.p_id){const r=records.find(r=>r.id===args.p_id);if(r)r.version++;}return {data:null,error:{code}};}
 let data;
 if(name==='rd_list_records')data=list(args.p_filter);
 else if(name==='rd_list_types')data=types;
 else if(name==='rd_subject_picker')data=page(subjects.filter(s=>s.label.includes(args.p_search)),args.p_page,args.p_page_size);
 else if(name==='rd_employee_picker')data=page(employees.filter(s=>s.name.includes(args.p_search)),args.p_page,args.p_page_size);
 else if(name==='rd_create_subject'){
   const employee=employees.find(e=>e.id===args.p_employee_id);if(!employee)throw Error('fixture identity');
   data={id:uuid(100+subjects.length),label:employee.name,employee_id:employee.id,version:1};subjects.push(data);
 } else if(name==='rd_subject_history')data=list(args.p_filter,args.p_subject_id);
 else if(name==='rd_record_audit')data=page(audits.filter(a=>a.entity_id===args.p_record_id),args.p_page,args.p_page_size);
 else if(name==='rd_get_record')data=records.find(r=>r.id===args.p_id);
 else if(name==='rd_create_record'){
   const p=args.p_input,t=types.find(t=>t.code===p.type_code),s=subjects.find(s=>s.id===p.subject_id);
   data={...p,id:uuid(500+records.length),subject_label:s.label,applicant_label:subjects.find(s=>s.id===p.applicant_subject_id)?.label||null,type_label:t.label,unit_points:t.points,total_points:calculatePoints(t.points,p.quantity),origin:'manual',status:'recorded',void_reason:null,version:1,created_at:'2026-11-26T02:00:00Z',updated_at:'2026-11-26T02:00:00Z'};
   records.unshift(data);audit('create',null,data);
 }else if(name==='rd_update_record'||name==='rd_void_record'){
   const i=records.findIndex(r=>r.id===args.p_id),before=records[i];
   if(before.version!==args.p_expected_version)return {data:null,error:{code:'40001'}};
   data=name==='rd_void_record'?{...before,status:'voided',void_reason:args.p_reason,version:before.version+1}:{...before,...args.p_patch,version:before.version+1};
   if(name==='rd_update_record'&&((args.p_patch.type_code&&args.p_patch.type_code!==before.type_code)||(args.p_patch.quantity&&args.p_patch.quantity!==before.quantity))){const t=types.find(t=>t.code===data.type_code);Object.assign(data,{type_label:t.label,unit_points:t.points,total_points:calculatePoints(t.points,data.quantity)});}
   records[i]=data;audit(name==='rd_void_record'?'void':'update',before,data);
 }else throw Error(`Unexpected fixture RPC ${name}`);
 return {data:structuredClone(data),error:null};
}
function audit(action,before,after){audits.unshift({id:uuid(3000+audits.length),entity_kind:'record',entity_id:after.id,action,actor_id:uuid(9000),at:'2026-11-26T02:00:00Z',before,after,reason:after.void_reason});}
export const supabase={
 auth:{
  getSession:async()=>{const s=session();await new Promise(r=>setTimeout(r,mode==='initialRace'?350:10));return {data:{session:s},error:null};},
  onAuthStateChange:callback=>{listeners.add(callback);return {data:{subscription:{unsubscribe:()=>listeners.delete(callback)}}};},
  signOut:async()=>window.__rdFixture.switchSession('none')
 },
 rpc(name,args){
  const atStart=mode;
  const call={name,args:structuredClone(args),aborted:false};calls.push(call);
  return {abortSignal(signal){signal.addEventListener('abort',()=>call.aborted=true,{once:true});return new Promise(resolve=>{
   const delay=name==='rd_permission'&&atStart==='pending'?500:args.p_filter?.search==='slow'?350:delays[name]||15;
   // Deliberately resolves after abort: tests cancellation AND late-result suppression.
   setTimeout(()=>resolve(run(name,args,atStart)),delay);
  });}};
 }
};
window.__rdFixture={calls,failNext:(name,code)=>failures[name]=code,delay:(name,ms)=>delays[name]=ms,
 switchSession(next){mode=next;for(const callback of listeners)callback(next==='none'?'SIGNED_OUT':'SIGNED_IN',session());},
 getRecord:id=>structuredClone(records.find(r=>r.id===id)),records:()=>structuredClone(records)
};

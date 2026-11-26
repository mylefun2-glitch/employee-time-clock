import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

async function loadService() {
  const source=readFileSync(new URL('../services/rewardsDisciplineService.ts',import.meta.url),'utf8');
  const calls=[];
  globalThis.__rdClient={rpc(name,args){const call={name,args};calls.push(call);return {abortSignal(signal){call.signal=signal;return Promise.resolve(globalThis.__rdResponse??{data:true,error:null});}};}};
  const domain=new URL('../lib/rewardsDiscipline.mjs',import.meta.url).href;
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
    .replace(/import \{ supabase \} from ['"]\.\.\/lib\/supabase['"];?/, 'const supabase=globalThis.__rdClient;')
    .replace(/(['"])\.\.\/lib\/rewardsDiscipline.mjs\1/g,JSON.stringify(domain));
  const module=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64')+'#'+Math.random());
  return {module,calls};
}

test('UI route and nav use isolated capability, no employee/PIN/local-storage inference',()=>{
 const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
 const app=read('../App.tsx'),layout=read('../layouts/AdminLayout.tsx'),hook=read('../hooks/useRewardsDisciplinePermission.ts'),page=read('../pages/admin/EmployeeRewardsDisciplinePage.tsx');
 assert.match(app, /path="rewards-discipline" element=\{<EmployeeRewardsDisciplinePage/);
 assert.match(app, /RewardsDisciplinePermissionProvider><AdminLayout/);
 assert.match(layout, /rewardsPermission.status === 'allowed' && renderNavItem/);
 assert.match(page, /permission.status !== 'allowed'/);
 assert.match(page, /RewardsWorkspace key=\{permission.epoch\}/);
 for(const source of [hook,page]) assert.doesNotMatch(source,/localStorage|EmployeeContext|isSupervisor|is_manager|user_metadata|sessionStorage/);
 assert.match(hook,/controller.abort\(\)/);assert.match(hook,/authEvent !== initialEvent/);
});

test('UI service uses exact RPC envelopes and decimal strings',async()=>{
 const {module:{createRewardsDisciplineService},calls}=await loadService();
 const service=createRewardsDisciplineService();
 globalThis.__rdResponse={data:{items:[],total:0,page:2,page_size:20,summary:{recorded_count:0,voided_count:0,total_points:'-0.5'}},error:null};
 assert.equal((await service.list({page:2,search:'literal_%'})).summary.total_points,'-0.5');
 assert.deepEqual(calls[0].args,{p_filter:{page:2,page_size:20,search:'literal_%'}});
 await service.employeePicker('test',3);
 assert.deepEqual(calls[1].args,{p_search:'test',p_page:3,p_page_size:20});
 await service.createSubject({id:'employee',name:'Canonical',department:null});
 assert.deepEqual(calls[2].args,{p_label:'Canonical',p_employee_id:'employee'});
});

test('UI service rejects client score/actor/status and sends version for edit/void',async()=>{
 const {module:{createRewardsDisciplineService},calls}=await loadService();
 const service=createRewardsDisciplineService();
 const input={subject_id:'00000000-0000-4000-8000-000000000001',application_date:'2026-01-02',type_code:'warning',quantity:3,reason:'  multiline\n保留  '};
 globalThis.__rdResponse={data:{id:'record'},error:null};
 await service.create(input);
 assert.equal(calls[0].args.p_input.reason,input.reason);
 assert.equal('total_points' in calls[0].args.p_input,false);
 await assert.rejects(service.create({...input,status:'recorded'}));
 await assert.rejects(service.update('r',2,{actor_id:'forged'}));
 await service.update('r',2,{reason:'changed'});
 assert.deepEqual(calls[1].args,{p_id:'r',p_expected_version:2,p_patch:{reason:'changed'}});
 await service.void('r',3,'有實質錯誤');
 assert.deepEqual(calls[2].args,{p_id:'r',p_expected_version:3,p_reason:'有實質錯誤'});
});

test('list/history filter validation fails before RPC and permits corrected filters',async()=>{
 const {module:{createRewardsDisciplineService,rewardsErrorMessage},calls}=await loadService();
 const service=createRewardsDisciplineService();
 for(const filter of [{from_date:'2026-11-26',to_date:'2026-11-25'},{year:10000}]){
   for(const load of [()=>service.list(filter),()=>service.history('subject',filter)]){
     assert.throws(load,error=>error instanceof TypeError&&rewardsErrorMessage(error).includes('欄位格式不正確'));
   }
 }
 assert.equal(calls.length,0);
 globalThis.__rdResponse={data:{items:[],total:0,page:1,page_size:20,summary:{recorded_count:0,voided_count:0,total_points:'0'}},error:null};
 await service.list({year:2026});await service.history('subject',{from_date:'2026-11-26',to_date:'2026-11-26'});
 assert.equal(calls.length,2);
});

test('UI service fails visibly on forbidden/stale/null and aborts before RPC',async()=>{
 const {module:{createRewardsDisciplineService,rewardsErrorMessage},calls}=await loadService();
 const service=createRewardsDisciplineService();
 for(const [code,phrase] of [['42501','禁止'],['40001','重新讀取']]){
   globalThis.__rdResponse={data:null,error:{code,message:'private detail'}};
   await assert.rejects(service.list({}),e=>rewardsErrorMessage(e).includes(phrase));
 }
 globalThis.__rdResponse={data:null,error:null};
 await assert.rejects(service.list({}));
 const controller=new AbortController();controller.abort();
 await assert.rejects(createRewardsDisciplineService(controller.signal).list({}),{name:'AbortError'});
 assert.equal(calls.length,3);
});

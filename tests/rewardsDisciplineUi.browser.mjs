// Run explicitly: REWARDS_UI_FIXTURE_ROOT=<private scratch with tailwind.js/icons.css/icons.ttf>
// node --test tests/rewardsDisciplineUi.browser.mjs
// Requires externally installed Playwright Chromium/WebKit, no production network or data.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium,webkit,expect} from '@playwright/test';
import {fileURLToPath} from 'node:url';
import {join,resolve} from 'node:path';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const repo=fileURLToPath(new URL('../',import.meta.url));
const root=process.env.REWARDS_UI_FIXTURE_ROOT;
assert.ok(root&&!resolve(root).startsWith(repo),'Set an external private scratch fixture root');
for(const asset of ['tailwind.js','icons.css','icons.ttf']) assert.ok(readFileSync(join(root,asset)).length>100);
const artifacts=join(root,'artifacts');mkdirSync(artifacts,{recursive:true});
writeFileSync(join(root,'index.html'),`<!doctype html><html lang="zh-Hant"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script src="/tailwind.js"></script><link rel="stylesheet" href="/icons.css"><style>body{margin:0;font-family:Inter,'Noto Sans TC',sans-serif}#fixture-label{padding:4px;background:#fef3c7;font-size:12px}</style></head><body><div id="fixture-label">SYNTHETIC FIXTURE — 模擬資料，非正式環境</div><div id="root"></div><script type="module" src="/@fs${join(repo,'tests/fixtures/rewardsDisciplineBrowser.tsx')}"></script></body></html>`);
const server=await createServer({root,configFile:false,optimizeDeps:{include:['react','react-dom/client','react/jsx-runtime','react/jsx-dev-runtime','react-router-dom']},server:{host:'127.0.0.1',port:0,fs:{allow:[repo,root]}},resolve:{dedupe:['react','react-dom'],alias:{'react':join(repo,'node_modules/react'),'react-dom':join(repo,'node_modules/react-dom'),'react-router-dom':join(repo,'node_modules/react-router-dom')}},plugins:[{name:'synthetic-client-only',enforce:'pre',resolveId(source){if(source.endsWith('/lib/supabase'))return join(repo,'tests/fixtures/rewardsDisciplineMock.mjs');}}]});
await server.listen();
const url=server.resolvedUrls.local[0];
const report={fixture:true,engines:{},errors:[],networkBlocked:[]};
async function api(page,method,...args){return page.evaluate(({method,args})=>window.__rdFixture[method](...args),{method,args});}
async function calls(page,name){return page.evaluate(name=>window.__rdFixture.calls.filter(c=>!name||c.name===name),name);}
async function loaded(page){await expect(page.locator('.rd-records')).toBeVisible();await expect(page.getByRole('button',{name:'新增獎懲',exact:true})).toBeEnabled();}
async function noOverflow(page){
 const bad=await page.evaluate(()=>{
  const bad=[];if(document.documentElement.scrollWidth>innerWidth+1)bad.push('document');
  for(const e of document.querySelectorAll('.rd-records,.rd-dialog,.rd-picker,.rd-row,.rd-form-grid,.rd-filters'))if(e.getClientRects().length&&e.scrollWidth>e.clientWidth+1)bad.push(`${e.className}:${e.scrollWidth}/${e.clientWidth}`);
  for(const e of document.querySelectorAll('.rd input,.rd select,.rd textarea'))if(e.getClientRects().length&&parseFloat(getComputedStyle(e).fontSize)<16)bad.push('small-input');return bad;
 });assert.deepEqual(bad,[]);
}
try {
 for(const [engine,browserType] of Object.entries({chromium,webkit})) {
  await test(`${engine}: real renderer synthetic acceptance`,async t=>{
   const browser=await browserType.launch({headless:true});
   const context=await browser.newContext({viewport:{width:1440,height:1000}});
   await context.route('**/*',route=>new URL(route.request().url()).origin===new URL(url).origin?route.continue():(report.networkBlocked.push(route.request().url()),route.abort()));
   const page=await context.newPage();page.setDefaultTimeout(8000);page.on('pageerror',e=>report.errors.push(`${engine}:${e.message}`));
   const results=[];
   const check=async(name,fn)=>{await t.test(name,async()=>{await fn();results.push(name);});};
   try {
    for(const mode of ['denied','error','pending','none'])await check(`${mode}: no business reads, no nav, direct route closed`,async()=>{
     await page.goto(`${url}?permission=${mode}`);
     await page.waitForFunction(()=>!!window.__rdFixture);
     if(mode==='pending')await expect(page.getByText('確認獎懲管理權限中…')).toBeVisible();
     else if(mode==='none')await expect(page.getByText('模擬登入頁（未登入）')).toBeVisible();
     else await expect(page.getByRole('alert')).toBeVisible();
     assert.equal((await calls(page)).filter(c=>c.name!=='rd_permission').length,0);
     assert.equal(await page.locator('a[href="/admin/rewards-discipline"]').count(),0);
     if(mode==='pending'){await api(page,'switchSession','denied');await page.waitForTimeout(600);assert.equal((await calls(page)).filter(c=>c.name!=='rd_permission').length,0);await expect(page.getByRole('alert')).toContainText('禁止');}
    });
    await check('late initial getSession cannot restore a switched session',async()=>{
      await page.goto(`${url}?permission=initialRace`);await page.waitForFunction(()=>!!window.__rdFixture);await api(page,'switchSession','denied');await page.waitForTimeout(450);assert.equal((await calls(page)).filter(c=>c.name!=='rd_permission').length,0);await expect(page.locator('a[href="/admin/rewards-discipline"]')).toHaveCount(0);
    });
    await check('allow true fetches server page and full-filter summary',async()=>{
     await page.goto(url);await loaded(page);await expect(page.locator('a[href="/admin/rewards-discipline"]')).toBeVisible();await expect(page.locator('.rd-row')).toHaveCount(20);await expect(page.locator('.rd-summary').first()).toContainText('登錄 44 件');
     assert.deepEqual((await calls(page,'rd_list_records'))[0].args,{p_filter:{page:1,page_size:20}});
    });
    for (const target of ['list','history']) for (const invalid of ['range','year']) await check(`${target}: invalid ${invalid} preserves inputs, shows alert and recovers without pageerror`,async()=>{
     const regression=await context.newPage(),errors=[];regression.setDefaultTimeout(8000);regression.on('pageerror',e=>{errors.push(e.message);report.errors.push(`${engine}-${target}-${invalid}:${e.message}`);});
     try {
      await regression.goto(url);await loaded(regression);
      let scope=regression.locator('section[aria-label="員工獎懲管理"]');
      if(target==='history'){
       await regression.locator('.rd-row').first().getByRole('button',{name:/查看/}).click();await regression.getByRole('dialog').getByRole('button',{name:'個人歷史／期間小計',exact:true}).click();scope=regression.getByRole('region',{name:'個人歷史'});
      }else if(invalid==='range') await regression.getByText('申請日期區間／每頁筆數',{exact:true}).click();
      await expect(scope.locator('.rd-summary').first()).toBeVisible();
      const year=scope.getByLabel(target==='list'?'申請年度':'歷史年度',{exact:true});
      const from=scope.getByLabel(target==='list'?'申請起日':'歷史起日',{exact:true});
      const to=scope.getByLabel(target==='list'?'申請迄日':'歷史迄日',{exact:true});
      const rpcName=target==='list'?'rd_list_records':'rd_subject_history';
      if(invalid==='range'){await from.fill('2026-11-26');await expect(scope.locator('.rd-summary').first()).toBeVisible();}
      const before=(await calls(regression,rpcName)).length;
      if(invalid==='range')await to.fill('2026-11-25');else await year.fill('10000');
      await expect(scope.getByRole('alert')).toContainText('欄位格式不正確');
      assert.ok(await regression.locator('#root').evaluate(root=>root.childElementCount>0));
      assert.deepEqual(errors,[]);
      assert.equal((await calls(regression,rpcName)).length,before,'invalid filter must not reach RPC');
      await expect(scope.locator('.rd-summary')).toHaveCount(0);
      if(invalid==='range'){
       await expect(from).toHaveValue('2026-11-26');await expect(to).toHaveValue('2026-11-25');await to.fill('2026-11-26');
      }else{await expect(year).toHaveValue('10000');await year.fill('2026');}
      await expect(scope.locator('.rd-summary').first()).toBeVisible();await expect(scope.getByRole('alert')).toHaveCount(0);
      assert.ok((await calls(regression,rpcName)).length>before,'corrected filter resumes RPC');
      if(invalid==='range'){await expect(from).toHaveValue('2026-11-26');await expect(to).toHaveValue('2026-11-26');}else await expect(year).toHaveValue('2026');
      assert.deepEqual(errors,[]);
     } finally {writeFileSync(join(artifacts,`${engine}-${target}-invalid-${invalid}.json`),JSON.stringify({fixture:true,pageErrors:errors}));await regression.close();}
    });
    await check('server pagination, later page null date, search/year/type/status reset',async()=>{
     await page.getByRole('button',{name:'下一頁',exact:true}).click();await expect(page.locator('.rd-pagination')).toContainText('第 2 頁');await page.getByRole('button',{name:'下一頁',exact:true}).click();await expect(page.locator('.rd-row')).toHaveCount(5);await expect(page.locator('.rd-records')).toContainText('未填');
     await page.getByLabel('申請年度',{exact:true}).fill('2025');await expect(page.getByText('沒有符合條件的獎懲記錄。')).toBeVisible();assert.equal((await calls(page,'rd_list_records')).at(-1).args.p_filter.page,1);
     await page.getByLabel('申請年度',{exact:true}).fill('');await loaded(page);
     await page.getByLabel('種類',{exact:true}).selectOption('warning');await expect(page.getByText('沒有符合條件的獎懲記錄。')).toBeVisible();await page.getByLabel('種類',{exact:true}).selectOption('');await loaded(page);
     await page.getByLabel('狀態',{exact:true}).selectOption('voided');await expect(page.locator('.rd-row')).toHaveCount(1);await expect(page.locator('.rd-summary').first()).toContainText('積分小計 0');await page.getByLabel('狀態',{exact:true}).selectOption('');await loaded(page);
    });
    await check('period and page size use complete server filters and summaries',async()=>{
     await page.getByText('申請日期區間／每頁筆數',{exact:true}).click();await page.getByLabel('申請起日',{exact:true}).fill('2026-11-25');await page.getByLabel('申請迄日',{exact:true}).fill('2026-11-26');await page.getByLabel('每頁筆數',{exact:true}).selectOption('50');await loaded(page);await expect(page.locator('.rd-filter-summary')).toContainText('2026-11-25～2026-11-26');const filter=(await calls(page,'rd_list_records')).at(-1).args.p_filter;assert.deepEqual(filter,{page:1,page_size:50,from_date:'2026-11-25',to_date:'2026-11-26'});await page.getByLabel('申請起日',{exact:true}).fill('');await page.getByLabel('申請迄日',{exact:true}).fill('');await page.getByLabel('每頁筆數',{exact:true}).selectOption('20');await loaded(page);await page.getByText('申請日期區間／每頁筆數',{exact:true}).click();
    });
    await check('search cancels and ignores deliberately late result',async()=>{
     await page.getByLabel('姓名／事由搜尋').fill('slow');await page.waitForTimeout(40);await page.getByLabel('姓名／事由搜尋').fill('模擬事由45');await expect(page.locator('.rd-row')).toHaveCount(1);await page.waitForTimeout(400);await expect(page.locator('.rd-records')).toContainText('模擬事由45');assert.ok((await calls(page,'rd_list_records')).some(c=>c.args.p_filter.search==='slow'&&c.aborted));await page.getByLabel('姓名／事由搜尋').fill('');await loaded(page);
    });
    await check('later page failure is an error, not zero or stale data',async()=>{
     await api(page,'failNext','rd_list_records','42501');await page.getByRole('button',{name:'下一頁',exact:true}).click();await expect(page.getByRole('alert')).toContainText('禁止');assert.equal(await page.locator('.rd-row').count(),0);assert.equal(await page.locator('.rd-summary').count(),0);await page.getByRole('button',{name:'重新讀取清單'}).click();await loaded(page);await expect(page.locator('.rd-pagination')).toContainText('第 2 頁');await page.getByRole('button',{name:'上一頁',exact:true}).click();await loaded(page);
    });
    await check('picker error is not empty; search and optional applicant reach later subjects',async()=>{
     await api(page,'failNext','rd_subject_picker','42501');await page.getByRole('button',{name:'新增獎懲',exact:true}).click();const dialog=page.getByRole('dialog'),subject=dialog.getByRole('group',{name:'被獎懲人',exact:true});await expect(subject.getByRole('alert')).toContainText('禁止');assert.equal(await subject.getByText('沒有符合的人物。請調整搜尋或改找現職員工。').count(),0);await subject.getByRole('button',{name:'重試選人'}).click();await subject.getByLabel('搜尋被獎懲人').fill('模擬人物45');await subject.getByRole('button',{name:'模擬人物45',exact:true}).click();const applicant=dialog.getByRole('group',{name:'申請人（選填）',exact:true});await applicant.getByRole('button',{name:'選擇申請人（選填）',exact:true}).click();await applicant.getByRole('button',{name:'下一頁',exact:true}).click();await applicant.getByRole('button',{name:'模擬人物35',exact:true}).click();await expect(applicant).toContainText('模擬人物35');await dialog.getByRole('button',{name:'關閉對話框'}).click();
    });
    await check('create selects a subject beyond page 1 and retains failed input',async()=>{
     await page.getByRole('button',{name:'新增獎懲',exact:true}).click();const dialog=page.getByRole('dialog'),subject=dialog.getByRole('group',{name:'被獎懲人',exact:true});await expect(subject.getByRole('button',{name:'模擬人物1',exact:true})).toBeVisible();await subject.getByRole('button',{name:'下一頁',exact:true}).click();await subject.getByRole('button',{name:'模擬人物25',exact:true}).click();await expect(subject).toContainText('模擬人物25');
     await dialog.getByLabel('申請日期',{exact:true}).fill('2026-11-26');await dialog.getByLabel('獎懲種類',{exact:true}).selectOption('warning');await dialog.getByLabel('次數',{exact:true}).fill('3');await dialog.getByLabel('事由',{exact:true}).fill('browser 新建事由\n保留完整輸入');await dialog.getByLabel('依據（選填）').fill('browser 依據');await expect(dialog).toContainText('積分預覽：-1.5');
     assert.equal(await dialog.getByLabel('獎懲種類',{exact:true}).locator('option[value="retired"]').count(),0);
     await api(page,'failNext','rd_create_record','FIXTURE');await dialog.getByRole('button',{name:'儲存記錄',exact:true}).click();await expect(dialog.getByRole('alert')).toBeVisible();await expect(dialog.getByLabel('事由',{exact:true})).toHaveValue('browser 新建事由\n保留完整輸入');await dialog.getByRole('button',{name:'儲存記錄',exact:true}).click();await expect(dialog).toHaveCount(0);await loaded(page);
     const payload=(await calls(page,'rd_create_record')).at(-1).args.p_input;assert.equal(payload.applicant_subject_id,null);for(const k of ['actor','status','source','total_points','unit_points'])assert.equal(k in payload,false);
     assert.equal((await api(page,'records')).find(r=>r.reason.startsWith('browser 新建')).total_points,'-1.5');
    });
    await check('employee picker server page canonical subject, cancel does not create record',async()=>{
     const before=(await calls(page,'rd_create_record')).length;await page.getByRole('button',{name:'新增獎懲',exact:true}).click();const dialog=page.getByRole('dialog'),subject=dialog.getByRole('group',{name:'被獎懲人',exact:true});await subject.getByRole('button',{name:'找現職員工',exact:true}).click();await subject.getByRole('button',{name:'下一頁',exact:true}).click();await subject.getByRole('button',{name:'模擬現職25・模擬單位（選用並建立人物）',exact:true}).click();await expect(subject).toContainText('模擬現職25');const payload=(await calls(page,'rd_create_subject')).at(-1).args;assert.equal(payload.p_label,'模擬現職25');assert.ok(payload.p_employee_id);await dialog.getByRole('button',{name:'關閉對話框'}).click();assert.equal((await calls(page,'rd_create_record')).length,before);
    });
    await check('create/edit local validation is caught, retains input and does not send mutation RPC',async()=>{
     for(const mode of ['create','edit']){
      const rpcName=mode==='create'?'rd_create_record':'rd_update_record',before=(await calls(page,rpcName)).length;
      if(mode==='create')await page.getByRole('button',{name:'新增獎懲',exact:true}).click();else await page.locator('.rd-row').filter({has:page.getByText('模擬事由2',{exact:true})}).getByRole('button',{name:/編輯/}).click();
      const dialog=page.getByRole('dialog');
      if(mode==='create'){
       await dialog.getByRole('group',{name:'被獎懲人',exact:true}).getByRole('button',{name:'模擬人物1',exact:true}).click();await dialog.getByLabel('申請日期',{exact:true}).fill('2026-11-26');await dialog.getByLabel('獎懲種類',{exact:true}).selectOption('warning');await dialog.getByLabel('次數',{exact:true}).fill('3');
      }
      await dialog.getByLabel('事由',{exact:true}).fill('   ');await dialog.getByRole('button',{name:'儲存記錄',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('欄位格式不正確');await expect(dialog.getByLabel('事由',{exact:true})).toHaveValue('   ');assert.equal((await calls(page,rpcName)).length,before);await dialog.getByRole('button',{name:'關閉對話框'}).click();
     }
    });
    await check('historical edit stale protection, explicit reload, text keeps original score',async()=>{
     const row=page.locator('.rd-row').filter({has:page.getByText('模擬事由2',{exact:true})});await row.getByRole('button',{name:/編輯/}).click();const dialog=page.getByRole('dialog');await expect(dialog.getByLabel('事由',{exact:true})).toHaveValue('模擬事由2');await expect(dialog).toContainText('原記錄積分：3');await dialog.getByLabel('事由',{exact:true}).fill('歷史改文字不重算');await api(page,'failNext','rd_update_record','40001');await dialog.getByRole('button',{name:'儲存記錄',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('重新讀取');await expect(dialog.getByLabel('事由',{exact:true})).toHaveValue('歷史改文字不重算');await dialog.getByText('重新讀取選項',{exact:true}).click();await dialog.getByRole('button',{name:'確認捨棄輸入並重新讀取'}).click();await expect(dialog.getByLabel('事由',{exact:true})).toHaveValue('模擬事由2');await dialog.getByLabel('事由',{exact:true}).fill('歷史改文字不重算');await dialog.getByRole('button',{name:'儲存記錄',exact:true}).click();await expect(dialog).toHaveCount(0);const call=(await calls(page,'rd_update_record')).at(-1);assert.deepEqual(call.args.p_patch,{reason:'歷史改文字不重算'});assert.equal((await api(page,'getRecord',call.args.p_id)).total_points,'3');
    });
    await check('quantity change previews and reprices, audit and history use server totals',async()=>{
     await loaded(page);const row=page.locator('.rd-row').filter({has:page.getByText('歷史改文字不重算',{exact:true})});await row.getByRole('button',{name:/編輯/}).click();let dialog=page.getByRole('dialog');await dialog.getByLabel('次數',{exact:true}).fill('2');await expect(dialog).toContainText('積分預覽：1');await dialog.getByRole('button',{name:'儲存記錄',exact:true}).click();await expect(dialog).toHaveCount(0);await loaded(page);await row.getByRole('button',{name:/查看/}).click();dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'個人歷史／期間小計',exact:true}).click();await expect(dialog.getByRole('region',{name:'個人歷史'}).locator('.rd-summary')).toContainText('非本頁小計');await dialog.getByRole('button',{name:'操作稽核',exact:true}).click();await expect(dialog.getByRole('region',{name:'操作稽核'})).toContainText('編輯');await dialog.getByRole('button',{name:'關閉對話框'}).click();
    });
    await check('void requires substantive reason and confirmation, failure retains reason',async()=>{
     const row=page.locator('.rd-row').filter({has:page.getByText('歷史改文字不重算',{exact:true})});await row.getByRole('button',{name:/查看/}).click();const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'作廢記錄',exact:true}).click();await expect(dialog.getByRole('button',{name:'確認作廢',exact:true})).toBeDisabled();await dialog.getByLabel('實質作廢原因').fill('   ');await dialog.getByRole('checkbox').check();await expect(dialog.getByRole('button',{name:'確認作廢',exact:true})).toBeDisabled();await dialog.getByLabel('實質作廢原因').fill('重複記錄，已核對原始依據');await dialog.getByRole('checkbox').check();await api(page,'failNext','rd_void_record','42501');await dialog.getByRole('button',{name:'確認作廢',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('禁止');await expect(dialog.getByLabel('實質作廢原因')).toHaveValue('重複記錄，已核對原始依據');await dialog.getByRole('button',{name:'確認作廢',exact:true}).click();await expect(dialog).toHaveCount(0);await loaded(page);await expect(row).toContainText('已作廢');assert.equal(await row.getByRole('button',{name:/編輯/}).count(),0);
    });
    await check('closing a loading detail aborts and ignores its late response',async()=>{
     await api(page,'delay','rd_get_record',250);await page.locator('.rd-row').first().getByRole('button',{name:/查看/}).click();await expect(page.getByRole('dialog').getByRole('status')).toBeVisible();await page.keyboard.press('Escape');await page.waitForTimeout(300);await expect(page.getByRole('dialog')).toHaveCount(0);assert.ok((await calls(page,'rd_get_record')).at(-1).aborted);await api(page,'delay','rd_get_record',0);
    });
    await check('permission switch cancels pending business request and removes stale modal/nav',async()=>{
     await api(page,'delay','rd_list_records',350);await page.getByLabel('姓名／事由搜尋').fill('模擬');await page.waitForTimeout(30);await api(page,'switchSession','denied');await expect(page.getByRole('alert')).toContainText('禁止');await expect(page.locator('.rd-row')).toHaveCount(0);await expect(page.locator('a[href="/admin/rewards-discipline"]')).toHaveCount(0);await page.waitForTimeout(400);await expect(page.locator('.rd-row')).toHaveCount(0);assert.ok((await calls(page,'rd_list_records')).at(-1).aborted);
    });
    await check('permission switch while form is open clears all inputs and rechecks new session',async()=>{
     await api(page,'delay','rd_list_records',0);await api(page,'switchSession','allowed');await loaded(page);await page.getByRole('button',{name:'新增獎懲',exact:true}).click();await page.getByRole('dialog').getByLabel('事由',{exact:true}).fill('不可跨帳號保留');await api(page,'switchSession','denied');await expect(page.getByRole('dialog')).toHaveCount(0);await api(page,'switchSession','allowed');await loaded(page);await page.getByRole('button',{name:'新增獎懲',exact:true}).click();await expect(page.getByRole('dialog').getByLabel('事由',{exact:true})).toHaveValue('');await page.keyboard.press('Escape');
    });
    for(const width of [320,390,1440])await check(`${width}px populated list/long text/form: no horizontal overflow, >=16px inputs, native focus trap`,async()=>{
     await page.setViewportSize({width,height:1000});await page.waitForTimeout(350);await loaded(page);await noOverflow(page);await page.screenshot({path:join(artifacts,`${engine}-${width}-list.png`),fullPage:true});
     const row=page.locator('.rd-row').filter({hasText:'完整長文事由'});await row.getByRole('button',{name:/查看/}).click();let dialog=page.getByRole('dialog');await expect(dialog).toContainText('<img src=x onerror=alert(1)>');assert.equal(await dialog.locator('img').count(),0);await noOverflow(page);await page.screenshot({path:join(artifacts,`${engine}-${width}-detail.png`),fullPage:true});await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(row.getByRole('button',{name:/查看/})).toBeFocused();
     await page.getByRole('button',{name:'新增獎懲',exact:true}).click();dialog=page.getByRole('dialog');await expect(dialog.getByRole('button',{name:'模擬人物1',exact:true})).toBeVisible();await noOverflow(page);
     const focus=[];for(const direction of ['Tab','Shift+Tab'])for(let i=0;i<60;i++){await page.keyboard.press(direction);focus.push(await page.evaluate(()=>({inside:!!document.activeElement?.closest('[role="dialog"]'),name:document.activeElement?.getAttribute('aria-label')||document.activeElement?.textContent?.slice(0,50)})));}assert.ok(focus.every(f=>f.inside));assert.ok(new Set(focus.map(f=>f.name)).size>5);writeFileSync(join(artifacts,`${engine}-${width}-focus.json`),JSON.stringify(focus));
     await page.screenshot({path:join(artifacts,`${engine}-${width}-form.png`),fullPage:true});await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'新增獎懲',exact:true})).toBeFocused();
    });
    await check('mobile touch context renders actual list/form without sideways dragging',async()=>{
     const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});await mobile.route('**/*',route=>new URL(route.request().url()).origin===new URL(url).origin?route.continue():route.abort());const phone=await mobile.newPage();phone.on('pageerror',e=>report.errors.push(`${engine}-touch:${e.message}`));try{await phone.goto(url);await loaded(phone);await phone.waitForTimeout(350);await noOverflow(phone);await phone.screenshot({path:join(artifacts,`${engine}-touch-list.png`)});await phone.getByRole('button',{name:'新增獎懲',exact:true}).tap();await expect(phone.getByRole('dialog').getByRole('button',{name:'模擬人物1',exact:true})).toBeVisible();await noOverflow(phone);await phone.screenshot({path:join(artifacts,`${engine}-touch-form.png`)});await phone.getByRole('button',{name:'關閉對話框'}).tap();await expect(phone.getByRole('dialog')).toHaveCount(0);}finally{await mobile.close();}
    });
    await check('unmount aborts requests without late page resurrection',async()=>{
     await api(page,'delay','rd_list_records',350);await page.getByLabel('姓名／事由搜尋').fill('unmount');await page.waitForTimeout(40);await page.getByRole('link',{name:'儀表板',exact:true}).click();await expect(page.getByText('模擬其他頁')).toBeVisible();await page.waitForTimeout(400);assert.equal(await page.locator('.rd-row').count(),0);assert.ok((await calls(page,'rd_list_records')).at(-1).aborted);
    });
   }finally{report.engines[engine]={passed:results.length,cases:results};await browser.close();}
  });
 }
 await test('all browser contexts have no uncaught page errors',()=>assert.deepEqual(report.errors,[]));
} finally {writeFileSync(join(artifacts,'results.json'),JSON.stringify(report,null,2));await server.close();}

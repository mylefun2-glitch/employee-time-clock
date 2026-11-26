import React, { useMemo, useState } from 'react';
import { useRewardsDisciplinePermission } from '../../hooks/useRewardsDisciplinePermission';
import { createRewardsDisciplineService, type RewardsDisciplineService } from '../../services/rewardsDisciplineService';
import type { RewardRecordFilter, RewardRecord } from '../../types/rewardsDiscipline';
import { ErrorNotice, rewardDate, RewardsDialog, RewardsPagination, RewardsSummary, useRewardsQuery } from '../../components/rewardsDiscipline/RewardsShared';
import RewardsRecordForm from '../../components/rewardsDiscipline/RewardsRecordForm';
import RewardsRecordDialog from '../../components/rewardsDiscipline/RewardsRecordDialog';
import '../../components/rewardsDiscipline/rewardsDiscipline.css';

export default function EmployeeRewardsDisciplinePage() {
  const permission = useRewardsDisciplinePermission();
  const service = useMemo(()=>createRewardsDisciplineService(permission.signal),[permission.epoch,permission.signal]);
  if (permission.status === 'unknown') return <section className="rd" aria-label="員工獎懲管理"><p role="status">確認獎懲管理權限中…</p></section>;
  if (permission.status !== 'allowed') return <section className="rd"><h1>員工獎懲管理</h1><p role="alert">{permission.status==='error'?'無法確認獎懲管理權限，已停止讀取。請重新登入或稍後重新整理。':'禁止存取：此帳號沒有員工獎懲管理權限。'}</p></section>;
  return <RewardsWorkspace key={permission.epoch} service={service}/>;
}
function RewardsWorkspace({service}:{service:RewardsDisciplineService}) {
  const [filter,setFilter] = useState<RewardRecordFilter>({page:1,page_size:20}), [revision,setRevision]=useState(0), [typesRevision,setTypesRevision]=useState(0);
  const [modal,setModal]=useState<{id:string;mode:'detail'|'edit'|'void'}|null>(null),[creating,setCreating]=useState(false),[message,setMessage]=useState('');
  const query = useRewardsQuery(JSON.stringify([filter,revision]),signal=>service.list(filter,signal));
  const types = useRewardsQuery(`types:${typesRevision}`,signal=>service.types(signal));
  const change = (patch:RewardRecordFilter) => {setFilter(f=>({...f,...patch,page:1}));setMessage('');};
  const cleanChange = (key:keyof RewardRecordFilter,value:string|number|undefined) => setFilter(f=>{
    const next={...f,page:1}; if(value===''||value===undefined)delete next[key];else Object.assign(next,{[key]:value});return next;
  });
  const saved = (_record:RewardRecord) => {setModal(null);setCreating(false);setRevision(v=>v+1);setMessage('記錄已儲存；清單與完整篩選小計重新讀取中。');};
  const selectedType=types.data?.find(t=>t.code===filter.type_code)?.label || filter.type_code || '全部種類';
  return <section className="rd" aria-label="員工獎懲管理">
    <header className="rd-toolbar"><div><h1 tabIndex={-1} data-rd-focus-anchor>員工獎懲管理</h1><p className="rd-muted">獨立登錄・不連動薪資或差勤</p></div><button className="rd-primary" disabled={!types.data||!!types.error} onClick={event=>{event.currentTarget.focus();setCreating(true);}}>新增獎懲</button></header>
    <div className="rd-filters">
      <label className="rd-field rd-search">姓名／事由搜尋<input type="search" maxLength={200} placeholder="搜尋姓名、種類或事由" value={filter.search||''} onChange={e=>cleanChange('search',e.target.value)}/></label>
      <label className="rd-field">申請年度<input type="number" min="1" max="9999" placeholder="全部" value={filter.year||''} onChange={e=>cleanChange('year',e.target.value?Number(e.target.value):undefined)}/></label>
      <label className="rd-field">種類<select aria-label="種類" value={filter.type_code||''} onChange={e=>cleanChange('type_code',e.target.value)}><option value="">全部種類</option>{types.data?.map(t=><option key={t.code} value={t.code}>{t.label}{t.active?'':'（停用歷史）'}</option>)}</select></label>
      <label className="rd-field">狀態<select aria-label="狀態" value={filter.status||''} onChange={e=>cleanChange('status',e.target.value)}><option value="">全部狀態</option><option value="recorded">已登錄</option><option value="voided">已作廢</option></select></label>
    </div>
    <details className="rd-period"><summary>申請日期區間／每頁筆數</summary><div className="rd-filters"><label className="rd-field">申請起日<input type="date" value={filter.from_date||''} onChange={e=>cleanChange('from_date',e.target.value)}/></label><label className="rd-field">申請迄日<input type="date" value={filter.to_date||''} onChange={e=>cleanChange('to_date',e.target.value)}/></label><label className="rd-field">每頁筆數<select aria-label="每頁筆數" value={filter.page_size} onChange={e=>change({page_size:Number(e.target.value)})}>{[20,50,100].map(n=><option key={n} value={n}>{n}</option>)}</select></label></div></details>
    <p className="rd-filter-summary">目前條件：{filter.search?`搜尋「${filter.search}」`:'全部姓名／事由'}・{filter.year?`${filter.year}年`:'全部年度'}・{selectedType}・{filter.status==='recorded'?'已登錄':filter.status==='voided'?'已作廢':'全部狀態'}・{filter.from_date||'不限起日'}～{filter.to_date||'不限迄日'}。依申請日由新到舊，未填日期最後。</p>
    {Boolean(types.error)&&<><ErrorNotice error={types.error}/><button onClick={()=>setTypesRevision(v=>v+1)}>重試種類</button></>}
    {message&&<p role="status">{message}</p>}
    {query.loading?<p role="status">讀取獎懲記錄中…</p>:query.error?<><ErrorNotice error={query.error}/><button onClick={()=>setRevision(v=>v+1)}>重新讀取清單</button></>:query.data&&<>
      <RewardsSummary result={query.data}/>
      <div className="rd-records" aria-label="獎懲清單">{query.data.items.map(record=><article className={`rd-row ${record.status==='voided'?'rd-voided':''}`} key={record.id}>
        <button className="rd-row-main" onClick={event=>{event.currentTarget.focus();setModal({id:record.id,mode:'detail'});}} aria-label={`查看 ${record.subject_label} ${record.type_label} 詳情`}><strong className="rd-name">{record.subject_label}</strong><span className="rd-reason">{record.reason||'事由未填'}</span><span className="rd-kind">{record.type_label} × {record.quantity??'未填'}</span><span className="rd-points">{record.total_points} 分</span><span className="rd-row-meta">{rewardDate(record.application_date)}・{record.status==='voided'?'已作廢':'已登錄'}</span></button>
        {record.status==='recorded'&&<button className="rd-edit" disabled={!types.data} aria-label={`編輯 ${record.subject_label} 記錄`} onClick={event=>{event.currentTarget.focus();setModal({id:record.id,mode:'edit'});}}>編輯</button>}
      </article>)}</div>
      {query.data.total===0&&<p>沒有符合條件的獎懲記錄。</p>}
      {query.data.total>0&&query.data.items.length===0&&<p>此頁已無記錄，請回上一頁或調整篩選。</p>}
      <RewardsPagination result={query.data} page={filter.page||1} onPage={page=>setFilter(f=>({...f,page}))}/>
    </>}
    {creating&&types.data&&<RewardsDialog title="新增獎懲記錄" onClose={()=>setCreating(false)}><RewardsRecordForm types={types.data} service={service} onSaved={saved} onReload={()=>{}}/></RewardsDialog>}
    {modal&&<RewardsRecordDialog key={modal.id+modal.mode} id={modal.id} mode={modal.mode} service={service} types={types.data||[]} filter={filter} onClose={()=>setModal(null)} onSaved={saved}/>}
  </section>;
}

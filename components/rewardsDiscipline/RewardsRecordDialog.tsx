import React, { useEffect, useRef, useState } from 'react';
import type { RewardRecord, RewardRecordFilter, RewardType } from '../../types/rewardsDiscipline';
import type { RewardsDisciplineService } from '../../services/rewardsDisciplineService';
import { ErrorNotice, rewardDate, RewardsDialog, RewardsPagination, RewardsSummary, useRewardsQuery } from './RewardsShared';
import RewardsRecordForm from './RewardsRecordForm';

export function RewardsRecordText({ record }: { record: RewardRecord }) {
  return <dl className="rd-detail">
    <dt>被獎懲人</dt><dd>{record.subject_label}</dd><dt>申請日期</dt><dd>{rewardDate(record.application_date)}</dd>
    <dt>申請人</dt><dd>{record.applicant_label || '未填'}</dd><dt>種類／次數</dt><dd>{record.type_label}／{record.quantity ?? '未填'}</dd>
    <dt>積分</dt><dd>{record.total_points}（單次：{record.unit_points ?? '歷史無證據'}）</dd>
    <dt>狀態</dt><dd>{record.status === 'voided' ? '已作廢' : '已登錄'}</dd><dt>事由</dt><dd>{record.reason || '未填'}</dd><dt>依據</dt><dd>{record.basis || '未填'}</dd>
    <dt>備註</dt><dd>{record.notes || '未填'}</dd><dt>事件日期</dt><dd>{rewardDate(record.event_date)}</dd>
    <dt>來源</dt><dd>{record.origin === 'import' ? '歷史匯入' : '手動登錄'}</dd><dt>版本</dt><dd>{record.version}</dd>
    {record.status === 'voided' && <><dt>作廢原因</dt><dd>{record.void_reason}</dd></>}
  </dl>;
}
function History({ record, service, initialFilter }: { record: RewardRecord; service: RewardsDisciplineService; initialFilter: RewardRecordFilter }) {
  const [filter, setFilter] = useState<RewardRecordFilter>({year:initialFilter.year, from_date:initialFilter.from_date, to_date:initialFilter.to_date, page:1, page_size:20});
  const [retry, setRetry] = useState(0);
  const cleanFilter = Object.fromEntries(Object.entries(filter).filter(([,v]) => v !== undefined)) as RewardRecordFilter;
  const key = JSON.stringify([record.subject_id,cleanFilter,retry]);
  const query = useRewardsQuery(key, signal => service.history(record.subject_id, cleanFilter, signal));
  const dateChange = (key: 'from_date'|'to_date', value: string) => setFilter(f => ({ ...f, [key]: value || undefined, page:1 }));
  return <section aria-label="個人歷史"><h3>{record.subject_label}・個人歷史／期間小計</h3>
    <div className="rd-filters"><label className="rd-field">歷史年度<input type="number" min="1" max="9999" value={filter.year || ''} onChange={e => setFilter(f => ({...f,year:e.target.value ? Number(e.target.value) : undefined,page:1}))}/></label><label className="rd-field">歷史起日<input type="date" value={filter.from_date || ''} onChange={e => dateChange('from_date',e.target.value)}/></label><label className="rd-field">歷史迄日<input type="date" value={filter.to_date || ''} onChange={e => dateChange('to_date',e.target.value)}/></label></div>
    <p className="rd-muted">依申請日期；{filter.year ? `${filter.year} 年` : '全部年度'}・{filter.from_date || '不限起日'}～{filter.to_date || '不限迄日'}；全部種類與狀態，排除作廢積分。</p>
    {query.loading ? <p role="status">讀取歷史中…</p> : query.error ? <><ErrorNotice error={query.error}/><button onClick={() => setRetry(v=>v+1)}>重試歷史</button></> : query.data && <><RewardsSummary result={query.data}/>{query.data.items.map(item => <details className="rd-history-row" key={item.id}><summary>{rewardDate(item.application_date)}・{item.type_label}・{item.total_points} 分・{item.status === 'voided' ? '已作廢' : '已登錄'}</summary><RewardsRecordText record={item}/></details>)}{query.data.total === 0 && <p>此期間沒有記錄。</p>}<RewardsPagination result={query.data} page={filter.page || 1} onPage={page => setFilter(f=>({...f,page}))}/></>}
  </section>;
}
function Audit({ id, service }: { id: string; service: RewardsDisciplineService }) {
  const [page,setPage] = useState(1), [retry,setRetry] = useState(0);
  const query = useRewardsQuery(`${id}:${page}:${retry}`, signal => service.audit(id,page,signal));
  const actions = {create:'新增',update:'編輯',void:'作廢',import:'歷史匯入',link:'人物連結',type_update:'種類更新'};
  return <section aria-label="操作稽核"><h3>記錄操作稽核</h3>{query.loading ? <p role="status">讀取稽核中…</p> : query.error ? <><ErrorNotice error={query.error}/><button onClick={()=>setRetry(v=>v+1)}>重試稽核</button></> : query.data && <>{query.data.items.map(item => <details key={item.id} className="rd-history-row"><summary>{item.at}・{actions[item.action]}</summary><p>操作者 Auth UUID：{item.actor_id}</p>{item.reason && <p>原因：{item.reason}</p>}<h4>變更前</h4><pre>{item.before ? JSON.stringify(item.before,null,2) : '無'}</pre><h4>變更後</h4><pre>{JSON.stringify(item.after,null,2)}</pre></details>)}{query.data.total===0 && <p>沒有操作紀錄。</p>}<RewardsPagination result={query.data} page={page} onPage={setPage}/></>}</section>;
}
function VoidForm({ record, service, onSaved }: { record: RewardRecord; service: RewardsDisciplineService; onSaved: (record: RewardRecord)=>void }) {
  const [reason,setReason] = useState(''), [confirm,setConfirm] = useState(false), [busy,setBusy] = useState(false), [error,setError] = useState<unknown>();
  const request = useRef<AbortController | null>(null);
  useEffect(()=>()=>request.current?.abort(),[]);
  const submit = async (event:React.FormEvent) => {
    event.preventDefault(); if (!reason.trim() || !confirm || busy) return;
    const controller = new AbortController(); request.current=controller;setBusy(true);setError(undefined);
    try { const saved = await service.void(record.id,record.version,reason,controller.signal);if(!controller.signal.aborted)onSaved(saved); }
    catch(e){if(!controller.signal.aborted)setError(e);}
    finally{if(!controller.signal.aborted)setBusy(false);}
  };
  return <form className="rd-form" onSubmit={submit}><p>{record.subject_label}・{rewardDate(record.application_date)}・{record.type_label}・{record.total_points} 分</p><p className="rd-error">作廢不可復原；保留原記錄與稽核，並排除積分，不會物理刪除。</p><label className="rd-field">實質作廢原因<textarea aria-label="實質作廢原因" required maxLength={2000} rows={4} value={reason} disabled={busy} onChange={e=>{setReason(e.target.value);setConfirm(false);}}/></label><label className="rd-check"><input type="checkbox" checked={confirm} disabled={busy} onChange={e=>setConfirm(e.target.checked)}/>我已確認人物與記錄，了解作廢不可復原</label>{Boolean(error)&&<ErrorNotice error={error}/>}<button type="submit" className="rd-danger" disabled={busy||!confirm||!reason.trim()}>{busy?'作廢中…':'確認作廢'}</button></form>;
}
export default function RewardsRecordDialog({ id, mode: initialMode, service, types, filter, onClose, onSaved }: {
  id: string; mode: 'detail'|'edit'|'void'; service: RewardsDisciplineService; types: RewardType[]; filter: RewardRecordFilter; onClose:()=>void; onSaved:(record:RewardRecord)=>void;
}) {
  const [mode,setMode]=useState(initialMode),[retry,setRetry]=useState(0),[fresh,setFresh]=useState<RewardRecord>();
  const [showHistory,setShowHistory]=useState(false),[showAudit,setShowAudit]=useState(false);
  const query = useRewardsQuery(`${id}:${retry}`,signal=>service.get(id,signal));
  const record=fresh||query.data;
  return <RewardsDialog title={mode==='edit'?'編輯獎懲記錄':mode==='void'?'作廢獎懲記錄':'獎懲記錄詳情'} onClose={onClose}>
    {query.loading ? <p role="status">讀取記錄中…</p> : query.error ? <><ErrorNotice error={query.error}/><button onClick={()=>setRetry(v=>v+1)}>重新讀取</button></> : record && <>
      {mode==='edit' && record.status==='recorded' ? <RewardsRecordForm key={record.version} record={record} types={types} service={service} onSaved={onSaved} onReload={setFresh}/> : mode==='void' && record.status==='recorded' ? <VoidForm record={record} service={service} onSaved={onSaved}/> : <>
        <RewardsRecordText record={record}/><div className="rd-toolbar">{record.status==='recorded'&&<><button disabled={!types.length} onClick={()=>setMode('edit')}>編輯記錄</button><button className="rd-danger" onClick={()=>setMode('void')}>作廢記錄</button></>}<button aria-expanded={showHistory} onClick={()=>setShowHistory(v=>!v)}>個人歷史／期間小計</button><button aria-expanded={showAudit} onClick={()=>setShowAudit(v=>!v)}>操作稽核</button></div>
        {showHistory&&<History record={record} service={service} initialFilter={filter}/>}{showAudit&&<Audit id={record.id} service={service}/>}
      </>}
    </>}
  </RewardsDialog>;
}

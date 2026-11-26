import React, { useEffect, useRef, useState } from 'react';
import type { Page, RewardSubject, RewardEmployeeChoice } from '../../types/rewardsDiscipline';
import type { RewardsDisciplineService } from '../../services/rewardsDisciplineService';
import { ErrorNotice, RewardsPagination, useRewardsQuery } from './RewardsShared';

type Selection = Pick<RewardSubject, 'id' | 'label'>;
export default function RewardsSubjectPicker({ label, value, onChange, service, allowEmployee = false }: {
  label: string; value: Selection | null; onChange: (subject: Selection | null) => void; service: RewardsDisciplineService; allowEmployee?: boolean;
}) {
  const [open, setOpen] = useState(!value && allowEmployee), [search, setSearch] = useState(''), [page, setPage] = useState(1);
  const [mode, setMode] = useState<'subject'|'employee'>('subject'), [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false), [error, setError] = useState<unknown>();
  const mutation = useRef<AbortController | null>(null);
  useEffect(() => () => mutation.current?.abort(), []);
  const query = useRewardsQuery<Page<RewardSubject | RewardEmployeeChoice>>(`${open}:${mode}:${search}:${page}:${revision}`, signal =>
    !open ? Promise.resolve({ items: [], total: 0, page: 1, page_size: 20 }) : mode === 'subject' ? service.subjectPicker(search, page, signal) : service.employeePicker(search, page, signal));
  const choose = async (item: RewardSubject | RewardEmployeeChoice) => {
    if ('label' in item) { onChange(item); setOpen(false); return; }
    const controller = new AbortController(); mutation.current = controller; setBusy(true); setError(undefined);
    try {
      const subject = await service.createSubject(item, controller.signal);
      if (!controller.signal.aborted) { onChange(subject); setOpen(false); }
    } catch (e) { if (!controller.signal.aborted) setError(e); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  };
  return <fieldset className="rd-picker" disabled={busy}><legend>{label}</legend>
    <div className="rd-toolbar"><strong>{value?.label || '尚未選擇'}</strong>
      {!open && <button type="button" onClick={() => setOpen(true)}>{value ? '更換' : '選擇'}{label}</button>}
      {value && <button type="button" onClick={() => { onChange(null); setOpen(true); }}>清除{label}</button>}
    </div>
    {open && <>
      {allowEmployee && <div className="rd-toolbar"><button type="button" aria-pressed={mode === 'subject'} onClick={() => { setMode('subject'); setPage(1); }}>既有獎懲人物（含歷史離職）</button><button type="button" aria-pressed={mode === 'employee'} onClick={() => { setMode('employee'); setPage(1); }}>找現職員工</button></div>}
      <label className="rd-field">搜尋{label}<input maxLength={200} value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></label>
      {mode === 'employee' && <p className="rd-muted">選用現職員工會依員工主檔建立獎懲人物，不會修改員工資料或配對歷史人物。</p>}
      {query.loading ? <p role="status">搜尋中…</p> : query.error ? <><ErrorNotice error={query.error}/><button type="button" onClick={() => setRevision(v => v+1)}>重試選人</button></> : <>
        <div className="rd-choices">{query.data?.items.map(item => <button type="button" key={item.id} onClick={() => choose(item)}>{'label' in item ? item.label : `${item.name}・${item.department || '未填單位'}（選用並建立人物）`}</button>)}</div>
        {query.data?.total === 0 && <p>沒有符合的人物。請調整搜尋或改找現職員工。</p>}
        <RewardsPagination result={query.data} page={page} onPage={setPage} disabled={query.loading}/>
      </>}
    </>}
    {busy && <p role="status">建立人物中…</p>}{Boolean(error) && <ErrorNotice error={error}/>}
  </fieldset>;
}

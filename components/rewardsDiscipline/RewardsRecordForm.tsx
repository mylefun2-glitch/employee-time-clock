import React, { useEffect, useRef, useState } from 'react';
import type { RewardRecord, RewardType, CreateRewardRecord, UpdateRewardRecord, RewardSubject } from '../../types/rewardsDiscipline';
import { calculatePoints } from '../../lib/rewardsDiscipline.mjs';
import { RewardsRpcError, type RewardsDisciplineService } from '../../services/rewardsDisciplineService';
import { ErrorNotice } from './RewardsShared';
import RewardsSubjectPicker from './RewardsSubjectPicker';

export default function RewardsRecordForm({ record, types, service, onSaved, onReload }: {
  record?: RewardRecord; types: RewardType[]; service: RewardsDisciplineService; onSaved: (record: RewardRecord) => void; onReload: (record: RewardRecord) => void;
}) {
  const [subject, setSubject] = useState<Pick<RewardSubject,'id'|'label'> | null>(record ? {id: record.subject_id, label: record.subject_label} : null);
  const [applicant, setApplicant] = useState<Pick<RewardSubject,'id'|'label'> | null>(record?.applicant_subject_id ? {id: record.applicant_subject_id, label: record.applicant_label || '未填姓名'} : null);
  const [date, setDate] = useState(record?.application_date || ''), [type, setType] = useState(record?.type_code || '');
  const [quantity, setQuantity] = useState(record?.quantity?.toString() || ''), [reason, setReason] = useState(record?.reason || '');
  const [basis, setBasis] = useState(record?.basis || ''), [notes, setNotes] = useState(record?.notes || '');
  const [error, setError] = useState<unknown>(), [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const selectedType = types.find(t => t.code === type), numericQuantity = Number(quantity);
  const repriced = !record || type !== (record.type_code || '') || quantity !== (record.quantity?.toString() || '');
  let preview = record?.total_points || '—';
  if (repriced) {
    try { preview = selectedType?.active ? calculatePoints(selectedType.points, numericQuantity) : '—'; } catch { preview = '—'; }
  }
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (!record && !subject) { setError(new TypeError('subject')); return; }
    const controller = new AbortController(); request.current = controller; setBusy(true); setError(undefined);
    try {
      let saved: RewardRecord;
      if (record) {
        const patch: UpdateRewardRecord = {};
        if (date !== (record.application_date || '')) patch.application_date = date;
        if (type !== (record.type_code || '')) patch.type_code = type;
        if (quantity !== (record.quantity?.toString() || '')) patch.quantity = numericQuantity;
        if ((applicant?.id || null) !== record.applicant_subject_id) patch.applicant_subject_id = applicant?.id || null;
        if (reason !== record.reason) patch.reason = reason;
        if (basis !== record.basis) patch.basis = basis;
        if (notes !== record.notes) patch.notes = notes;
        if (!Object.keys(patch).length) { setBusy(false); return; }
        saved = await service.update(record.id, record.version, patch, controller.signal);
      } else {
        const input: CreateRewardRecord = {subject_id: subject!.id, application_date: date, type_code: type, quantity: numericQuantity, reason, basis, notes, applicant_subject_id: applicant?.id || null};
        saved = await service.create(input, controller.signal);
      }
      if (!controller.signal.aborted) onSaved(saved);
    } catch (e) { if (!controller.signal.aborted) setError(e); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  };
  const reload = async () => {
    if (!record || busy) return;
    const controller = new AbortController(); request.current = controller; setBusy(true);
    try { const fresh = await service.get(record.id, controller.signal); if (!controller.signal.aborted) onReload(fresh); }
    catch (e) { if (!controller.signal.aborted) setError(e); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  };
  return <form onSubmit={submit} className="rd-form">
    <fieldset disabled={busy} className="rd-form-fields">
      {record ? <p>被獎懲人：<strong>{record.subject_label}</strong>（不可改換人物）</p> : <RewardsSubjectPicker label="被獎懲人" value={subject} onChange={setSubject} service={service} allowEmployee/>}
      <div className="rd-form-grid">
        <label className="rd-field">申請日期{record?.application_date === null && <span className="rd-muted">歷史未填，可保留；不是事件日</span>}<input aria-label="申請日期" type="date" required={!record || record.application_date !== null} value={date} onChange={e => setDate(e.target.value)}/></label>
        <label className="rd-field">獎懲種類<select aria-label="獎懲種類" required={!record || record.type_code !== null} value={type} onChange={e => setType(e.target.value)}><option value="">{record && !record.type_code ? `${record.type_label}（歷史未對應）` : '請選擇種類'}</option>{types.filter(t => t.active || t.code === record?.type_code).map(t => <option key={t.code} value={t.code} disabled={!t.active}>{t.label}{!t.active ? '（已停用；保留歷史）' : ''}</option>)}</select></label>
        <label className="rd-field">次數<input type="number" inputMode="numeric" min="1" max="1000000" step="1" required={!record || record.quantity !== null} value={quantity} onChange={e => setQuantity(e.target.value)}/></label>
      </div>
      <p className="rd-summary">{repriced ? '積分預覽' : '原記錄積分'}：<strong>{preview}</strong>・以伺服器儲存結果為準{record && !repriced ? '；僅改文字不重算歷史積分。' : '。'}</p>
      <label className="rd-field">事由<textarea aria-label="事由" required={!record || !!record.reason.trim() || reason !== record.reason} rows={4} maxLength={4000} value={reason} onChange={e => setReason(e.target.value)}/></label>
      <label className="rd-field">依據（選填）<textarea aria-label="依據（選填）" rows={2} maxLength={2000} value={basis} onChange={e => setBasis(e.target.value)}/></label>
      <RewardsSubjectPicker label="申請人（選填）" value={applicant} onChange={setApplicant} service={service}/>
      <details><summary>其他選填內容</summary><label className="rd-field">備註<textarea aria-label="備註" rows={2} maxLength={4000} value={notes} onChange={e => setNotes(e.target.value)}/></label></details>
    </fieldset>
    {Boolean(error) && <ErrorNotice error={error}/>}
    {record && error instanceof RewardsRpcError && error.code === '40001' && <details><summary>重新讀取選項</summary><p>重新讀取會捨棄本次尚未儲存的輸入，請先自行保留內容。</p><button type="button" disabled={busy} onClick={reload}>確認捨棄輸入並重新讀取</button></details>}
    <div className="rd-toolbar"><button className="rd-primary" type="submit" disabled={busy}>{busy ? '儲存中…' : '儲存記錄'}</button></div>
  </form>;
}

import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { rewardsErrorMessage } from '../../services/rewardsDisciplineService';
import type { Page, RewardRecordPage } from '../../types/rewardsDiscipline';

/** Keys include every filter/page. A new key hides old data before effects run. */
export function useRewardsQuery<T>(key: string, load: (signal: AbortSignal) => Promise<T>) {
  const [state, setState] = useState<{key:string;data?:T;error?:unknown}>({ key: '' });
  useEffect(() => {
    const controller = new AbortController();
    let alive = true;
    // Invoke inside the promise chain: loaders may synchronously validate/throw.
    Promise.resolve().then(() => {
      controller.signal.throwIfAborted();
      return load(controller.signal);
    }).then(data => {
      if (alive && !controller.signal.aborted) setState({ key, data });
    }).catch(error => {
      if (alive && !controller.signal.aborted) setState({ key, error });
    });
    return () => { alive = false; controller.abort(); };
  }, [key]);
  return state.key === key ? { ...state, loading: false } : { key, loading: true, data: undefined, error: undefined };
}
export function ErrorNotice({ error }: { error: unknown }) {
  return <p role="alert" className="rd-error">{rewardsErrorMessage(error)}</p>;
}
export function RewardsDialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const titleId = useId(), ref = useRef<HTMLDivElement>(null), closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const controls = () => Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]') || [])
      .filter(node => node.getClientRects().length > 0);
    (controls()[0] || ref.current)?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); }
      if (event.key === 'Tab') {
        event.preventDefault();
        const nodes = controls(), index = nodes.indexOf(document.activeElement as HTMLElement);
        if (nodes.length) nodes[(index + (event.shiftKey ? -1 : 1) + nodes.length) % nodes.length].focus();
        else ref.current?.focus();
      }
    };
    document.addEventListener('keydown', keydown, true);
    return () => {
      document.removeEventListener('keydown', keydown, true); document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
      else document.querySelector<HTMLElement>('[data-rd-focus-anchor]')?.focus();
    };
  }, []);
  return createPortal(<div className="rd rd-overlay"><div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="rd-dialog">
    <header className="rd-toolbar"><h2 id={titleId}>{title}</h2><button type="button" onClick={onClose} aria-label="關閉對話框">關閉</button></header>{children}
  </div></div>, document.body);
}
export function RewardsPagination({ result, page, onPage, disabled = false }: { result?: Page<unknown>; page: number; onPage: (page: number) => void; disabled?: boolean }) {
  return <div className="rd-pagination">
    <button type="button" disabled={disabled || page <= 1} onClick={() => onPage(page - 1)}>上一頁</button>
    <span>{result ? `第 ${page} 頁／共 ${result.total} 筆` : `第 ${page} 頁`}</span>
    <button type="button" disabled={disabled || !result || page * result.page_size >= result.total} onClick={() => onPage(page + 1)}>下一頁</button>
  </div>;
}
export function RewardsSummary({ result }: { result: RewardRecordPage }) {
  return <p className="rd-summary">完整篩選結果：登錄 {result.summary.recorded_count} 件・作廢 {result.summary.voided_count} 件・積分小計 <strong>{result.summary.total_points}</strong>（排除作廢；非本頁小計）</p>;
}
export const rewardDate = (date: string | null) => date || '未填';

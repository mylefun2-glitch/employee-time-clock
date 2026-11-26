import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { createRewardsDisciplineService } from '../services/rewardsDisciplineService';

type Permission = { status: 'unknown' | 'allowed' | 'denied' | 'error'; epoch: number; signal?: AbortSignal };
const PermissionContext = createContext<Permission>({ status: 'unknown', epoch: 0 });
/** Independent of employee/PIN state and generic admin layout authentication. */
export function RewardsDisciplinePermissionProvider({ children }: { children: ReactNode }) {
  const [permission, setPermission] = useState<Permission>({ status: 'unknown', epoch: 0 });
  useEffect(() => {
    let alive = true, epoch = 0, authEvent = 0;
    let controller = new AbortController();
    const applySession = (session: Session | null) => {
      controller.abort();
      controller = new AbortController();
      const signal = controller.signal, current = ++epoch;
      setPermission({ status: session ? 'unknown' : 'denied', epoch: current, signal });
      if (!session?.access_token || !session.user?.id) return;
      // Never await a Supabase call inside onAuthStateChange's auth lock.
      queueMicrotask(async () => {
        if (!alive || signal.aborted) return;
        try {
          const allowed = await createRewardsDisciplineService(signal).permission();
          if (alive && !signal.aborted && current === epoch) setPermission({ status: allowed === true ? 'allowed' : 'denied', epoch: current, signal });
        } catch {
          if (alive && !signal.aborted && current === epoch) setPermission({ status: 'error', epoch: current, signal });
        }
      });
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      authEvent++;
      if (alive) applySession(session);
    });
    const initialEvent = authEvent;
    Promise.resolve().then(() => supabase.auth.getSession()).then(({ data, error }) => {
      if (!alive || authEvent !== initialEvent) return;
      if (error) setPermission({ status: 'error', epoch: ++epoch });
      else applySession(data.session);
    }).catch(() => {
      if (alive && authEvent === initialEvent) setPermission({ status: 'error', epoch: ++epoch });
    });
    return () => { alive = false; controller.abort(); subscription.unsubscribe(); };
  }, []);
  return createElement(PermissionContext.Provider, { value: permission }, children);
}
export function useRewardsDisciplinePermission() { return useContext(PermissionContext); }

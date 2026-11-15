import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

/** Fail closed on disconnect, background, scope changes and failed revalidation.
 * A generation also rejects network responses started before any invalidation. */
export function useRouteServerData<T>(key: string | null, load: () => Promise<T>) {
  const loadRef = useRef(load); loadRef.current = load;
  const [slot, setSlot] = useState<{key:string; data:T} | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let disposed = false, generation = 0, online = false, active = AppState.currentState === 'active', busy = false;
    const clear = () => { generation++; busy = false; setSlot(null); };
    const refresh = async () => {
      if (!key || !online || !active || busy || disposed) return;
      busy = true;
      const gen = ++generation;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        const data = await Promise.race([loadRef.current(), new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error("Access verification timed out")), 12000);
        })]);
        if (!disposed && gen === generation) { setSlot({key, data}); setError(false); }
      } catch {
        if (!disposed && gen === generation) { setSlot(null); setError(true); }
      } finally { if (timeout) clearTimeout(timeout); if (gen === generation) busy = false; }
    };
    setSlot(null); setError(false);
    const network = NetInfo.addEventListener(state => {
      const next = state.isConnected === true && state.isInternetReachable !== false;
      if (!next) clear();
      const changed = online !== next; online = next;
      if (next && changed) void refresh();
    });
    const app = AppState.addEventListener('change', state => {
      active = state === 'active'; clear(); if (active) void refresh();
    });
    const timer = setInterval(() => { void refresh(); }, 15000);
    return () => { disposed = true; generation++; network(); app.remove(); clearInterval(timer); };
  }, [key]);
  return {data:key && slot?.key === key ? slot.data : null, error};
}

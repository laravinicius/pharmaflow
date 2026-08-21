import { useCallback, useEffect, useRef, useState } from 'react';
import { db } from '../services/lanDatabase';

interface PerfMetrics {
  ipcDurationMs: number;
  reloadCount: number;
  sqlQueryCount: number;
  recordsReturned: number;
  concurrentLoads: number;
  lastError: string | null;
}

const globalMetrics: PerfMetrics = {
  ipcDurationMs: 0,
  reloadCount: 0,
  sqlQueryCount: 0,
  recordsReturned: 0,
  concurrentLoads: 0,
  lastError: null,
};

let activeLoads = 0;

export function getPerfMetrics(): PerfMetrics {
  return { ...globalMetrics };
}

export function resetPerfMetrics(): void {
  globalMetrics.ipcDurationMs = 0;
  globalMetrics.reloadCount = 0;
  globalMetrics.sqlQueryCount = 0;
  globalMetrics.recordsReturned = 0;
  globalMetrics.concurrentLoads = 0;
  globalMetrics.lastError = null;
  activeLoads = 0;
}

export function useData<T>(fetcher: () => Promise<T>, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadRef = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const load = useCallback(async (silent = false) => {
    const loadId = ++loadRef.current;
    activeLoads++;
    globalMetrics.concurrentLoads = Math.max(globalMetrics.concurrentLoads, activeLoads);

    if (!silent) setLoading(true);
    const start = performance.now();
    try {
      const result = await fetcher();
      if (!isMountedRef.current) return;
      const duration = performance.now() - start;
      globalMetrics.ipcDurationMs += duration;
      globalMetrics.reloadCount++;
      globalMetrics.lastError = null;

      if (Array.isArray(result)) {
        globalMetrics.recordsReturned += result.length;
      } else if (result && typeof result === 'object') {
        globalMetrics.recordsReturned += 1;
      }

      setData(result);
      setError(null);
    } catch (e: any) {
      if (!isMountedRef.current) return;
      globalMetrics.lastError = e.message ?? 'Erro desconhecido';
      if (!silent) setError(globalMetrics.lastError);
    } finally {
      if (!isMountedRef.current) return;
      activeLoads--;
      if (!silent) setLoading(false);
    }
  }, deps);

  useEffect(() => {
    const off = db.data.onChanged(() => load(true));
    const timer = setInterval(() => load(true), 10_000);
    return () => { if (off) off(); clearInterval(timer); };
  }, [load]);

  useEffect(() => { load(); }, [load]);
  return { data, loading, error, reload: load };
}

import { useCallback, useEffect, useState } from 'react';
import { db } from '../services/lanDatabase';

export function useData<T>(fetcher: () => Promise<T>, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const result = await fetcher();
      setData(result);
      setError(null);
    } catch (e: any) {
      // Erros de atualização em background não substituem dados já exibidos
      if (!silent) setError(e.message ?? 'Erro desconhecido');
    } finally {
      if (!silent) setLoading(false);
    }
  }, deps);

  // Atualização ao vivo: recarrega silenciosamente quando o servidor muda
  // (gravação nesta máquina via data:changed) ou em outras máquinas (polling)
  useEffect(() => {
    const off = db.data.onChanged(() => load(true));
    const timer = setInterval(() => load(true), 10_000);
    return () => { if (off) off(); clearInterval(timer); };
  }, [load]);

  useEffect(() => { load(); }, [load]);
  return { data, loading, error, reload: load };
}

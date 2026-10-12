'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { pesanError } from './gas-client';

/** Pemuat data sederhana: memuat ulang saat deps berubah atau reload() dipanggil; membatalkan hasil basi. */
export function useAsync<T>(muat: () => Promise<T>, deps: readonly unknown[]) {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true });
  const [tick, setTick] = useState(0);
  const muatRef = useRef(muat);
  muatRef.current = muat;

  useEffect(() => {
    let batal = false;
    setState(s => ({ data: s.data, loading: true }));
    muatRef.current()
      .then(data => { if (!batal) setState({ data, loading: false }); })
      .catch(e => { if (!batal) setState(s => ({ data: s.data, loading: false, error: pesanError(e) })); });
    return () => { batal = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick(t => t + 1), []);
  return { ...state, reload };
}

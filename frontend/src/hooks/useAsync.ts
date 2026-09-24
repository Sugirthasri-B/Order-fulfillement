import { useCallback, useEffect, useRef, useState } from 'react';
import { getApiErrorMessage } from '../services/apiClient';

interface UseAsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Runs an async fetcher on mount (and whenever `deps` changes), tracking
 * loading/error/data state. `refetch` re-runs it manually, e.g. after a
 * create action elsewhere on the page.
 */
export const useAsync = <T>(fetcher: () => Promise<T>, deps: unknown[] = []) => {
  const [state, setState] = useState<UseAsyncState<T>>({
    data: null,
    loading: true,
    error: null,
  });
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await fetcherRef.current();
      setState({ data, loading: false, error: null });
    } catch (error) {
      setState({ data: null, loading: false, error: getApiErrorMessage(error) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
  }, [run]);

  return { ...state, refetch: run };
};

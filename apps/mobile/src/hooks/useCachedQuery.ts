import { useState, useEffect, useCallback, useRef } from "react";
import { Cache } from "../utils/Cache";

interface QueryOptions {
  /** Background-refresh when cached data is older than this (default 5 min). */
  ttlMs?: number;
  /** Skip loading entirely while false. */
  enabled?: boolean;
}

interface QueryResult<T> {
  /** Cached data instantly, refreshed silently. Null only before first load. */
  data: T | null;
  /** Local override (optimistic updates). */
  setData: (d: T | null | ((prev: T | null) => T | null)) => void;
  /** True only during an explicit pull-to-refresh. */
  refreshing: boolean;
  /** Silent background sync; pass { showIndicator: true } for pull-to-refresh. */
  refresh: (opts?: { showIndicator?: boolean }) => Promise<void>;
  /** True while nothing (cache or network) has resolved yet. */
  isFirstLoad: boolean;
}

/**
 * Stale-while-revalidate query: paints cached data instantly with zero
 * spinners, then syncs in the background. Navigating away and back never
 * blanks the screen.
 */
export function useCachedQuery<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  opts?: QueryOptions
): QueryResult<T> {
  const ttlMs = opts?.ttlMs ?? 5 * 60_000;
  const enabled = opts?.enabled ?? true;
  const [data, setDataState] = useState<T | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const setData = useCallback((d: T | null | ((prev: T | null) => T | null)) => {
    setDataState((prev) => (typeof d === "function" ? (d as any)(prev) : d));
  }, []);

  const refresh = useCallback(
    async (rOpts?: { showIndicator?: boolean }) => {
      if (!key || !enabled) return;
      const showIndicator = rOpts?.showIndicator ?? false;
      if (showIndicator) setRefreshing(true);
      try {
        const fresh = await fetcherRef.current();
        if (!mountedRef.current) return;
        setDataState(fresh);
        Cache.set(key, fresh).catch(() => {});
      } catch (e: any) {
        const reason = e?.code || e?.response?.status || e?.message || "unknown";
        console.log(`[useCachedQuery:${key}] background sync failed (${reason}), keeping cache`);
      } finally {
        if (mountedRef.current) {
          setRefreshing(false);
          setIsFirstLoad(false);
        }
      }
    },
    [key, enabled]
  );

  useEffect(() => {
    if (!key || !enabled) {
      setIsFirstLoad(false);
      return;
    }
    let cancelled = false;
    (async () => {
      // 1. Instant paint from cache (any age).
      const cached = await Cache.getStale<T>(key);
      if (cancelled || !mountedRef.current) return;
      if (cached !== null && cached !== undefined) {
        setDataState(cached);
        setIsFirstLoad(false);
      }
      // 2. Silent sync when missing or stale.
      const fresh = await Cache.getFresh<T>(key, ttlMs);
      if (cancelled || !mountedRef.current) return;
      if (fresh === null || fresh === undefined) {
        await refresh();
      } else {
        setIsFirstLoad(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { data, setData, refreshing, refresh, isFirstLoad };
}

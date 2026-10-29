// Data hooks. A read starts when the component mounts, repeats on a timer if asked, and refetches after any
// successful write. Old data stays on screen while a refresh runs, so lists never flash empty.
import { useCallback, useEffect, useRef, useState } from "react";
import { useDataVersion } from "./tx";

export interface Async<T> {
  data: T | undefined;
  error: Error | null;
  loading: boolean;
  /** True while a refresh runs after data is already shown. */
  refreshing: boolean;
  reload: () => void;
}

export function useAsync<T>(fn: () => Promise<T>, deps: readonly unknown[], opts: { interval?: number; enabled?: boolean } = {}): Async<T> {
  const { interval, enabled = true } = opts;
  const version = useDataVersion();
  const [state, setState] = useState<{ data: T | undefined; error: Error | null; loading: boolean; refreshing: boolean }>({ data: undefined, error: null, loading: enabled, refreshing: false });
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const seq = useRef(0);
  const depKey = JSON.stringify(deps, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
  const lastKey = useRef(depKey);

  useEffect(() => {
    if (!enabled) {
      setState({ data: undefined, error: null, loading: false, refreshing: false });
      return;
    }
    const run = ++seq.current;
    const sameInput = lastKey.current === depKey;
    lastKey.current = depKey;
    setState((s) => ({ data: sameInput ? s.data : undefined, error: sameInput ? s.error : null, loading: !sameInput || s.data === undefined, refreshing: sameInput && s.data !== undefined }));
    fnRef.current().then(
      (data) => run === seq.current && setState({ data, error: null, loading: false, refreshing: false }),
      (error: unknown) => run === seq.current && setState((s) => ({ data: s.data, error: error instanceof Error ? error : new Error(String(error)), loading: false, refreshing: false })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depKey, enabled, version, tick]);

  useEffect(() => {
    if (!interval || !enabled) return;
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") setTick((n) => n + 1);
    }, interval);
    return () => window.clearInterval(t);
  }, [interval, enabled]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { ...state, reload };
}

/** A clock that ticks every second, for countdowns. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now() / 1000), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** Eases a number toward its target. Used by the tension gauges. */
export function useTween(target: number, ms = 700): number {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  const valueRef = useRef(target);
  valueRef.current = value;
  useEffect(() => {
    if (typeof window === "undefined" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    from.current = valueRef.current;
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - k, 3);
      setValue(from.current + (target - from.current) * eased);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

export function useDocumentTitle(title: string): void {
  useEffect(() => {
    const prev = document.title;
    document.title = title ? `${title} · Leash` : "Leash";
    return () => {
      document.title = prev;
    };
  }, [title]);
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setMatches(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [query]);
  return matches;
}

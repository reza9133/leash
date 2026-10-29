// Runs a write call for a button or a form: tracks that it is running and keeps the last error to show next to it.
import { useCallback, useState } from "react";
import type { TxResult } from "./tx";

export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const run = useCallback(async (call: () => Promise<TxResult>): Promise<TxResult> => {
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const result = await call();
      if (result.ok) setDone(true);
      else setError(result.message ?? "The call failed.");
      return result;
    } finally {
      setBusy(false);
    }
  }, []);

  const clear = useCallback(() => {
    setError(null);
    setDone(false);
  }, []);

  return { busy, error, done, run, clear };
}

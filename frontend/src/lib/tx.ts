// Sends a write call through the connected wallet and follows it until the validators have decided.
//
// A GenLayer write has three stages the user can see:
//   1. wallet      the wallet asks for a signature,
//   2. submitted   the transaction is on Studionet and waits for its turn,
//   3. consensus   a leader proposes, the validators vote (AI reviews take the longest),
// and it ends as done or failed. A decided transaction can still carry a contract error (the call was refused),
// so the outcome is read from the receipt, not from the status alone.
import { CONTRACT_ADDRESS } from "../config";
import { getReader, getWriter, errorText } from "./client";
import { createStore, safeStorage, useStore } from "./store";
import { isDecided, outcome, STATUS_TEXT } from "./receipt";
import { describeWalletError, ensureWalletReady, WalletNotReady } from "./wallet/wallet";

export type TxPhase = "wallet" | "submitted" | "consensus" | "done" | "failed";

export interface TxEntry {
  id: string;
  fn: string;
  label: string;
  phase: TxPhase;
  hash?: string;
  statusName?: string;
  message?: string;
  returned?: string;
  startedAt: number;
  finishedAt?: number;
  /** The method uses the AI reviewer, so it can take several minutes. */
  slow: boolean;
  dismissed: boolean;
}

const KEY = "leash.tx.v1";
const SLOW = new Set(["review", "audit"]);

function load(): TxEntry[] {
  try {
    const raw = JSON.parse(safeStorage.get(KEY) ?? "[]") as TxEntry[];
    return raw.filter((t) => t && t.id && t.hash).slice(-12);
  } catch {
    return [];
  }
}

export const txStore = createStore<{ list: TxEntry[] }>({ list: load() });
export const useTxs = () => useStore(txStore).list;

function persist() {
  const keep = txStore.get().list.filter((t) => t.hash).slice(-12);
  safeStorage.set(KEY, JSON.stringify(keep));
}

function update(id: string, patch: Partial<TxEntry>) {
  txStore.set((s) => ({ list: s.list.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  persist();
}

export function dismissTx(id: string) {
  update(id, { dismissed: true });
  stopPolling(id);
}

export function clearFinished() {
  txStore.set((s) => ({ list: s.list.filter((t) => t.phase !== "done" && t.phase !== "failed") }));
  persist();
}

// ---- data refresh --------------------------------------------------------------------------------------------------------

/** Bumped after every successful write; data hooks refetch when it changes. */
export const dataStore = createStore<{ version: number }>({ version: 0 });
export const bumpData = () => dataStore.patch({ version: dataStore.get().version + 1 });
export const useDataVersion = () => useStore(dataStore).version;

// ---- running a write -------------------------------------------------------------------------------------------------------

type Arg = string | number | bigint | boolean | null;

export interface TxRequest {
  fn: string;
  args: Arg[];
  value?: bigint;
  /** Shown in the transaction panel, for example "Create mandate". */
  label: string;
}

export interface TxResult {
  ok: boolean;
  hash?: string;
  returned?: string;
  message?: string;
  /** True when the user closed the wallet prompt or the wallet was not ready: nothing was sent. */
  notSent?: boolean;
}

const aborters = new Map<string, AbortController>();
const stopPolling = (id: string) => aborters.get(id)?.abort();
const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      resolve();
    });
  });

let counter = 0;
const newId = () => `tx-${Date.now().toString(36)}-${++counter}`;

export async function runTx(req: TxRequest): Promise<TxResult> {
  const id = newId();
  const entry: TxEntry = { id, fn: req.fn, label: req.label, phase: "wallet", startedAt: Date.now(), slow: SLOW.has(req.fn), dismissed: false };

  let account: string;
  let provider;
  try {
    ({ account, provider } = await ensureWalletReady());
  } catch (err) {
    const message = err instanceof WalletNotReady ? err.message : describeWalletError(err);
    return { ok: false, message, notSent: true };
  }

  txStore.set((s) => ({ list: [...s.list, entry] }));

  let hash: string;
  try {
    const client = await getWriter(account, provider);
    hash = await client.writeContract({ address: CONTRACT_ADDRESS, functionName: req.fn, args: req.args, ...(req.value ? { value: req.value } : {}) });
  } catch (err) {
    const rejected = (err as { code?: number })?.code === 4001 || /user rejected|user denied|rejected the request/i.test(errorText(err));
    const message = rejected ? "You closed the request in your wallet. Nothing was sent." : describeWalletError(err);
    txStore.set((s) => ({ list: s.list.filter((t) => t.id !== id) }));
    return { ok: false, message, notSent: true };
  }

  update(id, { phase: "submitted", hash });
  const result = await follow(id, hash);
  return { ...result, hash };
}

/** Polls a transaction until it is decided. Used right after sending and when the page reloads with a pending one. */
async function follow(id: string, hash: string): Promise<Omit<TxResult, "hash">> {
  const abort = new AbortController();
  aborters.set(id, abort);
  const started = Date.now();
  const client = await getReader();
  let tx: Record<string, any> | null = null;
  let misses = 0;

  while (!abort.signal.aborted) {
    try {
      const t = await client.getTransaction({ hash });
      misses = 0;
      const name = String(t?.statusName ?? "");
      if (name) update(id, { statusName: name, phase: name === "PENDING" || name === "ACTIVATED" ? "submitted" : "consensus" });
      if (name && isDecided(name)) {
        tx = t;
        break;
      }
    } catch {
      misses++;
    }
    const waited = Date.now() - started;
    if (waited > 40 * 60_000 || misses > 80) {
      const message = "The network is taking longer than expected. The transaction may still complete; check its status again in a moment.";
      update(id, { phase: "failed", message, finishedAt: Date.now() });
      aborters.delete(id);
      return { ok: false, message };
    }
    await sleep(waited < 120_000 ? 2500 : 5000, abort.signal);
  }
  aborters.delete(id);
  if (!tx) return { ok: false, message: "Stopped watching this transaction." };

  const out = outcome(tx);
  const name = String(tx.statusName ?? "");
  if (out.ok) {
    update(id, { phase: "done", finishedAt: Date.now(), returned: out.returned, message: undefined });
    bumpData();
    return { ok: true, returned: out.returned };
  }
  let message = out.message;
  if (!message) {
    if (name === "UNDETERMINED") message = "The validators could not agree on the result. This can happen with an AI review. Try again.";
    else if (name === "LEADER_TIMEOUT" || name === "VALIDATORS_TIMEOUT") message = "The network timed out before it decided. Try again.";
    else if (name === "CANCELED") message = "The transaction was cancelled.";
    else if (!out.known) message = "The transaction was decided, but its result could not be read. Check the contract state before retrying.";
    else message = "The contract refused the call.";
  }
  update(id, { phase: "failed", finishedAt: Date.now(), message });
  bumpData();
  return { ok: false, message };
}

/** Resumes tracking of transactions that were still running when the page was closed. */
export function resumePending(): void {
  for (const t of txStore.get().list) {
    if (t.hash && (t.phase === "submitted" || t.phase === "consensus") && !aborters.has(t.id)) void follow(t.id, t.hash);
    // a transaction that never got a hash was only waiting for the wallet; it cannot be resumed
  }
  txStore.set((s) => ({ list: s.list.filter((t) => t.hash || t.phase === "done" || t.phase === "failed") }));
}

export { STATUS_TEXT };

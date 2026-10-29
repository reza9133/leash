// Reads the outcome of a decided GenLayer transaction without depending on one exact receipt shape.
// A receipt without a readable result never counts as a success.

type Json = Record<string, any>;

const FAIL = /ERROR|REVERT|FAIL|ROLLBACK/i;
const PASS = /RETURN|SUCCESS/i;

/** Transaction statuses after which nothing more happens to the transaction itself. */
export const DECIDED = ["ACCEPTED", "UNDETERMINED", "LEADER_TIMEOUT", "VALIDATORS_TIMEOUT", "CANCELED", "FINALIZED"] as const;
export const isDecided = (statusName: string): boolean => (DECIDED as readonly string[]).includes(statusName);

export const STATUS_TEXT: Record<string, string> = {
  PENDING: "Queued for the validators",
  ACTIVATED: "Queued for the validators",
  PROPOSING: "A leader is proposing the result",
  COMMITTING: "Validators are committing their votes",
  REVEALING: "Validators are revealing their votes",
  ACCEPTED: "Consensus reached",
  READY_TO_FINALIZE: "Consensus reached, finalising",
  FINALIZED: "Finalised",
  UNDETERMINED: "Validators could not agree",
  CANCELED: "Cancelled",
  LEADER_TIMEOUT: "The leader timed out",
  VALIDATORS_TIMEOUT: "The validators timed out",
  APPEAL_COMMITTING: "Appeal in progress",
  APPEAL_REVEALING: "Appeal in progress",
};

export function leaderOf(tx: Json | null | undefined): Json | undefined {
  const lr = tx?.consensus_data?.leader_receipt ?? tx?.data?.leader_receipt ?? tx?.leader_receipt;
  return Array.isArray(lr) ? lr[0] : lr ?? undefined;
}

export interface Outcome {
  ok: boolean;
  known: boolean;
  status: string;
  /** The contract's own error text, when the call was refused. */
  message?: string;
  /** What the call returned, as text (for example a new mandate id). */
  returned?: string;
}

function payloadText(leader: Json | undefined): string | undefined {
  const payload = leader?.result?.payload;
  if (typeof payload === "string") return payload;
  return undefined;
}

function returnedText(leader: Json | undefined): string | undefined {
  const payload = leader?.result?.payload;
  if (payload && typeof payload === "object" && typeof payload.readable === "string") return payload.readable;
  return undefined;
}

/** The contract raises plain sentences; strip the wrapper some node versions put around them. */
export function cleanContractError(text: string): string {
  let t = text.trim();
  // UserError(message='...') and similar wrappers
  const wrapped = /message\s*=\s*(['"])([\s\S]*)\1\)?\s*$/.exec(t);
  if (wrapped) return wrapped[2].slice(0, 300);
  t = t.replace(/^(?:UserError|contract_error|Error)\s*[:\-]\s*/i, "");
  const quoted = /"([^"]{6,300})"/.exec(t);
  if (quoted && /[.!]$/.test(quoted[1])) t = quoted[1];
  return t.slice(0, 300);
}

export function outcome(tx: Json | null | undefined): Outcome {
  const named: string = tx?.statusName ?? tx?.status_name ?? "";
  const leader = leaderOf(tx);
  const direct = [tx?.txExecutionResultName, tx?.resultName, leader?.execution_result, leader?.result?.status];
  for (const v of direct) {
    if (typeof v !== "string" || !v) continue;
    if (FAIL.test(v)) {
      const raw = payloadText(leader);
      return { ok: false, known: true, status: `${named || "decided"} / ${v}`, message: raw ? cleanContractError(raw) : undefined };
    }
    if (PASS.test(v)) return { ok: true, known: true, status: `${named || "decided"} / ${v}`, returned: returnedText(leader) };
  }
  const text = safeJson(tx);
  if (/FINISHED_WITH_ERROR|"execution_result"\s*:\s*"ERROR"/.test(text)) return { ok: false, known: true, status: `${named || "decided"} / error` };
  if (/FINISHED_WITH_RETURN|"execution_result"\s*:\s*"SUCCESS"/.test(text)) return { ok: true, known: true, status: `${named || "decided"} / success`, returned: returnedText(leader) };
  return { ok: false, known: false, status: `unreadable receipt (${Object.keys(tx ?? {}).slice(0, 8).join(", ") || "empty"})` };
}

function safeJson(v: unknown): string {
  try {
    return JSON.stringify(v ?? null, (_k, x) => (typeof x === "bigint" ? x.toString() : x)) ?? "";
  } catch {
    return String(v);
  }
}

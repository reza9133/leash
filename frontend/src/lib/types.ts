// Types and constants shared by the whole app. Every number comes from contract.generated.json, which
// scripts/sync-contract.mjs extracts from contracts/leash.py.
import generated from "./contract.generated.json";

const K = generated.constants as Record<string, string>;
const num = (name: string): number => Number(K[name]);
const big = (name: string): bigint => BigInt(K[name]);

export const LIMITS = {
  bps: num("BPS"),
  minPayment: big("MIN_PAYMENT"),
  maxAmount: big("MAX_AMOUNT"),
  maxDelegates: num("MAX_DELEGATES"),
  maxPayees: num("MAX_PAYEES"),
  maxOpen: num("MAX_OPEN"),
  maxWindowEntries: num("MAX_WINDOW_ENTRIES"),
  maxPage: num("MAX_PAGE"),
  minName: num("MIN_NAME"),
  maxName: num("MAX_NAME"),
  minPolicy: num("MIN_POLICY"),
  maxPolicy: num("MAX_POLICY"),
  minPurpose: num("MIN_PURPOSE"),
  maxPurpose: num("MAX_PURPOSE"),
  maxNote: num("MAX_NOTE"),
  maxReason: num("MAX_REASON"),
  maxUrl: num("MAX_URL"),
  minDelay: num("MIN_DELAY"),
  maxDelay: num("MAX_DELAY"),
  minWindow: num("MIN_WINDOW"),
  maxWindow: num("MAX_WINDOW"),
  minSpan: num("MIN_SPAN"),
  maxSpan: num("MAX_SPAN"),
  minExpiry: num("MIN_EXPIRY"),
  maxExpiry: num("MAX_EXPIRY"),
  defaultSpan: num("DEFAULT_SPAN"),
  defaultAuto: num("DEFAULT_AUTO"),
  defaultReject: num("DEFAULT_REJECT"),
  maxTries: num("MAX_TRIES"),
  retryGap: num("RETRY_GAP"),
  bondBps: big("BOND_BPS"),
  minBond: big("MIN_BOND"),
  rewardBps: big("REWARD_BPS"),
  strictNum: num("STRICT_NUM"),
  strictDen: num("STRICT_DEN"),
  evidenceChars: num("EVIDENCE_CHARS"),
  minEvidence: num("MIN_EVIDENCE"),
  riskSlack: num("RISK_SLACK"),
  riskRoom: num("RISK_ROOM"),
} as const;

// ---- request states ---------------------------------------------------------------------------------------------

export const STATE_NAMES = [
  "PENDING",
  "APPROVED",
  "ESCALATED",
  "REJECTED",
  "EXECUTED",
  "VETOED",
  "CANCELLED",
  "EXPIRED",
  "CHALLENGED",
] as const;
export type StateName = (typeof STATE_NAMES)[number];

export const S: Record<StateName, number> = Object.fromEntries(STATE_NAMES.map((n) => [n, num(n)])) as Record<StateName, number>;

export const OPEN_STATES: readonly number[] = [S.PENDING, S.APPROVED, S.ESCALATED, S.CHALLENGED];
export const FINAL_STATES: readonly number[] = [S.REJECTED, S.EXECUTED, S.VETOED, S.CANCELLED, S.EXPIRED];

export const stateName = (n: number): StateName => STATE_NAMES[n] ?? "PENDING";

export const BY = { none: num("BY_NONE"), ai: num("BY_AI"), owner: num("BY_OWNER"), guardian: num("BY_GUARDIAN") } as const;
export const BY_LABEL = ["Nobody yet", "The AI review", "The owner", "The guardian"] as const;

export const PAYEE = { any: num("PAYEE_ANY"), listed: num("PAYEE_LISTED") } as const;
export const BOND = {
  none: num("BOND_NONE"),
  held: num("BOND_HELD"),
  refunded: num("BOND_REFUNDED"),
  forfeited: num("BOND_FORFEITED"),
  rewarded: num("BOND_REWARDED"),
} as const;
export const BOND_LABEL = ["No bond", "Held by the contract", "Refunded to the watcher", "Forfeited to the mandate", "Returned with a reward"] as const;

export const FLAG_LABEL: Record<string, string> = {
  off_policy: "Outside the policy",
  injection: "Tries to steer the reviewer",
  vague: "Too vague",
  evidence_mismatch: "Evidence does not match",
  unusual_amount: "Unusual amount",
  unreadable: "Evidence unreadable",
  no_evidence: "No evidence",
  payee_unknown: "Payee unknown",
  duplicate_suspect: "Looks like a duplicate",
};

export type Verdict = "APPROVE" | "ESCALATE" | "REJECT";

// ---- rows returned by the contract's views (amounts are decimal strings of wei) --------------------------------------

export interface DelegateRow {
  who: string;
  active: boolean;
  budget: string;
  spent: string;
  held: string;
  left: string;
  open: number;
  requested: number;
  executed: number;
  rejected: number;
  vetoed: number;
}

export interface MandateRow {
  id: number;
  owner: string;
  guardian: string;
  name: string;
  policy: string;
  policy_rev: number;
  created: number;
  expires_at: number;
  paused: boolean;
  ended: boolean;
  payee_mode: number;
  need_evidence: boolean;
  per_payment_cap: string;
  window_cap: string;
  window_secs: number;
  window_used: string;
  window_entries: number;
  review_delay: number;
  escalation_window: number;
  exec_grace: number;
  auto_risk: number;
  reject_risk: number;
  balance: string;
  reserved: string;
  free: string;
  deposited: string;
  withdrawn: string;
  paid: string;
  rewards: string;
  forfeited: string;
  delegates: DelegateRow[];
  payees: string[];
  requests: number;
}

export interface ReviewInfo {
  at: number;
  verdict: Verdict;
  risk: number;
  flags: string[];
  reason: string;
  hash: string;
  rev: number;
}

export interface AuditInfo {
  at: number;
  verdict?: Verdict;
  risk?: number;
  flags?: string[];
  reason: string;
  hash?: string;
  upheld?: boolean;
  reward?: number | string;
  inconclusive?: boolean;
}

export interface RequestRow {
  id: number;
  mandate: number;
  delegate: string;
  payee: string;
  amount: string;
  purpose: string;
  url: string;
  state: number;
  decided_by: number;
  created: number;
  ready_at: number;
  decide_by: number;
  executed_at: number;
  closed_at: number;
  tries: number;
  risk: number;
  policy_rev: number;
  review: ReviewInfo | null;
  audit: AuditInfo | null;
  challenged: boolean;
  challenger: string;
  bond: string;
  bond_state: number;
  claim: string;
  note: string;
}

export interface Stats {
  mandates: number;
  requests: number;
  executed: number;
  rejected: number;
  vetoed: number;
  challenges_upheld: number;
  challenges_dismissed: number;
  reviews: number;
  volume: string;
  deposited: string;
  paid: string;
  bonds: string;
}

export interface Solvency {
  deposited: string;
  paid: string;
  bonds: string;
  held: string;
  reserved: string;
  balanced: boolean;
}

export interface Allowance {
  seat: boolean;
  usable: boolean;
  per_payment: string;
  seat_left: string;
  unreserved: string;
  window_left: string;
  open_slots: number;
  max_request: string;
}

export type Role = "owner" | "guardian" | "seat" | "none";

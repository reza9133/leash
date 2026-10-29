// Who may do what, and when a request has run out of road. These mirror the contract's own checks
// (_role, _stale, execute, challenge, ...) so the interface only offers actions that can succeed.
import { sameAddr } from "./format";
import { BY, OPEN_STATES, S } from "./types";
import type { DelegateRow, MandateRow, RequestRow, Role } from "./types";

export function seatOf(m: MandateRow, who?: string | null): DelegateRow | undefined {
  if (!who) return undefined;
  return m.delegates.find((d) => sameAddr(d.who, who));
}

export function roleOf(m: MandateRow, who?: string | null): Role {
  if (!who) return "none";
  if (sameAddr(m.owner, who)) return "owner";
  if (m.guardian && sameAddr(m.guardian, who)) return "guardian";
  if (seatOf(m, who)) return "seat";
  return "none";
}

export const ROLE_LABEL: Record<Role, string> = { owner: "Owner", guardian: "Guardian", seat: "Agent seat", none: "Watcher" };

/** Same test as the contract's _stale: has an open request run out of time, or lost its mandate or seat? */
export function isStale(r: RequestRow, m: MandateRow, now: number): boolean {
  if (!OPEN_STATES.includes(r.state)) return false;
  const seat = seatOf(m, r.delegate);
  const ended = m.expires_at !== 0 && now >= m.expires_at;
  if (ended || !seat || !seat.active) return true;
  if (r.state === S.PENDING || r.state === S.ESCALATED) return now >= r.decide_by;
  return now >= r.ready_at + m.exec_grace;
}

export interface ActionState {
  /** The user can press it now. */
  enabled: boolean;
  /** Why it is not available, or a hint that explains when it will be. */
  reason?: string;
}

export interface RequestActions {
  review: ActionState;
  cancel: ActionState;
  decide: ActionState;
  veto: ActionState;
  execute: ActionState;
  expire: ActionState;
  challenge: ActionState;
  audit: ActionState;
}

const off = (reason?: string): ActionState => ({ enabled: false, reason });
const on: ActionState = { enabled: true };

export function requestActions(r: RequestRow, m: MandateRow, me: string | null | undefined, now: number): RequestActions {
  const role = roleOf(m, me);
  const staff = role === "owner" || role === "guardian";
  const isAgent = !!me && sameAddr(r.delegate, me);
  const stale = isStale(r, m, now);
  const live = !m.paused && !(m.expires_at !== 0 && now >= m.expires_at);
  const open = OPEN_STATES.includes(r.state);

  const none: RequestActions = {
    review: off("This request is closed."),
    cancel: off("This request is closed."),
    decide: off("This request is closed."),
    veto: off("This request is closed."),
    execute: off("This request is closed."),
    expire: off("This request is closed."),
    challenge: off("This request is closed."),
    audit: off("This request is closed."),
  };
  if (!open) return none;

  const a: RequestActions = {
    review: off("Only a pending request can be reviewed."),
    cancel: off(),
    decide: off("Only an escalated request waits for a decision."),
    veto: off("Only an approved or challenged request can be vetoed."),
    execute: off("Only an approved request can be paid."),
    expire: stale ? on : off("Nothing has expired yet."),
    challenge: off("Only an approval given by the AI can be challenged."),
    audit: off("Only a challenged request can be audited."),
  };

  // cancel: the delegate who filed it, before it is paid
  if ([S.PENDING, S.ESCALATED, S.APPROVED].includes(r.state)) a.cancel = isAgent ? on : off("Only the agent who filed the request can withdraw it.");
  else a.cancel = off("A challenged request cannot be withdrawn until the audit ends.");

  if (r.state === S.PENDING) {
    a.review = stale ? off("The request is stale. Close it instead.") : live ? on : off("The mandate is paused or has ended.");
  }
  if (r.state === S.ESCALATED) {
    a.decide = !staff ? off("Only the owner or the guardian can decide.") : stale ? off("The request is stale. Close it instead.") : on;
  }
  if (r.state === S.APPROVED || r.state === S.CHALLENGED) {
    a.veto = staff ? on : off("Only the owner or the guardian can veto.");
  }
  if (r.state === S.APPROVED) {
    if (now < r.ready_at) a.execute = off("The approval is still in its waiting time.");
    else if (now >= r.ready_at + m.exec_grace) a.execute = off("The approval is no longer payable. Close it.");
    else a.execute = live ? on : off("The mandate is paused or has ended.");

    if (r.decided_by !== BY.ai) a.challenge = off("Only approvals given by the AI can be challenged.");
    else if (r.challenged) a.challenge = off("This approval has been challenged before.");
    else if (now >= r.ready_at) a.challenge = off("The waiting time is over.");
    else if (isAgent || staff) a.challenge = off("The agent, the owner and the guardian cannot challenge.");
    else a.challenge = on;
  }
  if (r.state === S.CHALLENGED) {
    a.audit = stale ? off("The request is stale. Close it instead.") : on;
  }
  return a;
}

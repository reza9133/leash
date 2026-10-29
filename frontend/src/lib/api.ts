// Typed access to the contract. Views are plain reads; writes go through runTx (see tx.ts).
import { readView } from "./client";
import { runTx, type TxResult } from "./tx";
import { LIMITS } from "./types";
import type { Allowance, MandateRow, RequestRow, Solvency, Stats } from "./types";

const PAGE = LIMITS.maxPage;

export const api = {
  stats: () => readView<Stats>("stats"),
  solvency: () => readView<Solvency>("solvency"),
  mandate: (id: number) => readView<MandateRow>("get_mandate", [id]),
  mandates: (offset = 0, limit = 20) => readView<MandateRow[]>("list_mandates", [offset, Math.min(limit, PAGE)]),
  mandatesOf: (who: string, offset = 0, limit = 20) => readView<MandateRow[]>("mandates_of", [who, offset, Math.min(limit, PAGE)]),
  request: (id: number) => readView<RequestRow>("get_request", [id]),
  requests: (mandate: number, offset = 0, limit = 20) => readView<RequestRow[]>("list_requests", [mandate, offset, Math.min(limit, PAGE)]),
  allowance: (mandate: number, who: string) => readView<Allowance>("allowance_of", [mandate, who]),
};

type W = Promise<TxResult>;

/** Every state-changing call of the contract, with the labels the transaction panel shows. */
export const write = {
  createMandate: (a: { name: string; policy: string; perPaymentCap: bigint; windowCap: bigint; windowSecs: number; reviewDelay: number; guardian: string; deposit: bigint }): W =>
    runTx({ fn: "create_mandate", label: "Create mandate", value: a.deposit > 0n ? a.deposit : undefined, args: [a.name, a.policy, a.perPaymentCap, a.windowCap, a.windowSecs, a.reviewDelay, a.guardian] }),
  setRules: (a: { id: number; payeeMode: number; needEvidence: boolean; autoRisk: number; rejectRisk: number; escalationWindow: number; execGrace: number; expiresIn: number }): W =>
    runTx({ fn: "set_rules", label: "Update rules", args: [a.id, a.payeeMode, a.needEvidence, a.autoRisk, a.rejectRisk, a.escalationWindow, a.execGrace, a.expiresIn] }),
  setPolicy: (id: number, policy: string): W => runTx({ fn: "set_policy", label: "Update policy", args: [id, policy] }),
  setLimits: (a: { id: number; perPaymentCap: bigint; windowCap: bigint; reviewDelay: number }): W =>
    runTx({ fn: "set_limits", label: "Update limits", args: [a.id, a.perPaymentCap, a.windowCap, a.reviewDelay] }),
  setGuardian: (id: number, guardian: string): W => runTx({ fn: "set_guardian", label: guardian ? "Set guardian" : "Remove guardian", args: [id, guardian] }),
  setPaused: (id: number, paused: boolean): W => runTx({ fn: "set_paused", label: paused ? "Pause mandate" : "Resume mandate", args: [id, paused] }),
  fund: (id: number, amount: bigint): W => runTx({ fn: "fund", label: "Fund mandate", value: amount, args: [id] }),
  withdraw: (id: number, amount: bigint): W => runTx({ fn: "withdraw", label: "Withdraw funds", args: [id, amount] }),
  grantDelegate: (id: number, delegate: string, budget: bigint): W => runTx({ fn: "grant_delegate", label: "Grant seat", args: [id, delegate, budget] }),
  revokeDelegate: (id: number, delegate: string): W => runTx({ fn: "revoke_delegate", label: "Revoke seat", args: [id, delegate] }),
  addPayee: (id: number, payee: string): W => runTx({ fn: "add_payee", label: "Add payee", args: [id, payee] }),
  removePayee: (id: number, payee: string): W => runTx({ fn: "remove_payee", label: "Remove payee", args: [id, payee] }),
  requestPayment: (a: { id: number; payee: string; amount: bigint; purpose: string; evidence: string }): W =>
    runTx({ fn: "request_payment", label: "File payment request", args: [a.id, a.payee, a.amount, a.purpose, a.evidence] }),
  cancelRequest: (id: number): W => runTx({ fn: "cancel_request", label: `Withdraw request #${id}`, args: [id] }),
  review: (id: number): W => runTx({ fn: "review", label: `AI review of request #${id}`, args: [id] }),
  decide: (id: number, approve: boolean, note: string): W => runTx({ fn: "decide", label: approve ? `Approve request #${id}` : `Reject request #${id}`, args: [id, approve, note] }),
  veto: (id: number, note: string): W => runTx({ fn: "veto", label: `Veto request #${id}`, args: [id, note] }),
  execute: (id: number): W => runTx({ fn: "execute", label: `Pay request #${id}`, args: [id] }),
  expire: (id: number): W => runTx({ fn: "expire_request", label: `Close request #${id}`, args: [id] }),
  challenge: (id: number, reason: string, bond: bigint): W => runTx({ fn: "challenge", label: `Challenge request #${id}`, value: bond, args: [id, reason] }),
  audit: (id: number): W => runTx({ fn: "audit", label: `Audit of request #${id}`, args: [id] }),
};

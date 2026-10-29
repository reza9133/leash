// Human text for every public method of the contract. The names, parameters, kinds and errors come from
// contract.generated.json (see scripts/sync-contract.mjs); this file only adds the explanations.
// tests/docs.test.ts fails when a method of the contract has no entry here, or an entry has no method.

export const METHOD_NAMES = [
  "create_mandate",
  "set_rules",
  "set_policy",
  "set_limits",
  "set_guardian",
  "set_paused",
  "fund",
  "withdraw",
  "grant_delegate",
  "revoke_delegate",
  "add_payee",
  "remove_payee",
  "request_payment",
  "cancel_request",
  "review",
  "decide",
  "veto",
  "execute",
  "expire_request",
  "challenge",
  "audit",
  "stats",
  "solvency",
  "get_mandate",
  "list_mandates",
  "mandates_of",
  "get_request",
  "list_requests",
  "allowance_of",
] as const;

export type MethodName = (typeof METHOD_NAMES)[number];

export type MethodGroup = "setup" | "agent" | "review" | "challenge" | "views";
export type RoleKey = "owner" | "guardian" | "agent" | "watcher" | "anyone";

export const GROUP_TITLE: Record<MethodGroup, string> = {
  setup: "Setup and funds",
  agent: "Agent calls",
  review: "Review, decision and payment",
  challenge: "Challenge and audit",
  views: "Views",
};

export const GROUP_INTRO: Record<MethodGroup, string> = {
  setup: "Opening a mandate, configuring it, funding it and managing who may spend. All of these except create_mandate and fund are restricted to the owner, with a few things the guardian may also do.",
  agent: "What a seat holder does: file a payment request, or withdraw one before it is paid.",
  review: "The steps that move a request from filing to payment or refusal. Most of them can be called by anyone, because the contract checks the facts, not the caller.",
  challenge: "Watchers can bet a bond that an AI approval was a mistake. A stricter audit settles the bet.",
  views: "Read-only calls. They return JSON text and cost nothing.",
};

export const ROLE_LABEL: Record<RoleKey, string> = {
  owner: "Owner",
  guardian: "Guardian",
  agent: "Agent (seat holder)",
  watcher: "Watcher",
  anyone: "Anyone",
};

export interface MethodDoc {
  group: MethodGroup;
  summary: string;
  /** Who may call it, in words. */
  who: string;
  /** Roles used by the filter chips. */
  roles: RoleKey[];
  /** What each parameter means, by parameter name. */
  params: Record<string, string>;
  /** What it changes. */
  effects: string[];
  /** What the call returns, when it returns something. */
  returns?: string;
  notes?: string[];
}

export const METHOD_DOCS: Record<MethodName, MethodDoc> = {
  create_mandate: {
    group: "setup",
    summary: "Opens a mandate and, optionally, funds it with the value attached to the call.",
    who: "Anyone. The caller becomes the owner.",
    roles: ["anyone"],
    params: {
      name: "Display name, 3 to 60 characters after cleaning.",
      policy: "The spending rule in plain words, 20 to 1200 characters. The AI reviews every request against this text.",
      per_payment_cap: "The most one payment may be, in wei. At least 0.001 GEN.",
      window_cap: "The most that may be paid inside any rolling window, in wei. Not below the per-payment cap.",
      window_secs: "Length of the rolling window in seconds, 60 to 2,592,000 (30 days). It cannot be changed later.",
      review_delay: "Seconds an AI approval waits before it can be paid, 60 to 604,800 (7 days). This is the time to veto or challenge.",
      guardian: "An optional second key as a 0x address, or an empty string for none. It cannot be the owner.",
    },
    effects: [
      "The attached value becomes the first deposit (zero is allowed).",
      "The new mandate starts with payee mode 0 (any payee), evidence optional, auto risk 35, reject risk 75, an escalation window and a payment grace of 3 days each, and no expiry. Change them with set_rules.",
      "The mandate appears in the owner's list and, if there is one, in the guardian's list (mandates_of).",
    ],
    returns: "The id of the new mandate. Ids start at 0.",
    notes: ["The name and the policy are cleaned before they are stored: hidden characters are dropped, spaces are collapsed and angle brackets become parentheses."],
  },
  set_rules: {
    group: "setup",
    summary: "Sets the payee mode, the evidence rule, the risk limits, the time limits and the expiry.",
    who: "Owner only.",
    roles: ["owner"],
    params: {
      mandate_id: "The mandate.",
      payee_mode: "0 lets the AI judge any payee. 1 pays only payees on the allowlist.",
      need_evidence: "When true, every request must carry a link to a page that backs the payment.",
      auto_risk: "Up to this risk (0 to 100) the AI may approve on its own.",
      reject_risk: "Above this risk the review rejects. Between auto_risk and reject_risk a human decides. Must not be below auto_risk and at most 100.",
      escalation_window: "Seconds a human has to decide an escalated request, 60 to 2,592,000.",
      exec_grace: "Seconds an approval stays payable after it is ready, 60 to 2,592,000.",
      expires_in: "Seconds from now until the mandate ends, or 0 for never. Otherwise 60 to 31,622,400 (366 days).",
    },
    effects: [
      "Replaces all eight settings at once; send the current value for anything you do not want to change.",
      "After the expiry nothing new is accepted or paid. Requests can still be closed, vetoed and withdrawn, and the owner can withdraw unreserved funds.",
    ],
  },
  set_policy: {
    group: "setup",
    summary: "Replaces the written policy.",
    who: "Owner only.",
    roles: ["owner"],
    params: {
      mandate_id: "The mandate.",
      policy: "The new policy, 20 to 1200 characters.",
    },
    effects: [
      "Requests still waiting for a review are reviewed against the new text.",
      "The policy revision number goes up by one. Each stored review records the revision it used.",
    ],
    notes: ["A request that was already approved under the old policy stays approved. Veto it if the new policy forbids it."],
  },
  set_limits: {
    group: "setup",
    summary: "Changes the per-payment cap, the rolling-window cap and the review delay.",
    who: "Owner only.",
    roles: ["owner"],
    params: {
      mandate_id: "The mandate.",
      per_payment_cap: "New per-payment cap in wei, at least 0.001 GEN.",
      window_cap: "New window cap in wei, not below the per-payment cap.",
      review_delay: "New waiting time for future AI approvals, 60 to 604,800 seconds.",
    },
    effects: [
      "The caps are checked again when a request is executed, so a tighter cap also stops approvals that are already waiting.",
      "The review delay only affects approvals made after the change, because an approval's ready time is fixed when it is approved.",
    ],
  },
  set_guardian: {
    group: "setup",
    summary: "Names, replaces or removes the guardian.",
    who: "Owner only.",
    roles: ["owner"],
    params: {
      mandate_id: "The mandate.",
      guardian: "The new guardian as a 0x address, or an empty string to remove the guardian.",
    },
    effects: ["The guardian can veto, decide escalations, revoke seats and pause, but cannot move money or change settings.", "The mandate is added to the new guardian's list."],
    notes: ["The guardian cannot be the owner or the contract, and cannot hold an active seat in the same mandate."],
  },
  set_paused: {
    group: "setup",
    summary: "Pauses or resumes a mandate.",
    who: "The owner can pause and resume. The guardian can only pause.",
    roles: ["owner", "guardian"],
    params: {
      mandate_id: "The mandate.",
      paused: "true to pause, false to resume.",
    },
    effects: [
      "A paused mandate accepts no new request, runs no review and pays nothing.",
      "Vetoes, withdrawals by the agent, closing of stale requests and the owner's withdraw still work.",
    ],
  },
  fund: {
    group: "setup",
    summary: "Adds the attached value to a mandate's balance.",
    who: "Anyone. Only the owner can take money out again.",
    roles: ["anyone"],
    params: { mandate_id: "The mandate to fund." },
    effects: ["The balance and the deposited total of the mandate and of the contract go up by the attached value."],
    notes: ["The call must carry a positive value."],
  },
  withdraw: {
    group: "setup",
    summary: "Takes unreserved funds out of a mandate.",
    who: "Owner only.",
    roles: ["owner"],
    params: {
      mandate_id: "The mandate.",
      amount: "Amount in wei. Positive, and not more than balance minus reserved.",
    },
    effects: ["The amount is sent to the owner.", "Money reserved by approved requests cannot be withdrawn until those requests are paid, vetoed, withdrawn or closed."],
  },
  grant_delegate: {
    group: "setup",
    summary: "Gives an agent a seat with a total budget.",
    who: "Owner only.",
    roles: ["owner"],
    params: {
      mandate_id: "The mandate.",
      delegate: "The agent's address.",
      budget: "The total the seat may ever spend, in wei: at least 0.001 GEN.",
    },
    effects: [
      "A new address takes a new seat.",
      "Granting again to an existing seat replaces its budget and brings a revoked seat back. What the seat has already spent still counts against the new budget.",
    ],
    notes: ["The owner, the guardian, the zero address and the contract cannot hold a seat. A mandate can grant at most 12 seats in its life; revoked seats still count."],
  },
  revoke_delegate: {
    group: "setup",
    summary: "Switches a seat off.",
    who: "Owner or guardian.",
    roles: ["owner", "guardian"],
    params: {
      mandate_id: "The mandate.",
      delegate: "The seat holder's address.",
    },
    effects: ["The seat stops working at once. Its open requests can be closed by anyone with expire_request."],
  },
  add_payee: {
    group: "setup",
    summary: "Adds an address to the payee allowlist.",
    who: "Owner only.",
    roles: ["owner"],
    params: {
      mandate_id: "The mandate.",
      payee: "The address that may be paid.",
    },
    effects: ["The allowlist is only used when the payee mode is 1. The list holds at most 24 addresses."],
  },
  remove_payee: {
    group: "setup",
    summary: "Removes an address from the payee allowlist.",
    who: "Owner only.",
    roles: ["owner"],
    params: {
      mandate_id: "The mandate.",
      payee: "The address to remove.",
    },
    effects: ["In payee mode 1, approved requests for this payee can no longer be paid."],
  },
  request_payment: {
    group: "agent",
    summary: "Asks to pay an address, with a purpose and optional evidence.",
    who: "A seat holder with an active seat.",
    roles: ["agent"],
    params: {
      mandate_id: "The mandate.",
      payee: "The address to pay. Not the seat itself, the zero address or the contract; on the allowlist when the payee mode is 1.",
      amount: "Amount in wei: at least 0.001 GEN, within the per-payment cap, the seat's remaining budget and the unreserved balance.",
      purpose: "What the payment is for, 12 to 300 characters. The reviewer reads it.",
      evidence_url: "One public http(s) link that backs the payment, or an empty string. Required when the mandate says so.",
    },
    effects: [
      "Every hard limit is checked here. The AI review comes afterwards and can only say no.",
      "The request starts as PENDING. A seat can have at most 3 open requests.",
      "An evidence page can back only one live request per mandate. Its address is normalised, so the same page under another spelling counts as the same page.",
    ],
    returns: "The id of the new request.",
  },
  cancel_request: {
    group: "agent",
    summary: "Withdraws a request before it is paid.",
    who: "The agent who filed the request.",
    roles: ["agent"],
    params: { request_id: "The request." },
    effects: ["Allowed while the request is PENDING, ESCALATED or APPROVED. Any reservation is released and the evidence page is free again."],
  },
  review: {
    group: "review",
    summary: "Runs the AI review of a pending request.",
    who: "Anyone.",
    roles: ["anyone"],
    params: { request_id: "The request." },
    effects: [
      "The model reads the policy, the purpose and the evidence. Its answer is settled against the owner's risk limits.",
      "Approve with low risk: the request is APPROVED, the amount is reserved and it can be paid after the review delay.",
      "Unsure or mid risk: the request is ESCALATED to the owner or the guardian.",
      "Reject or high risk: the request is REJECTED.",
      "A page that cannot be read is retried up to three times, two minutes apart, and then goes to a human.",
    ],
    notes: [
      "This is a consensus call with a language model and can take several minutes.",
      "The call fails when the amount no longer fits the unreserved balance or the seat's remaining budget, when the mandate is paused or ended, and when the request is stale.",
    ],
  },
  decide: {
    group: "review",
    summary: "Approves or rejects an escalated request.",
    who: "Owner or guardian.",
    roles: ["owner", "guardian"],
    params: {
      request_id: "The request.",
      approve: "true to approve, false to reject.",
      note: "A short note, at most 200 characters. May be empty.",
    },
    effects: ["An approval by a human can be paid at once: it does not wait for the review delay.", "A rejection closes the request."],
  },
  veto: {
    group: "review",
    summary: "Stops an approved or challenged request before it is paid.",
    who: "Owner or guardian.",
    roles: ["owner", "guardian"],
    params: {
      request_id: "The request.",
      note: "A short note, at most 200 characters. May be empty.",
    },
    effects: ["The reservation is released, the request ends as VETOED and a challenger's bond, if one is held, goes back to the challenger."],
  },
  execute: {
    group: "review",
    summary: "Pays an approved request once its waiting time is over.",
    who: "Anyone.",
    roles: ["anyone"],
    params: { request_id: "The request." },
    effects: [
      "Every limit is checked again, because the owner may have tightened them since the approval: the per-payment cap, the allowlist, the seat, the rolling window and the 48-payment bound.",
      "On success the payee receives the amount and the request ends as EXECUTED.",
    ],
    notes: ["The call must come after ready_at and before ready_at plus the payment grace."],
  },
  expire_request: {
    group: "review",
    summary: "Closes a request that ran out of time, or whose mandate or seat is gone.",
    who: "Anyone.",
    roles: ["anyone"],
    params: { request_id: "The request." },
    effects: ["The reserved money is released and a challenger's bond goes back. The request ends as EXPIRED."],
    notes: ["A pending or escalated request is stale after its decide-by time. An approved or challenged one is stale after ready_at plus the payment grace. An ended mandate or a revoked seat makes every open request stale."],
  },
  challenge: {
    group: "challenge",
    summary: "Bets a bond that an AI approval was a mistake.",
    who: "Anyone except the agent, the owner and the guardian.",
    roles: ["watcher"],
    params: {
      request_id: "The request.",
      reason: "Why the approval is wrong, at least 12 characters. The auditor treats it as a lead, never as a fact.",
    },
    effects: [
      "The call must carry exactly the bond: 5% of the payment, and at least 0.001 GEN.",
      "The request moves to CHALLENGED and freezes until the audit ends.",
    ],
    notes: ["Only an approval given by the AI can be challenged, only once, and only while it is still in its waiting time."],
  },
  audit: {
    group: "challenge",
    summary: "Runs the stricter second review of a challenged approval.",
    who: "Anyone.",
    roles: ["anyone"],
    params: { request_id: "The request." },
    effects: [
      "Upheld (the audit does not approve): the request is VETOED and the watcher gets the bond back plus up to 10% of the payment. The reward is charged to the seat and to the rolling window and is cut to what both still allow.",
      "Dismissed (the audit approves): the bond goes to the mandate and the request is APPROVED again. It cannot be challenged a second time.",
      "Unreadable three times: the bond goes back and a human decides (the request is ESCALATED).",
    ],
    notes: ["The audit approves only up to two thirds of the owner's auto risk limit, and it can take several minutes like a review."],
  },
  stats: {
    group: "views",
    summary: "Totals for the whole contract.",
    who: "Anyone.",
    roles: ["anyone"],
    params: {},
    effects: ["Counts of mandates, requests, executed, rejected and vetoed requests, upheld and dismissed challenges, reviews, and the money totals."],
    returns: "JSON text. See the views and data page for the fields.",
  },
  solvency: {
    group: "views",
    summary: "The books of the whole contract.",
    who: "Anyone.",
    roles: ["anyone"],
    params: {},
    effects: ["Reports deposited, paid, bonds, held and reserved, and balanced: true when deposited minus paid equals held plus bonds."],
    returns: "JSON text.",
  },
  get_mandate: {
    group: "views",
    summary: "One mandate with its settings, balances, seats and payees.",
    who: "Anyone.",
    roles: ["anyone"],
    params: { mandate_id: "The mandate." },
    effects: ["Fails with No such mandate. when the id does not exist."],
    returns: "JSON text with one mandate row.",
  },
  list_mandates: {
    group: "views",
    summary: "All mandates, newest first.",
    who: "Anyone.",
    roles: ["anyone"],
    params: {
      offset: "How many of the newest mandates to skip.",
      limit: "How many to return. At most 50.",
    },
    effects: ["Pages through every mandate in the contract."],
    returns: "JSON text with an array of mandate rows.",
  },
  mandates_of: {
    group: "views",
    summary: "The mandates an address owns, guards or holds a seat in, newest first.",
    who: "Anyone.",
    roles: ["anyone"],
    params: {
      who: "The address to look up.",
      offset: "How many to skip.",
      limit: "How many to return. At most 50.",
    },
    effects: ["An address with no mandates gets an empty array."],
    returns: "JSON text with an array of mandate rows.",
  },
  get_request: {
    group: "views",
    summary: "One request with its review, audit and challenge details.",
    who: "Anyone.",
    roles: ["anyone"],
    params: { request_id: "The request." },
    effects: ["Fails with No such request. when the id does not exist."],
    returns: "JSON text with one request row.",
  },
  list_requests: {
    group: "views",
    summary: "The requests of one mandate, newest first.",
    who: "Anyone.",
    roles: ["anyone"],
    params: {
      mandate_id: "The mandate.",
      offset: "How many of the newest requests to skip.",
      limit: "How many to return. At most 50.",
    },
    effects: ["Pages through one mandate's requests."],
    returns: "JSON text with an array of request rows.",
  },
  allowance_of: {
    group: "views",
    summary: "What a seat could ask for right now, and the limits that bind it.",
    who: "Anyone.",
    roles: ["anyone"],
    params: {
      mandate_id: "The mandate.",
      who: "The address to check. An address without a seat gets seat: false and zeros.",
    },
    effects: ["Combines the per-payment cap, the seat's remaining budget, the unreserved balance, the rolling window and the open-request slots into max_request."],
    returns: "JSON text with one allowance object.",
  },
};

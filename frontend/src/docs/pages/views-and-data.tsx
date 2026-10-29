import { Link } from "react-router-dom";
import { H2, H3, Lead, Note, MethodLink } from "../kit";
import { CodeBlock } from "../../components/ui";

const MANDATE = `{
  "id": 0, "owner": "0x…", "guardian": "", "name": "Ops budget", "policy": "…", "policy_rev": 1,
  "created": 1767225600, "expires_at": 0, "paused": false, "ended": false,
  "payee_mode": 0, "need_evidence": false,
  "per_payment_cap": "100000000000000000", "window_cap": "500000000000000000", "window_secs": 86400,
  "window_used": "0", "window_entries": 0,
  "review_delay": 3600, "escalation_window": 259200, "exec_grace": 259200,
  "auto_risk": 35, "reject_risk": 75,
  "balance": "0", "reserved": "0", "free": "0",
  "deposited": "0", "withdrawn": "0", "paid": "0", "rewards": "0", "forfeited": "0",
  "delegates": [{ "who": "0x…", "active": true, "budget": "…", "spent": "…", "held": "…", "left": "…", "open": 0, "requested": 0, "executed": 0, "rejected": 0, "vetoed": 0 }],
  "payees": ["0x…"], "requests": 0
}`;

const REQUEST = `{
  "id": 0, "mandate": 0, "delegate": "0x…", "payee": "0x…", "amount": "…",
  "purpose": "…", "url": "", "state": 1, "decided_by": 1,
  "created": 0, "ready_at": 0, "decide_by": 0, "executed_at": 0, "closed_at": 0,
  "tries": 0, "risk": 20, "policy_rev": 1,
  "review": { "at": 0, "verdict": "APPROVE", "risk": 20, "flags": [], "reason": "…", "hash": "", "rev": 1 },
  "audit": null,
  "challenged": false, "challenger": "", "bond": "0", "bond_state": 0, "claim": "", "note": "…"
}`;

export default function Page() {
  return (
    <>
      <Lead>Views return JSON text. Parse it, and keep amounts as strings or BigInt: they can exceed what a JavaScript number holds exactly.</Lead>

      <H2 id="reading">Reading with genlayer-js</H2>
      <CodeBlock
        lang="ts"
        code={`import { createClient, chains } from "genlayer-js";

const client = createClient({ chain: chains.studionet });
const read = async (functionName: string, args: unknown[] = []) =>
  JSON.parse(await client.readContract({ address: LEASH_ADDRESS, functionName, args }));

const mandate = await read("get_mandate", [0]);
const free = BigInt(mandate.free);`}
      />
      <Note title="Lists are newest first">
        <code>list_mandates</code>, <code>mandates_of</code> and <code>list_requests</code> start from the newest entry. <code>offset</code> skips that many entries and <code>limit</code> is capped at 50.
      </Note>

      <H2 id="mandate-row">A mandate row</H2>
      <p>Returned by <MethodLink name="get_mandate" />, <MethodLink name="list_mandates" /> and <MethodLink name="mandates_of" />.</p>
      <CodeBlock lang="json" code={MANDATE} />
      <ul>
        <li><code>guardian</code> is an empty string when there is none. <code>expires_at</code> is 0 when the mandate never ends.</li>
        <li><code>ended</code> is true when the expiry has passed; <code>paused</code> and <code>ended</code> both stop new activity.</li>
        <li><code>window_used</code> and <code>window_entries</code> describe the rolling window right now, so they change with time even when nothing is written.</li>
        <li><code>free</code> is <code>balance - reserved</code>. <code>rewards</code> and <code>forfeited</code> are what challenges paid out and brought in.</li>
      </ul>

      <H2 id="request-row">A request row</H2>
      <p>Returned by <MethodLink name="get_request" /> and <MethodLink name="list_requests" />.</p>
      <CodeBlock lang="json" code={REQUEST} />
      <ul>
        <li><code>state</code> is 0 to 8 (see <Link to="/docs/request-lifecycle">the life of a request</Link>); <code>decided_by</code> is 0 to 3.</li>
        <li><code>ready_at</code> is when an approval can be paid; <code>decide_by</code> is the deadline for a review or a decision.</li>
        <li><code>bond_state</code>: 0 none, 1 held, 2 refunded, 3 forfeited, 4 rewarded.</li>
        <li><code>review</code> and <code>audit</code> are null until they exist. An audit carries <code>upheld</code> and <code>reward</code>, or <code>inconclusive</code> when the evidence could not be read.</li>
      </ul>

      <H2 id="allowance">The allowance</H2>
      <p><MethodLink name="allowance_of" /> answers what a seat could ask for right now.</p>
      <CodeBlock
        lang="json"
        code={`{ "seat": true, "usable": true, "per_payment": "…", "seat_left": "…", "unreserved": "…", "window_left": "…", "open_slots": 3, "max_request": "…" }`}
      />
      <p><code>max_request</code> is the smallest of the per-payment cap, the seat's remaining budget and the free funds, or 0 when the mandate is not usable or no slot is open.</p>

      <H3 id="stats">stats and solvency</H3>
      <CodeBlock
        lang="json"
        code={`// stats
{ "mandates": 0, "requests": 0, "executed": 0, "rejected": 0, "vetoed": 0, "challenges_upheld": 0,
  "challenges_dismissed": 0, "reviews": 0, "volume": "0", "deposited": "0", "paid": "0", "bonds": "0" }

// solvency
{ "deposited": "0", "paid": "0", "bonds": "0", "held": "0", "reserved": "0", "balanced": true }`}
      />
    </>
  );
}

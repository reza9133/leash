import { H2, Lead } from "../kit";

const TERMS: [string, string][] = [
  ["Agent", "An account that holds a seat and files payment requests. Also called a delegate in the contract."],
  ["Allowance", "What a seat could ask for right now: the smallest of the per-payment cap, its remaining budget and the free funds."],
  ["Approval", "A request cleared by the AI, the owner or the guardian. The amount is reserved."],
  ["Audit", "A stricter second review of a challenged approval."],
  ["Balance", "The GEN a mandate holds, reserved or not."],
  ["Bond", "Money a watcher sends with a challenge: 5% of the payment, at least 0.001 GEN."],
  ["Challenge", "A bet by a watcher that an AI approval was a mistake."],
  ["Decided by", "Who cleared a request: none, the AI, the owner or the guardian."],
  ["Escalation", "A request the AI could not settle; a human decides."],
  ["Evidence", "A public link to a page that backs a payment."],
  ["Execute", "Pay an approved request after its waiting time."],
  ["Free funds", "Balance minus reserved."],
  ["Grace time", "How long an approval stays payable after it is ready."],
  ["Guardian", "An optional second key that can pause, veto, revoke seats and decide."],
  ["Mandate", "A funded budget with a written policy, hard limits and seats."],
  ["Payee", "The address a request pays."],
  ["Policy", "The plain-words rule the AI reads for every request."],
  ["Ready time", "When an AI approval can first be paid."],
  ["Reserved", "Money promised to approved requests; it cannot be withdrawn."],
  ["Review", "The AI's reading of a request against the policy."],
  ["Review delay", "The waiting time of an AI approval; the time to veto or challenge."],
  ["Risk", "The reviewer's estimate from 0 to 100 that approving would be a mistake."],
  ["Rolling window", "The last stretch of time over which payments are added up against the window cap."],
  ["Seat", "A budget granted to an agent."],
  ["Veto", "A human stops an approved request before it is paid."],
  ["Watcher", "Anyone who is not the owner, the guardian or the agent of a request."],
  ["Wei", "The smallest unit of GEN: 10^-18."],
];

export default function Page() {
  return (
    <>
      <Lead>The words this project uses.</Lead>
      <dl className="docs-dl">
        {TERMS.map(([t, d]) => (
          <div key={t} id={t.toLowerCase().replace(/\s+/g, "-")}>
            <dt><strong>{t}</strong></dt>
            <dd>{d}</dd>
          </div>
        ))}
      </dl>
      <H2 id="states">States</H2>
      <p>0 Pending, 1 Approved, 2 Escalated, 3 Rejected, 4 Executed, 5 Vetoed, 6 Cancelled, 7 Expired, 8 Challenged.</p>
    </>
  );
}

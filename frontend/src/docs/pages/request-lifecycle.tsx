import { H2, Lead, Note, DocTable, MethodLink, StateLink } from "../kit";
import { LifecycleExplorer } from "../../components/Lifecycle";


export default function Page() {
  return (
    <>
      <Lead>A request is always in exactly one of nine states. Five are final. This page lists each state, how it is reached and what can happen next.</Lead>

      <LifecycleExplorer />

      <H2 id="states">The states</H2>
      <DocTable>
        <thead>
          <tr><th>State</th><th>Meaning</th><th>Next</th></tr>
        </thead>
        <tbody>
          <tr id="pending"><td><StateLink state="PENDING" /></td><td>Filed; every hard limit passed; waiting for the AI review.</td><td><MethodLink name="review" />, <MethodLink name="cancel_request" />, <MethodLink name="expire_request" /></td></tr>
          <tr id="approved"><td><StateLink state="APPROVED" /></td><td>Cleared by the AI, the owner or the guardian. The amount is reserved.</td><td><MethodLink name="execute" />, <MethodLink name="veto" />, <MethodLink name="challenge" />, <MethodLink name="cancel_request" />, <MethodLink name="expire_request" /></td></tr>
          <tr id="escalated"><td><StateLink state="ESCALATED" /></td><td>The AI was not sure; a human decides before the deadline.</td><td><MethodLink name="decide" />, <MethodLink name="cancel_request" />, <MethodLink name="expire_request" /></td></tr>
          <tr id="challenged"><td><StateLink state="CHALLENGED" /></td><td>A watcher posted a bond against an AI approval. The money stays reserved.</td><td><MethodLink name="audit" />, <MethodLink name="veto" />, <MethodLink name="expire_request" /></td></tr>
          <tr id="rejected"><td><StateLink state="REJECTED" /></td><td>Final. Refused by the review or by a human.</td><td>None</td></tr>
          <tr id="executed"><td><StateLink state="EXECUTED" /></td><td>Final. The payee was paid.</td><td>None</td></tr>
          <tr id="vetoed"><td><StateLink state="VETOED" /></td><td>Final. Stopped after approval, by a human or by an upheld challenge.</td><td>None</td></tr>
          <tr id="cancelled"><td><StateLink state="CANCELLED" /></td><td>Final. Withdrawn by the agent.</td><td>None</td></tr>
          <tr id="expired"><td><StateLink state="EXPIRED" /></td><td>Final. Nobody acted in time, or the mandate or the seat ended.</td><td>None</td></tr>
        </tbody>
      </DocTable>

      <H2 id="decided-by">Who cleared it</H2>
      <p>
        Every request carries <code>decided_by</code>: 0 none, 1 the AI, 2 the owner, 3 the guardian. It matters because only an approval given by the AI can be challenged,
        and only an AI approval has to wait for the review delay. A human approval can be paid at once.
      </p>

      <H2 id="clocks">The clocks</H2>
      <ul>
        <li><strong>Escalation window.</strong> A request that is pending or escalated must be reviewed or decided before <code>decide_by</code>. After that anyone can expire it.</li>
        <li><strong>Review delay.</strong> An AI approval can be paid only after <code>ready_at</code>. This is the time to veto or challenge.</li>
        <li><strong>Grace time.</strong> An approval is payable until <code>ready_at</code> plus the grace time, then it expires.</li>
        <li><strong>Retry gap.</strong> If the evidence page cannot be read the review or audit may be repeated after two minutes, up to three tries; then the request goes to a human.</li>
      </ul>

      <Note title="Everything is checked twice">
        Limits are checked when the request is filed and again when it is paid, so tightening the rules protects requests that were approved earlier.
      </Note>
    </>
  );
}

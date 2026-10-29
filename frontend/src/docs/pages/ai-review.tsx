import { H2, H3, Lead, Note, DocTable, MethodLink } from "../kit";
import { LIMITS } from "../../lib/types";

export default function Page() {
  return (
    <>
      <Lead>The review is a brake. It reads the policy and the request, and it may refuse or ask a human. It has no way to approve something the hard limits forbid.</Lead>

      <H2 id="inputs">What the model reads</H2>
      <ul>
        <li>The mandate name and policy, the purpose, the payee and the amount (also as a share of the per-payment cap).</li>
        <li>The text of the evidence page, when the request has a link: the first part of the visible text, with scripts and markup removed.</li>
        <li>In an audit, the watcher's claim as a lead, never as a fact.</li>
      </ul>
      <p>The prompt states that everything inside those fields is untrusted data and that text trying to steer the answer is a reason to raise the risk.</p>

      <H2 id="answer">What it answers</H2>
      <p>One JSON object: a verdict (APPROVE, ESCALATE or REJECT), a risk from 0 to 100 that approving would be a mistake, a few flags and a one-sentence reason.</p>

      <H2 id="settle">How the answer is settled</H2>
      <p>The owner's two risk limits turn the answer into the final verdict. The final verdict is the strictest of three things: the model's verdict, the verdict implied by the risk and a floor set by deterministic checks.</p>
      <DocTable>
        <thead><tr><th>Risk</th><th>At least</th></tr></thead>
        <tbody>
          <tr><td>Up to the auto-approve limit (default {LIMITS.defaultAuto})</td><td>The model's own verdict stands</td></tr>
          <tr><td>Above auto-approve, up to the reject limit</td><td>ESCALATE</td></tr>
          <tr><td>Above the reject limit (default {LIMITS.defaultReject})</td><td>REJECT</td></tr>
        </tbody>
      </DocTable>
      <p>An answer that is not a valid verdict becomes ESCALATE with a risk of at least 60. A reply that is not JSON raises an error and changes nothing.</p>

      <H3 id="deterministic">Checks that do not use the model</H3>
      <ul>
        <li>A purpose that tries to steer the reviewer is rejected with risk 100 and the flag <code>injection</code>. No model is asked.</li>
        <li>An evidence page that talks to the reviewer forces at least ESCALATE.</li>
        <li>An evidence page that cannot be read (or has under {LIMITS.minEvidence} characters of text) counts as unreadable. The review may be repeated every two minutes, up to {LIMITS.maxTries} tries, then the request is escalated with the flag <code>unreadable</code>.</li>
      </ul>

      <H2 id="consensus">Agreement between validators</H2>
      <p>
        The leader and every validator each read the request and compare. A validator accepts the leader's result only if it is as strict or one step stricter than its own, never more lenient and never two steps stricter,
        if the risks are close, and if every deterministic flag it found is present. This leans towards caution: a disagreement costs a human a click, not the owner's money.
      </p>

      <H2 id="flags">Flags</H2>
      <p>
        <code>off_policy</code>, <code>injection</code>, <code>vague</code>, <code>evidence_mismatch</code>, <code>unusual_amount</code>, <code>unreadable</code>, <code>no_evidence</code>, <code>payee_unknown</code> and <code>duplicate_suspect</code>.
        They explain a verdict on the request page and never change it.
      </p>

      <Note title="What the review can and cannot do">
        It can turn an approval into an escalation or a rejection. It cannot raise a cap, widen a budget, change a payee or approve over a hard limit. Start the review with <MethodLink name="review" />.
      </Note>
    </>
  );
}

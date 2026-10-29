import { Link } from "react-router-dom";
import { H2, Lead, Note, MethodLink } from "../kit";

export default function Page() {
  return (
    <>
      <Lead>Set a mandate up so that the worst case is acceptable, fund it with what you can afford to lose, and keep an eye on the inbox.</Lead>

      <H2 id="policy">Write a policy the AI can apply</H2>
      <ul>
        <li>Say what the money is for and what it is not for. “Pay for cloud hosting and domain renewals of the Atlas project. No payments to individuals.”</li>
        <li>Name the evidence you expect: an invoice link, a ticket, a public page.</li>
        <li>Keep it under 1,200 characters. A short, concrete policy gets a more reliable review than a long vague one.</li>
        <li>Changing it with <MethodLink name="set_policy" /> affects reviews that have not run yet. It does not undo approvals already given; veto them if needed.</li>
      </ul>

      <H2 id="limits">Choose the limits first</H2>
      <p>
        Decide the largest payment you can live with (per-payment cap), the most you can lose in a day or a week (window cap and length), and a seat budget for each agent.
        These are the guarantees; the policy only narrows them.
      </p>
      <ul>
        <li><strong>Review delay</strong> is your reaction time. Pick one you can actually keep up with, from minutes to 7 days.</li>
        <li><strong>Payee mode.</strong> Use the allowlist (mode 1) whenever the set of recipients is known. It removes a whole class of mistakes.</li>
        <li><strong>Risk limits.</strong> Lower the auto-approve limit to send more requests to a human; the defaults are 35 and 75.</li>
        <li><strong>Evidence.</strong> Require it when payments are backed by invoices or tickets.</li>
        <li><strong>Expiry</strong> makes a temporary budget stop by itself.</li>
      </ul>

      <H2 id="fund">Fund and withdraw</H2>
      <p>
        Anyone can add money with <MethodLink name="fund" />. You can take out the free part at any time with <MethodLink name="withdraw" />; money reserved for approved requests stays until they end.
      </p>

      <H2 id="agents">Give seats</H2>
      <p>
        Grant a seat per agent with its own total budget (<MethodLink name="grant_delegate" />). Revoke with <MethodLink name="revoke_delegate" /> if an agent misbehaves.
        An agent cannot be the owner or the guardian.
      </p>

      <H2 id="guardian">Add a guardian</H2>
      <p>A guardian is a second key for quick brakes: pause, veto, revoke and decide. It cannot resume, change limits or withdraw. Set one with <MethodLink name="set_guardian" />.</p>

      <H2 id="supervise">Supervise</H2>
      <ul>
        <li>Open <Link to="/app">the dashboard</Link>. The inbox lists requests that wait for your decision or are inside their waiting time.</li>
        <li>For an AI approval you disagree with, press <em>Veto</em> before the ready time (<MethodLink name="veto" />).</li>
        <li>For an escalation, press <em>Approve</em> or <em>Reject</em> (<MethodLink name="decide" />). Your approval can be paid immediately.</li>
        <li>In an emergency, <MethodLink name="set_paused" /> stops everything new while you investigate.</li>
      </ul>

      <Note tone="tip" title="Watchers work for you">
        A challenge costs the watcher a bond and, when it is right, costs the mandate 10% of the payment and saves the payment. Mandates with obvious policies are easy to audit.
      </Note>
    </>
  );
}

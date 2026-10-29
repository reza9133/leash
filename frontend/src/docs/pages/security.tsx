import { H2, Lead, Note, DocTable } from "../kit";

export default function Page() {
  return (
    <>
      <Lead>What is guaranteed by code, what is left to the AI and the humans, and what Leash does not cover.</Lead>

      <H2 id="guarantees">Guaranteed by code</H2>
      <p>These hold whatever the model says and whatever an agent writes:</p>
      <ul>
        <li>No payment above the per-payment cap, above the seat budget, or that would push the rolling window above its cap.</li>
        <li>No payment to an unlisted payee in allowlist mode, no payment from a revoked seat, none from a paused or expired mandate.</li>
        <li>Limits are checked again at payment time, so tightening them also protects approvals already given.</li>
        <li>The model can only move a request towards refusal. It cannot approve over a limit.</li>
        <li>Only the owner changes rules and withdraws; the guardian can only brake.</li>
        <li>The books balance: every wei paid in is paid out, held by a mandate or held as a bond.</li>
        <li>A request closes into exactly one final state, and reserved money is released when it does.</li>
      </ul>

      <H2 id="ai">Left to the AI, with backups</H2>
      <p>Whether a purpose fits the policy is a judgement. The model can be fooled into approving something that fits the limits but not the intent. The backups are the review delay, the owner's veto, the watchers' challenge, and the strict audit.</p>
      <ul>
        <li>Text that talks to the reviewer is a reason to refuse. A deterministic check catches the obvious phrasings; it is best effort.</li>
        <li>The evidence page is untrusted data. An unreadable page is never approved by default.</li>
        <li>Validators accept a result only if it is as strict or slightly stricter than their own.</li>
      </ul>

      <H2 id="threats">Threats and answers</H2>
      <DocTable>
        <thead><tr><th>Threat</th><th>Answer</th></tr></thead>
        <tbody>
          <tr><td>An agent argues its way past the reviewer</td><td>Hard limits cap the damage; veto and challenge cover the delay</td></tr>
          <tr><td>An agent reuses one invoice many times</td><td>One live request per evidence page per mandate, with addresses normalised</td></tr>
          <tr><td>An agent and a friend farm challenge rewards</td><td>Rewards count as seat spending and rolling-window spending and are capped</td></tr>
          <tr><td>A stolen guardian key</td><td>It can pause, veto and revoke, which only stop things; it cannot resume, reconfigure or withdraw</td></tr>
          <tr><td>The owner tightens a limit after approving</td><td>The payment is checked again and refused if it no longer fits</td></tr>
          <tr><td>An unreadable evidence page</td><td>Retries, then a human decides</td></tr>
          <tr><td>The model returns garbage</td><td>The call fails and nothing is stored</td></tr>
        </tbody>
      </DocTable>

      <H2 id="not-covered">Not covered</H2>
      <ul>
        <li>A compromised owner key. The owner can do everything the owner is allowed to do.</li>
        <li>A policy that is wrong. If you write “pay anything”, the AI will not argue.</li>
        <li>An honest request that is wise to refuse but fits your own policy and limits.</li>
        <li>The network. Leash runs on a testnet; its tokens have no value and the platform may be reset.</li>
        <li>This frontend. It is a convenience, not part of the guarantees; the contract is.</li>
      </ul>

      <Note tone="warn" title="Not audited">
        The contract has been tested extensively but has not had an independent audit. Do not put funds you cannot lose into it.
      </Note>
    </>
  );
}

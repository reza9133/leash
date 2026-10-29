import { H2, Lead, Note, DocTable, MethodLink } from "../kit";
import { LIMITS } from "../../lib/types";

export default function Page() {
  return (
    <>
      <Lead>A mandate is a funded budget with written rules. Four kinds of account interact with it, and each can do a different, small set of things.</Lead>

      <H2 id="mandate">What a mandate holds</H2>
      <ul>
        <li><strong>A balance</strong> of GEN, funded by anyone through <MethodLink name="fund" /> or at creation.</li>
        <li><strong>A policy</strong>, 20 to 1,200 characters of plain words that the AI reads. Each change raises a revision number.</li>
        <li><strong>Hard limits:</strong> a per-payment cap, a window cap over a rolling window, and the review delay.</li>
        <li><strong>Rules:</strong> payee mode (any, or listed only), whether evidence is required, the two risk limits, the escalation window, the payment grace time and an optional expiry.</li>
        <li><strong>Seats</strong> for agents (up to {LIMITS.maxDelegates} ever granted), and a payee list (up to {LIMITS.maxPayees}).</li>
        <li><strong>An optional guardian</strong>, a second key with a short list of safety powers.</li>
      </ul>

      <H2 id="roles">Who may do what</H2>
      <DocTable>
        <thead>
          <tr><th>Role</th><th>Can</th><th>Cannot</th></tr>
        </thead>
        <tbody>
          <tr><td>Owner</td><td>Configure everything, fund, withdraw unreserved money, grant and revoke seats, decide escalations, veto, pause and resume</td><td>Be a seat holder or the guardian</td></tr>
          <tr><td>Guardian</td><td>Veto, decide escalations, revoke seats, pause</td><td>Resume, configure, withdraw or hold a seat</td></tr>
          <tr><td>Agent (seat holder)</td><td>File requests and withdraw its own requests</td><td>Challenge its own request, pay itself, review or decide</td></tr>
          <tr><td>Watcher (anyone else)</td><td>Challenge an AI approval with a bond; run reviews, audits, payments and expirations</td><td>Challenge as agent, owner or guardian</td></tr>
        </tbody>
      </DocTable>
      <Note title="Why the guardian cannot resume">
        A guardian is a brake you can hand to a monitoring script or a colleague. It can stop things but cannot start a paused mandate again, change a limit or withdraw money. Like the owner it can approve an escalated request, which is still bounded by every hard limit.
      </Note>

      <H2 id="seats">Seats</H2>
      <p>
        A seat has a total budget. What a seat has spent and what is reserved for its approved requests both count against it.
        Granting again to the same address replaces the budget and brings a revoked seat back; spent money still counts. Revoking a seat does not
        delete it, so it still uses one of the {LIMITS.maxDelegates} slots. Requests of a revoked seat can no longer be paid and are closed by expiry.
        A seat can have {LIMITS.maxOpen} open requests at a time.
      </p>

      <H2 id="payees">Payees</H2>
      <p>
        In payee mode 0 any address can be paid and the AI judges the payee against the policy. In mode 1 only listed payees can be paid, checked
        when the request is filed and again when it is paid, so removing a payee stops payments that were already approved.
      </p>

      <H2 id="pause">Pause, expiry and the end of a mandate</H2>
      <p>
        While a mandate is paused or after its expiry nothing new is accepted and nothing is paid. Open requests can still be closed, vetoed and
        expired, and the owner can withdraw whatever is not reserved. Changing the rules with <MethodLink name="set_rules" /> restarts the expiry clock.
      </p>
    </>
  );
}

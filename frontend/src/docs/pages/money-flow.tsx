import { H2, Lead, Note, DocTable, MethodLink } from "../kit";
import { CodeBlock } from "../../components/ui";

export default function Page() {
  return (
    <>
      <Lead>Every wei the contract holds is accounted for. This page shows where money sits at each step and the one equation that must always hold.</Lead>

      <H2 id="words">The words</H2>
      <ul>
        <li><strong>Balance</strong> is what a mandate holds. <strong>Reserved</strong> is the part promised to approved requests. <strong>Free</strong> is balance minus reserved.</li>
        <li>A <strong>seat</strong> tracks its own <code>budget</code>, <code>spent</code> and <code>held</code>. What it may still ask for is <code>budget - spent - held</code>.</li>
        <li>A <strong>bond</strong> is money a watcher sends with a challenge. The contract holds it apart from every mandate.</li>
      </ul>

      <H2 id="moments">Moment by moment</H2>
      <DocTable>
        <thead>
          <tr><th>Moment</th><th>Mandate balance</th><th>Reserved</th><th>Elsewhere</th></tr>
        </thead>
        <tbody>
          <tr><td>Deposit or fund</td><td>+ amount</td><td></td><td></td></tr>
          <tr><td>Approval</td><td></td><td>+ amount</td><td>Seat held + amount</td></tr>
          <tr><td>Veto, cancel, expiry</td><td></td><td>- amount</td><td>Seat held - amount; a held bond goes back</td></tr>
          <tr><td>Execute</td><td>- amount</td><td>- amount</td><td>Payee + amount; seat spent + amount; window + amount</td></tr>
          <tr><td>Challenge</td><td></td><td></td><td>Bond held by the contract</td></tr>
          <tr><td>Audit upheld</td><td>- reward</td><td>- amount</td><td>Watcher gets bond + reward; seat spent + reward; window + reward</td></tr>
          <tr><td>Audit dismissed</td><td>+ bond</td><td></td><td>Bond becomes the mandate's money</td></tr>
          <tr><td>Withdraw</td><td>- amount</td><td></td><td>Owner + amount; only free money</td></tr>
        </tbody>
      </DocTable>

      <H2 id="bond-reward">Bond and reward</H2>
      <p>
        The bond is 5% of the payment and at least 0.001 GEN. If the audit upholds the challenge the watcher receives the bond back plus a reward of 10% of the payment.
        The reward is money that leaves the mandate, so it counts as spending of the seat and inside the rolling window, and it is cut down to what both still allow.
        This stops an agent and a friend from farming rewards past the owner's limits. If the audit dismisses the challenge the bond becomes the mandate's money.
      </p>

      <H2 id="books">The books</H2>
      <p><MethodLink name="solvency" /> checks the whole contract:</p>
      <CodeBlock lang="text" code={`deposited - paid  =  held by mandates + bonds held
reserved          <=  held by mandates`} />
      <p>
        <code>deposited</code> is every wei ever paid in (funds and bonds). <code>paid</code> is every wei ever paid out (payments, withdrawals, bonds returned and rewards).
        The Explorer page shows this equation live; <code>balanced</code> must always be true.
      </p>
      <Note tone="warn" title="Payments are final">
        Once <MethodLink name="execute" /> succeeds the payee holds the money. Use the review delay, the veto and a tight per-payment cap as the safety margin.
      </Note>
    </>
  );
}

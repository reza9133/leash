import { H2, Lead, Note, Steps, MethodLink, DocTable } from "../kit";

export default function Page() {
  return (
    <>
      <Lead>Anyone can bet money that an AI approval was a mistake. A stricter audit settles the bet, and the loser pays.</Lead>

      <H2 id="who">Who can challenge</H2>
      <p>
        Any account except the agent who filed the request, the owner and the guardian (they have cancel, veto and decide). The request must be APPROVED by the AI, still inside its review delay, and never challenged before.
      </p>

      <H2 id="bond">The bond</H2>
      <p>The bond is exactly 5% of the payment, at least 0.001 GEN, sent with the call. You must also give a reason of 12 to 300 characters. The reason is a lead for the auditor and is shown on the request page.</p>

      <H2 id="steps">What happens</H2>
      <Steps>
        <li><MethodLink name="challenge" /> moves the request to CHALLENGED. The money stays reserved and the payment cannot be made.</li>
        <li>Anyone calls <MethodLink name="audit" />. The auditor is stricter: it approves only up to two thirds of the owner's auto-approve risk limit, and it looks for reasons the approval may be wrong.</li>
        <li>If the audit does not approve, the challenge is <strong>upheld</strong>: the request is VETOED, the watcher gets the bond back plus a reward of 10% of the payment (cut down to what the seat budget and the window still allow).</li>
        <li>If the audit approves, the challenge is <strong>dismissed</strong>: the request returns to APPROVED with the same ready time and the bond goes to the mandate.</li>
        <li>If the evidence stays unreadable for three tries, nobody is blamed: the bond is returned and a human decides.</li>
      </Steps>

      <H2 id="outcomes">Outcomes</H2>
      <DocTable>
        <thead><tr><th>Audit result</th><th>Request</th><th>Bond</th></tr></thead>
        <tbody>
          <tr><td>Upheld</td><td>VETOED</td><td>Returned with a reward</td></tr>
          <tr><td>Dismissed</td><td>APPROVED again</td><td>Forfeited to the mandate</td></tr>
          <tr><td>Unreadable three times</td><td>ESCALATED</td><td>Refunded</td></tr>
          <tr><td>Owner or guardian vetoes meanwhile</td><td>VETOED</td><td>Refunded</td></tr>
        </tbody>
      </DocTable>

      <Note tone="tip" title="Watching is cheap">
        A challenge needs only a bond and a clear reason. If you are right you are paid; if you are wrong you lose a small amount. Pick approvals whose purpose or evidence you can really check.
      </Note>
    </>
  );
}

import { H2, Lead, Note, MethodLink } from "../kit";

export default function Page() {
  return (
    <>
      <Lead>A watcher is anyone who is not the owner, the guardian or the agent. Your job is to catch approvals that should not have been given, and to be paid when you are right.</Lead>

      <H2 id="find">Find a candidate</H2>
      <p>Open the Explorer or a mandate and look at requests in the APPROVED state that were approved by the AI. Only those can be challenged, and only until their ready time. Good candidates are:</p>
      <ul>
        <li>A purpose that is vague or does not match the policy.</li>
        <li>Evidence that does not support the payment, or no evidence in a mandate that normally has some.</li>
        <li>An amount that is unusual for the stated purpose.</li>
        <li>A payee you can show is not who the purpose says.</li>
      </ul>

      <H2 id="challenge">Challenge</H2>
      <p>
        On the request page press <em>Challenge</em>, write at least 12 characters explaining what is wrong, and confirm the exact bond (5% of the payment, at least 0.001 GEN). This calls <MethodLink name="challenge" />.
        The payment is frozen at once.
      </p>

      <H2 id="audit">Run the audit</H2>
      <p>Anyone can call <MethodLink name="audit" />, so you can run it yourself. The auditor is stricter than the first review. If it does not approve, you receive your bond and 10% of the payment. If it approves, the bond goes to the mandate.</p>

      <H2 id="risk">The risk</H2>
      <ul>
        <li>You lose the bond if the audit approves. Keep to cases you can explain.</li>
        <li>The reward is limited by what the seat budget and the rolling window still allow, and can be zero.</li>
        <li>If the evidence page cannot be read three times, the bond is returned and a human decides.</li>
      </ul>

      <Note title="Your claim is a lead, not a fact">
        The auditor reads your reason but treats it as untrusted text. A reason that tries to give orders to the auditor is ignored.
      </Note>
    </>
  );
}

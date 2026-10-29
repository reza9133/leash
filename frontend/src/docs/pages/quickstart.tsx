import { Link } from "react-router-dom";
import { H2, Lead, Note, Steps, MethodLink } from "../kit";
import { CHAIN } from "../../config";

export default function Page() {
  return (
    <>
      <Lead>
        You need two accounts to see the whole flow: one for the owner and one for the agent. Ten minutes is enough.
      </Lead>

      <H2 id="before">Before you start</H2>
      <ul>
        <li>A browser wallet that speaks EIP-1193 (any wallet that shows up in the connect list).</li>
        <li>Two accounts in it, and a little GEN on {CHAIN.name} in each. Gas is not needed for reads.</li>
        <li>Switch the wallet to {CHAIN.name}. The app tells you when the network is wrong and can switch it for you; see <Link to="/docs/wallet-network">wallet and network</Link>.</li>
      </ul>

      <H2 id="steps">Walk through it</H2>
      <Steps>
        <li>
          <strong>Connect the owner account.</strong> Use the connect button in the header and pick your wallet.
        </li>
        <li>
          <strong>Create a mandate.</strong> Open <Link to="/app/new">New mandate</Link>. Give it a name, write the policy in plain words
          (20 to 1,200 characters), set the per-payment cap, the window cap and window length, and the review delay. Add GEN to
          fund it in the same step. This calls <MethodLink name="create_mandate" />.
        </li>
        <li>
          <strong>Give the agent a seat.</strong> On the mandate page open <em>Seats and payees</em>, paste the agent's address and a budget
          (<MethodLink name="grant_delegate" />). Optionally list payees and switch the mandate to allowlist mode in <em>Manage</em>.
        </li>
        <li>
          <strong>Switch to the agent account and file a request.</strong> On the <em>Requests</em> tab choose a payee, an amount and a purpose
          (<MethodLink name="request_payment" />). The form shows the maximum you may ask for right now.
        </li>
        <li>
          <strong>Ask for the review.</strong> Open the request and press <em>Run the AI review</em> (<MethodLink name="review" />). Validators read the policy and
          the evidence; this takes longer than a normal transaction.
        </li>
        <li>
          <strong>Wait or intervene.</strong> An approval waits for the review delay. The owner can veto it
          (<MethodLink name="veto" />); a third account can challenge it with a bond (<MethodLink name="challenge" />).
        </li>
        <li>
          <strong>Pay.</strong> When the countdown ends, anyone can press <em>Pay now</em> (<MethodLink name="execute" />). The payee receives the money.
        </li>
      </Steps>

      <Note tone="tip" title="Escalations">
        If the review is unsure the request is escalated. The owner or guardian then approves or rejects it with <MethodLink name="decide" />, and a human approval can be paid immediately.
      </Note>
    </>
  );
}

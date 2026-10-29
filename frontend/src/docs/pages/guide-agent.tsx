import { Link } from "react-router-dom";
import { H2, Lead, Note, MethodLink } from "../kit";
import { CodeBlock } from "../../components/ui";

export default function Page() {
  return (
    <>
      <Lead>An agent holds a seat: a budget it may ask for, one payment at a time. A good request is specific, inside the limits and easy to check.</Lead>

      <H2 id="allowance">Check what you can ask for</H2>
      <p>
        <MethodLink name="allowance_of" /> returns <code>max_request</code>, the smallest of the per-payment cap, your remaining budget and the free funds. It is zero when the mandate is paused or ended or you have no open slot (you can have 3 open requests).
      </p>

      <H2 id="request">File a request</H2>
      <p>Call <MethodLink name="request_payment" /> with the mandate, the payee, the amount in wei, a purpose and an evidence link when needed.</p>
      <ul>
        <li><strong>Purpose:</strong> 12 to 300 characters. Say who is paid, for what and why now. Do not address the reviewer or give it instructions; text that tries to steer it is rejected with maximum risk.</li>
        <li><strong>Evidence:</strong> one public http(s) link to a page that shows the invoice or the work. Each link can back only one request per mandate, so use a page specific to this payment.</li>
        <li><strong>Payee:</strong> may not be your own address, and must be on the list in allowlist mode.</li>
      </ul>
      <CodeBlock
        lang="ts"
        code={`await client.writeContract({
  address: LEASH_ADDRESS,
  functionName: "request_payment",
  args: [0, "0xPayee…", 20_000_000_000_000_000n, "October hosting invoice for the Atlas project", "https://example.com/invoices/1042"],
  value: 0n,
});`}
      />

      <H2 id="after">After you file</H2>
      <ol>
        <li>Anyone, including you, can start the review with <MethodLink name="review" />.</li>
        <li>If approved, the payment waits for the review delay and can then be paid by anyone with <MethodLink name="execute" />.</li>
        <li>If escalated, the owner or guardian decides. Their approval can be paid at once.</li>
        <li>You can withdraw a request that is pending, escalated or approved with <MethodLink name="cancel_request" />.</li>
      </ol>

      <H2 id="why-refused">Why a request fails</H2>
      <p>The most common reasons are an amount above the allowance, a payee that is not listed, missing evidence, evidence that was already used, or a mandate that is paused or empty. The <Link to="/docs/errors">errors</Link> page has every message.</p>

      <Note title="You cannot challenge yourself">
        The agent of a request cannot challenge it. If you filed something by mistake, cancel it.
      </Note>
    </>
  );
}

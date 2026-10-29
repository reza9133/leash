import { H2, Lead, Note } from "../kit";
import { CodeBlock } from "../../components/ui";

export default function Page() {
  return (
    <>
      <Lead>The contract is tested against the real GenLayer SDK without a network. The frontend is tested against the real contract behind a local stand-in for the chain.</Lead>

      <H2 id="contract">The contract</H2>
      <p>
        Python tests run the contract in the GenLayer direct runner. They cover text cleaning, every validation edge, review outcomes for each verdict and risk, limits and the rolling window,
        challenges and audits, the validator acceptance rule, adversarial inputs and a random walk that checks the books after every call.
      </p>
      <CodeBlock lang="bash" code={`pip install -r requirements.txt
python3 -m pytest -q`} />

      <H2 id="frontend">The frontend</H2>
      <CodeBlock
        lang="bash"
        code={`cd frontend
npm install
npm run check:contract   # the generated interface matches contracts/leash.py
npm run build            # type check and production build
npm test                 # unit tests`}
      />
      <ul>
        <li><strong>Interface drift:</strong> <code>check:contract</code> fails when the methods, parameters, errors or constants in the contract differ from what the app uses. The unit tests also fail when a method or an error message has no documentation.</li>
        <li><strong>End to end:</strong> <code>tests/e2e</code> starts the real contract in the direct runner behind a JSON-RPC server that speaks the same protocol as the network, with mock EIP-6963 wallets. Playwright drives the built app through creating a mandate, seats, a request, a review, a challenge, an audit and a payment, and through wallet discovery, connect, disconnect, account change and network switching.</li>
      </ul>

      <Note title="What is not tested here">
        These runs do not touch the public Studionet. A final pass against the live network is the owner's to run with test funds.
      </Note>
    </>
  );
}

import { Link } from "react-router-dom";
import { H2, Lead, Note, DocTable } from "../kit";
import { CodeBlock } from "../../components/ui";
import { LIMITS } from "../../lib/types";

export default function Page() {
  return (
    <>
      <Lead>
        Leash is a GenLayer intelligent contract that lets an owner hand a bounded budget to autonomous agents. The
        budget has hard limits that plain arithmetic enforces, and an AI reviewer that can only make a payment harder,
        never easier.
      </Lead>

      <H2 id="problem">The problem</H2>
      <p>
        An agent that can pay people needs money, and an agent that holds money can be tricked, can misread an
        instruction or can simply be wrong. Giving a language model the keys is the obvious design and the dangerous one:
        every limit you rely on is a sentence the model may decide to ignore.
      </p>

      <H2 id="idea">The idea</H2>
      <p>Leash splits the decision into four layers, and gives each one only the power it can be trusted with.</p>
      <DocTable>
        <thead>
          <tr><th>Layer</th><th>Decides</th><th>Can it be talked into a mistake?</th></tr>
        </thead>
        <tbody>
          <tr><td>Deterministic shell</td><td>Amounts, caps, budgets, the rolling window, the payee list, expiry, who may call what</td><td>No. It is code.</td></tr>
          <tr><td>AI review</td><td>Whether the purpose fits the written policy and the evidence supports it</td><td>Maybe, so it can only lower what the shell allows</td></tr>
          <tr><td>Human brake</td><td>Veto, decisions on escalations, pause, revoke</td><td>No</td></tr>
          <tr><td>Watchers</td><td>Bet a bond against an AI approval; a stricter audit settles it</td><td>They are paid to find mistakes</td></tr>
        </tbody>
      </DocTable>
      <p>
        Whatever the reviewer says, an agent can never move more than its seat budget, more than the per-payment cap, more
        than the rolling-window cap, or pay a payee the owner did not list (in allowlist mode). The model can refuse a
        request or ask a human; it cannot raise a cap.
      </p>

      <H2 id="flow">A request in one picture</H2>
      <CodeBlock
        lang="text"
        code={`agent files a request
  -> hard limits checked by code
  -> AI review: approve / escalate / reject
  -> waiting time (veto or challenge)
  -> anyone executes the payment`}
      />
      <ol>
        <li>The agent files a request: payee, amount, purpose and, when required, a link to evidence.</li>
        <li>The contract checks every hard limit at once. A request that breaks one is refused before any model runs.</li>
        <li>Anyone can ask for the AI review. It approves, rejects or hands the request to a human.</li>
        <li>An AI approval waits for the review delay. During that time the owner or guardian can veto, and any watcher can challenge with a bond.</li>
        <li>After the delay anyone can execute the payment. Every limit is checked again.</li>
      </ol>

      <H2 id="numbers">Numbers worth knowing</H2>
      <ul>
        <li>Minimum payment: 0.001 GEN. Open requests per seat: {LIMITS.maxOpen}. Seats per mandate: {LIMITS.maxDelegates}. Listed payees: {LIMITS.maxPayees}.</li>
        <li>Default risk limits: auto-approve up to {LIMITS.defaultAuto}, reject above {LIMITS.defaultReject}.</li>
        <li>A challenge bond is 5% of the payment (at least 0.001 GEN); a successful watcher also earns 10% of the payment.</li>
      </ul>

      <Note title="Testnet software">
        Leash runs on GenLayer Studionet and has not been audited. Use test funds only.
      </Note>

      <H2 id="next">Where to go next</H2>
      <p>
        Follow the <Link to="/docs/quickstart">quick start</Link>, or read <Link to="/docs/mandates-roles">mandates and roles</Link> and{" "}
        <Link to="/docs/request-lifecycle">the life of a request</Link> for the full model.
      </p>
    </>
  );
}

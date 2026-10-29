import { Link } from "react-router-dom";
import { H2, Lead, Note, DocTable } from "../kit";

export default function Page() {
  return (
    <>
      <Lead>The app is a thin, honest layer over the contract: every number comes from a read, every button is one contract method.</Lead>

      <H2 id="screens">The screens</H2>
      <DocTable>
        <thead><tr><th>Screen</th><th>What it is for</th></tr></thead>
        <tbody>
          <tr><td><Link to="/">Home</Link></td><td>The idea, live numbers and an interactive lifecycle.</td></tr>
          <tr><td><Link to="/app">Dashboard</Link></td><td>Your mandates, with a tension gauge for each, and an inbox of requests that need action from you.</td></tr>
          <tr><td><Link to="/app/new">New mandate</Link></td><td>A form with validation and a summary of what you are about to create.</td></tr>
          <tr><td>Mandate</td><td>Tabs: Overview (funds and limits), Requests, Seats and payees, Manage (pause, policy, limits, rules, guardian, withdraw).</td></tr>
          <tr><td>Request</td><td>The state, countdowns, the review and audit verdicts, and the actions available to your role.</td></tr>
          <tr><td><Link to="/explore">Explorer</Link></td><td>Contract facts, totals, the books equation and every mandate.</td></tr>
          <tr><td><Link to="/docs">Docs</Link></td><td>This documentation, with search.</td></tr>
        </tbody>
      </DocTable>

      <H2 id="actions">Actions</H2>
      <p>Buttons are shown only for what your role can do in the current state, and write buttons are disabled while the wallet is on the wrong network. Each action opens a card in the transaction panel at the bottom right.</p>

      <H2 id="tx">The transaction panel</H2>
      <p>
        A GenLayer transaction passes through several phases: pending, proposing, committing, revealing and accepted. The panel shows the current phase with a spinner, the elapsed time and the transaction hash.
        AI reviews and audits take longer because validators read the evidence and run the model. The panel survives a page reload for transactions still in flight.
      </p>

      <H2 id="themes">Themes</H2>
      <p>Three themes: Light, Dim (a softer, semi-light look) and Dark. The first choice follows your system setting; the switch in the header remembers yours.</p>

      <H2 id="keys">Keyboard</H2>
      <ul>
        <li><kbd>/</kbd> focuses the documentation search.</li>
        <li>Every control is reachable with Tab, and the skip link at the top jumps to the main content.</li>
        <li>Animations respect the system setting for reduced motion; the 3D hero falls back to a flat logo where WebGL is unavailable.</li>
      </ul>

      <Note title="Data freshness">
        Pages refresh after your own transactions and at intervals. Time-based facts, such as the rolling window and countdowns, are computed from the chain clock when read.
      </Note>
    </>
  );
}

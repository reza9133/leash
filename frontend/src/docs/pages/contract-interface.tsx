import { Link } from "react-router-dom";
import { H2, H3, Lead, Note, DocTable } from "../kit";
import { CodeBlock } from "../../components/ui";
import generated from "../../lib/contract.generated.json";
import { GROUP_INTRO, GROUP_TITLE, METHOD_DOCS, ROLE_LABEL, type MethodGroup, type MethodName } from "../methodDocs";
import { ERROR_HELP } from "../errors";

interface GenMethod {
  name: string;
  kind: "write" | "view";
  payable: boolean;
  params: [string, string][];
  returns: string;
  errors: string[];
}

const METHODS = generated.methods as GenMethod[];
const GROUPS: MethodGroup[] = ["setup", "agent", "review", "challenge", "views"];

function signature(m: GenMethod): string {
  const args = m.params.map(([n, t]) => `${n}: ${t}`).join(", ");
  return `${m.name}(${args})${m.returns && m.returns !== "None" ? ` -> ${m.returns}` : ""}`;
}

export default function Page() {
  return (
    <>
      <Lead>
        {METHODS.length} public methods: {METHODS.filter((m) => m.kind === "write").length} that change state and {METHODS.filter((m) => m.kind === "view").length} read-only views.
        Everything on this page is generated from the contract source and checked against it in the tests.
      </Lead>

      <H2 id="conventions">Conventions</H2>
      <ul>
        <li>Amounts are integers in wei (1 GEN = 10<sup>18</sup> wei). Views return amounts as decimal strings.</li>
        <li>Addresses are 0x-prefixed hex strings. Ids start at 0.</li>
        <li>Times are Unix seconds. Durations are seconds.</li>
        <li>Methods marked <em>payable</em> take their amount from the value attached to the transaction.</li>
        <li>Views return JSON text; see <Link to="/docs/views-and-data">views and data</Link>.</li>
      </ul>
      <Note title="Text is cleaned before it is stored">
        Names, policies, purposes, notes and reasons lose hidden characters, collapse spaces and turn angle brackets into parentheses, then the length limits apply to the cleaned text.
      </Note>

      {GROUPS.map((g) => (
        <section key={g}>
          <H2 id={`group-${g}`}>{GROUP_TITLE[g]}</H2>
          <p>{GROUP_INTRO[g]}</p>
          {METHODS.filter((m) => METHOD_DOCS[m.name as MethodName]?.group === g).map((m) => {
            const doc = METHOD_DOCS[m.name as MethodName];
            return (
              <div key={m.name} className="docs-method-block">
                <H3 id={m.name}>{m.name}</H3>
                <p>
                  {doc.summary}
                  {m.payable && <> <strong>Payable.</strong></>}
                </p>
                <CodeBlock lang="text" code={signature(m)} />
                <p>
                  <strong>Who:</strong> {doc.who} <span className="muted">({doc.roles.map((r) => ROLE_LABEL[r]).join(", ")})</span>
                </p>
                {m.params.length > 0 && (
                  <DocTable>
                    <thead><tr><th>Parameter</th><th>Type</th><th>Meaning</th></tr></thead>
                    <tbody>
                      {m.params.map(([n, t]) => (
                        <tr key={n}><td><code>{n}</code></td><td><code>{t}</code></td><td>{doc.params[n]}</td></tr>
                      ))}
                    </tbody>
                  </DocTable>
                )}
                <ul>{doc.effects.map((e, i) => <li key={i}>{e}</li>)}</ul>
                {doc.returns && <p><strong>Returns:</strong> {doc.returns}</p>}
                {doc.notes?.map((n, i) => <p key={i} className="muted">{n}</p>)}
                {m.errors.length > 0 && (
                  <details className="docs-errors">
                    <summary>Errors this method can raise ({m.errors.length})</summary>
                    <ul>
                      {m.errors.map((e) => (
                        <li key={e}><code>{e}</code>{ERROR_HELP[e] ? <> — {ERROR_HELP[e].fix}</> : null}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            );
          })}
        </section>
      ))}

      <H2 id="calling">Calling from code</H2>
      <CodeBlock
        lang="ts"
        title="genlayer-js"
        code={`import { createClient, chains } from "genlayer-js";

const client = createClient({ chain: chains.studionet, account });
const hash = await client.writeContract({
  address: LEASH_ADDRESS,
  functionName: "request_payment",
  args: [mandateId, payee, amountWei, "Pay the hosting invoice for October", "https://example.com/invoice"],
  value: 0n,
});
const stats = JSON.parse(await client.readContract({ address: LEASH_ADDRESS, functionName: "stats", args: [] }));`}
      />
    </>
  );
}

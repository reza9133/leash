import { H2, Lead, Note, DocTable } from "../kit";
import generated from "../../lib/contract.generated.json";
import { ERROR_HELP } from "../errors";

export default function Page() {
  const used = new Set<string>();
  (generated.methods as { errors: string[] }[]).forEach((m) => m.errors.forEach((e) => used.add(e)));
  const rows = [...used].sort((a, b) => a.localeCompare(b));
  const model = Object.keys(ERROR_HELP).filter((k) => k.startsWith("[LLM_ERROR]"));
  const plain = rows.filter((r) => !r.startsWith("[LLM_ERROR]"));
  return (
    <>
      <Lead>
        When a transaction fails, the contract's message is shown on the transaction panel and on the failed action. Find it here to see what caused it.
      </Lead>
      <Note title="Nothing is half done">
        A failed call changes nothing. If a message appears, the state is exactly what it was before.
      </Note>

      <H2 id="messages">Messages</H2>
      <DocTable>
        <thead><tr><th>Message</th><th>Cause</th><th>What to do</th></tr></thead>
        <tbody>
          {plain.map((m) => (
            <tr key={m}>
              <td><code>{m}</code></td>
              <td>{ERROR_HELP[m]?.cause}</td>
              <td>{ERROR_HELP[m]?.fix}</td>
            </tr>
          ))}
        </tbody>
      </DocTable>

      <H2 id="model">Model errors</H2>
      <p>
        These come from the AI review when the model's reply cannot be used. The validators cannot agree on a result, so the transaction does not succeed and nothing is stored.
      </p>
      <DocTable>
        <thead><tr><th>Message</th><th>Cause</th><th>What to do</th></tr></thead>
        <tbody>
          {model.map((m) => (
            <tr key={m}><td><code>{m}</code></td><td>{ERROR_HELP[m].cause}</td><td>{ERROR_HELP[m].fix}</td></tr>
          ))}
        </tbody>
      </DocTable>

      <H2 id="wallet">Wallet and network messages</H2>
      <DocTable>
        <thead><tr><th>Message</th><th>What to do</th></tr></thead>
        <tbody>
          <tr><td>Connection cancelled in the wallet.</td><td>You closed or declined the wallet prompt. Press connect again.</td></tr>
          <tr><td>Network switch cancelled in the wallet.</td><td>Press the switch button again and approve it.</td></tr>
          <tr><td>The wrong-network banner</td><td>Use its switch button; write actions stay disabled until the chain is right.</td></tr>
        </tbody>
      </DocTable>
    </>
  );
}

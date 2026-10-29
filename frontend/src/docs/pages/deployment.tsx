import { H2, Lead, Note, DocTable } from "../kit";
import { CodeBlock, Address } from "../../components/ui";
import { CHAIN, CONTRACT_ADDRESS, CONTRACT_EXPLORER_URL, LINKS } from "../../config";

export default function Page() {
  return (
    <>
      <Lead>Where the contract lives, how to deploy your own copy and how to host this frontend.</Lead>

      <H2 id="deployed">The deployed contract</H2>
      <DocTable>
        <tbody>
          <tr><th>Network</th><td>{CHAIN.name} (chain id {CHAIN.id})</td></tr>
          <tr><th>Address</th><td><Address value={CONTRACT_ADDRESS} full /></td></tr>
          <tr><th>Explorer</th><td><a href={CONTRACT_EXPLORER_URL} target="_blank" rel="noreferrer">Open in the GenLayer explorer</a></td></tr>
          <tr><th>Source</th><td><a href={LINKS.githubContract} target="_blank" rel="noreferrer">contracts/leash.py</a></td></tr>
          <tr><th>RPC</th><td><code>{CHAIN.rpcUrl}</code></td></tr>
        </tbody>
      </DocTable>

      <H2 id="own">Deploy your own copy</H2>
      <ol>
        <li>Install the GenLayer CLI and select Studionet as the network.</li>
        <li>Deploy <code>contracts/leash.py</code>. The constructor takes no arguments.</li>
        <li>Copy the contract address from the deployment result.</li>
      </ol>
      <CodeBlock lang="bash" code={`npm install -g genlayer
genlayer network set studionet
genlayer deploy --contract contracts/leash.py`} />
      <Note title="Commands change">
        The GenLayer tooling evolves. If a command differs, follow the current instructions in the GenLayer documentation.
      </Note>

      <H2 id="frontend">Point this frontend at it</H2>
      <p>The address is read at build time from <code>VITE_LEASH_ADDRESS</code> and falls back to the one above.</p>
      <CodeBlock lang="bash" code={`cd frontend
npm install
VITE_LEASH_ADDRESS=0xYourAddress npm run build`} />

      <H2 id="hosting">Hosting</H2>
      <p>
        The build is a static site in <code>frontend/dist</code>. The app uses hash routes (<code>#/app</code>, <code>#/docs</code>), so any static host works without rewrite rules, including GitHub Pages.
        Serve it over HTTPS so wallets treat the page as a secure context.
      </p>

      <H2 id="sync">Keeping the frontend in step with the contract</H2>
      <p>
        <code>npm run sync:contract</code> reads <code>contracts/leash.py</code> and regenerates the list of methods, parameters, errors and constants the frontend uses.
        <code>npm run check:contract</code> fails when the generated file is out of date, so the interface cannot drift from the contract.
      </p>
    </>
  );
}

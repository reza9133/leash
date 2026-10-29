import { H2, Lead, DocTable } from "../kit";
import { LINKS } from "../../config";

export default function Page() {
  return (
    <>
      <Lead>Leash is open source and built for GenLayer, the network where contracts can read the web and ask a language model, with validators agreeing on the answer.</Lead>

      <H2 id="links">Links</H2>
      <DocTable>
        <tbody>
          <tr><th>Source code</th><td><a href={LINKS.github} target="_blank" rel="noopener noreferrer">{LINKS.github}</a></td></tr>
          <tr><th>The contract</th><td><a href={LINKS.githubContract} target="_blank" rel="noopener noreferrer">contracts/leash.py</a></td></tr>
          <tr><th>Author on X</th><td><a href={LINKS.twitter} target="_blank" rel="noopener noreferrer">{LINKS.twitterHandle}</a></td></tr>
          <tr><th>GenLayer</th><td><a href={LINKS.genlayer} target="_blank" rel="noopener noreferrer">genlayer.com</a> and <a href={LINKS.genlayerDocs} target="_blank" rel="noopener noreferrer">docs.genlayer.com</a></td></tr>
        </tbody>
      </DocTable>

      <H2 id="feedback">Feedback</H2>
      <p>Open an issue on GitHub for bugs and ideas, or write on X. Reports of a request the AI should have refused are especially welcome.</p>

      <H2 id="status">Status</H2>
      <p>Leash is testnet software, not audited. Interfaces may change.</p>
    </>
  );
}

import { Link } from "react-router-dom";
import { H2, Lead } from "../kit";

const QA: { id: string; q: string; a: React.ReactNode }[] = [
  { id: "ai-money", q: "Can the AI move money?", a: "No. It can only approve a request that already passed every hard limit, and only when its risk is low. The payment itself is made by anyone calling execute after the waiting time." },
  { id: "who-pays", q: "Who calls execute?", a: "Anyone. The contract checks the facts, not the caller, so the agent, the owner, a watcher or a script can do it." },
  { id: "wrong-ai", q: "What if the AI approves something wrong?", a: "The owner or guardian can veto it during the waiting time, and any watcher can challenge it with a bond. A stricter audit then decides." },
  { id: "unsure", q: "What if the AI is unsure?", a: "The request is escalated and the owner or guardian decides. If nobody acts before the deadline it expires and nothing is paid." },
  { id: "evidence", q: "What counts as evidence?", a: "One public http or https link to a page the validators can read. It needs a real domain, no credentials and no custom port. Each page can back one live request per mandate." },
  { id: "unreadable", q: "The evidence page cannot be read. Now what?", a: "The review can be repeated after two minutes, up to three tries. Then the request goes to a human; it is never approved by default." },
  { id: "pause", q: "Can I stop everything quickly?", a: "Yes. The owner or the guardian can pause a mandate. Only the owner can resume it." },
  { id: "withdraw", q: "Can I get my money back?", a: "Yes, the part that is not reserved for approved requests, at any time. Reserved money is released when the request ends." },
  { id: "bond", q: "What happens to a challenge bond?", a: "If the audit does not approve, the watcher gets it back plus a reward of 10% of the payment. If it approves, it goes to the mandate. If the audit cannot read the evidence, it is returned." },
  { id: "cost", q: "Why does a review take so long?", a: "Validators fetch the evidence and run the model, and they must agree. It takes longer than an ordinary transaction." },
  { id: "network", q: "Which network is it on?", a: <>GenLayer Studionet. See <Link to="/docs/wallet-network">wallet and network</Link>.</> },
  { id: "audited", q: "Is it audited?", a: "No. Use test funds only." },
];

export default function Page() {
  return (
    <>
      <Lead>Short answers to the questions people ask first.</Lead>
      {QA.map((x) => (
        <section key={x.id}>
          <H2 id={x.id}>{x.q}</H2>
          <p>{x.a}</p>
        </section>
      ))}
    </>
  );
}

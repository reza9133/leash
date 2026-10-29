import { Link } from "react-router-dom";
import { ArrowRight, BookOpen } from "lucide-react";
import { CHAIN, CONTRACT_ADDRESS, LINKS } from "../config";
import { api } from "../lib/api";
import { formatGen } from "../lib/format";
import { useAsync, useDocumentTitle } from "../lib/hooks";
import { useTilt } from "../lib/tilt";
import { HeroScene } from "../components/HeroScene";
import { LayerStack } from "../components/LayerStack";
import { LifecycleExplorer } from "../components/Lifecycle";
import { GenLayerMark } from "../components/Logo";
import { Address, ButtonLink } from "../components/ui";

const ROLES = [
  {
    name: "Owner",
    does: "Writes the policy, sets the limits, funds the mandate, gives seats to agents and can veto anything before it is paid.",
    doc: "guide-owner",
  },
  {
    name: "Guardian",
    does: "A second key. It can veto, decide what the AI was unsure about, revoke seats and pause. It can never move or configure money.",
    doc: "mandates-roles",
  },
  {
    name: "Agent",
    does: "Holds a seat with a budget. Files payment requests with a purpose and evidence, and is paid only when every layer agrees.",
    doc: "guide-agent",
  },
  {
    name: "Watcher",
    does: "Anyone. Challenges an AI approval that looks wrong by posting a bond, and earns a reward when the audit proves them right.",
    doc: "guide-watcher",
  },
];

function Live() {
  const stats = useAsync(() => api.stats(), [], { interval: 60000 });
  const s = stats.data;
  if (!s) return <p className="stat-sentence muted">{stats.error ? `Live numbers from ${CHAIN.name} are not reachable right now.` : `Reading the contract on ${CHAIN.name}…`}</p>;
  return (
    <p className="stat-sentence" data-testid="live-stats">
      So far on {CHAIN.name}: <b>{s.mandates}</b> {s.mandates === 1 ? "mandate" : "mandates"}, <b>{s.requests}</b> {s.requests === 1 ? "request" : "requests"}, and <b>{formatGen(s.volume)}</b> paid out.
    </p>
  );
}

export default function Home() {
  useDocumentTitle("");
  const tilt = useTilt<HTMLDivElement>(5);
  return (
    <>
      <section className="hero">
        <div className="page hero__grid">
          <div className="hero__copy">
            <h1>
              Let your agent spend.
              <br />
              Keep the leash.
            </h1>
            <p className="hero__lead">
              Leash is a spending mandate for autonomous agents. You set hard limits that the contract enforces. An AI reviewer reads every request, and it can only say no. You keep a veto, and anyone can challenge a bad approval.
            </p>
            <div className="hero__actions">
              <ButtonLink to="/app" variant="primary" size="lg" iconAfter={<ArrowRight size={18} />} data-testid="hero-open">
                Open the app
              </ButtonLink>
              <ButtonLink to="/docs/overview" size="lg" icon={<BookOpen size={18} />}>
                Read the docs
              </ButtonLink>
            </div>
            <Live />
          </div>
          <div className="hero__visual">
            <HeroScene />
          </div>
        </div>
        <div className="stitch hero__stitch" aria-hidden />
      </section>

      <section className="page section" aria-labelledby="layers-h">
        <div className="section__head">
          <div>
            <h2 id="layers-h">Four layers between an agent and your money</h2>
            <p>The first one is arithmetic. The others add judgement, but none of them can undo the first.</p>
          </div>
        </div>
        <LayerStack />
      </section>

      <section className="band" aria-labelledby="follow-h">
        <div className="page section">
          <div className="section__head">
            <div>
              <h2 id="follow-h">Follow a request</h2>
              <p>Every arrow is a real method of the contract. Pick a story and play it.</p>
            </div>
          </div>
          <LifecycleExplorer />
        </div>
      </section>

      <section className="page section" aria-labelledby="roles-h">
        <div className="section__head">
          <h2 id="roles-h">Four roles, no shared keys</h2>
        </div>
        <dl className="roles">
          {ROLES.map((r) => (
            <div key={r.name} className="roles__row">
              <dt>{r.name}</dt>
              <dd>
                {r.does}{" "}
                <Link to={`/docs/${r.doc}`} className="roles__more">
                  Learn more
                </Link>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="page section">
        <div className="cta tilt" ref={tilt}>
          <div className="cta__copy">
            <h2>Try it on Studionet</h2>
            <p>
              The contract is live on <GenLayerMark size={14} /> {CHAIN.name}. Connect a wallet, create a mandate with test funds, and file a request from a second address to see all four layers work.
            </p>
            <p className="cta__addr">
              <Address value={CONTRACT_ADDRESS} head={10} tail={8} />
            </p>
          </div>
          <div className="cta__actions">
            <ButtonLink to="/app/new" variant="primary" size="lg">
              Create a mandate
            </ButtonLink>
            <ButtonLink href={LINKS.github} external size="lg">
              View the source
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}

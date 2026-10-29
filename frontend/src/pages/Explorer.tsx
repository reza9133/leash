import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, ExternalLink, TriangleAlert } from "lucide-react";
import { CHAIN, CONTRACT_ADDRESS, CONTRACT_EXPLORER_URL, LINKS } from "../config";
import { api } from "../lib/api";
import { formatDuration, ratio } from "../lib/format";
import { useAsync, useDocumentTitle } from "../lib/hooks";
import { Gen, PageHead } from "../components/Common";
import { TensionGauge } from "../components/TensionGauge";
import { Address, Chip, EmptyState, ErrorState, Facts } from "../components/ui";
import { Skeleton } from "../components/Spinners";

const PAGE = 10;

function Stat({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="stat">
      <dt>{label}</dt>
      <dd>{children}</dd>
      {hint && <small>{hint}</small>}
    </div>
  );
}

export default function Explorer() {
  useDocumentTitle("Explorer");
  const stats = useAsync(() => api.stats(), [], { interval: 30000 });
  const books = useAsync(() => api.solvency(), [], { interval: 30000 });
  const [page, setPage] = useState(0);
  const total = stats.data?.mandates ?? 0;
  const list = useAsync(() => api.mandates(page * PAGE, PAGE), [page, total], { enabled: stats.data !== undefined, interval: 30000 });
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const s = stats.data;
  const b = books.data;

  return (
    <>
      <PageHead title="Explorer">What the Leash contract holds and has done on {CHAIN.name}. Everything here is read straight from the contract, and anyone can look.</PageHead>

      <div className="page stack">
        <section className="panel">
          <h3>The contract</h3>
          <Facts
            compact
            items={[
              { label: "Address", value: <Address value={CONTRACT_ADDRESS} full /> },
              { label: "Network", value: `${CHAIN.name} (chain ${CHAIN.id})` },
              { label: "Source", value: <a href={LINKS.githubContract} target="_blank" rel="noopener noreferrer" className="ext-link">contracts/leash.py <ExternalLink size={13} /></a> },
              { label: "Block explorer", value: <a href={CONTRACT_EXPLORER_URL} target="_blank" rel="noopener noreferrer" className="ext-link">GenLayer explorer <ExternalLink size={13} /></a>, hint: "Opens this contract and its transactions in the explorer." },
            ]}
          />
        </section>

        <section aria-labelledby="stats-h">
          <div className="section__head">
            <h2 id="stats-h">Activity</h2>
          </div>
          {stats.error && !s && <ErrorState error={stats.error} retry={stats.reload} />}
          {stats.loading && !s && <Skeleton height={120} radius={12} />}
          {s && (
            <dl className="stats" data-testid="stats">
              <Stat label="Mandates">{s.mandates}</Stat>
              <Stat label="Requests">{s.requests}</Stat>
              <Stat label="Paid out" hint="requests">{s.executed}</Stat>
              <Stat label="Rejected">{s.rejected}</Stat>
              <Stat label="Vetoed">{s.vetoed}</Stat>
              <Stat label="AI reviews">{s.reviews}</Stat>
              <Stat label="Challenges upheld">{s.challenges_upheld}</Stat>
              <Stat label="Challenges dismissed">{s.challenges_dismissed}</Stat>
              <Stat label="Volume paid"><Gen wei={s.volume} /></Stat>
            </dl>
          )}
        </section>

        <section className="panel" aria-labelledby="books-h">
          <div className="row row--between">
            <h3 id="books-h">The books</h3>
            {b && (b.balanced ? <Chip tone="ok" dot>Balanced</Chip> : <Chip tone="bad" dot>Out of balance</Chip>)}
          </div>
          <p className="muted">Everything paid in is either paid out, held by a mandate, or held as a bond. If these numbers ever stopped adding up, the contract would be broken.</p>
          {books.error && !b && <ErrorState error={books.error} retry={books.reload} />}
          {b && (
            <>
              <div className="equation" data-testid="books">
                <div><span>Paid in</span><strong><Gen wei={b.deposited} /></strong></div>
                <i aria-hidden>−</i>
                <div><span>Paid out</span><strong><Gen wei={b.paid} /></strong></div>
                <i aria-hidden>=</i>
                <div><span>Held by mandates</span><strong><Gen wei={b.held} /></strong></div>
                <i aria-hidden>+</i>
                <div><span>Held as bonds</span><strong><Gen wei={b.bonds} /></strong></div>
              </div>
              <TensionGauge value={ratio(b.reserved, b.held)} label="Reserved share of held money" left="Reserved by approved requests" right={<><Gen wei={b.reserved} /> of <Gen wei={b.held} /></>} />
              {b.balanced ? (
                <p className="ok-text"><Check size={15} aria-hidden /> The books balance.</p>
              ) : (
                <p className="bad-text"><TriangleAlert size={15} aria-hidden /> The books do not balance.</p>
              )}
            </>
          )}
        </section>

        <section aria-labelledby="all-h">
          <div className="section__head">
            <h2 id="all-h">All mandates</h2>
            {total > 0 && <span className="muted num">{total} in total</span>}
          </div>
          {list.loading && !list.data && <Skeleton height={200} radius={12} />}
          {list.error && !list.data && <ErrorState error={list.error} retry={list.reload} />}
          {list.data && list.data.length === 0 && <EmptyState title="No mandates yet">Nobody has created one on this contract so far.</EmptyState>}
          {list.data && list.data.length > 0 && (
            <div className="table-wrap">
              <table className="table" data-testid="explorer-table">
                <thead>
                  <tr>
                    <th>Mandate</th>
                    <th>Owner</th>
                    <th className="num">Balance</th>
                    <th className="num">Paid</th>
                    <th className="num">Requests</th>
                    <th>Window</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <Link to={`/app/mandates/${m.id}`}>{m.name}</Link> <span className="muted num">#{m.id}</span>
                      </td>
                      <td><Address value={m.owner} /></td>
                      <td className="num"><Gen wei={m.balance} /></td>
                      <td className="num"><Gen wei={m.paid} /></td>
                      <td className="num">{m.requests}</td>
                      <td className="muted">{formatDuration(m.window_secs)}</td>
                      <td>{m.ended ? <Chip>Ended</Chip> : m.paused ? <Chip tone="warn" dot>Paused</Chip> : <Chip tone="ok" dot>Active</Chip>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {pages > 1 && (
            <div className="row row--between pager">
              <button type="button" className="btn btn--secondary btn--sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                <span>Newer</span>
              </button>
              <span className="muted num">Page {page + 1} of {pages}</span>
              <button type="button" className="btn btn--secondary btn--sm" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>
                <span>Older</span>
              </button>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { api } from "../lib/api";
import { useAsync, useDocumentTitle, useNow } from "../lib/hooks";
import { formatDuration, ratio } from "../lib/format";
import { isStale, roleOf } from "../lib/roles";
import { OPEN_STATES, S } from "../lib/types";
import type { MandateRow, RequestRow } from "../lib/types";
import { useAccount, ConnectPrompt, Gen, PageHead, RoleChip } from "../components/Common";
import { StateChip } from "../components/StateChip";
import { TensionGauge } from "../components/TensionGauge";
import { Button, ButtonLink, Chip, EmptyState, ErrorState } from "../components/ui";
import { Skeleton } from "../components/Spinners";

interface Job {
  request: RequestRow;
  mandate: MandateRow;
  text: string;
}

function mandateStatus(m: MandateRow, now: number) {
  if (m.ended || (m.expires_at !== 0 && now >= m.expires_at)) return <Chip tone="neutral">Ended</Chip>;
  if (m.paused) return <Chip tone="warn" dot>Paused</Chip>;
  return <Chip tone="ok" dot>Active</Chip>;
}

function JumpBox() {
  const nav = useNavigate();
  const [kind, setKind] = useState<"mandates" | "requests">("mandates");
  const [id, setId] = useState("");
  const valid = /^\d{1,9}$/.test(id.trim());
  return (
    <form
      className="jump"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) nav(`/app/${kind}/${Number(id.trim())}`);
      }}
      role="search"
      aria-label="Open by number"
    >
      <div className="segmented" role="radiogroup" aria-label="What to open">
        <button type="button" role="radio" aria-checked={kind === "mandates"} onClick={() => setKind("mandates")}>Mandate</button>
        <button type="button" role="radio" aria-checked={kind === "requests"} onClick={() => setKind("requests")}>Request</button>
      </div>
      <div className="affix">
        <span className="affix__unit">#</span>
        <input className="input" inputMode="numeric" placeholder="Number" value={id} onChange={(e) => setId(e.target.value)} aria-label="Number" data-testid="jump-input" />
      </div>
      <Button type="submit" disabled={!valid} icon={<Search size={16} />}>Open</Button>
    </form>
  );
}

export default function Dashboard() {
  useDocumentTitle("Your mandates");
  const { account, ready, connected } = useAccount();
  const now = useNow(30000);

  const data = useAsync(
    async () => {
      const list = await api.mandatesOf(account!, 0, 50);
      const watch = list.slice(0, 8);
      const reqs = await Promise.all(watch.map((m) => api.requests(m.id, 0, 25).catch(() => [] as RequestRow[])));
      return { list, reqs, mandates: watch };
    },
    [account],
    { enabled: !!account && ready, interval: 30000 },
  );

  const jobs: Job[] = [];
  if (data.data) {
    const t = Date.now() / 1000;
    data.data.mandates.forEach((m, i) => {
      const role = roleOf(m, account);
      for (const r of data.data!.reqs[i]) {
        if (!OPEN_STATES.includes(r.state)) continue;
        if (isStale(r, m, t)) {
          jobs.push({ request: r, mandate: m, text: "Ran out of time. Anyone can close it." });
        } else if (r.state === S.ESCALATED && (role === "owner" || role === "guardian")) {
          jobs.push({ request: r, mandate: m, text: "The AI was unsure. It needs your decision." });
        } else if (r.state === S.APPROVED && role === "seat" && r.delegate.toLowerCase() === account!.toLowerCase() && t >= r.ready_at) {
          jobs.push({ request: r, mandate: m, text: "Cleared and ready to be paid." });
        } else if (r.state === S.PENDING && r.delegate.toLowerCase() === account!.toLowerCase()) {
          jobs.push({ request: r, mandate: m, text: "Waiting for its AI review. Anyone can start it." });
        }
      }
    });
  }

  return (
    <>
      <PageHead
        title="Your mandates"
        actions={
          <ButtonLink to="/app/new" variant="primary" icon={<Plus size={16} />} data-testid="new-mandate">
            New mandate
          </ButtonLink>
        }
      >
        Mandates you own, guard or hold a seat in, and the requests that are waiting for you.
      </PageHead>

      <div className="page section--tight">
        <JumpBox />
      </div>

      {!connected && (
        <div className="page">
          <ConnectPrompt />
        </div>
      )}
      {connected && !ready && (
        <div className="page">
          <EmptyState title="Switch to GenLayer Studionet">Use the banner above to switch your wallet to Studionet. Your mandates will load as soon as it is on the right network.</EmptyState>
        </div>
      )}

      {connected && ready && (
        <div className="page dash">
          {data.error && !data.data && <ErrorState error={data.error} retry={data.reload} />}

          {data.loading && !data.data && (
            <div className="stack" aria-busy>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} height={92} radius={12} />
              ))}
            </div>
          )}

          {data.data && jobs.length > 0 && (
            <section className="section--tight" aria-labelledby="inbox-h">
              <div className="section__head">
                <h2 id="inbox-h">Needs attention</h2>
              </div>
              <ul className="inbox" data-testid="inbox">
                {jobs.slice(0, 12).map((j) => (
                  <li key={j.request.id}>
                    <Link to={`/app/requests/${j.request.id}`} className="inbox__item">
                      <StateChip state={j.request.state} />
                      <span className="grow">
                        <strong>
                          Request #{j.request.id} <span className="muted">in {j.mandate.name}</span>
                        </strong>
                        <small>{j.text}</small>
                      </span>
                      <Gen wei={j.request.amount} />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data.data && (
            <section className="section" aria-labelledby="mand-h">
              <div className="section__head">
                <h2 id="mand-h">Mandates</h2>
                {data.data.list.length > 0 && <span className="muted">{data.data.list.length} in total</span>}
              </div>
              {data.data.list.length === 0 ? (
                <EmptyState title="No mandates yet" action={<ButtonLink to="/app/new" variant="primary" icon={<Plus size={16} />}>Create your first mandate</ButtonLink>}>
                  A mandate holds money for an agent, with limits the agent cannot change. Create one, fund it, give an agent a seat, and watch the requests come in.
                </EmptyState>
              ) : (
                <ul className="mlist" data-testid="mandate-list">
                  {data.data.list.map((m) => {
                    const role = roleOf(m, account);
                    return (
                      <li key={m.id} className="mrow">
                        <div className="mrow__main">
                          <div className="row">
                            <Link to={`/app/mandates/${m.id}`} className="mrow__name">
                              {m.name}
                            </Link>
                            <span className="muted num">#{m.id}</span>
                            <RoleChip role={role} />
                            {mandateStatus(m, now)}
                          </div>
                          <p className="mrow__policy">{m.policy}</p>
                        </div>
                        <dl className="mrow__stats">
                          <div>
                            <dt>Balance</dt>
                            <dd><Gen wei={m.balance} /></dd>
                          </div>
                          <div>
                            <dt>Free to use</dt>
                            <dd><Gen wei={m.free} /></dd>
                          </div>
                          <div>
                            <dt>Requests</dt>
                            <dd className="num">{m.requests}</dd>
                          </div>
                        </dl>
                        <div className="mrow__gauge">
                          <TensionGauge
                            value={ratio(m.window_used, m.window_cap)}
                            label={`Spending in the last ${formatDuration(m.window_secs)}`}
                            left={<>Spent in {formatDuration(m.window_secs)}</>}
                            right={<><Gen wei={m.window_used} /> of <Gen wei={m.window_cap} /></>}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {data.data.list.length > 0 && <p className="muted fineprint">This list refreshes itself every half minute and after each transaction.</p>}
            </section>
          )}
        </div>
      )}
    </>
  );
}

import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Ban, BadgeCheck, Banknote, Gavel, Hourglass, ScanSearch, ShieldAlert, Undo2 } from "lucide-react";
import { api, write } from "../lib/api";
import { formatDateTime, formatDuration, formatGen, sameAddr } from "../lib/format";
import { useAsync, useDocumentTitle, useNow } from "../lib/hooks";
import { requestActions, roleOf, type ActionState } from "../lib/roles";
import { useAction } from "../lib/useAction";
import { BOND_LABEL, BY, BY_LABEL, FLAG_LABEL, LIMITS, OPEN_STATES, S, stateName } from "../lib/types";
import type { AuditInfo, MandateRow, RequestRow, ReviewInfo } from "../lib/types";
import { bondFor, checkText, rewardFor } from "../lib/validate";
import { useWallet } from "../lib/wallet/wallet";
import { Gen, PageHead, RoleChip } from "../components/Common";
import { Counter, Field, TextArea } from "../components/Fields";
import { Lifecycle } from "../components/Lifecycle";
import { StateChip, STATE_HELP } from "../components/StateChip";
import { PageLoader } from "../components/Spinners";
import { Address, Button, Callout, Chip, Disclosure, ErrorState, ExternalLinkText, Facts, Meter } from "../components/ui";
import { NotFound } from "./Mandate";

const verdictTone = (v?: string) => (v === "APPROVE" ? "ok" : v === "REJECT" ? "bad" : "warn");
const verdictLabel = (v?: string) => (v === "APPROVE" ? "Approve" : v === "REJECT" ? "Reject" : "Escalate to a human");
const riskTone = (n: number) => (n <= 35 ? "ok" : n >= 75 ? "bad" : "warn");

function Verdict({ title, info }: { title: string; info: ReviewInfo | AuditInfo }) {
  const flags = info.flags ?? [];
  const risk = info.risk;
  return (
    <section className="panel verdict" data-testid="verdict">
      <div className="row row--between">
        <h3>{title}</h3>
        {info.verdict && <Chip tone={verdictTone(info.verdict)} dot>{verdictLabel(info.verdict)}</Chip>}
      </div>
      {risk !== undefined && (
        <div className="verdict__risk">
          <span>Risk score</span>
          <Meter value={risk / 100} tone={riskTone(risk)} label={`Risk ${risk} of 100`} />
          <strong className="num">{risk}</strong>
        </div>
      )}
      {flags.length > 0 && (
        <ul className="flags" aria-label="Concerns the reviewer raised">
          {flags.map((f) => (
            <li key={f}>
              <Chip tone="warn">{FLAG_LABEL[f] ?? f}</Chip>
            </li>
          ))}
        </ul>
      )}
      {info.reason && <blockquote className="verdict__reason">{info.reason}</blockquote>}
      <p className="muted fineprint">Decided {formatDateTime(info.at)}. {"rev" in info && info.rev ? `Policy revision ${info.rev}.` : ""}</p>
    </section>
  );
}

function ActionCard({ icon, title, text, state, children }: { icon: ReactNode; title: string; text: ReactNode; state: ActionState; children: ReactNode }) {
  return (
    <section className={`action ${state.enabled ? "" : "is-off"}`} data-testid={`action-${title.toLowerCase().replace(/\W+/g, "-")}`}>
      <div className="action__head">
        {icon}
        <h4>{title}</h4>
      </div>
      <p className="muted">{text}</p>
      {state.enabled ? children : state.reason && <p className="action__why">{state.reason}</p>}
    </section>
  );
}

function Simple({ label, call, variant = "primary", testId }: { label: string; call: () => ReturnType<typeof write.review>; variant?: "primary" | "secondary" | "danger"; testId?: string }) {
  const act = useAction();
  return (
    <div className="stack tight">
      <Button variant={variant} busy={act.busy} onClick={() => void act.run(call)} data-testid={testId}>
        {label}
      </Button>
      {act.error && <p className="field__error" role="alert">{act.error}</p>}
    </div>
  );
}

function NoteForm({ r, mode }: { r: RequestRow; mode: "approve" | "reject" | "veto" }) {
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  const act = useAction();
  const err = note.trim() === "" ? null : checkText("The note", note, 1, LIMITS.maxNote);
  const submit = () => {
    setTouched(true);
    if (err) return;
    void act.run(() => (mode === "veto" ? write.veto(r.id, note.trim()) : write.decide(r.id, mode === "approve", note.trim())));
  };
  return (
    <div className="stack tight">
      <Field label="Note" optional htmlFor={`note-${mode}`} error={touched ? err : null} counter={<Counter text={note} min={0} max={LIMITS.maxNote} />}>
        <TextArea id={`note-${mode}`} value={note} onChange={setNote} rows={2} testId={`note-${mode}`} />
      </Field>
      <Button variant={mode === "approve" ? "primary" : "danger"} busy={act.busy} onClick={submit} data-testid={`${mode}-submit`}>
        {mode === "approve" ? "Approve the payment" : mode === "reject" ? "Reject the payment" : "Veto the payment"}
      </Button>
      {act.error && <p className="field__error" role="alert">{act.error}</p>}
    </div>
  );
}

function ChallengeForm({ r }: { r: RequestRow }) {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const act = useAction();
  const amount = BigInt(r.amount);
  const bond = bondFor(amount);
  const err = checkText("The reason", reason, 1, LIMITS.maxReason);
  return (
    <div className="stack tight">
      <Field label="Why should this be stopped?" htmlFor="ch-reason" error={touched ? err : null} counter={<Counter text={reason} min={1} max={LIMITS.maxReason} />} hint="State the concrete problem. A second AI reads the request again with your reason.">
        <TextArea id="ch-reason" value={reason} onChange={setReason} rows={3} invalid={touched && !!err} testId="ch-reason" />
      </Field>
      <p className="bondline">
        Bond to post: <b>{formatGen(bond)}</b>. If the audit upholds your challenge you get it back plus up to <b>{formatGen(rewardFor(amount))}</b>. If it is dismissed the bond goes to the mandate.
      </p>
      <Button
        variant="primary"
        busy={act.busy}
        onClick={() => {
          setTouched(true);
          if (!err) void act.run(() => write.challenge(r.id, reason.trim(), bond));
        }}
        data-testid="ch-submit"
      >
        Challenge with a bond of {formatGen(bond)}
      </Button>
      {act.error && <p className="field__error" role="alert">{act.error}</p>}
    </div>
  );
}

function Countdown({ label, to, now }: { label: string; to: number; now: number }) {
  const left = to - now;
  return (
    <li>
      <span>{label}</span>
      <strong className="num">{left > 0 ? `in ${formatDuration(left)}` : "now"}</strong>
      <small className="muted">{formatDateTime(to)}</small>
    </li>
  );
}

const byText = (n: number): string => (BY_LABEL[n] ?? "nobody").replace(/^The /, "the ").replace(/^Nobody yet$/, "nobody");

function headline(r: RequestRow, m: MandateRow, stale: boolean, now: number): string {
  const st = stateName(r.state);
  if (stale && OPEN_STATES.includes(r.state)) return "This request ran out of time, or its mandate or seat went away. Anyone can close it, which releases any reserved money.";
  switch (st) {
    case "PENDING":
      return "Filed and waiting for its AI review. Anyone can start the review.";
    case "ESCALATED":
      return "The AI reviewer was not sure. The owner or the guardian has to decide.";
    case "APPROVED":
      return now < r.ready_at ? `Approved by ${byText(r.decided_by)}. It waits out the review delay, so a human can veto it and a watcher can challenge it.` : `Approved and past its review delay. It can be paid now, for the next ${formatDuration(Math.max(0, r.ready_at + m.exec_grace - now))}.`;
    case "CHALLENGED":
      return "A watcher challenged the approval. The money stays reserved until the audit settles it.";
    case "EXECUTED":
      return "Paid. The payee has received the money.";
    case "REJECTED":
      return `Refused by ${byText(r.decided_by)}. Nothing was paid.`;
    case "VETOED":
      return "Stopped after it was approved. Nothing was paid.";
    case "CANCELLED":
      return "Withdrawn by the agent. Nothing was paid.";
    default:
      return "Closed without a payment because nobody acted in time.";
  }
}

export default function Request() {
  const params = useParams();
  const valid = /^\d+$/.test(params.id ?? "");
  const id = Number(params.id);
  const w = useWallet();
  const now = useNow(1000);
  const req = useAsync(() => api.request(id), [id], { enabled: valid, interval: 12000 });
  const r = req.data;
  const man = useAsync(() => api.mandate(r!.mandate), [r?.mandate], { enabled: !!r, interval: 20000 });
  const m = man.data;
  useDocumentTitle(`Request ${params.id ?? ""}`);

  if (!valid) return <NotFound what="request" />;
  if (req.loading && !r) return <PageLoader label="Loading the request" />;
  if (req.error && !r) {
    return /No such request/i.test(req.error.message) ? (
      <NotFound what="request" id={id} />
    ) : (
      <div className="page section">
        <ErrorState error={req.error} retry={req.reload} />
      </div>
    );
  }
  if (!r) return null;
  if (!m) {
    return man.error ? (
      <div className="page section">
        <ErrorState error={man.error} retry={man.reload} />
      </div>
    ) : (
      <PageLoader label="Loading the mandate" />
    );
  }

  const me = w.account;
  const role = roleOf(m, me);
  const actions = requestActions(r, m, me, now);
  const open = OPEN_STATES.includes(r.state);
  const st = stateName(r.state);
  const stale = open && actions.expire.enabled;
  const isMine = sameAddr(r.delegate, me);

  const show = {
    review: r.state === S.PENDING,
    decide: r.state === S.ESCALATED,
    execute: r.state === S.APPROVED,
    challenge: r.state === S.APPROVED,
    audit: r.state === S.CHALLENGED,
    veto: r.state === S.APPROVED || r.state === S.CHALLENGED,
    cancel: [S.PENDING, S.ESCALATED, S.APPROVED].includes(r.state),
  };

  return (
    <>
      <div className="page crumb">
        <Link to={`/app/mandates/${m.id}?tab=requests`} className="back">
          <ArrowLeft size={15} /> {m.name}
        </Link>
      </div>
      <PageHead title={<>Request #{r.id}</>}>
        <span className="head-meta">
          <StateChip state={r.state} />
          <Gen wei={r.amount} />
          {role !== "none" && <RoleChip role={role} />}
          {isMine && <Chip tone="ok">Your request</Chip>}
        </span>
      </PageHead>

      <div className="page section--tight">
        <div className={`status-banner status-banner--${st.toLowerCase()}`} data-testid="status-banner" aria-live="polite">
          <strong>{stale ? "Out of time" : st === "EXECUTED" ? "Paid" : st[0] + st.slice(1).toLowerCase()}</strong>
          <span>{headline(r, m, stale, now)}</span>
        </div>
      </div>

      <div className="page split request-split">
        <div className="stack">
          {open && (r.state === S.APPROVED || r.state === S.PENDING || r.state === S.ESCALATED) && (
            <ul className="countdowns" aria-label="Times that matter">
              {r.state === S.APPROVED && <Countdown label="Can be paid" to={r.ready_at} now={now} />}
              {r.state === S.APPROVED && <Countdown label="No longer payable" to={r.ready_at + m.exec_grace} now={now} />}
              {(r.state === S.PENDING || r.state === S.ESCALATED) && <Countdown label="Goes stale" to={r.decide_by} now={now} />}
            </ul>
          )}

          <section className="panel">
            <h3>The request</h3>
            <Facts
              items={[
                { label: "Mandate", value: <Link to={`/app/mandates/${m.id}`}>{m.name}</Link> },
                { label: "Filed by", value: <Address value={r.delegate} full /> },
                { label: "Pay to", value: <Address value={r.payee} full /> },
                { label: "Amount", value: <Gen wei={r.amount} /> },
                { label: "Purpose", value: <span className="policy-text">{r.purpose}</span> },
                { label: "Evidence", value: r.url ? <ExternalLinkText href={r.url}>{r.url}</ExternalLinkText> : <span className="muted">None</span> },
                { label: "Filed", value: formatDateTime(r.created) },
                { label: "Decided by", value: BY_LABEL[r.decided_by] ?? "—" },
                ...(r.note ? [{ label: "Note", value: r.note }] : []),
                ...(r.executed_at ? [{ label: "Paid at", value: formatDateTime(r.executed_at) }] : []),
                ...(r.closed_at ? [{ label: "Closed at", value: formatDateTime(r.closed_at) }] : []),
                ...(r.tries ? [{ label: "Review attempts", value: `${r.tries} of ${LIMITS.maxTries}`, hint: "A review that cannot read the evidence page is retried, then sent to a human." }] : []),
              ]}
            />
          </section>

          {r.review && <Verdict title="AI review" info={r.review} />}

          {(r.challenged || r.audit) && (
            <section className="panel" data-testid="challenge-panel">
              <h3>Challenge</h3>
              <Facts
                compact
                items={[
                  { label: "Watcher", value: r.challenger ? <Address value={r.challenger} full /> : "—" },
                  { label: "Bond", value: <><Gen wei={r.bond} /> <span className="muted">({BOND_LABEL[r.bond_state]})</span></> },
                  { label: "Claim", value: r.claim || "—" },
                ]}
              />
            </section>
          )}
          {r.audit && <Verdict title={r.audit.upheld === undefined ? "Audit" : r.audit.upheld ? "Audit: challenge upheld" : "Audit: challenge dismissed"} info={r.audit} />}

          <Disclosure summary="Where this request is in its life">
            <div className="lc-scroll">
              <Lifecycle current={st} />
            </div>
          </Disclosure>
        </div>

        <aside className="stack actions" aria-label="Actions">
          <h3 className="actions__title">What you can do</h3>
          {!open && <Callout tone="note">{STATE_HELP[st]} Nothing more can be done with it.</Callout>}
          {open && !me && <Callout tone="note">Connect a wallet to act on this request.</Callout>}

          {open && show.review && (
            <ActionCard icon={<ScanSearch size={18} />} title="Start the AI review" text="Validators read the policy, the purpose and the evidence. It can take a few minutes. It can approve inside the limits, escalate or reject." state={actions.review}>
              <Simple label="Start the review" call={() => write.review(r.id)} testId="review-submit" />
            </ActionCard>
          )}

          {open && show.decide && (
            <ActionCard icon={<Gavel size={18} />} title="Decide" text="The AI was not sure, so the choice is yours." state={actions.decide}>
              <div className="stack">
                <NoteForm r={r} mode="approve" />
                <NoteForm r={r} mode="reject" />
              </div>
            </ActionCard>
          )}

          {open && show.execute && (
            <ActionCard icon={<Banknote size={18} />} title="Pay it" text="Sends the money to the payee. Anyone can do this once the review delay has passed." state={actions.execute}>
              <Simple label={`Pay ${formatGen(r.amount)}`} call={() => write.execute(r.id)} testId="execute-submit" />
            </ActionCard>
          )}

          {open && show.challenge && r.decided_by === BY.ai && (
            <ActionCard icon={<ShieldAlert size={18} />} title="Challenge the approval" text="If you think the AI was wrong to approve, post a bond and a second review will audit it. Only possible during the review delay." state={actions.challenge}>
              <ChallengeForm r={r} />
            </ActionCard>
          )}

          {open && show.audit && (
            <ActionCard icon={<BadgeCheck size={18} />} title="Run the audit" text="A second AI review reads the request again with the challenger's reason. Anyone can start it." state={actions.audit}>
              <Simple label="Start the audit" call={() => write.audit(r.id)} testId="audit-submit" />
            </ActionCard>
          )}

          {open && show.veto && (
            <ActionCard icon={<Ban size={18} />} title="Veto" text="Stops the payment and releases the reserved money. Only the owner and the guardian can." state={actions.veto}>
              <NoteForm r={r} mode="veto" />
            </ActionCard>
          )}

          {open && show.cancel && (
            <ActionCard icon={<Undo2 size={18} />} title="Withdraw the request" text="The agent that filed it can take it back before it is paid." state={actions.cancel}>
              <Simple label="Withdraw request" variant="secondary" call={() => write.cancelRequest(r.id)} testId="cancel-submit" />
            </ActionCard>
          )}

          {open && (
            <ActionCard icon={<Hourglass size={18} />} title="Close an expired request" text="When nobody acts in time, or the mandate or the seat is gone, anyone can close the request." state={actions.expire}>
              <Simple label="Close the request" variant="secondary" call={() => write.expire(r.id)} testId="expire-submit" />
            </ActionCard>
          )}
        </aside>
      </div>
    </>
  );
}

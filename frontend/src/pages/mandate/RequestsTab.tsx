import { useState } from "react";
import { Link } from "react-router-dom";
import { Send } from "lucide-react";
import { api, write } from "../../lib/api";
import { formatGen, weiToGenText } from "../../lib/format";
import { useAsync } from "../../lib/hooks";
import { useAction } from "../../lib/useAction";
import { LIMITS } from "../../lib/types";
import type { MandateRow } from "../../lib/types";
import { checkAddress, checkAmount, checkEvidence, checkText, looksLikeSteering } from "../../lib/validate";
import { Gen } from "../../components/Common";
import { AddressInput, Counter, Field, GenInput, TextArea } from "../../components/Fields";
import { RequestList } from "../../components/RequestList";
import { Button, Callout, EmptyState, ErrorState } from "../../components/ui";
import { Skeleton } from "../../components/Spinners";

const PAGE = 15;

function RequestForm({ m, me }: { m: MandateRow; me: string }) {
  const [payee, setPayee] = useState("");
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [evidence, setEvidence] = useState("");
  const [touched, setTouched] = useState(false);
  const act = useAction();
  const allowance = useAsync(() => api.allowance(m.id, me), [m.id, me], { interval: 30000 });
  const a = allowance.data;

  const amt = checkAmount("The amount", amount);
  const errors = {
    payee: checkAddress("The payee", payee) ?? (payee.trim().toLowerCase() === me.toLowerCase() ? "A seat cannot pay itself." : m.payee_mode === 1 && !m.payees.some((p) => p.toLowerCase() === payee.trim().toLowerCase()) ? "That payee is not on the allowlist." : null),
    amount: amt.error ?? (a && amt.wei !== null && amt.wei > BigInt(a.max_request) ? `You can ask for at most ${formatGen(a.max_request)} right now.` : null),
    purpose: checkText("The purpose", purpose, LIMITS.minPurpose, LIMITS.maxPurpose) ?? (looksLikeSteering(purpose) ? "This reads like an instruction to the reviewer. Describe what the money is for." : null),
    evidence: checkEvidence(evidence, m.need_evidence),
  };
  const bad = Object.values(errors).some(Boolean);
  const shown = (k: keyof typeof errors) => (touched ? errors[k] : null);

  return (
    <form
      className="panel form"
      data-testid="request-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (bad || amt.wei === null) return;
        void act.run(() => write.requestPayment({ id: m.id, payee: payee.trim(), amount: amt.wei!, purpose: purpose.trim(), evidence: evidence.trim() })).then((r) => {
          if (r.ok) {
            setPayee("");
            setAmount("");
            setPurpose("");
            setEvidence("");
            setTouched(false);
          }
        });
      }}
    >
      <h3>File a payment request</h3>
      {a && !a.usable && <Callout tone="warn">This mandate is paused or has ended, so it takes no new requests.</Callout>}
      {a && a.usable && (
        <ul className="allowance" aria-label="What you can ask for">
          <li>
            <span>You can ask for up to</span>
            <strong><Gen wei={a.max_request} /></strong>
          </li>
          <li>
            <span>Seat budget left</span>
            <strong><Gen wei={a.seat_left} /></strong>
          </li>
          <li>
            <span>Window room</span>
            <strong><Gen wei={a.window_left} /></strong>
          </li>
          <li>
            <span>Open request slots</span>
            <strong className="num">{a.open_slots}</strong>
          </li>
        </ul>
      )}
      <Field label="Pay to" htmlFor="rq-payee" error={shown("payee")}>
        <AddressInput id="rq-payee" value={payee} onChange={setPayee} invalid={!!shown("payee")} testId="rq-payee" />
      </Field>
      <Field label="Amount" htmlFor="rq-amount" error={shown("amount")}>
        <GenInput id="rq-amount" value={amount} onChange={setAmount} invalid={!!shown("amount")} testId="rq-amount" max={a && a.usable && BigInt(a.max_request) > 0n ? { label: "Max", onClick: () => setAmount(weiToGenText(a.max_request)) } : undefined} />
      </Field>
      <Field label="Purpose" htmlFor="rq-purpose" error={shown("purpose")} counter={<Counter text={purpose} min={LIMITS.minPurpose} max={LIMITS.maxPurpose} />} hint="Say what the money is for, plainly. The AI reviewer compares it with the policy.">
        <TextArea id="rq-purpose" value={purpose} onChange={setPurpose} rows={4} invalid={!!shown("purpose")} testId="rq-purpose" />
      </Field>
      <Field label="Evidence link" htmlFor="rq-evidence" optional={!m.need_evidence} error={shown("evidence")} hint="One public page that backs the payment, such as an invoice or a pull request. The reviewer reads it. Each link can back one request.">
        <input id="rq-evidence" className="input" inputMode="url" autoComplete="off" spellCheck={false} placeholder="https://…" value={evidence} onChange={(e) => setEvidence(e.target.value)} aria-invalid={!!shown("evidence") || undefined} data-testid="rq-evidence" />
      </Field>
      <div className="row">
        <Button type="submit" variant="primary" busy={act.busy} icon={<Send size={16} />} data-testid="rq-submit">
          File request
        </Button>
        {act.done && <span className="ok-text">Request filed.</span>}
      </div>
      {act.error && <p className="field__error" role="alert">{act.error}</p>}
    </form>
  );
}

export function RequestsTab({ m, me, isSeat }: { m: MandateRow; me: string | null; isSeat: boolean }) {
  const [page, setPage] = useState(0);
  const list = useAsync(() => api.requests(m.id, page * PAGE, PAGE), [m.id, page], { interval: 20000 });
  const pages = Math.max(1, Math.ceil(m.requests / PAGE));
  return (
    <div className={isSeat ? "split" : ""}>
      <section className="stack">
        {list.error && !list.data && <ErrorState error={list.error} retry={list.reload} />}
        {list.loading && !list.data && <Skeleton height={180} radius={12} />}
        {list.data && list.data.length === 0 && (
          <EmptyState title="No requests yet">{isSeat ? "File the first request with the form." : "Agents with a seat can file payment requests. They show up here as soon as they do."}</EmptyState>
        )}
        {list.data && list.data.length > 0 && <RequestList rows={list.data} me={me} />}
        {pages > 1 && (
          <div className="row row--between">
            <Button size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Newer</Button>
            <span className="muted num">Page {page + 1} of {pages}</span>
            <Button size="sm" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Older</Button>
          </div>
        )}
        {!isSeat && me && (
          <p className="muted fineprint">
            You do not hold a seat in this mandate. Seats are given by the owner on the <Link to={`/app/mandates/${m.id}?tab=seats`}>Seats and payees</Link> tab.
          </p>
        )}
      </section>
      {isSeat && me && <RequestForm m={m} me={me} />}
    </div>
  );
}

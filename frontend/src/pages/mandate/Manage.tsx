import { useState } from "react";
import { Pause, Play } from "lucide-react";
import { write } from "../../lib/api";
import { formatDuration, formatGen, sameAddr, weiToGenText } from "../../lib/format";
import { useAction } from "../../lib/useAction";
import { LIMITS, PAYEE } from "../../lib/types";
import type { MandateRow, Role } from "../../lib/types";
import { checkAddress, checkAmount, checkRange, checkText, looksLikeSteering } from "../../lib/validate";
import { AddressInput, Counter, DurationInput, Field, GenInput, TextArea, Toggle } from "../../components/Fields";
import { Button, Callout } from "../../components/ui";

const unitText = (s: number) => formatDuration(s);

function Panel({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section className="panel form">
      <h3>{title}</h3>
      {intro && <p className="muted">{intro}</p>}
      {children}
    </section>
  );
}

function Result({ act, ok }: { act: ReturnType<typeof useAction>; ok: string }) {
  return (
    <>
      {act.done && <span className="ok-text">{ok}</span>}
      {act.error && <p className="field__error" role="alert">{act.error}</p>}
    </>
  );
}

function PauseBox({ m, role }: { m: MandateRow; role: Role }) {
  const act = useAction();
  const canResume = role === "owner";
  return (
    <Panel title={m.paused ? "Paused" : "Pause"} intro="A paused mandate accepts no new request and pays nothing. Everything already in progress can still be vetoed, withdrawn, closed and withdrawn from.">
      {m.paused && !canResume ? (
        <Callout tone="note">Only the owner can resume a mandate.</Callout>
      ) : (
        <div className="row">
          <Button variant={m.paused ? "primary" : "danger"} busy={act.busy} icon={m.paused ? <Play size={16} /> : <Pause size={16} />} onClick={() => void act.run(() => write.setPaused(m.id, !m.paused))} data-testid="pause-toggle">
            {m.paused ? "Resume mandate" : "Pause mandate"}
          </Button>
          <Result act={act} ok={m.paused ? "Resumed." : "Paused."} />
        </div>
      )}
    </Panel>
  );
}

function PolicyBox({ m }: { m: MandateRow }) {
  const [text, setText] = useState(m.policy);
  const [touched, setTouched] = useState(false);
  const act = useAction();
  const err = checkText("The policy", text, LIMITS.minPolicy, LIMITS.maxPolicy) ?? (looksLikeSteering(text) ? "The policy reads like an instruction to the reviewer. Describe what may be paid." : null);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (!err) void act.run(() => write.setPolicy(m.id, text.trim()));
      }}
      noValidate
    >
      <Panel title="Policy" intro="Requests that are still waiting are reviewed against the new text.">
        <Field label="Policy" htmlFor="mg-policy" error={touched ? err : null} counter={<Counter text={text} min={LIMITS.minPolicy} max={LIMITS.maxPolicy} />}>
          <TextArea id="mg-policy" value={text} onChange={setText} rows={6} invalid={touched && !!err} testId="mg-policy" />
        </Field>
        <div className="row">
          <Button type="submit" busy={act.busy} disabled={text.trim() === m.policy.trim()}>Save policy</Button>
          <Result act={act} ok="Policy saved." />
        </div>
      </Panel>
    </form>
  );
}

function LimitsBox({ m }: { m: MandateRow }) {
  const [per, setPer] = useState(weiToGenText(m.per_payment_cap));
  const [win, setWin] = useState(weiToGenText(m.window_cap));
  const [delay, setDelay] = useState(m.review_delay);
  const [touched, setTouched] = useState(false);
  const act = useAction();
  const p = checkAmount("The per-payment limit", per);
  const w = checkAmount("The window limit", win);
  const wErr = w.error ?? (p.wei !== null && w.wei !== null && w.wei < p.wei ? "The window limit must be at least the per-payment limit." : null);
  const dErr = checkRange("The review delay", delay, LIMITS.minDelay, LIMITS.maxDelay, unitText);
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (p.error || wErr || dErr || p.wei === null || w.wei === null) return;
        void act.run(() => write.setLimits({ id: m.id, perPaymentCap: p.wei!, windowCap: w.wei!, reviewDelay: delay }));
      }}
    >
      <Panel title="Limits" intro="New limits apply to every payment from now on, also to approvals that are still waiting.">
        <div className="field__row">
          <Field label="Most for one payment" htmlFor="mg-per" error={touched ? p.error : null}>
            <GenInput id="mg-per" value={per} onChange={setPer} invalid={touched && !!p.error} testId="mg-per" />
          </Field>
          <Field label="Most inside the window" htmlFor="mg-win" error={touched ? wErr : null} hint={`The window is ${formatDuration(m.window_secs)} and is fixed when the mandate is created.`}>
            <GenInput id="mg-win" value={win} onChange={setWin} invalid={touched && !!wErr} testId="mg-win" />
          </Field>
        </div>
        <Field label="Review delay" htmlFor="mg-delay" error={touched ? dErr : null}>
          <DurationInput id="mg-delay" seconds={delay} onChange={setDelay} invalid={touched && !!dErr} testId="mg-delay" />
        </Field>
        <div className="row">
          <Button type="submit" busy={act.busy}>Save limits</Button>
          <Result act={act} ok="Limits saved." />
        </div>
      </Panel>
    </form>
  );
}

function RulesBox({ m }: { m: MandateRow }) {
  const [mode, setMode] = useState(m.payee_mode);
  const [evidence, setEvidence] = useState(m.need_evidence);
  const [auto, setAuto] = useState(m.auto_risk);
  const [reject, setReject] = useState(m.reject_risk);
  const [esc, setEsc] = useState(m.escalation_window);
  const [grace, setGrace] = useState(m.exec_grace);
  const [endsOn, setEndsOn] = useState(m.expires_at !== 0);
  const [endsIn, setEndsIn] = useState(m.expires_at ? Math.max(LIMITS.minExpiry, m.expires_at - Math.floor(Date.now() / 1000)) : 30 * 86400);
  const [touched, setTouched] = useState(false);
  const act = useAction();
  const riskErr = auto < 0 || reject > 100 || auto > reject ? "The limits must satisfy 0 ≤ approve ≤ reject ≤ 100." : null;
  const escErr = checkRange("The decision time", esc, LIMITS.minSpan, LIMITS.maxSpan, unitText);
  const graceErr = checkRange("The payable time", grace, LIMITS.minSpan, LIMITS.maxSpan, unitText);
  const endErr = endsOn ? checkRange("The expiry", endsIn, LIMITS.minExpiry, LIMITS.maxExpiry, unitText) : null;
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (riskErr || escErr || graceErr || endErr) return;
        // The contract resets the end date on every call, so keep an existing one only when it is still wanted.
        void act.run(() => write.setRules({ id: m.id, payeeMode: mode, needEvidence: evidence, autoRisk: auto, rejectRisk: reject, escalationWindow: esc, execGrace: grace, expiresIn: endsOn ? endsIn : 0 }));
      }}
    >
      <Panel title="Review rules" intro="How strict the AI reviewer is, who can be paid, and when the mandate ends.">
        <Field label="Who can be paid">
          <div className="segmented" role="radiogroup" aria-label="Who can be paid">
            <button type="button" role="radio" aria-checked={mode === PAYEE.any} onClick={() => setMode(PAYEE.any)}>Any address</button>
            <button type="button" role="radio" aria-checked={mode === PAYEE.listed} onClick={() => setMode(PAYEE.listed)}>Listed payees only</button>
          </div>
        </Field>
        <Toggle checked={evidence} onChange={setEvidence} title="Require a link to evidence" hint="Every new request must link a public page that backs the payment." />
        <div className="field__row">
          <Field label="AI may approve up to risk" htmlFor="mg-auto">
            <input id="mg-auto" type="number" min={0} max={100} className="input num" value={auto} onChange={(e) => setAuto(Number(e.target.value))} />
          </Field>
          <Field label="AI rejects above risk" htmlFor="mg-rej">
            <input id="mg-rej" type="number" min={0} max={100} className="input num" value={reject} onChange={(e) => setReject(Number(e.target.value))} />
          </Field>
        </div>
        {touched && riskErr && <p className="field__error" role="alert">{riskErr}</p>}
        <div className="field__row">
          <Field label="Time for a human to decide" htmlFor="mg-esc" error={touched ? escErr : null}>
            <DurationInput id="mg-esc" seconds={esc} onChange={setEsc} invalid={touched && !!escErr} />
          </Field>
          <Field label="Time an approval stays payable" htmlFor="mg-grace" error={touched ? graceErr : null}>
            <DurationInput id="mg-grace" seconds={grace} onChange={setGrace} invalid={touched && !!graceErr} />
          </Field>
        </div>
        <Toggle checked={endsOn} onChange={setEndsOn} title="End the mandate automatically" hint="Saving these rules restarts the countdown from now. Funds can always be withdrawn." />
        {endsOn && (
          <Field label="Ends in" htmlFor="mg-end" error={touched ? endErr : null}>
            <DurationInput id="mg-end" seconds={endsIn} onChange={setEndsIn} invalid={touched && !!endErr} />
          </Field>
        )}
        <div className="row">
          <Button type="submit" busy={act.busy} data-testid="rules-save">Save rules</Button>
          <Result act={act} ok="Rules saved." />
        </div>
      </Panel>
    </form>
  );
}

function GuardianBox({ m }: { m: MandateRow }) {
  const [who, setWho] = useState(m.guardian);
  const [touched, setTouched] = useState(false);
  const act = useAction();
  const err = checkAddress("The guardian", who, { optional: true }) ?? (who.trim() && sameAddr(who.trim(), m.owner) ? "The guardian has to be someone other than the owner." : null);
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (!err) void act.run(() => write.setGuardian(m.id, who.trim()));
      }}
    >
      <Panel title="Guardian" intro="A second key that can veto, decide escalations, revoke seats and pause. It can never move or configure money. Leave empty to remove it.">
        <Field label="Guardian address" htmlFor="mg-guard" error={touched ? err : null}>
          <AddressInput id="mg-guard" value={who} onChange={setWho} invalid={touched && !!err} testId="mg-guard" />
        </Field>
        <div className="row">
          <Button type="submit" busy={act.busy} disabled={who.trim().toLowerCase() === m.guardian.toLowerCase()}>{who.trim() ? "Save guardian" : "Remove guardian"}</Button>
          <Result act={act} ok="Saved." />
        </div>
      </Panel>
    </form>
  );
}

function WithdrawBox({ m }: { m: MandateRow }) {
  const [amount, setAmount] = useState("");
  const [touched, setTouched] = useState(false);
  const act = useAction();
  const c = checkAmount("The amount", amount, { min: 1n });
  const over = c.wei !== null && c.wei > BigInt(m.free) ? `Only ${formatGen(m.free)} is free. The rest is reserved by approved requests.` : null;
  const err = c.error ?? over;
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (err || c.wei === null) return;
        void act.run(() => write.withdraw(m.id, c.wei!)).then((r) => r.ok && setAmount(""));
      }}
    >
      <Panel title="Withdraw" intro="Takes funds that no approved request has reserved back to your wallet.">
        <Field label="Amount" htmlFor="mg-wd" error={touched ? err : null} hint={`Free to withdraw: ${formatGen(m.free)}`}>
          <GenInput id="mg-wd" value={amount} onChange={setAmount} invalid={touched && !!err} testId="mg-wd" max={BigInt(m.free) > 0n ? { label: "All", onClick: () => setAmount(weiToGenText(m.free)) } : undefined} />
        </Field>
        <div className="row">
          <Button type="submit" busy={act.busy} data-testid="wd-submit">Withdraw</Button>
          <Result act={act} ok="Withdrawn." />
        </div>
      </Panel>
    </form>
  );
}

export function Manage({ m, role }: { m: MandateRow; role: Role }) {
  if (role !== "owner" && role !== "guardian") {
    return <Callout tone="note" title="Only the owner and the guardian manage a mandate">Connect the owner or guardian wallet to change limits, rules, seats or funds.</Callout>;
  }
  if (role === "guardian") {
    return (
      <div className="stack manage">
        <Callout tone="note" title="You are the guardian">You can pause the mandate here, revoke seats on the Seats tab, and veto or decide requests on their pages. Limits, rules and money belong to the owner.</Callout>
        {!m.paused && <PauseBox m={m} role={role} />}
      </div>
    );
  }
  return (
    <div className="manage">
      <div className="stack">
        <PauseBox m={m} role={role} />
        <PolicyBox m={m} />
        <LimitsBox m={m} />
      </div>
      <div className="stack">
        <RulesBox m={m} />
        <GuardianBox m={m} />
        <WithdrawBox m={m} />
      </div>
    </div>
  );
}

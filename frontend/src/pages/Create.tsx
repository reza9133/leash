import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Repeat, Wallet } from "lucide-react";
import { api, write } from "../lib/api";
import { formatDuration, formatGen, sameAddr } from "../lib/format";
import { useDocumentTitle } from "../lib/hooks";
import { LIMITS, PAYEE } from "../lib/types";
import { bondFor, checkAddress, checkAmount, checkRange, checkText, looksLikeSteering } from "../lib/validate";
import { onStudionet, openConnect, switchToStudionet, useWallet } from "../lib/wallet/wallet";
import { Field, GenInput, AddressInput, TextArea, Counter, DurationInput, Toggle } from "../components/Fields";
import { PageHead } from "../components/Common";
import { Button, Callout, Disclosure } from "../components/ui";

const POLICY_EXAMPLES = [
  { label: "Research agent", text: "Pay for API access, data sets and cloud compute that a research agent needs for its assigned project. No payments to individuals, no subscriptions that renew by themselves, nothing for entertainment." },
  { label: "Ops agent", text: "Pay vendor invoices for infrastructure and tooling that the engineering team already uses. The payee must match the vendor named on the invoice. Anything unusual or new needs a human to decide." },
  { label: "Community grants", text: "Pay small bounties to contributors for merged work that is linked as evidence. One bounty per piece of work. Never pay the person who files the request." },
];

const unitText = (s: number) => formatDuration(s);

export default function Create() {
  useDocumentTitle("New mandate");
  const nav = useNavigate();
  const w = useWallet();
  const connected = w.status === "connected";
  const right = onStudionet(w);

  const [name, setName] = useState("");
  const [policy, setPolicy] = useState("");
  const [perPayment, setPerPayment] = useState("1");
  const [windowCap, setWindowCap] = useState("5");
  const [windowSecs, setWindowSecs] = useState(86400);
  const [delay, setDelay] = useState(600);
  const [guardian, setGuardian] = useState("");
  const [deposit, setDeposit] = useState("");

  const [payeeMode, setPayeeMode] = useState<number>(PAYEE.any);
  const [needEvidence, setNeedEvidence] = useState(false);
  const [autoRisk, setAutoRisk] = useState(LIMITS.defaultAuto);
  const [rejectRisk, setRejectRisk] = useState(LIMITS.defaultReject);
  const [escalation, setEscalation] = useState(LIMITS.defaultSpan);
  const [grace, setGrace] = useState(LIMITS.defaultSpan);
  const [expires, setExpires] = useState(false);
  const [expiresIn, setExpiresIn] = useState(30 * 86400);

  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const problems = useMemo(() => {
    const e: Record<string, string | null> = {};
    e.name = checkText("The name", name, LIMITS.minName, LIMITS.maxName);
    e.policy = checkText("The policy", policy, LIMITS.minPolicy, LIMITS.maxPolicy) ?? (looksLikeSteering(policy) ? "The policy reads like an instruction to the reviewer. Describe what may be paid, not how to answer." : null);
    const per = checkAmount("The per-payment limit", perPayment);
    const win = checkAmount("The window limit", windowCap);
    e.per = per.error;
    e.win = win.error ?? (per.wei !== null && win.wei !== null && win.wei < per.wei ? "The window limit must be at least the per-payment limit." : null);
    e.windowSecs = checkRange("The window", windowSecs, LIMITS.minWindow, LIMITS.maxWindow, unitText);
    e.delay = checkRange("The review delay", delay, LIMITS.minDelay, LIMITS.maxDelay, unitText);
    e.guardian = checkAddress("The guardian", guardian, { optional: true }) ?? (guardian.trim() && w.account && sameAddr(guardian.trim(), w.account) ? "The guardian has to be someone other than you." : null);
    const dep = deposit.trim() === "" ? { error: null, wei: 0n } : checkAmount("The deposit", deposit, { min: 1n });
    e.deposit = dep.error;
    e.risk = autoRisk < 0 || rejectRisk > 100 || autoRisk > rejectRisk ? "The limits must satisfy 0 ≤ approve ≤ reject ≤ 100." : null;
    e.escalation = checkRange("The decision time", escalation, LIMITS.minSpan, LIMITS.maxSpan, unitText);
    e.grace = checkRange("The payable time", grace, LIMITS.minSpan, LIMITS.maxSpan, unitText);
    e.expires = expires ? checkRange("The expiry", expiresIn, LIMITS.minExpiry, LIMITS.maxExpiry, unitText) : null;
    return { e, per: per.wei, win: win.wei, dep: dep.wei };
  }, [name, policy, perPayment, windowCap, windowSecs, delay, guardian, deposit, autoRisk, rejectRisk, escalation, grace, expires, expiresIn, w.account]);

  const hasError = Object.values(problems.e).some(Boolean);
  const show = (k: string) => (touched ? problems.e[k] : null);

  const rulesChanged = payeeMode !== PAYEE.any || needEvidence || autoRisk !== LIMITS.defaultAuto || rejectRisk !== LIMITS.defaultReject || escalation !== LIMITS.defaultSpan || grace !== LIMITS.defaultSpan || expires;

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setTouched(true);
    setMessage(null);
    if (!connected) return openConnect();
    if (!right) return void switchToStudionet();
    if (hasError || problems.per === null || problems.win === null) return;
    setBusy(true);
    try {
      const made = await write.createMandate({
        name: name.trim(),
        policy: policy.trim(),
        perPaymentCap: problems.per,
        windowCap: problems.win,
        windowSecs,
        reviewDelay: delay,
        guardian: guardian.trim(),
        deposit: problems.dep ?? 0n,
      });
      if (!made.ok) {
        setMessage(made.message ?? "The mandate was not created.");
        return;
      }
      let id = made.returned !== undefined && /^\d+$/.test(made.returned) ? Number(made.returned) : NaN;
      if (!Number.isFinite(id) && w.account) {
        const mine = await api.mandatesOf(w.account, 0, 10).catch(() => []);
        id = mine.find((m) => m.name === name.trim().replace(/\s+/g, " "))?.id ?? mine[0]?.id ?? NaN;
      }
      if (Number.isFinite(id) && rulesChanged) {
        const r = await write.setRules({ id, payeeMode, needEvidence, autoRisk, rejectRisk, escalationWindow: escalation, execGrace: grace, expiresIn: expires ? expiresIn : 0 });
        if (!r.ok) setMessage(`The mandate was created, but its extra rules were not saved: ${r.message ?? "the call failed"}. You can set them on the Manage tab.`);
      }
      nav(Number.isFinite(id) ? `/app/mandates/${id}` : "/app");
    } finally {
      setBusy(false);
    }
  }

  const bond = problems.per ? bondFor(problems.per) : null;

  return (
    <>
      <PageHead title="New mandate">A mandate is a pot of money with rules. You set the limits once. Agents you give a seat can ask for payments, and the contract refuses anything outside them.</PageHead>
      <form className="page create" onSubmit={(e) => void submit(e)} noValidate>
        <div className="create__form form">
          <fieldset className="fieldset">
            <legend>What is it for</legend>
            <Field label="Name" htmlFor="m-name" error={show("name")} counter={<Counter text={name} min={LIMITS.minName} max={LIMITS.maxName} />}>
              <input id="m-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Research budget" autoComplete="off" aria-invalid={!!show("name") || undefined} data-testid="m-name" />
            </Field>
            <Field
              label="Policy"
              htmlFor="m-policy"
              error={show("policy")}
              counter={<Counter text={policy} min={LIMITS.minPolicy} max={LIMITS.maxPolicy} />}
              hint="Write in plain words what may be paid and what may not. The AI reviewer reads every request against this text. It can refuse a request that does not fit, but it can never allow more than the limits below."
            >
              <TextArea id="m-policy" value={policy} onChange={setPolicy} rows={6} invalid={!!show("policy")} placeholder="Pay for…" testId="m-policy" />
            </Field>
            <div className="chips-row" aria-label="Examples">
              <span className="muted">Start from</span>
              {POLICY_EXAMPLES.map((x) => (
                <button key={x.label} type="button" className="chip-btn" onClick={() => setPolicy(x.text)}>
                  {x.label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="fieldset">
            <legend>Hard limits</legend>
            <div className="field__row">
              <Field label="Most for one payment" htmlFor="m-per" error={show("per")} hint="No single request can be larger.">
                <GenInput id="m-per" value={perPayment} onChange={setPerPayment} invalid={!!show("per")} testId="m-per" />
              </Field>
              <Field label="Most inside the window" htmlFor="m-win" error={show("win")} hint="All payments together, in any rolling window.">
                <GenInput id="m-win" value={windowCap} onChange={setWindowCap} invalid={!!show("win")} testId="m-win" />
              </Field>
            </div>
            <div className="field__row">
              <Field label="Window length" htmlFor="m-wlen" error={show("windowSecs")} hint="From 1 minute to 30 days.">
                <DurationInput id="m-wlen" seconds={windowSecs} onChange={setWindowSecs} invalid={!!show("windowSecs")} testId="m-wlen" />
              </Field>
              <Field label="Review delay" htmlFor="m-delay" error={show("delay")} hint="How long an approval waits before it can be paid. This is your time to veto, and a watcher's time to challenge.">
                <DurationInput id="m-delay" seconds={delay} onChange={setDelay} invalid={!!show("delay")} testId="m-delay" />
              </Field>
            </div>
          </fieldset>

          <fieldset className="fieldset">
            <legend>Money and people</legend>
            <Field label="First deposit" htmlFor="m-dep" optional error={show("deposit")} hint="Sent with the transaction. Anyone can add more later; only you can take it out.">
              <GenInput id="m-dep" value={deposit} onChange={setDeposit} invalid={!!show("deposit")} testId="m-dep" />
            </Field>
            <Field label="Guardian" htmlFor="m-guard" optional error={show("guardian")} hint="A second key that can veto, decide escalations, revoke seats and pause. It can never move or configure money.">
              <AddressInput id="m-guard" value={guardian} onChange={setGuardian} invalid={!!show("guardian")} testId="m-guard" />
            </Field>
          </fieldset>

          <Disclosure summary="Advanced rules" id="advanced">
            <div className="form">
              <Field label="Who can be paid" hint="With a list, only payees you add are accepted. You can edit the list after creating the mandate.">
                <div className="segmented" role="radiogroup" aria-label="Who can be paid">
                  <button type="button" role="radio" aria-checked={payeeMode === PAYEE.any} onClick={() => setPayeeMode(PAYEE.any)}>Any address</button>
                  <button type="button" role="radio" aria-checked={payeeMode === PAYEE.listed} onClick={() => setPayeeMode(PAYEE.listed)}>Listed payees only</button>
                </div>
              </Field>
              <Toggle checked={needEvidence} onChange={setNeedEvidence} title="Require a link to evidence" hint="Every request must link a public page that backs the payment." />
              <div className="field__row">
                <Field label="AI may approve up to risk" htmlFor="m-auto" hint="Requests scored at or below this are approved without a human.">
                  <input id="m-auto" type="number" min={0} max={100} className="input num" value={autoRisk} onChange={(e) => setAutoRisk(Number(e.target.value))} />
                </Field>
                <Field label="AI rejects above risk" htmlFor="m-rej" hint="Between the two numbers, a human decides.">
                  <input id="m-rej" type="number" min={0} max={100} className="input num" value={rejectRisk} onChange={(e) => setRejectRisk(Number(e.target.value))} />
                </Field>
              </div>
              {show("risk") && <p className="field__error" role="alert">{problems.e.risk}</p>}
              <div className="field__row">
                <Field label="Time for a human to decide" htmlFor="m-esc" error={show("escalation")}>
                  <DurationInput id="m-esc" seconds={escalation} onChange={setEscalation} invalid={!!show("escalation")} />
                </Field>
                <Field label="Time an approval stays payable" htmlFor="m-grace" error={show("grace")}>
                  <DurationInput id="m-grace" seconds={grace} onChange={setGrace} invalid={!!show("grace")} />
                </Field>
              </div>
              <Toggle checked={expires} onChange={setExpires} title="End the mandate automatically" hint="After that, nothing new is accepted or paid. Funds can still be withdrawn." />
              {expires && (
                <Field label="Ends in" htmlFor="m-exp" error={show("expires")}>
                  <DurationInput id="m-exp" seconds={expiresIn} onChange={setExpiresIn} invalid={!!show("expires")} />
                </Field>
              )}
              {rulesChanged && <p className="field__hint">These rules are saved with a second transaction right after the mandate is created.</p>}
            </div>
          </Disclosure>

          {message && (
            <Callout tone="danger" title="Not created">
              {message}
            </Callout>
          )}
        </div>

        <aside className="create__side">
          <div className="panel summary">
            <h3>What you are setting up</h3>
            <p>
              An agent can ask for up to <b>{problems.per ? formatGen(problems.per) : "…"}</b> at a time and <b>{problems.win ? formatGen(problems.win) : "…"}</b> in any <b>{Number.isFinite(windowSecs) ? formatDuration(windowSecs) : "…"}</b>.
            </p>
            <p>
              Every approval waits <b>{Number.isFinite(delay) ? formatDuration(delay) : "…"}</b> before it can be paid. {guardian.trim() ? "Your guardian can veto in that time, and so can you." : "You can veto in that time."}
            </p>
            {bond !== null && (
              <p className="muted">
                A watcher who challenges an AI approval of {formatGen(problems.per!)} has to post a bond of {formatGen(bond)}.
              </p>
            )}
            <p className="muted">{problems.dep ? `You will send ${formatGen(problems.dep)} with the transaction.` : "You will fund the mandate afterwards."}</p>
            <Button type="submit" variant="primary" size="lg" busy={busy} icon={!connected ? <Wallet size={18} /> : !right ? <Repeat size={18} /> : undefined} data-testid="create-submit">
              {!connected ? "Connect wallet to continue" : !right ? "Switch network to continue" : "Create mandate"}
            </Button>
            {touched && hasError && <p className="field__error" role="alert">Some fields need attention.</p>}
            <p className="fineprint muted">You sign one transaction. It can take a short while for the validators to agree.</p>
          </div>
        </aside>
      </form>
    </>
  );
}

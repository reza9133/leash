import { useState } from "react";
import { Plus, UserMinus, UserPlus } from "lucide-react";
import { write } from "../../lib/api";
import { sameAddr, weiToGenText } from "../../lib/format";
import { useAction } from "../../lib/useAction";
import { LIMITS, PAYEE } from "../../lib/types";
import type { DelegateRow, MandateRow, Role } from "../../lib/types";
import { checkAddress, checkAmount } from "../../lib/validate";
import { Gen } from "../../components/Common";
import { AddressInput, Field, GenInput } from "../../components/Fields";
import { Address, Button, Callout, Chip, EmptyState } from "../../components/ui";

function GrantForm({ m, prefill }: { m: MandateRow; prefill?: DelegateRow | null }) {
  const [who, setWho] = useState(prefill?.who ?? "");
  const [budget, setBudget] = useState(prefill ? weiToGenText(prefill.budget) : "");
  const [touched, setTouched] = useState(false);
  const act = useAction();
  const budgetCheck = checkAmount("The budget", budget);
  const whoError = checkAddress("The agent", who) ?? (sameAddr(who.trim(), m.owner) ? "The owner cannot hold a seat." : m.guardian && sameAddr(who.trim(), m.guardian) ? "The guardian cannot also hold a seat." : null);
  const full = m.delegates.length >= LIMITS.maxDelegates && !m.delegates.some((d) => sameAddr(d.who, who.trim()));
  return (
    <form
      className="panel form"
      noValidate
      data-testid="grant-form"
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (whoError || budgetCheck.error || budgetCheck.wei === null || full) return;
        void act.run(() => write.grantDelegate(m.id, who.trim(), budgetCheck.wei!)).then((r) => {
          if (r.ok) {
            setWho("");
            setBudget("");
            setTouched(false);
          }
        });
      }}
    >
      <h3>Give an agent a seat</h3>
      <Field label="Agent address" htmlFor="g-who" error={touched ? whoError : null} hint="The address the agent signs with. Giving a seat to an existing address replaces its budget and brings a revoked seat back.">
        <AddressInput id="g-who" value={who} onChange={setWho} invalid={touched && !!whoError} testId="g-who" />
      </Field>
      <Field label="Total budget" htmlFor="g-budget" error={touched ? budgetCheck.error : null} hint="Everything this seat may ever have paid, including requests still open. What it has already used keeps counting.">
        <GenInput id="g-budget" value={budget} onChange={setBudget} invalid={touched && !!budgetCheck.error} testId="g-budget" />
      </Field>
      {full && <p className="field__error" role="alert">All {LIMITS.maxDelegates} seats of this mandate are in use.</p>}
      <div className="row">
        <Button type="submit" variant="primary" busy={act.busy} icon={<UserPlus size={16} />} data-testid="g-submit">
          Grant seat
        </Button>
        {act.done && <span className="ok-text">Seat granted.</span>}
      </div>
      {act.error && <p className="field__error" role="alert">{act.error}</p>}
    </form>
  );
}

function RevokeButton({ m, d }: { m: MandateRow; d: DelegateRow }) {
  const act = useAction();
  return (
    <>
      <Button size="sm" variant="danger" busy={act.busy} icon={<UserMinus size={14} />} onClick={() => void act.run(() => write.revokeDelegate(m.id, d.who))} data-testid={`revoke-${d.who}`}>
        Revoke
      </Button>
      {act.error && <span className="field__error" role="alert">{act.error}</span>}
    </>
  );
}

function PayeeAdd({ m }: { m: MandateRow }) {
  const [who, setWho] = useState("");
  const [touched, setTouched] = useState(false);
  const act = useAction();
  const err = checkAddress("The payee", who) ?? (m.payees.some((p) => sameAddr(p, who.trim())) ? "That payee is already listed." : null);
  return (
    <form
      className="form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (err) return;
        void act.run(() => write.addPayee(m.id, who.trim())).then((r) => {
          if (r.ok) {
            setWho("");
            setTouched(false);
          }
        });
      }}
    >
      <Field label="Add a payee" htmlFor="p-who" error={touched ? err : null}>
        <div className="inline-form">
          <AddressInput id="p-who" value={who} onChange={setWho} invalid={touched && !!err} testId="p-who" />
          <Button type="submit" busy={act.busy} icon={<Plus size={16} />} data-testid="p-add">
            Add
          </Button>
        </div>
      </Field>
      {act.error && <p className="field__error" role="alert">{act.error}</p>}
    </form>
  );
}

function PayeeRow({ m, who, owner }: { m: MandateRow; who: string; owner: boolean }) {
  const act = useAction();
  return (
    <li className="payee">
      <Address value={who} full />
      {owner && (
        <Button size="sm" variant="ghost" busy={act.busy} onClick={() => void act.run(() => write.removePayee(m.id, who))}>
          Remove
        </Button>
      )}
      {act.error && <span className="field__error" role="alert">{act.error}</span>}
    </li>
  );
}

export function Seats({ m, me, role }: { m: MandateRow; me: string | null; role: Role }) {
  const owner = role === "owner";
  const staff = owner || role === "guardian";
  const [edit, setEdit] = useState<DelegateRow | null>(null);
  return (
    <div className="stack">
      <section>
        <div className="section__head">
          <h3>Seats</h3>
          <span className="muted num">
            {m.delegates.filter((d) => d.active).length} active of {LIMITS.maxDelegates}
          </span>
        </div>
        {m.delegates.length === 0 ? (
          <EmptyState title="No seats yet">{owner ? "Give an agent a seat below. Without one, nobody can file requests." : "The owner has not given any agent a seat yet."}</EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table" data-testid="seat-table">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Status</th>
                  <th className="num">Budget</th>
                  <th className="num">Spent</th>
                  <th className="num">Held</th>
                  <th className="num">Left</th>
                  <th className="num">Open</th>
                  <th className="num">Filed</th>
                  <th className="num">Paid</th>
                  <th className="num">Refused</th>
                  {staff && <th />}
                </tr>
              </thead>
              <tbody>
                {m.delegates.map((d) => (
                  <tr key={d.who}>
                    <td>
                      <Address value={d.who} />
                      {sameAddr(d.who, me) && <span className="muted"> you</span>}
                    </td>
                    <td>{d.active ? <Chip tone="ok" dot>Active</Chip> : <Chip tone="neutral">Revoked</Chip>}</td>
                    <td className="num"><Gen wei={d.budget} /></td>
                    <td className="num"><Gen wei={d.spent} /></td>
                    <td className="num"><Gen wei={d.held} /></td>
                    <td className="num"><Gen wei={d.left} /></td>
                    <td className="num">{d.open}</td>
                    <td className="num">{d.requested}</td>
                    <td className="num">{d.executed}</td>
                    <td className="num" title={`${d.rejected} rejected, ${d.vetoed} vetoed`}>{d.rejected + d.vetoed}</td>
                    {staff && (
                      <td>
                        <div className="row">
                          {owner && (
                            <Button size="sm" variant="ghost" onClick={() => setEdit(d)}>
                              {d.active ? "Change budget" : "Restore"}
                            </Button>
                          )}
                          {d.active && <RevokeButton m={m} d={d} />}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {owner && <GrantForm key={edit?.who ?? "new"} m={m} prefill={edit} />}

      <section>
        <div className="section__head">
          <h3>Payees</h3>
          <Chip tone={m.payee_mode === PAYEE.listed ? "accent" : "neutral"}>{m.payee_mode === PAYEE.listed ? "Only listed payees can be paid" : "Any address can be paid"}</Chip>
        </div>
        {m.payee_mode !== PAYEE.listed && m.payees.length > 0 && <Callout tone="note">The list is stored but not used while the mandate accepts any payee. Switch it to listed payees on the Manage tab.</Callout>}
        {m.payees.length === 0 ? (
          <p className="muted">{m.payee_mode === PAYEE.listed ? "The list is empty, so no request can be filed yet." : "No payees are listed."}</p>
        ) : (
          <ul className="payee-list" data-testid="payee-list">
            {m.payees.map((p) => (
              <PayeeRow key={p} m={m} who={p} owner={owner} />
            ))}
          </ul>
        )}
        {owner && <PayeeAdd m={m} />}
      </section>
    </div>
  );
}

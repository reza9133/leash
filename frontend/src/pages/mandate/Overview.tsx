import { useState } from "react";
import { HandCoins } from "lucide-react";
import { write } from "../../lib/api";
import { formatDateTime, formatDuration, ratio } from "../../lib/format";
import { checkAmount } from "../../lib/validate";
import { useAction } from "../../lib/useAction";
import { PAYEE } from "../../lib/types";
import type { MandateRow } from "../../lib/types";
import { Gen } from "../../components/Common";
import { Field, GenInput } from "../../components/Fields";
import { TensionGauge } from "../../components/TensionGauge";
import { Button, Facts } from "../../components/ui";

function FundBox({ m }: { m: MandateRow }) {
  const [amount, setAmount] = useState("");
  const act = useAction();
  const check = amount ? checkAmount("The amount", amount, { min: 1n }) : { error: null, wei: null };
  return (
    <form
      className="panel form"
      onSubmit={(e) => {
        e.preventDefault();
        if (check.wei && !check.error) void act.run(() => write.fund(m.id, check.wei!)).then((r) => r.ok && setAmount(""));
      }}
    >
      <h3>Add funds</h3>
      <Field label="Amount" htmlFor="fund-amount" error={amount ? check.error : null} hint="Anyone can add funds to a mandate. Only the owner can take them out.">
        <GenInput id="fund-amount" value={amount} onChange={setAmount} invalid={!!(amount && check.error)} testId="fund-amount" />
      </Field>
      <div className="row">
        <Button type="submit" variant="primary" busy={act.busy} disabled={!check.wei || !!check.error} icon={<HandCoins size={16} />} data-testid="fund-submit">
          Fund mandate
        </Button>
        {act.done && <span className="ok-text">Funds added.</span>}
      </div>
      {act.error && <p className="field__error" role="alert">{act.error}</p>}
    </form>
  );
}

export function Overview({ m, now }: { m: MandateRow; now: number }) {
  const reserved = ratio(m.reserved, m.balance);
  const ended = m.expires_at !== 0 && now >= m.expires_at;
  return (
    <div className="split">
      <div className="stack">
        <section className="panel">
          <h3>Policy</h3>
          <p className="policy-text">{m.policy}</p>
          <p className="muted fineprint">Revision {m.policy_rev}. The AI reviewer reads every request against this text.</p>
        </section>

        <section className="panel">
          <h3>Spending</h3>
          <div className="stack">
            <TensionGauge
              value={ratio(m.window_used, m.window_cap)}
              label="Spending inside the window"
              left={<>Spent in the last {formatDuration(m.window_secs)}</>}
              right={
                <>
                  <Gen wei={m.window_used} /> of <Gen wei={m.window_cap} />
                </>
              }
            />
            <TensionGauge
              value={reserved}
              tone="auto"
              label="Money reserved by approved requests"
              left={<>Reserved by approvals</>}
              right={
                <>
                  <Gen wei={m.reserved} /> of <Gen wei={m.balance} />
                </>
              }
            />
          </div>
        </section>

        <section className="panel">
          <h3>Money</h3>
          <Facts
            items={[
              { label: "Balance", value: <Gen wei={m.balance} />, hint: "What the mandate holds now." },
              { label: "Reserved", value: <Gen wei={m.reserved} />, hint: "Promised to approved requests and bonds. Cannot be withdrawn." },
              { label: "Free", value: <Gen wei={m.free} /> },
              { label: "Paid out", value: <Gen wei={m.paid} /> },
              { label: "Deposited", value: <Gen wei={m.deposited} /> },
              { label: "Withdrawn", value: <Gen wei={m.withdrawn} /> },
              { label: "Challenge rewards paid", value: <Gen wei={m.rewards} /> },
              { label: "Bonds forfeited to this mandate", value: <Gen wei={m.forfeited} /> },
            ]}
          />
        </section>
      </div>

      <aside className="stack">
        <FundBox m={m} />
        <section className="panel">
          <h3>Rules</h3>
          <Facts
            compact
            items={[
              { label: "Per payment", value: <Gen wei={m.per_payment_cap} /> },
              { label: "Per window", value: <Gen wei={m.window_cap} /> },
              { label: "Window", value: formatDuration(m.window_secs) },
              { label: "Review delay", value: formatDuration(m.review_delay) },
              { label: "Payees", value: m.payee_mode === PAYEE.listed ? `Listed only (${m.payees.length})` : "Any address" },
              { label: "Evidence", value: m.need_evidence ? "Required" : "Optional" },
              { label: "AI approves up to", value: `risk ${m.auto_risk}` },
              { label: "AI rejects above", value: `risk ${m.reject_risk}` },
              { label: "Human decides within", value: formatDuration(m.escalation_window) },
              { label: "Approval payable for", value: formatDuration(m.exec_grace) },
              { label: "Ends", value: m.expires_at ? (ended ? `Ended ${formatDateTime(m.expires_at)}` : formatDateTime(m.expires_at)) : "Never" },
              { label: "Created", value: formatDateTime(m.created) },
            ]}
          />
        </section>
      </aside>
    </div>
  );
}

// Form building blocks used by the create form and the management forms.
import { useId, useState, type ReactNode } from "react";
import { UNIT_SECONDS, splitDuration, type TimeUnit } from "../lib/format";
import { textLength } from "../lib/validate";

export function Field({ label, hint, error, optional, counter, children, htmlFor }: { label: ReactNode; hint?: ReactNode; error?: string | null; optional?: boolean; counter?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={htmlFor}>
        <span>
          {label} {optional && <small>(optional)</small>}
        </span>
        {counter}
      </label>
      {children}
      {error ? (
        <p className="field__error" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="field__hint">{hint}</p>
      )}
    </div>
  );
}

/** A GEN amount typed as decimal text. */
export function GenInput({ id, value, onChange, placeholder = "0.0", invalid, disabled, testId, max }: { id?: string; value: string; onChange: (v: string) => void; placeholder?: string; invalid?: boolean; disabled?: boolean; testId?: string; max?: { label: string; onClick: () => void } }) {
  return (
    <div className={`affix ${invalid ? "is-invalid" : ""}`}>
      <input id={id} className="input num" inputMode="decimal" autoComplete="off" spellCheck={false} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} aria-invalid={invalid || undefined} data-testid={testId} />
      {max && (
        <button type="button" className="affix__action" onClick={max.onClick}>
          {max.label}
        </button>
      )}
      <span className="affix__unit">GEN</span>
    </div>
  );
}

export function AddressInput({ id, value, onChange, placeholder = "0x…", invalid, disabled, testId }: { id?: string; value: string; onChange: (v: string) => void; placeholder?: string; invalid?: boolean; disabled?: boolean; testId?: string }) {
  return <input id={id} className="input input--mono" autoComplete="off" spellCheck={false} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} aria-invalid={invalid || undefined} data-testid={testId} />;
}

export function TextArea({ id, value, onChange, placeholder, rows = 5, invalid, disabled, testId }: { id?: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; invalid?: boolean; disabled?: boolean; testId?: string }) {
  return <textarea id={id} className="textarea" rows={rows} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} aria-invalid={invalid || undefined} data-testid={testId} />;
}

export function Counter({ text, min, max }: { text: string; min: number; max: number }) {
  const n = textLength(text);
  const bad = n > max || (n > 0 && n < min);
  return (
    <small className={`counter ${bad ? "is-over" : ""}`}>
      {n} / {max}
    </small>
  );
}

const UNITS: TimeUnit[] = ["minutes", "hours", "days"];

/** A duration typed as a number and a unit. The value held by the parent is in seconds. */
export function DurationInput({ id, seconds, onChange, invalid, disabled, testId }: { id?: string; seconds: number; onChange: (s: number) => void; invalid?: boolean; disabled?: boolean; testId?: string }) {
  const initial = splitDuration(seconds);
  const [unit, setUnit] = useState<TimeUnit>(initial.unit === "seconds" ? "minutes" : initial.unit);
  const shown = seconds / UNIT_SECONDS[unit];
  const [text, setText] = useState(String(Number.isInteger(shown) ? shown : Number(shown.toFixed(2))));
  const uid = useId();
  const commit = (t: string, u: TimeUnit) => {
    setText(t);
    const n = Number(t);
    onChange(t.trim() === "" || !Number.isFinite(n) ? NaN : Math.round(n * UNIT_SECONDS[u]));
  };
  return (
    <div className={`affix ${invalid ? "is-invalid" : ""}`}>
      <input id={id} className="input num" inputMode="decimal" value={text} onChange={(e) => commit(e.target.value, unit)} disabled={disabled} aria-invalid={invalid || undefined} data-testid={testId} />
      <select
        className="select"
        aria-label="Unit"
        value={unit}
        disabled={disabled}
        onChange={(e) => {
          const u = e.target.value as TimeUnit;
          setUnit(u);
          commit(text, u);
        }}
        id={uid}
      >
        {UNITS.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Toggle({ checked, onChange, title, hint, disabled, testId }: { checked: boolean; onChange: (v: boolean) => void; title: ReactNode; hint?: ReactNode; disabled?: boolean; testId?: string }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} data-testid={testId} />
      <span className="toggle__track" aria-hidden />
      <span className="toggle__text">
        <strong>{title}</strong>
        {hint && <small>{hint}</small>}
      </span>
    </label>
  );
}

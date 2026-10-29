// Shared interface pieces. Buttons feel like hardware: a hard bottom edge that presses in.
import { useCallback, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { TriangleAlert, Check, Copy, ExternalLink, Info, Lightbulb, OctagonAlert, X } from "lucide-react";
import { shortAddr } from "../lib/format";
import { InlineSpinner } from "./Spinners";

export type Tone = "neutral" | "ok" | "warn" | "bad" | "info" | "accent";

// ---- buttons -----------------------------------------------------------------------------------------------------

interface BtnProps {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "md" | "sm" | "lg";
  busy?: boolean;
  icon?: ReactNode;
  iconAfter?: ReactNode;
}

const btnClass = (v: BtnProps["variant"] = "secondary", size: BtnProps["size"] = "md", extra = "") => `btn btn--${v} btn--${size} ${extra}`.trim();

export function Button({ variant, size, busy, icon, iconAfter, children, className, disabled, ...rest }: BtnProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...rest} className={btnClass(variant, size, className)} disabled={disabled || busy} aria-busy={busy || undefined}>
      {busy ? <InlineSpinner /> : icon}
      {children != null && <span>{children}</span>}
      {iconAfter}
    </button>
  );
}

export function ButtonLink({ variant, size, icon, iconAfter, children, className, to, href, external, ...rest }: BtnProps & { to?: LinkProps["to"]; href?: string; external?: boolean; className?: string; children?: ReactNode; onClick?: () => void }) {
  const content = (
    <>
      {icon}
      <span>{children}</span>
      {iconAfter}
    </>
  );
  if (to !== undefined) {
    return (
      <Link to={to} className={btnClass(variant, size, className)} {...rest}>
        {content}
      </Link>
    );
  }
  return (
    <a href={href} className={btnClass(variant, size, className)} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} {...rest}>
      {content}
    </a>
  );
}

export function IconButton({ label, children, className = "", ...rest }: { label: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" aria-label={label} title={label} className={`icon-btn ${className}`.trim()} {...rest}>
      {children}
    </button>
  );
}

// ---- small display pieces ------------------------------------------------------------------------------------------

export function Chip({ tone = "neutral", dot, children, title }: { tone?: Tone; dot?: boolean; children: ReactNode; title?: string }) {
  return (
    <span className={`chip chip--${tone}`} title={title}>
      {dot && <i className="chip__dot" aria-hidden />}
      {children}
    </span>
  );
}

export function CopyButton({ value, label = "Copy", className = "" }: { value: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = value;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* nothing else to try */
      }
      ta.remove();
    }
    setDone(true);
    window.setTimeout(() => setDone(false), 1400);
  }, [value]);
  return (
    <button type="button" className={`copy-btn ${done ? "is-done" : ""} ${className}`.trim()} onClick={copy} aria-label={done ? "Copied" : label} title={done ? "Copied" : label}>
      {done ? <Check size={14} strokeWidth={2.4} /> : <Copy size={14} />}
    </button>
  );
}

/** An address or hash: shortened, monospaced, with a copy button. The full value is in the tooltip. */
export function Address({ value, full, head = 6, tail = 4, className = "" }: { value: string; full?: boolean; head?: number; tail?: number; className?: string }) {
  if (!value) return <span className="muted">none</span>;
  return (
    <span className={`address ${className}`.trim()}>
      <code title={value}>{full ? value : shortAddr(value, head, tail)}</code>
      <CopyButton value={value} label="Copy address" />
    </span>
  );
}

const CALLOUT_ICON = { note: Info, tip: Lightbulb, warn: TriangleAlert, danger: OctagonAlert } as const;

export function Callout({ tone = "note", title, children }: { tone?: "note" | "tip" | "warn" | "danger"; title?: string; children: ReactNode }) {
  const Icon = CALLOUT_ICON[tone];
  return (
    <aside className={`callout callout--${tone}`} role={tone === "danger" || tone === "warn" ? "note" : undefined}>
      <Icon size={18} aria-hidden className="callout__icon" />
      <div className="callout__body">
        {title && <strong className="callout__title">{title}</strong>}
        <div>{children}</div>
      </div>
    </aside>
  );
}

export function ExternalLinkText({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="ext-link">
      {children}
      <ExternalLink size={13} aria-hidden />
    </a>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <svg className="empty__art" viewBox="0 0 120 60" aria-hidden>
        <path d="M10 20c20 34 60 34 100 0" fill="none" stroke="var(--line)" strokeWidth="3" strokeLinecap="round" strokeDasharray="1 9" />
        <circle cx="10" cy="20" r="7" fill="none" stroke="var(--ink-3)" strokeWidth="3" />
        <circle cx="110" cy="20" r="4.5" fill="var(--accent)" />
      </svg>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action && <div className="empty__action">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, retry, title = "Could not load this" }: { error: Error | string; retry?: () => void; title?: string }) {
  const text = typeof error === "string" ? error : error.message;
  return (
    <div className="error-state" role="alert">
      <OctagonAlert size={22} aria-hidden />
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
      {retry && (
        <Button size="sm" onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/** A definition list for facts: label on the left, value on the right. */
export function Facts({ items, compact }: { items: { label: ReactNode; value: ReactNode; hint?: ReactNode }[]; compact?: boolean }) {
  return (
    <dl className={`facts ${compact ? "facts--compact" : ""}`}>
      {items.map((it, i) => (
        <div key={i} className="facts__row">
          <dt>{it.label}</dt>
          <dd>
            {it.value}
            {it.hint && <small>{it.hint}</small>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function Meter({ value, tone = "accent", label }: { value: number; tone?: Tone; label?: string }) {
  const pct = Math.max(0, Math.min(100, value * 100));
  return (
    <div className="meter" role="img" aria-label={label ?? `${Math.round(pct)}%`}>
      <i className={`meter__fill meter__fill--${tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ---- tabs, disclosure, modal ----------------------------------------------------------------------------------------

export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: { id: T; label: ReactNode; count?: number }[]; value: T; onChange: (id: T) => void; label: string }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const onKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const n = tabs.length;
    const next = e.key === "Home" ? 0 : e.key === "End" ? n - 1 : (i + (e.key === "ArrowRight" ? 1 : -1) + n) % n;
    onChange(tabs[next].id);
    refs.current[tabs[next].id]?.focus();
  };
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((t, i) => (
        <button
          key={t.id}
          ref={(el) => {
            refs.current[t.id] = el;
          }}
          role="tab"
          type="button"
          id={`tab-${t.id}`}
          aria-selected={t.id === value}
          aria-controls={`panel-${t.id}`}
          tabIndex={t.id === value ? 0 : -1}
          className={`tabs__tab ${t.id === value ? "is-active" : ""}`}
          onClick={() => onChange(t.id)}
          onKeyDown={(e) => onKey(e, i)}
        >
          {t.label}
          {t.count !== undefined && <span className="tabs__count num">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function TabPanel({ id, active, children }: { id: string; active: boolean; children: ReactNode }) {
  if (!active) return null;
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} className="tab-panel">
      {children}
    </div>
  );
}

export function Disclosure({ summary, children, defaultOpen = false, id }: { summary: ReactNode; children: ReactNode; defaultOpen?: boolean; id?: string }) {
  return (
    <details className="disclosure" open={defaultOpen} id={id}>
      <summary>{summary}</summary>
      <div className="disclosure__body">{children}</div>
    </details>
  );
}

export function Modal({ open, onClose, title, children, wide, footer }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean; footer?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "modal--wide" : ""}`}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className="modal__panel">
          <header className="modal__head">
            <h2 id={titleId}>{title}</h2>
            <IconButton label="Close" onClick={onClose}>
              <X size={18} />
            </IconButton>
          </header>
          <div className="modal__body">{children}</div>
          {footer && <footer className="modal__foot">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

// ---- code ------------------------------------------------------------------------------------------------------------

const KEYWORDS = /\b(const|let|var|function|return|if|else|for|while|await|async|import|from|export|new|class|def|self|None|True|False|try|except|raise|in|not|and|or|true|false|null|undefined|typeof|throw)\b/g;

function highlight(code: string, lang?: string): ReactNode[] {
  if (!lang || lang === "text" || lang === "bash" || lang === "sh") {
    if (lang === "bash" || lang === "sh") return highlightLines(code, /(#.*$)/gm);
    return [code];
  }
  const out: ReactNode[] = [];
  const re = /(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b0x[0-9a-fA-F]+\b|\b\d[\d_]*(?:\.\d+)?n?\b)|(\b[A-Za-z_]\w*\b)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(code))) {
    if (m.index > last) out.push(code.slice(last, m.index));
    if (m[1]) {
      if (lang === "json") out.push(m[1]);
      else out.push(<span key={k++} className="tok-c">{m[1]}</span>);
    } else if (m[2]) out.push(<span key={k++} className="tok-s">{m[2]}</span>);
    else if (m[3]) out.push(<span key={k++} className="tok-n">{m[3]}</span>);
    else if (m[4] && (lang === "js" || lang === "ts" || lang === "py" || lang === "python") && new RegExp(KEYWORDS.source).test(m[4])) out.push(<span key={k++} className="tok-k">{m[4]}</span>);
    else out.push(m[0]);
    last = m.index + m[0].length;
  }
  if (last < code.length) out.push(code.slice(last));
  return out;
}

function highlightLines(code: string, re: RegExp): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of code.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) out.push(code.slice(last, i));
    out.push(<span key={k++} className="tok-c">{m[0]}</span>);
    last = i + m[0].length;
  }
  if (last < code.length) out.push(code.slice(last));
  return out;
}

export function CodeBlock({ code, lang, title }: { code: string; lang?: string; title?: string }) {
  const text = code.replace(/\n$/, "");
  return (
    <figure className="code">
      {(title || lang) && (
        <figcaption>
          <span>{title ?? lang}</span>
          <CopyButton value={text} label="Copy code" />
        </figcaption>
      )}
      {!title && !lang && <CopyButton value={text} label="Copy code" className="code__float" />}
      <pre tabIndex={0}>
        <code>{highlight(text, lang)}</code>
      </pre>
    </figure>
  );
}

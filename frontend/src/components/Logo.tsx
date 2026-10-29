// The Leash mark: a hand loop (ring), the cord that falls out of it and runs taut to a bead, the agent.
// It reads as an "L" and as a lead being held. The ring follows the theme; the cord and bead stay safety orange.
import { Link } from "react-router-dom";

export function LeashMark({ size = 32, className = "", title }: { size?: number; className?: string; title?: string }) {
  return (
    <svg className={`leash-mark ${className}`.trim()} width={size} height={size} viewBox="0 0 64 64" fill="none" role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <circle cx="23" cy="21" r="11" stroke="var(--logo-ink)" strokeWidth="6.4" />
      <path d="M23 32v10.5A11.5 11.5 0 0 0 34.5 54H49" stroke="var(--accent)" strokeWidth="6.4" strokeLinecap="round" />
      <circle cx="53" cy="54" r="5.4" fill="var(--accent)" />
    </svg>
  );
}

export function Wordmark({ size = 22 }: { size?: number }) {
  return (
    <Link to="/" className="wordmark" aria-label="Leash, home">
      <LeashMark size={size + 8} />
      <span className="wordmark__text" style={{ fontSize: size }}>
        leash
      </span>
    </Link>
  );
}

/** The GenLayer mark, drawn from the project's logo. Takes the surrounding text colour. */
export function GenLayerMark({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg className={`genlayer-mark ${className}`.trim()} width={size * (362.5 / 340)} height={size} viewBox="0 0 362.5 340" fill="currentColor" fillRule="evenodd" aria-hidden>
      <path d="M163.8 0 L0 340 L159.8 277.5 L102.8 247.5 L164 119.2Z M198.7 0 L362.5 340 L202.7 277.5 L259.7 247.5 L198.5 118.5Z M181.25 162.2 L146.8 232.5 L181.25 250.2 L215.7 232.5Z" />
    </svg>
  );
}

// Loading indicators. They all borrow from the product: a ring (the hand), a cord and a bead (the agent).
import { LeashMark } from "./Logo";

/** The small spinner used inside buttons. */
export function InlineSpinner({ size = 14 }: { size?: number }) {
  return <span className="spin-inline" style={{ width: size, height: size }} aria-hidden />;
}

/** A bead that runs around a ring on its cord. The everyday loading indicator. */
export function LeashSpinner({ size = 44, label = "Loading" }: { size?: number; label?: string }) {
  return (
    <span className="leash-spinner" role="status" aria-label={label} style={{ width: size, height: size }}>
      <svg viewBox="0 0 64 64" aria-hidden>
        <circle cx="32" cy="32" r="22" fill="none" stroke="var(--line)" strokeWidth="4" />
        <g className="leash-spinner__orbit">
          <circle cx="32" cy="32" r="22" fill="none" stroke="var(--accent)" strokeWidth="5" strokeLinecap="round" strokeDasharray="46 92" />
          <circle cx="21" cy="51" r="6" fill="var(--accent)" />
        </g>
      </svg>
    </span>
  );
}

/** Three tilted rings turning around the mark: the large loader for pages and first load. */
export function OrbitLoader({ size = 150, label = "Loading", mark = true }: { size?: number; label?: string; mark?: boolean }) {
  return (
    <span className="orbit" role="status" aria-label={label} style={{ width: size, height: size }}>
      <span className="orbit__scene">
        <span className="orbit__ring orbit__ring--a"><i /></span>
        <span className="orbit__ring orbit__ring--b"><i /></span>
        <span className="orbit__ring orbit__ring--c"><i /></span>
        {mark && <LeashMark className="orbit__mark" size={size * 0.34} />}
      </span>
    </span>
  );
}

export type ConsensusPhase = "wallet" | "queue" | "propose" | "commit" | "reveal" | "done" | "failed";

/** Five validators in a ring. Shows where a transaction is in the consensus round. */
export function ConsensusSpinner({ phase, size = 88 }: { phase: ConsensusPhase; size?: number }) {
  const nodes = Array.from({ length: 5 }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return { x: 50 + 34 * Math.cos(a), y: 50 + 34 * Math.sin(a), i };
  });
  const lines: [number, number][] = [];
  for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) lines.push([i, j]);
  return (
    <svg className={`consensus consensus--${phase}`} viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={`Consensus: ${phase}`}>
      <circle className="consensus__halo" cx="50" cy="50" r="46" fill="none" />
      {lines.map(([a, b]) => (
        <line key={`${a}-${b}`} className="consensus__edge" x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y} />
      ))}
      {nodes.map((n) => (
        <g key={n.i} className="consensus__node" style={{ ["--i" as string]: n.i }}>
          <circle className="consensus__ripple" cx={n.x} cy={n.y} r="5" />
          <circle className="consensus__dot" cx={n.x} cy={n.y} r="5.5" />
        </g>
      ))}
      {phase === "done" && <path className="consensus__mark" d="M38 51l8 8 17-18" fill="none" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />}
      {phase === "failed" && <path className="consensus__mark" d="M40 40l20 20M60 40L40 60" fill="none" strokeWidth="6" strokeLinecap="round" />}
    </svg>
  );
}

export function Skeleton({ width = "100%", height = 16, radius = 6, className = "" }: { width?: number | string; height?: number | string; radius?: number; className?: string }) {
  return <span className={`skeleton ${className}`.trim()} style={{ width, height, borderRadius: radius }} aria-hidden />;
}

/** Full-width placeholder shown while a route's code loads. */
export function PageLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="page-loader">
      <OrbitLoader label={label} />
    </div>
  );
}

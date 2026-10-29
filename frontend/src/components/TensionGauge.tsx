// A spending gauge drawn as a leash. Nothing used: the cord hangs slack. At the limit it is pulled straight.
// The ring on the left is the hand (the owner's limit), the bead on the right is the agent.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTween } from "../lib/hooks";

export function TensionGauge({ value, left, right, height = 46, tone, label }: { value: number; left?: ReactNode; right?: ReactNode; height?: number; tone?: "auto" | "ok" | "warn" | "bad"; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setWidth(Math.max(120, entries[0].contentRect.width)));
    ro.observe(el);
    setWidth(Math.max(120, el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);

  const v = Math.max(0, Math.min(1, value));
  const t = useTween(v, 650);
  const R = 8;
  const y0 = 12;
  const maxSag = Math.min(26, height - 18);
  const sag = maxSag * Math.pow(1 - t, 1.7);
  const x1 = R * 2 + 2;
  const x2 = width - 7;
  const path = `M ${x1} ${y0} Q ${(x1 + x2) / 2} ${y0 + sag * 2} ${x2} ${y0}`;
  const level = tone && tone !== "auto" ? tone : v >= 1 ? "bad" : v >= 0.85 ? "warn" : "ok";
  const pct = Math.round(v * 100);

  return (
    <div className="gauge" ref={ref}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label}: ${pct}% used`} className={`gauge__svg gauge__svg--${level}`}>
        <path d={path} className="gauge__cord" fill="none" strokeWidth="4" strokeLinecap="round" />
        <circle cx={R + 1} cy={y0} r={R} className="gauge__ring" fill="var(--surface)" strokeWidth="3.4" />
        <circle cx={x2} cy={y0} r="5.5" className="gauge__bead" />
      </svg>
      {(left || right) && (
        <div className="gauge__legend">
          <span>{left}</span>
          <span>{right}</span>
        </div>
      )}
    </div>
  );
}

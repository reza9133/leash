// The life of a request as a diagram. Every arrow is a real contract method; every box is a state the contract reports.
// <Lifecycle> draws it with optional highlighting. <LifecycleExplorer> adds scenarios and a moving packet.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { prefersReducedMotion } from "../lib/theme";
import type { StateName } from "../lib/types";
import { Button } from "./ui";

interface NodeDef {
  id: StateName;
  x: number;
  y: number;
  label: string;
  tone: "neutral" | "ok" | "warn" | "bad" | "accent";
  caption?: string;
}

const W = 156;
const H = 48;

export const NODES: NodeDef[] = [
  { id: "PENDING", x: 120, y: 300, label: "Pending", tone: "neutral" },
  { id: "ESCALATED", x: 340, y: 120, label: "Escalated", tone: "warn" },
  { id: "APPROVED", x: 560, y: 300, label: "Approved", tone: "ok" },
  { id: "REJECTED", x: 340, y: 480, label: "Rejected", tone: "bad" },
  { id: "CHALLENGED", x: 800, y: 120, label: "Challenged", tone: "accent" },
  { id: "EXECUTED", x: 1000, y: 300, label: "Paid", tone: "ok" },
  { id: "VETOED", x: 800, y: 480, label: "Vetoed", tone: "bad" },
  { id: "CANCELLED", x: 120, y: 590, label: "Withdrawn", tone: "neutral", caption: "cancel_request, from pending, escalated or approved" },
  { id: "EXPIRED", x: 440, y: 590, label: "Expired", tone: "neutral", caption: "expire_request, from any open state that ran out of time" },
];

export type EdgeId =
  | "review_escalate"
  | "review_approve"
  | "review_reject"
  | "decide_approve"
  | "decide_reject"
  | "execute"
  | "challenge"
  | "audit_dismissed"
  | "audit_upheld"
  | "veto"
  | "audit_unreadable";

interface EdgeDef {
  id: EdgeId;
  from: StateName;
  to: StateName;
  d: string;
  label: string;
  lx: number;
  ly: number;
  anchor?: "start" | "middle" | "end";
}

export const EDGES: EdgeDef[] = [
  { id: "review_escalate", from: "PENDING", to: "ESCALATED", d: "M120 276 C120 150 170 120 262 120", label: "review: unsure", lx: 134, ly: 214, anchor: "start" },
  { id: "review_approve", from: "PENDING", to: "APPROVED", d: "M198 300 L482 300", label: "review: approve", lx: 412, ly: 288, anchor: "middle" },
  { id: "review_reject", from: "PENDING", to: "REJECTED", d: "M120 324 C120 440 170 480 262 480", label: "review: reject", lx: 134, ly: 410, anchor: "start" },
  { id: "decide_approve", from: "ESCALATED", to: "APPROVED", d: "M418 120 C500 120 520 190 520 276", label: "decide: approve", lx: 508, ly: 210, anchor: "end" },
  { id: "decide_reject", from: "ESCALATED", to: "REJECTED", d: "M340 144 L340 456", label: "decide: reject", lx: 352, ly: 392, anchor: "start" },
  { id: "execute", from: "APPROVED", to: "EXECUTED", d: "M638 300 L922 300", label: "execute", lx: 735, ly: 288, anchor: "middle" },
  { id: "challenge", from: "APPROVED", to: "CHALLENGED", d: "M580 276 C600 150 650 120 722 120", label: "challenge", lx: 640, ly: 106, anchor: "middle" },
  { id: "audit_dismissed", from: "CHALLENGED", to: "APPROVED", d: "M770 144 C770 220 670 230 628 276", label: "audit: dismissed", lx: 726, ly: 232, anchor: "middle" },
  { id: "audit_upheld", from: "CHALLENGED", to: "VETOED", d: "M830 144 L830 456", label: "audit: upheld", lx: 842, ly: 392, anchor: "start" },
  { id: "veto", from: "APPROVED", to: "VETOED", d: "M560 324 C560 430 620 480 722 480", label: "veto", lx: 580, ly: 430, anchor: "start" },
  { id: "audit_unreadable", from: "CHALLENGED", to: "ESCALATED", d: "M770 96 C700 30 450 30 370 96", label: "audit unreadable three times: bond back, a human decides", lx: 570, ly: 30, anchor: "middle" },
];

const edgeById = Object.fromEntries(EDGES.map((e) => [e.id, e])) as Record<EdgeId, EdgeDef>;

export function Lifecycle({ current, trail = [], edges = [], packet, onNode }: { current?: StateName; trail?: StateName[]; edges?: EdgeId[]; packet?: { x: number; y: number } | null; onNode?: (s: StateName) => void }) {
  const on = new Set(edges);
  const visited = new Set(trail);
  return (
    <svg className="lifecycle" viewBox="0 0 1100 650" role="img" aria-label="Life of a request: states and the methods that move a request between them">
      <defs>
        <marker id="lc-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M1 1l8 4-8 4z" fill="var(--ink-3)" />
        </marker>
        <marker id="lc-arrow-on" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M1 1l8 4-8 4z" fill="var(--accent)" />
        </marker>
      </defs>

      {EDGES.map((e) => (
        <g key={e.id} className={`lc-edge ${on.has(e.id) ? "is-on" : ""} ${e.id === "audit_unreadable" ? "is-rare" : ""}`}>
          <path d={e.d} fill="none" markerEnd={on.has(e.id) ? "url(#lc-arrow-on)" : "url(#lc-arrow)"} />
          <text x={e.lx} y={e.ly} textAnchor={e.anchor ?? "middle"}>
            {e.label}
          </text>
        </g>
      ))}

      {NODES.map((n) => {
        const isCurrent = current === n.id;
        return (
          <g
            key={n.id}
            className={`lc-node lc-node--${n.tone} ${isCurrent ? "is-current" : ""} ${visited.has(n.id) ? "is-visited" : ""} ${n.caption ? "is-exit" : ""}`}
            transform={`translate(${n.x - W / 2} ${n.y - H / 2})`}
            onClick={onNode ? () => onNode(n.id) : undefined}
            role={onNode ? "button" : undefined}
            tabIndex={onNode ? 0 : undefined}
            onKeyDown={onNode ? (e) => (e.key === "Enter" || e.key === " ") && onNode(n.id) : undefined}
          >
            <title>{n.id}</title>
            <rect width={W} height={H} rx="10" />
            <text x={W / 2} y={H / 2 + 5} textAnchor="middle">
              {n.label}
            </text>
            {n.caption && (
              <text className="lc-caption" x={W / 2} y={H + 20} textAnchor="middle">
                {n.caption.length > 34 ? <>
                  <tspan x={W / 2}>{n.caption.slice(0, n.caption.lastIndexOf(" ", 34))}</tspan>
                  <tspan x={W / 2} dy="15">{n.caption.slice(n.caption.lastIndexOf(" ", 34) + 1)}</tspan>
                </> : n.caption}
              </text>
            )}
          </g>
        );
      })}

      {packet && <circle className="lc-packet" cx={packet.x} cy={packet.y} r="7" />}
    </svg>
  );
}

// ---- scenarios ---------------------------------------------------------------------------------------------------------

interface Scenario {
  id: string;
  title: string;
  summary: string;
  steps: { edge: EdgeId; text: string }[];
}

export const SCENARIOS: Scenario[] = [
  {
    id: "clean",
    title: "The AI approves, the payee is paid",
    summary: "The happy path. The review fits the policy, nobody objects during the waiting time.",
    steps: [
      { edge: "review_approve", text: "The AI review reads the policy, the purpose and the evidence. The risk is low, so the request is approved and its amount is reserved." },
      { edge: "execute", text: "After the owner's waiting time, anyone can call execute. Every limit is checked again and the payee is paid." },
    ],
  },
  {
    id: "unsure",
    title: "The AI is unsure, the owner decides",
    summary: "A middle risk score or an unclear request goes to a human.",
    steps: [
      { edge: "review_escalate", text: "The model is not sure, or the risk sits between the owner's two limits. The request waits for a human." },
      { edge: "decide_approve", text: "The owner or the guardian approves. A human approval can be paid at once." },
      { edge: "execute", text: "Anyone executes the payment. The limits are enforced one more time." },
    ],
  },
  {
    id: "reject",
    title: "The review rejects it",
    summary: "The request is outside the policy or the risk is above the owner's reject limit.",
    steps: [{ edge: "review_reject", text: "The request is rejected and closed. No money was ever reserved, and the evidence link is free to use again." }],
  },
  {
    id: "veto",
    title: "A human vetoes the approval",
    summary: "The owner or the guardian can stop an approval for as long as it waits.",
    steps: [
      { edge: "review_approve", text: "The AI approves and the amount is reserved for the waiting time." },
      { edge: "veto", text: "The owner or the guardian vetoes. The reservation is released and the request is closed." },
    ],
  },
  {
    id: "upheld",
    title: "A watcher challenges and wins",
    summary: "Anyone can bet a bond that an AI approval was a mistake.",
    steps: [
      { edge: "review_approve", text: "The AI approves a request." },
      { edge: "challenge", text: "A watcher posts a bond of 5% of the payment (at least 0.001 GEN) and says why the approval is wrong. The request freezes." },
      { edge: "audit_upheld", text: "A stricter second review does not approve. The request is vetoed and the watcher gets the bond back plus up to 10% of the payment." },
    ],
  },
  {
    id: "dismissed",
    title: "A watcher challenges and loses",
    summary: "The audit agrees with the first review, so the bond goes to the mandate.",
    steps: [
      { edge: "review_approve", text: "The AI approves a request." },
      { edge: "challenge", text: "A watcher posts a bond and challenges the approval." },
      { edge: "audit_dismissed", text: "The stricter audit approves too. The bond is forfeited to the mandate and the request is payable again. It cannot be challenged twice." },
      { edge: "execute", text: "After the waiting time the payee is paid." },
    ],
  },
];

const callOf = (e: EdgeId): string =>
  e.startsWith("review") ? "review" : e === "decide_approve" ? "decide (approve)" : e === "decide_reject" ? "decide (reject)" : e.startsWith("audit") ? "audit" : e;

function trailOf(s: Scenario, upTo: number): StateName[] {
  const out: StateName[] = ["PENDING"];
  for (let i = 0; i < upTo; i++) out.push(edgeById[s.steps[i].edge].to);
  return out;
}

export function LifecycleExplorer({ initial = "clean" }: { initial?: string }) {
  const [sid, setSid] = useState(initial);
  const scenario = useMemo(() => SCENARIOS.find((s) => s.id === sid) ?? SCENARIOS[0], [sid]);
  const [step, setStep] = useState(0); // how many steps are complete
  const [playing, setPlaying] = useState(false);
  const [packet, setPacket] = useState<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const holder = useRef<HTMLDivElement>(null);
  const raf = useRef(0);

  const stop = useCallback(() => {
    cancelAnimationFrame(raf.current);
    setPlaying(false);
    setPacket(null);
  }, []);

  useEffect(() => {
    stop();
    setStep(0);
  }, [sid, stop]);

  // The packet rides each arrow in turn.
  useEffect(() => {
    if (!playing) return;
    const svg = holder.current?.querySelector("svg");
    svgRef.current = svg ?? null;
    if (!svg) return;
    let i = step >= scenario.steps.length ? 0 : step;
    if (step >= scenario.steps.length) setStep(0);
    const reduce = prefersReducedMotion();
    let cancelled = false;

    const run = () => {
      if (cancelled) return;
      if (i >= scenario.steps.length) {
        setPlaying(false);
        setPacket(null);
        return;
      }
      const e = edgeById[scenario.steps[i].edge];
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", e.d);
      const len = path.getTotalLength();
      const duration = reduce ? 1 : 1100;
      const t0 = performance.now();
      const frame = (t: number) => {
        if (cancelled) return;
        const k = Math.min(1, (t - t0) / duration);
        const eased = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        const pt = path.getPointAtLength(len * eased);
        setPacket({ x: pt.x, y: pt.y });
        if (k < 1) raf.current = requestAnimationFrame(frame);
        else {
          i += 1;
          setStep(i);
          window.setTimeout(run, reduce ? 200 : 450);
        }
      };
      raf.current = requestAnimationFrame(frame);
    };
    run();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, scenario]);

  const trail = trailOf(scenario, step);
  const current = trail[trail.length - 1];
  const doneEdges = scenario.steps.slice(0, step).map((s) => s.edge);

  return (
    <div className="lc-explorer">
      <div className="lc-explorer__side">
        <div role="radiogroup" aria-label="Scenario" className="lc-explorer__list">
          {SCENARIOS.map((s) => (
            <button key={s.id} type="button" role="radio" aria-checked={s.id === sid} className={`lc-pick ${s.id === sid ? "is-active" : ""}`} onClick={() => setSid(s.id)}>
              <strong>{s.title}</strong>
              <span>{s.summary}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="lc-explorer__main">
        <div className="lc-explorer__stage" ref={holder}>
          <Lifecycle current={current} trail={trail} edges={doneEdges} packet={packet} />
        </div>
        <div className="lc-explorer__bar">
          <Button variant="primary" size="sm" icon={playing ? <Pause size={15} /> : step >= scenario.steps.length ? <RotateCcw size={15} /> : <Play size={15} />} onClick={() => (playing ? stop() : setPlaying(true))}>
            {playing ? "Pause" : step >= scenario.steps.length ? "Replay" : step > 0 ? "Continue" : "Play"}
          </Button>
          <Button size="sm" onClick={() => { stop(); setStep(0); }} disabled={step === 0 && !playing}>
            Reset
          </Button>
          <Button size="sm" onClick={() => { stop(); setStep((n) => Math.min(scenario.steps.length, n + 1)); }} disabled={step >= scenario.steps.length}>
            Step
          </Button>
        </div>
        <ol className="lc-explorer__steps" aria-live="polite">
          {scenario.steps.map((s, i) => (
            <li key={i} className={i < step ? "is-done" : i === step ? "is-next" : ""}>
              <code>{callOf(s.edge)}</code>
              <span>{s.text}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

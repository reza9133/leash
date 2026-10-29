// The four layers that stand between an agent and the money, as a stack of slabs in CSS 3D.
// On narrow screens and with reduced motion the slabs become a flat list.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Brain, Eye, Gauge, Hand } from "lucide-react";
import { formatDuration } from "../lib/format";
import { prefersReducedMotion } from "../lib/theme";
import { LIMITS } from "../lib/types";

interface Layer {
  id: string;
  name: string;
  tag: string;
  icon: ReactNode;
  summary: string;
  facts: string[];
}

const LAYERS: Layer[] = [
  {
    id: "limits",
    name: "Hard limits",
    tag: "The contract",
    icon: <Gauge size={22} />,
    summary: "Plain arithmetic that no one can talk around. Every request is checked against the numbers before anything else happens.",
    facts: [
      "A cap on every single payment, and a cap on everything paid inside a rolling window.",
      `Each agent seat has its own total budget and at most ${LIMITS.maxOpen} open requests.`,
      `Approvals wait out a review delay of ${formatDuration(LIMITS.minDelay)} to ${formatDuration(LIMITS.maxDelay)} before they can be paid.`,
    ],
  },
  {
    id: "ai",
    name: "AI review",
    tag: "Validators",
    icon: <Brain size={22} />,
    summary: "Validators read the policy, the purpose and the evidence, and score the risk. The review can say no, or say that a human should look. It cannot widen a limit.",
    facts: [
      `Risk up to ${LIMITS.defaultAuto} can be approved on its own, above ${LIMITS.defaultReject} it is rejected, in between a human decides.`,
      "A request is only approvable if it already passed every hard limit.",
      `If the evidence page cannot be read, the review is retried up to ${LIMITS.maxTries} times and then goes to a human.`,
    ],
  },
  {
    id: "human",
    name: "Human brake",
    tag: "Owner and guardian",
    icon: <Hand size={22} />,
    summary: "The people who own the money keep the last word. They decide what the AI was unsure about, and they can stop any approval before it is paid.",
    facts: [
      "The owner or the guardian can veto an approved request during the review delay.",
      `Escalated requests wait ${formatDuration(LIMITS.defaultSpan)} by default for a human decision.`,
      "A guardian can pause the mandate and revoke seats, but can never move or configure money.",
    ],
  },
  {
    id: "watch",
    name: "Watchers",
    tag: "Anyone",
    icon: <Eye size={22} />,
    summary: "Anyone can challenge an approval the AI gave. A second review audits it. A good catch is paid for; a false alarm costs the bond.",
    facts: [
      `A challenge needs a bond of ${Number(LIMITS.bondBps) / 100}% of the payment, at least 0.001 GEN.`,
      `If the audit upholds the challenge, the watcher gets the bond back plus up to ${Number(LIMITS.rewardBps) / 100}% of the payment.`,
      "If it is dismissed, the bond goes to the mandate.",
    ],
  },
];

export function LayerStack() {
  const [active, setActive] = useState(0);
  const touched = useRef(false);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const t = window.setInterval(() => {
      if (!touched.current) setActive((a) => (a + 1) % LAYERS.length);
    }, 4500);
    return () => window.clearInterval(t);
  }, []);

  const pick = (i: number) => {
    touched.current = true;
    setActive(i);
  };
  const layer = LAYERS[active];

  return (
    <div className="stack3d" data-testid="layer-stack">
      <div className="stack3d__stage">
        <div className="stack3d__scene" role="group" aria-label="The four layers, from the contract at the bottom to the watchers on top">
          {LAYERS.map((l, i) => {
            const lift = i === active ? 1 : 0;
            return (
              <button
                key={l.id}
                type="button"
                className={`slab ${i === active ? "is-active" : ""}`}
                style={{ ["--i" as string]: i, ["--lift" as string]: lift }}
                aria-pressed={i === active}
                onClick={() => pick(i)}
                onMouseEnter={() => pick(i)}
                onFocus={() => pick(i)}
                data-testid={`layer-${l.id}`}
              >
                <span className="slab__icon">{l.icon}</span>
                <span className="slab__text">
                  <strong>{l.name}</strong>
                  <small>{l.tag}</small>
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="stack3d__detail" aria-live="polite">
        <p className="stack3d__tag">{layer.tag}</p>
        <h3>{layer.name}</h3>
        <p>{layer.summary}</p>
        <ul>
          {layer.facts.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

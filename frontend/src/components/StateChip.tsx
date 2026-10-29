import { Chip, type Tone } from "./ui";
import { stateName, type StateName } from "../lib/types";

export const STATE_TONE: Record<StateName, Tone> = {
  PENDING: "neutral",
  APPROVED: "ok",
  ESCALATED: "warn",
  REJECTED: "bad",
  EXECUTED: "ok",
  VETOED: "bad",
  CANCELLED: "neutral",
  EXPIRED: "neutral",
  CHALLENGED: "accent",
};

export const STATE_LABEL: Record<StateName, string> = {
  PENDING: "Waiting for review",
  APPROVED: "Approved",
  ESCALATED: "Needs a decision",
  REJECTED: "Rejected",
  EXECUTED: "Paid",
  VETOED: "Vetoed",
  CANCELLED: "Withdrawn",
  EXPIRED: "Expired",
  CHALLENGED: "Challenged",
};

export const STATE_HELP: Record<StateName, string> = {
  PENDING: "Filed by an agent. Anyone can start the AI review.",
  APPROVED: "Cleared and the money is reserved. It can be paid after its waiting time.",
  ESCALATED: "The AI was not sure. The owner or the guardian decides.",
  REJECTED: "Final. Refused by the review or by a human.",
  EXECUTED: "Final. The payee has been paid.",
  VETOED: "Final. Stopped after approval by a human or by an upheld challenge.",
  CANCELLED: "Final. Withdrawn by the agent.",
  EXPIRED: "Final. Nobody acted in time, or the mandate or the seat went away.",
  CHALLENGED: "An approval is being audited after a watcher posted a bond. The money stays reserved.",
};

export function StateChip({ state }: { state: number }) {
  const name = stateName(state);
  return (
    <Chip tone={STATE_TONE[name]} dot title={`${name}: ${STATE_HELP[name]}`}>
      {STATE_LABEL[name]}
    </Chip>
  );
}

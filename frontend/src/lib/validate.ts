// Client-side checks that mirror the contract's own validation, so a form can explain a problem before anyone
// signs a transaction. The contract stays the authority: these functions never replace its checks.
import { LIMITS } from "./types";
import { isAddress, isZeroAddress, parseGen } from "./format";

// ---- text cleaning (same rules as the contract's _clean) -------------------------------------------------------------

const INVISIBLE = /[­؜᠎﻿​-‏‪-‮⁠-⁤⁦-⁩]/g;

/** The text as the contract will store it: no hidden characters, single spaces, angle brackets turned into parentheses. */
export function cleanText(input: string): string {
  const visible = input.replace(INVISIBLE, "").replace(/[\p{C}\p{Z}]/gu, " ");
  return visible.replace(/</g, "(").replace(/>/g, ")").split(/\s+/).filter(Boolean).join(" ");
}

export const textLength = (s: string): number => [...cleanText(s)].length;

export function checkText(label: string, value: string, min: number, max: number): string | null {
  const n = textLength(value);
  if (n < min) return `${label} needs at least ${min} characters (now ${n}).`;
  if (n > max) return `${label} can have at most ${max} characters (now ${n}).`;
  return null;
}

// ---- evidence links (same rules as the contract's _public_url) --------------------------------------------------------

const URL_RE = /^https?:\/\/([^/?#\s]+)([/?#]\S*)?$/;
const LABEL_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)$/;
const BAD_TLD = ["local", "localhost", "internal", "lan", "home", "corp", "intranet", "test", "invalid", "example", "onion", "arpa", "localdomain"];
const BAD_SUFFIX = ["nip.io", "sslip.io", "xip.io", "localtest.me", "lvh.me", "traefik.me"];

export function isPublicUrl(url: string): boolean {
  if (!url || url.length > LIMITS.maxUrl) return false;
  for (let i = 0; i < url.length; i++) {
    const c = url.charCodeAt(i);
    if (c < 33 || c > 126) return false;
  }
  const m = URL_RE.exec(url);
  if (!m) return false;
  let host = m[1].toLowerCase();
  if (host.includes("@")) return false;
  if (host.includes(":")) {
    const at = host.indexOf(":");
    const port = host.slice(at + 1);
    host = host.slice(0, at);
    if (port !== "80" && port !== "443") return false;
  }
  const labels = host.split(".");
  if (labels.length < 2 || !labels.every((x) => LABEL_RE.test(x))) return false;
  const tld = labels[labels.length - 1];
  if (!(/^[a-z]{2,}$/.test(tld)) && !tld.startsWith("xn--")) return false;
  if (BAD_TLD.includes(tld)) return false;
  for (let i = 0; i + 4 <= labels.length; i++) {
    if (labels.slice(i, i + 4).every((x) => /^\d+$/.test(x))) return false;
  }
  return !BAD_SUFFIX.some((s) => host === s || host.endsWith("." + s));
}

export function checkEvidence(url: string, required: boolean): string | null {
  const t = url.trim();
  if (!t) return required ? "This mandate needs a link to evidence." : null;
  if (!isPublicUrl(t)) return "Use one public http(s) link with a real domain: no IP address, no login in the link, no custom port.";
  return null;
}

// ---- steering phrases (the contract rejects a purpose that talks to its reviewer) ----------------------------------------

const STEER = new RegExp(
  [
    "ignore (?:all |any |the |every |your )?(?:previous|prior|above|earlier|preceding|former)\\b",
    "disregard (?:all |any |the |every |your )?(?:previous|prior|above|earlier|policy|rules|instructions|limits)",
    "forget (?:all |any |the |your )?(?:previous|prior|above|earlier|policy|rules|instructions)",
    "(?:system|developer) (?:prompt|message|instruction)",
    "you are now\\b|new instructions?\\b|from now on\\b",
    "override (?:the |all |any )?(?:policy|rules|limits|caps|review|checks?)",
    "(?:reply|respond|answer|output|return|say) (?:with |only )?(?:only )?[\"']?approve",
    "\"verdict\"\\s*:|verdict\\s*[:=]\\s*[\"']?approve",
    "(?:set|put|keep|rate) (?:the |your )?risk (?:to|at|as|score)",
    "(?:mark|treat|consider|label|rate) (?:this|it|the|that)(?: (?:request|payment|invoice|one))? as (?:safe|approved|low.risk)",
    "do not (?:flag|escalate|reject|question)\\b|must (?:be )?approved?\\b",
  ].join("|"),
  "i",
);

export function looksLikeSteering(text: string): boolean {
  return STEER.test(text.replace(INVISIBLE, "").toLowerCase().split(/\s+/).join(" "));
}

// ---- amounts, addresses, durations --------------------------------------------------------------------------------------

export function checkAmount(label: string, text: string, opts: { min?: bigint; max?: bigint } = {}): { error: string | null; wei: bigint | null } {
  const wei = parseGen(text);
  if (wei === null) return { error: `${label}: enter a number such as 0.05.`, wei: null };
  const min = opts.min ?? LIMITS.minPayment;
  const max = opts.max ?? LIMITS.maxAmount;
  if (wei < min) return { error: `${label} must be at least ${parseGenText(min)} GEN.`, wei };
  if (wei > max) return { error: `${label} is too large.`, wei };
  return { error: null, wei };
}

const parseGenText = (wei: bigint): string => {
  const whole = wei / 10n ** 18n;
  const frac = (wei % 10n ** 18n).toString().padStart(18, "0").replace(/0+$/, "");
  return `${whole}${frac ? "." + frac : ""}`;
};

export function checkAddress(label: string, value: string, opts: { optional?: boolean } = {}): string | null {
  const t = value.trim();
  if (!t) return opts.optional ? null : `${label}: enter an address.`;
  if (!isAddress(t)) return `${label}: that is not a valid address (0x followed by 40 hex characters).`;
  if (isZeroAddress(t)) return `${label}: the zero address cannot be used.`;
  return null;
}

export function checkRange(label: string, seconds: number, min: number, max: number, unitText: (s: number) => string): string | null {
  if (!Number.isFinite(seconds) || seconds < min || seconds > max) return `${label} has to be between ${unitText(min)} and ${unitText(max)}.`;
  return null;
}

/** Bond a watcher must post to challenge an AI approval (same formula as the contract). */
export function bondFor(amount: bigint): bigint {
  const pct = (amount * LIMITS.bondBps) / BigInt(LIMITS.bps);
  return pct > LIMITS.minBond ? pct : LIMITS.minBond;
}

/** Reward for an upheld challenge before the contract trims it to the seat and window room. */
export function rewardFor(amount: bigint): bigint {
  return (amount * LIMITS.rewardBps) / BigInt(LIMITS.bps);
}

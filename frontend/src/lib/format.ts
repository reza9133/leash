// Formatting and parsing helpers: GEN amounts, addresses, durations and dates.

const WEI = 10n ** 18n;

/** Parses a decimal GEN amount ("0.25") into wei. Returns null when the text is not a valid amount. */
export function parseGen(text: string): bigint | null {
  const t = text.trim().replace(/,/g, "");
  if (!/^\d+(\.\d{1,18})?$/.test(t) && !/^\.\d{1,18}$/.test(t)) return null;
  const [whole = "0", frac = ""] = t.split(".");
  return BigInt(whole || "0") * WEI + BigInt(frac.padEnd(18, "0") || "0");
}

/** Exact decimal text of an amount in wei, with trailing zeros removed. */
export function weiToGenText(wei: bigint | string): string {
  const w = BigInt(wei);
  const neg = w < 0n;
  const abs = neg ? -w : w;
  const whole = abs / WEI;
  const frac = (abs % WEI).toString().padStart(18, "0").replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole}${frac ? "." + frac : ""}`;
}

/** Human-friendly amount. Keeps small amounts exact (0.001) and trims big ones. */
export function formatGen(wei: bigint | string, opts: { max?: number; symbol?: boolean } = {}): string {
  const { max = 4, symbol = true } = opts;
  const w = BigInt(wei);
  const neg = w < 0n;
  const abs = neg ? -w : w;
  const whole = abs / WEI;
  let frac = (abs % WEI).toString().padStart(18, "0");
  let digits = frac.slice(0, max).replace(/0+$/, "");
  // a tiny non-zero amount must never read as zero
  if (!digits && abs > 0n && whole === 0n) {
    frac = frac.replace(/0+$/, "");
    const firstNonZero = frac.search(/[1-9]/);
    digits = frac.slice(0, Math.min(frac.length, firstNonZero + 2));
  }
  const wholeText = whole.toLocaleString("en-US");
  return `${neg ? "-" : ""}${wholeText}${digits ? "." + digits : ""}${symbol ? " GEN" : ""}`;
}

export const shortAddr = (a: string, head = 6, tail = 4): string => (a && a.length > head + tail + 2 ? `${a.slice(0, head)}…${a.slice(-tail)}` : a);

export const sameAddr = (a?: string | null, b?: string | null): boolean => !!a && !!b && a.toLowerCase() === b.toLowerCase();

export const isAddress = (a: string): boolean => /^0x[0-9a-fA-F]{40}$/.test(a.trim());

export const isZeroAddress = (a: string): boolean => /^0x0{40}$/i.test(a);

/** "3 days", "2 h 5 min", "45 s". Two units at most. */
export function formatDuration(seconds: number): string {
  let s = Math.max(0, Math.round(seconds));
  if (s === 0) return "0 s";
  const units: [string, number][] = [
    ["day", 86400],
    ["h", 3600],
    ["min", 60],
    ["s", 1],
  ];
  const parts: string[] = [];
  for (const [name, size] of units) {
    if (s >= size) {
      const n = Math.floor(s / size);
      s -= n * size;
      parts.push(name === "day" ? `${n} ${n === 1 ? "day" : "days"}` : `${n} ${name}`);
    }
    if (parts.length === 2) break;
  }
  return parts.join(" ");
}

export function formatDateTime(ts: number): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function formatDate(ts: number): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** "5 min ago" / "in 2 h". */
export function relativeTime(ts: number, now = Date.now() / 1000): string {
  if (!ts) return "—";
  const diff = ts - now;
  const abs = Math.abs(diff);
  if (abs < 5) return "just now";
  const text = formatDuration(abs).split(" ").slice(0, 2).join(" ");
  return diff >= 0 ? `in ${text}` : `${text} ago`;
}

export const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/** Ratio a/b as a number between 0 and 1 (0 when b is zero). Works on bigint amounts without losing precision. */
export function ratio(a: bigint | string, b: bigint | string): number {
  const x = BigInt(a);
  const y = BigInt(b);
  if (y <= 0n) return 0;
  const scaled = (x * 10_000n) / y;
  return clamp(Number(scaled) / 10_000, 0, 1);
}

export const plural = (n: number, one: string, many = one + "s"): string => `${n} ${n === 1 ? one : many}`;

export function ordinalPct(n: number): string {
  return `${Math.round(n)}%`;
}

/** Splits seconds into the biggest whole unit, for editing in a number + unit input. */
export type TimeUnit = "seconds" | "minutes" | "hours" | "days";
export const UNIT_SECONDS: Record<TimeUnit, number> = { seconds: 1, minutes: 60, hours: 3600, days: 86400 };

export function splitDuration(seconds: number): { value: number; unit: TimeUnit } {
  for (const unit of ["days", "hours", "minutes"] as const) {
    if (seconds >= UNIT_SECONDS[unit] && seconds % UNIT_SECONDS[unit] === 0) return { value: seconds / UNIT_SECONDS[unit], unit };
  }
  return { value: seconds, unit: "seconds" };
}

// Reads contracts/leash.py and writes src/lib/contract.generated.json: the public interface, the numeric limits and
// the user-facing error messages. The web app and the documentation import this file, so they cannot drift from the
// contract.
//
//   node scripts/sync-contract.mjs          regenerate the file
//   node scripts/sync-contract.mjs --check  exit 1 when the file is out of date (used by `npm run check:contract`)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SRC = fileURLToPath(new URL("../../contracts/leash.py", import.meta.url));
const OUT = fileURLToPath(new URL("../src/lib/contract.generated.json", import.meta.url));
const CHECK = process.argv.includes("--check");

const source = readFileSync(SRC, "utf8");
const lines = source.split("\n");

// ---- numeric constants -------------------------------------------------------------------------------------------

/** Evaluates a small Python integer expression ("10**15", "3 * 86400", "7 * 86400") with exact integers. */
function evalInt(expr) {
  const js = expr.replace(/(\d[\d_]*)/g, (m) => `${m.replace(/_/g, "")}n`);
  if (!/^[\dn\s*+\-()]+$/.test(js)) return null;
  try {
    return BigInt(Function(`"use strict"; return (${js});`)());
  } catch {
    return null;
  }
}

const constants = {};
const enums = {};
for (const raw of lines) {
  const line = raw.replace(/\s+#.*$/, "");
  let m = line.match(/^([A-Z][A-Z0-9_]*(?:\s*,\s*[A-Z][A-Z0-9_]*)+)\s*=\s*range\((\d+)\)\s*$/);
  if (m) {
    const names = m[1].split(",").map((s) => s.trim());
    enums[names.join(",")] = names;
    names.forEach((n, i) => (constants[n] = String(i)));
    continue;
  }
  m = line.match(/^([A-Z][A-Z0-9_]*(?:\s*,\s*[A-Z][A-Z0-9_]*)*)\s*=\s*(.+)$/);
  if (!m) continue;
  const names = m[1].split(",").map((s) => s.trim());
  const values = m[2].split(/\s*,\s*(?![^(]*\))/).map((s) => s.trim());
  if (names.length !== values.length) continue;
  names.forEach((n, i) => {
    const v = evalInt(values[i]);
    if (v !== null) constants[n] = v.toString();
  });
}

// ---- public interface ---------------------------------------------------------------------------------------------

const methods = [];
for (let i = 0; i < lines.length; i++) {
  const deco = lines[i].match(/^\s+@gl\.public\.(write|view)(\.payable)?\s*$/);
  if (!deco) continue;
  let j = i + 1;
  let sig = "";
  for (; j < lines.length; j++) {
    sig += lines[j].trim() + " ";
    const opens = (sig.match(/\(/g) || []).length;
    const closes = (sig.match(/\)/g) || []).length;
    if (opens > 0 && opens === closes && /:\s*$/.test(lines[j].trim())) break;
  }
  const m = sig.match(/def\s+(\w+)\s*\(([\s\S]*)\)\s*(?:->\s*([\w\[\], ]+?))?\s*:\s*$/);
  if (!m) throw new Error(`Cannot parse the signature near line ${i + 1}: ${sig}`);
  const params = m[2]
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && s !== "self")
    .map((s) => {
      const [name, type] = s.split(":").map((x) => x.trim());
      return [name, type ?? "any"];
    });
  // the body of the method, up to the next decorator or method at the same indent
  let end = j + 1;
  while (end < lines.length && !/^ {4}(@|def |class )|^\S/.test(lines[end])) end++;
  const body = lines.slice(j + 1, end).join("\n");
  const own = [...body.matchAll(/UserError\(\s*"((?:[^"\\]|\\.)*)"\s*\)/g)].map((x) => x[1]);
  const calls = new Set([...body.matchAll(/self\.(_\w+)\(|(?<![\w.])(_address|_tidy|_clean)\(/g)].map((x) => x[1] ?? x[2]));
  methods.push({
    name: m[1],
    kind: deco[1],
    payable: Boolean(deco[2]),
    params,
    returns: m[3]?.trim() ?? "None",
    own,
    calls: [...calls],
  });
}

// ---- helper errors (what each internal helper can raise) ------------------------------------------------------------

function helperErrors(name) {
  const start = lines.findIndex((l) => new RegExp(`^(?: {4})?def ${name}\\(`).test(l));
  if (start < 0) return [];
  let end = start + 1;
  while (end < lines.length && !/^(?: {4})?(def |class |@)|^\S/.test(lines[end].replace(/^ {8,}.*/, "")) ) end++;
  const baseIndent = lines[start].match(/^\s*/)[0].length;
  end = start + 1;
  while (end < lines.length && (lines[end].trim() === "" || lines[end].match(/^\s*/)[0].length > baseIndent)) end++;
  const body = lines.slice(start + 1, end).join("\n");
  return [...body.matchAll(/UserError\(\s*"((?:[^"\\]|\\.)*)"\s*\)/g)].map((x) => x[1]);
}
const helperNames = new Set(methods.flatMap((x) => x.calls));
const helpers = Object.fromEntries([...helperNames].map((n) => [n, helperErrors(n)]));
// helpers calling other helpers
const nested = { _must_be_live: [], _check_payee: [], _pick_guardian: ["_address"], _check_limits: [] };
for (const [h, subs] of Object.entries(nested)) for (const s of subs) helpers[h] = [...(helpers[h] ?? []), ...(helpers[s] ?? helperErrors(s))];

const clean = (s) => s.replace(/\\"/g, '"');
const out = {
  contract: "contracts/leash.py",
  constants,
  methods: methods.map((x) => {
    const viaHelpers = x.calls.flatMap((c) => helpers[c] ?? []);
    const errors = [...new Set([...x.own, ...viaHelpers].map(clean))];
    return { name: x.name, kind: x.kind, payable: x.payable, params: x.params, returns: x.returns, errors };
  }),
};

const next = JSON.stringify(out, null, 2) + "\n";
if (CHECK) {
  const prev = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
  if (prev !== next) {
    console.error("src/lib/contract.generated.json is out of date. Run: node scripts/sync-contract.mjs");
    process.exit(1);
  }
  console.log(`contract.generated.json is current (${out.methods.length} methods, ${Object.keys(constants).length} constants).`);
} else {
  writeFileSync(OUT, next);
  console.log(`wrote ${OUT}: ${out.methods.length} methods, ${Object.keys(constants).length} constants.`);
}

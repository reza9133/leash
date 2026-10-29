// Tiny helpers for the flow scripts.
import { mkdirSync } from "node:fs";
export const SHOTS = process.env.SHOTS_DIR ?? "/tmp/leash-shots";
mkdirSync(SHOTS, { recursive: true });
let failed = 0;
export const results = [];
export function check(cond, what) {
  results.push({ ok: !!cond, what });
  console.log(`${cond ? "ok  " : "FAIL"} ${what}`);
  if (!cond) failed++;
}
export const failures = () => failed;
export async function step(name, fn) {
  try {
    await fn();
  } catch (e) {
    check(false, `${name}: ${String(e.message).split("\n")[0]}`);
  }
}
export const shot = (page, name) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true, animations: "disabled", timeout: 60000 });

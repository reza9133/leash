// Runs the real genlayer-js client against the mock chain, the way the app does: reads through the RPC and
// writes through a wallet-like provider. Exits non-zero on the first failed expectation.
import { createClient, chains } from "genlayer-js";
import { startMock } from "./chain.mjs";
import { ACCOUNTS } from "./accounts.mjs";

const mock = await startMock({ fast: true, http: true, verbose: process.env.VERBOSE === "1" });
const chain = { ...chains.studionet, rpcUrls: { default: { http: [mock.url] } } };
const reader = createClient({ chain });
const walletFor = (address) => ({
  request: async ({ method, params }) => {
    const r = await mock.handleRpc({ jsonrpc: "2.0", id: 1, method, params });
    if (r.error) throw Object.assign(new Error(r.error.message), { code: r.error.code });
    return r.result;
  },
});
const clientFor = (a) => createClient({ chain, account: a.address, provider: walletFor(a.address) });

let failures = 0;
const expect = (cond, what) => {
  console.log(`${cond ? "ok  " : "FAIL"} ${what}`);
  if (!cond) failures++;
};
const GEN = 10n ** 18n;

async function send(a, fn, args, value = 0n) {
  const c = clientFor(a);
  const hash = await c.writeContract({ address: process.env.LEASH_ADDRESS ?? "0x13Ad9bC5C0a1fcC19f5C410b6685EB6029893CB5", functionName: fn, args, ...(value ? { value } : {}) });
  for (let i = 0; i < 200; i++) {
    const t = await reader.getTransaction({ hash });
    if (t.statusName === "ACCEPTED") return t;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error("transaction never decided");
}
const view = async (fn, args = []) => JSON.parse(await reader.readContract({ address: "0x13Ad9bC5C0a1fcC19f5C410b6685EB6029893CB5", functionName: fn, args }));

try {
  const s0 = await view("stats");
  expect(s0.mandates === 0, "fresh chain has no mandates");

  const t1 = await send(ACCOUNTS.owner, "create_mandate", ["Research budget", "Pay for cloud hosting and developer tooling only. Nothing personal.", GEN, 5n * GEN, 86400, 60, ""], 3n * GEN);
  const leader = t1.consensus_data.leader_receipt[0];
  expect(leader.execution_result === "SUCCESS" && leader.result.payload.readable === "0", `create_mandate succeeds and returns the id (got ${JSON.stringify(leader.result)})`);

  const m = await view("get_mandate", [0]);
  expect(m.name === "Research budget" && m.balance === (3n * GEN).toString(), "mandate row has the deposit");

  const bad = await send(ACCOUNTS.stranger, "set_paused", [0, true]);
  const badLeader = bad.consensus_data.leader_receipt[0];
  expect(badLeader.execution_result === "ERROR" && /Only the owner/.test(badLeader.result.payload), `a stranger is refused (${badLeader.result.payload})`);

  await send(ACCOUNTS.owner, "grant_delegate", [0, ACCOUNTS.agent.address, 2n * GEN]);
  const rq = await send(ACCOUNTS.agent, "request_payment", [0, ACCOUNTS.payee.address, GEN / 2n, "Monthly hosting invoice for the studio.", ""]);
  expect(rq.consensus_data.leader_receipt[0].result.payload.readable === "0", "request_payment returns request id 0");

  await send(ACCOUNTS.stranger, "review", [0]);
  const r1 = await view("get_request", [0]);
  expect(r1.state === 1, `review approves the request (state ${r1.state})`);

  mock.warp(120);
  await send(ACCOUNTS.stranger, "execute", [0]);
  const r2 = await view("get_request", [0]);
  expect(r2.state === 4, `execute pays it after the delay (state ${r2.state})`);

  const books = await view("solvency");
  expect(books.balanced === true, "the books balance");
} catch (e) {
  console.error("selftest crashed:", e);
  failures++;
} finally {
  await mock.close();
}
console.log(failures ? `${failures} failed` : "all passed");
process.exit(failures ? 1 : 0);

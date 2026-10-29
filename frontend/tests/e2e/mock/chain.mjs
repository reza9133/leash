// A test stand-in for GenLayer Studionet. The real Leash contract runs in the local direct runner (a python
// process, see chain_server.py); this file speaks the JSON-RPC that genlayer-js and the wallet use and moves
// transactions through the consensus phases with short delays, so the interface can be exercised end to end.
//
//   const mock = await startMock();
//   await mock.handleRpc({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] });
//   mock.setMode({ review: { verdict: "ESCALATE", risk: 50 } });
//   mock.warp(3600);               // move the contract's clock forward one hour
//   await mock.close();
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { createInterface } from "node:readline";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { abi, chains } from "genlayer-js";
import { decodeFunctionData, fromHex, fromRlp, toHex } from "viem";

const here = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(here, "../../../..");
export const CONTRACT_ADDRESS = "0x13Ad9bC5C0a1fcC19f5C410b6685EB6029893CB5";
const MARK = "@@RPC ";
const { calldata } = abi;
const CONSENSUS = chains.studionet.consensusMainContract;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const bigReplacer = (_k, v) => (typeof v === "bigint" ? { $big: v.toString() } : v);
const toPlain = (v) => (typeof v === "bigint" ? v : v instanceof Map ? Object.fromEntries([...v].map(([k, x]) => [k, toPlain(x)])) : Array.isArray(v) ? v.map(toPlain) : v);

export async function startMock(opts = {}) {
  const stepMs = opts.stepMs ?? 450;
  const slowMs = opts.slowMs ?? 1800;
  let offset = 0;
  const nowSeconds = () => Math.floor(Date.now() / 1000) + offset;

  // ---- the python backend that runs the real contract ----------------------------------------------------------------------------
  const child = spawn("bash", ["-c", `cd "${REPO_ROOT}" && python3 -m pytest -q -s -p no:cacheprovider -c pytest.ini frontend/tests/e2e/mock/chain_server.py`], { stdio: ["pipe", "pipe", opts.verbose ? "inherit" : "ignore"] });
  const pending = new Map();
  let nextId = 1;
  let markReady;
  const ready = new Promise((r) => (markReady = r));
  createInterface({ input: child.stdout }).on("line", (line) => {
    if (!line.startsWith(MARK)) return;
    const msg = JSON.parse(line.slice(MARK.length));
    if (msg.ready) return markReady();
    const p = pending.get(msg.id);
    if (p) {
      pending.delete(msg.id);
      p(msg);
    }
  });
  child.on("exit", () => markReady());
  async function ask(req) {
    await ready;
    const id = nextId++;
    const p = new Promise((resolveAsk) => pending.set(id, resolveAsk));
    child.stdin.write(JSON.stringify({ ...req, id, now: nowSeconds() }, bigReplacer) + "\n");
    return p;
  }
  await Promise.race([ready, sleep(180000)]);

  // ---- transactions ------------------------------------------------------------------------------------------------------------------
  const txs = new Map();
  let execQueue = Promise.resolve();
  const log = [];

  async function process(tx) {
    const slow = tx.fn === "review" || tx.fn === "audit";
    const step = opts.fast ? 20 : stepMs;
    tx.status = "PENDING";
    await sleep(step);
    tx.status = "PROPOSING";
    await sleep(step);
    tx.status = "COMMITTING";
    await sleep(opts.fast ? 20 : slow ? slowMs : step);
    // the contract call itself runs one at a time, in the order the transactions were committed
    const result = await (execQueue = execQueue.then(() => ask({ op: "call", sender: tx.from, fn: tx.fn, args: tx.args, value: tx.value.toString() })));
    tx.status = "REVEALING";
    await sleep(step);
    tx.ok = !!result.ok;
    tx.ret = result.ret;
    tx.error = result.error;
    tx.status = "ACCEPTED";
    log.push({ hash: tx.hash, fn: tx.fn, from: tx.from, ok: tx.ok, error: tx.error, ret: tx.ret });
  }

  function studioTx(tx) {
    const base = { hash: tx.hash, status: tx.status, from_address: tx.from, to_address: CONTRACT_ADDRESS, value: toHex(tx.value), data: {}, created_at: new Date(tx.created * 1000).toISOString(), type: "0x0" };
    if (tx.status !== "ACCEPTED") return base;
    return {
      ...base,
      consensus_data: {
        leader_receipt: [
          {
            execution_result: tx.ok ? "SUCCESS" : "ERROR",
            result: tx.ok ? { status: "return", payload: { readable: tx.ret === null || tx.ret === undefined ? "null" : String(tx.ret) } } : { status: "contract_error", payload: tx.error },
          },
        ],
      },
    };
  }

  // ---- JSON-RPC -------------------------------------------------------------------------------------------------------------------------
  async function dispatch(method, params) {
    switch (method) {
      case "eth_chainId":
        return "0xf22f";
      case "net_version":
        return "61999";
      case "eth_gasPrice":
        return "0x1";
      case "eth_blockNumber":
        return "0x10";
      case "eth_getTransactionCount":
        return "0x0";
      case "eth_estimateGas":
        return "0x30d40";
      case "eth_getBalance": {
        const r = await ask({ op: "balance", address: params[0] });
        return "0x" + BigInt(r.ret ?? 0).toString(16);
      }
      case "gen_call": {
        const p = params[0];
        const [data] = fromRlp(p.data, "bytes");
        const call = calldata.decode(data);
        const method2 = call.get("method");
        const args = call.get("args") ?? [];
        const r = await ask({ op: p.type === "write" ? "view" : "view", fn: method2, args });
        if (!r.ok) throw Object.assign(new Error(r.error.replace(/^[A-Za-z]+Error:\s*/, "")), { code: -32000 });
        const bytes = calldata.encode(r.ret);
        return { status: { code: 0, message: "" }, data: Buffer.from(bytes).toString("hex") };
      }
      case "eth_sendTransaction": {
        const p = params[0];
        const decoded = decodeFunctionData({ abi: CONSENSUS.abi, data: p.data });
        const txData = decoded.args[decoded.args.length - 1] ?? decoded.args[4];
        const [inner] = fromRlp(typeof txData === "string" ? txData : toHex(txData), "bytes");
        const call = calldata.decode(inner);
        const hash = "0x" + createHash("sha256").update(randomBytes(16)).digest("hex");
        const tx = {
          hash,
          from: p.from,
          fn: call.get("method"),
          args: toPlain(call.get("args") ?? []),
          value: p.value ? BigInt(p.value) : 0n,
          created: nowSeconds(),
          status: "PENDING",
        };
        txs.set(hash, tx);
        void process(tx);
        return hash;
      }
      case "eth_getTransactionByHash": {
        const tx = txs.get(params[0]);
        return tx ? studioTx(tx) : null;
      }
      case "wallet_switchEthereumChain":
      case "wallet_addEthereumChain":
        return null;
      default:
        throw Object.assign(new Error(`The mock does not support ${method}`), { code: -32601 });
    }
  }

  async function handleRpc(body) {
    const one = async (q) => {
      try {
        return { jsonrpc: "2.0", id: q.id, result: await dispatch(q.method, q.params ?? []) };
      } catch (e) {
        return { jsonrpc: "2.0", id: q.id, error: { code: e.code ?? -32000, message: e.message } };
      }
    };
    return Array.isArray(body) ? Promise.all(body.map(one)) : one(body);
  }

  // ---- control -------------------------------------------------------------------------------------------------------------------------
  const api = {
    handleRpc,
    log,
    txs,
    setMode: (mode) => ask({ op: "set_mode", ...mode }),
    warp: (seconds) => void (offset += seconds),
    now: nowSeconds,
    /** Direct contract access for test setup, bypassing the consensus delays. */
    call: (sender, fn, args = [], value = 0n) => ask({ op: "call", sender, fn, args, value: value.toString() }),
    view: async (fn, args = []) => {
      const r = await ask({ op: "view", fn, args });
      if (!r.ok) throw new Error(r.error);
      return JSON.parse(r.ret);
    },
    fast: (on = true) => void (opts.fast = on),
    async close() {
      try {
        child.stdin.end();
      } catch {
        /* already closed */
      }
      child.kill();
      server?.close();
    },
    url: "",
    port: 0,
  };

  // an HTTP front for tools that want a real URL (CORS enabled)
  let server;
  if (opts.http) {
    server = createServer((req, res) => {
      res.setHeader("access-control-allow-origin", "*");
      res.setHeader("access-control-allow-headers", "*");
      if (req.method === "OPTIONS") return void res.writeHead(204).end();
      let body = "";
      req.on("data", (d) => (body += d));
      req.on("end", async () => {
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify(await handleRpc(JSON.parse(body))));
      });
    });
    await new Promise((r) => server.listen(opts.port ?? 0, "127.0.0.1", r));
    api.port = server.address().port;
    api.url = `http://127.0.0.1:${api.port}/api`;
  }
  void fromHex;
  return api;
}

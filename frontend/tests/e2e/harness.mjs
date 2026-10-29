// Starts the mock chain, serves the built app and opens it in Chromium with mock wallets installed.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import { startMock, REPO_ROOT } from "./mock/chain.mjs";
import { installWallets } from "./mock/wallet.js";
import { ACCOUNTS } from "./mock/accounts.mjs";

const DIST = join(REPO_ROOT, "frontend", "dist");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".json": "application/json" };

function serveDist() {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    let file = normalize(join(DIST, url.pathname === "/" ? "index.html" : url.pathname));
    if (!file.startsWith(DIST)) return void res.writeHead(403).end();
    try {
      const body = await readFile(file);
      res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" }).end(body);
    } catch {
      res.writeHead(404).end("not found");
    }
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port })));
}

export const GL_ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];

export async function launch(opts = {}) {
  const mock = opts.mock ?? (await startMock({ fast: opts.fast ?? false }));
  const { server, port } = await serveDist();
  const browser = await chromium.launch({ args: GL_ARGS });
  const context = await browser.newContext({ viewport: opts.viewport ?? { width: 1280, height: 860 }, reducedMotion: opts.motion ? "no-preference" : "reduce" });
  await context.exposeFunction("__mockRpc", (body) => mock.handleRpc(body));
  const wallets = {
    accounts: [(opts.account ?? ACCOUNTS.owner).address],
    chainId: opts.chainId ?? "0xf22f",
    knownChains: opts.knownChains ?? ["0x1", "0xf22f"],
    wallets: opts.wallets,
    noEip6963: opts.noEip6963,
    legacy: opts.legacy,
  };
  await context.addInitScript(installWallets, wallets);
  if (!opts.webgl) {
    // the 3D hero is not what these tests are about, and software GL makes every frame slow
    await context.addInitScript(() => {
      const get = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
        return /webgl/i.test(String(type)) ? null : get.call(this, type, ...rest);
      };
    });
  }
  await context.addInitScript((t) => {
    try {
      localStorage.setItem("leash.theme", t.theme);
      sessionStorage.setItem("leash.splash", "1");
    } catch {}
  }, { theme: opts.theme ?? "light" });
  await context.route("**/studio.genlayer.com/**", async (route) => {
    const method = route.request().method();
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*" };
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const body = JSON.parse(route.request().postData() ?? "null");
    const res = await mock.handleRpc(body);
    return route.fulfill({ status: 200, headers: { ...cors, "content-type": "application/json" }, body: JSON.stringify(res) });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
  const base = `http://127.0.0.1:${port}/#`;
  return {
    mock,
    page,
    context,
    errors,
    base,
    goto: async (route) => {
      await page.goto(base + route);
      await page.waitForLoadState("load");
    },
    async close() {
      await browser.close();
      server.close();
      if (!opts.mock) await mock.close();
    },
  };
}

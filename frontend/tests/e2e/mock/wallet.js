// A browser-side mock of two EIP-6963 wallets. It is passed to Playwright's addInitScript as a function, so it has
// to be self-contained. `window.__mockRpc` (exposed by the harness) carries chain calls to the mock chain.
export function installWallets(opts) {
  const STUDIO = "0xf22f";
  const wallets = {};
  const info = (w) => ({ uuid: w.uuid, name: w.name, icon: w.icon, rdns: w.rdns });
  const svg = (c) => "data:image/svg+xml;base64," + btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" rx="10" fill="${c}"/></svg>`);

  function make(def) {
    const w = {
      ...def,
      accounts: [...opts.accounts],
      permitted: (() => { try { return localStorage.getItem('__mock_permitted_' + def.rdns) === '1'; } catch { return false; } })(),
      chain: opts.chainId,
      known: new Set(opts.knownChains),
      listeners: {},
      calls: [],
    };
    const save = () => { try { localStorage.setItem('__mock_permitted_' + def.rdns, w.permitted ? '1' : '0'); } catch {} };
    const emit = (ev, payload) => (w.listeners[ev] || []).slice().forEach((f) => { try { f(payload); } catch (e) { console.error(e); } });
    const provider = {
      isMock: true,
      async request({ method, params = [] }) {
        w.calls.push(method);
        await new Promise((r) => setTimeout(r, 60));
        switch (method) {
          case "eth_requestAccounts": {
            if (window.__walletReject) { const e = new Error("User rejected the request."); e.code = 4001; throw e; }
            await new Promise((r) => setTimeout(r, 200));
            w.permitted = true;
            save();
            return [...w.accounts];
          }
          case "eth_accounts":
            return w.permitted ? [...w.accounts] : [];
          case "eth_chainId":
            return w.chain;
          case "net_version":
            return String(parseInt(w.chain, 16));
          case "wallet_getPermissions":
            return w.permitted ? [{ parentCapability: "eth_accounts" }] : [];
          case "wallet_revokePermissions":
            if (w.noRevoke) { const e = new Error("Method not supported"); e.code = -32601; throw e; }
            w.permitted = false;
            save();
            emit("accountsChanged", []);
            return null;
          case "wallet_switchEthereumChain": {
            const id = params[0].chainId;
            if (window.__walletReject) { const e = new Error("User rejected the request."); e.code = 4001; throw e; }
            if (!w.known.has(id)) { const e = new Error("Unrecognized chain ID."); e.code = 4902; throw e; }
            w.chain = id;
            emit("chainChanged", id);
            return null;
          }
          case "wallet_addEthereumChain": {
            if (window.__walletReject) { const e = new Error("User rejected the request."); e.code = 4001; throw e; }
            const id = params[0].chainId;
            w.known.add(id);
            w.chain = id;
            w.added = params[0];
            emit("chainChanged", id);
            return null;
          }
          case "eth_sendTransaction": {
            if (!w.permitted) { const e = new Error("Not connected"); e.code = 4100; throw e; }
            if (window.__walletReject) { const e = new Error("User rejected the request."); e.code = 4001; throw e; }
            if (w.chain !== STUDIO) { const e = new Error("Wrong chain for this transaction"); e.code = -32000; throw e; }
            await new Promise((r) => setTimeout(r, 150));
            const tx = { ...params[0], from: w.accounts[0] };
            const res = await window.__mockRpc({ jsonrpc: "2.0", id: 1, method, params: [tx] });
            if (res.error) { const e = new Error(res.error.message); e.code = res.error.code; throw e; }
            return res.result;
          }
          default: {
            const res = await window.__mockRpc({ jsonrpc: "2.0", id: 1, method, params });
            if (res.error) { const e = new Error(res.error.message); e.code = res.error.code; throw e; }
            return res.result;
          }
        }
      },
      on(ev, fn) { (w.listeners[ev] ||= []).push(fn); return provider; },
      removeListener(ev, fn) { w.listeners[ev] = (w.listeners[ev] || []).filter((f) => f !== fn); return provider; },
    };
    w.provider = provider;
    w.emit = emit;
    w.setChain = (hex) => { w.chain = hex; w.known.add(hex); emit("chainChanged", hex); };
    w.setAccounts = (list) => { w.accounts = list; if (w.permitted) emit("accountsChanged", [...list]); };
    return w;
  }

  const defs = opts.wallets || [
    { key: "one", name: "Mock Wallet One", rdns: "io.mock.one", uuid: "11111111-1111-4111-8111-111111111111", icon: svg("#3b82f6") },
    { key: "two", name: "Mock Wallet Two", rdns: "io.mock.two", uuid: "22222222-2222-4222-8222-222222222222", icon: svg("#10b981") },
  ];
  defs.forEach((d) => { wallets[d.key] = make(d); });
  window.__wallets = wallets;

  const announce = () => {
    Object.values(wallets).forEach((w) => {
      window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: Object.freeze({ info: Object.freeze(info(w)), provider: w.provider }) }));
    });
  };
  if (!opts.noEip6963) {
    window.addEventListener("eip6963:requestProvider", announce);
    setTimeout(announce, 0);
  }
  if (opts.legacy) window.ethereum = Object.values(wallets)[0].provider;
}

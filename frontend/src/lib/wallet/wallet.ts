// Wallet state: discovery through EIP-6963, connect, disconnect, account and network tracking.
//
// Disconnect is real. EIP-1193 has no "disconnect" call, so three things happen together:
//   1. the app drops the account, the provider and every event listener it attached,
//   2. the wallet is asked to revoke this site's permission (wallet_revokePermissions) when it supports that,
//   3. a flag stops the automatic reconnect on the next visit.
import { CHAIN } from "../../config";
import { createStore, safeStorage, useStore } from "../store";
import { legacyProvider, requestProviders, startDiscovery, type EIP1193Provider, type ProviderDetail, type ProviderInfo } from "./eip6963";

const KEY_LAST = "leash.wallet.last";
const KEY_AUTO = "leash.wallet.auto";

export interface WalletState {
  providers: ProviderDetail[];
  scanned: boolean;
  status: "idle" | "connecting" | "connected";
  active: ProviderInfo | null;
  account: string | null;
  chainId: number | null;
  switching: boolean;
  error: string | null;
  connectOpen: boolean;
}

export const walletStore = createStore<WalletState>({
  providers: [],
  scanned: false,
  status: "idle",
  active: null,
  account: null,
  chainId: null,
  switching: false,
  error: null,
  connectOpen: false,
});

let activeProvider: EIP1193Provider | null = null;
let detach: (() => void) | null = null;
let stopDiscovery: (() => void) | null = null;
let started = false;

// ---- helpers -----------------------------------------------------------------------------------------------------------

const hexToNumber = (hex: unknown): number | null => {
  if (typeof hex === "number") return hex;
  if (typeof hex !== "string") return null;
  const n = hex.startsWith("0x") ? parseInt(hex, 16) : parseInt(hex, 10);
  return Number.isFinite(n) ? n : null;
};

interface RpcError {
  code?: number;
  message?: string;
  data?: { originalError?: { code?: number } };
}

/** A readable message for the errors wallets throw. */
export function describeWalletError(err: unknown): string {
  const e = err as RpcError;
  const code = e?.code ?? e?.data?.originalError?.code;
  if (code === 4001) return "You closed the request in your wallet.";
  if (code === -32002) return "Your wallet already has a pending request. Open the wallet and finish it.";
  if (code === 4100) return "The wallet has not authorised this site yet. Connect again.";
  if (code === 4900 || code === 4901) return "The wallet lost its connection to the network. Check the wallet and try again.";
  const msg = typeof e?.message === "string" ? e.message : "";
  return msg ? msg.split("\n")[0].slice(0, 220) : "The wallet returned an error.";
}

const isUserRejection = (err: unknown): boolean => (err as RpcError)?.code === 4001;

const lowerAddr = (a: unknown): string | null => (typeof a === "string" && /^0x[0-9a-fA-F]{40}$/.test(a) ? a : null);

function detachListeners() {
  detach?.();
  detach = null;
}

function attachListeners(provider: EIP1193Provider) {
  detachListeners();
  const onAccounts = (accounts: unknown) => {
    const list = Array.isArray(accounts) ? accounts : [];
    const first = lowerAddr(list[0]);
    if (!first) {
      // The wallet no longer shares an account with this site: that is a disconnect initiated from the wallet.
      clearSession();
      return;
    }
    walletStore.patch({ account: first });
  };
  const onChain = (chainId: unknown) => walletStore.patch({ chainId: hexToNumber(chainId) });
  const onDisconnect = () => clearSession();
  provider.on?.("accountsChanged", onAccounts);
  provider.on?.("chainChanged", onChain);
  provider.on?.("disconnect", onDisconnect);
  detach = () => {
    provider.removeListener?.("accountsChanged", onAccounts);
    provider.removeListener?.("chainChanged", onChain);
    provider.removeListener?.("disconnect", onDisconnect);
  };
}

function clearSession() {
  detachListeners();
  activeProvider = null;
  walletStore.patch({ status: "idle", active: null, account: null, chainId: null, switching: false });
}

async function finishConnect(detail: ProviderDetail, accounts: unknown) {
  const account = lowerAddr(Array.isArray(accounts) ? accounts[0] : null);
  if (!account) throw new Error("The wallet did not share an account.");
  const chainId = hexToNumber(await detail.provider.request({ method: "eth_chainId" }).catch(() => null));
  activeProvider = detail.provider;
  attachListeners(detail.provider);
  safeStorage.set(KEY_LAST, JSON.stringify({ rdns: detail.info.rdns, uuid: detail.info.uuid }));
  safeStorage.set(KEY_AUTO, "1");
  walletStore.patch({ status: "connected", active: detail.info, account, chainId, error: null });
}

// ---- discovery and reconnect ---------------------------------------------------------------------------------------------

function onProvider(detail: ProviderDetail) {
  const current = walletStore.get().providers;
  if (current.some((p) => p.info.uuid === detail.info.uuid)) return;
  walletStore.patch({ providers: [...current, detail] });
  void trySilentReconnect(detail);
}

async function trySilentReconnect(detail: ProviderDetail) {
  const st = walletStore.get();
  if (st.status !== "idle" || safeStorage.get(KEY_AUTO) !== "1") return;
  let last: { rdns?: string; uuid?: string } = {};
  try {
    last = JSON.parse(safeStorage.get(KEY_LAST) ?? "{}");
  } catch {
    return;
  }
  if (last.rdns !== detail.info.rdns) return;
  try {
    // eth_accounts never opens a pop-up: it only lists accounts this site already may use.
    const accounts = await detail.provider.request({ method: "eth_accounts" });
    if (Array.isArray(accounts) && accounts.length && walletStore.get().status === "idle") await finishConnect(detail, accounts);
  } catch {
    /* stay disconnected */
  }
}

/** Starts wallet discovery. Safe to call more than once. */
export function initWallet(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  stopDiscovery = startDiscovery(onProvider);
  // Wallets that load slowly announce again when asked; the legacy object is the last resort.
  window.setTimeout(() => requestProviders(), 400);
  window.setTimeout(() => {
    if (walletStore.get().providers.length === 0) {
      const legacy = legacyProvider();
      if (legacy) onProvider(legacy);
    }
    walletStore.patch({ scanned: true });
  }, 1000);
}

export function stopWallet(): void {
  stopDiscovery?.();
  stopDiscovery = null;
  started = false;
}

// ---- public actions ------------------------------------------------------------------------------------------------------

export async function connectWallet(uuid: string): Promise<boolean> {
  const detail = walletStore.get().providers.find((p) => p.info.uuid === uuid);
  if (!detail) {
    walletStore.patch({ error: "That wallet is no longer available. Reload the page and try again." });
    return false;
  }
  walletStore.patch({ status: "connecting", error: null });
  try {
    const accounts = await detail.provider.request({ method: "eth_requestAccounts" });
    await finishConnect(detail, accounts);
    return true;
  } catch (err) {
    walletStore.patch({ status: "idle", error: isUserRejection(err) ? "Connection cancelled in the wallet." : describeWalletError(err) });
    return false;
  }
}

export async function disconnectWallet(): Promise<void> {
  const provider = activeProvider;
  // Forget the session first so the interface reacts at once, whatever the wallet does next.
  safeStorage.set(KEY_AUTO, "0");
  safeStorage.remove(KEY_LAST);
  clearSession();
  walletStore.patch({ error: null });
  if (provider) {
    try {
      await provider.request({ method: "wallet_revokePermissions", params: [{ eth_accounts: {} }] });
    } catch {
      /* not every wallet supports revoking; the session is already closed on this side */
    }
  }
}

export async function switchToStudionet(): Promise<boolean> {
  const provider = activeProvider;
  if (!provider) return false;
  walletStore.patch({ switching: true, error: null });
  try {
    try {
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN.hexId }] });
    } catch (err) {
      const e = err as RpcError;
      const missing = e?.code === 4902 || e?.data?.originalError?.code === 4902 || /unrecognized chain|not been added|unknown chain|try adding the chain/i.test(e?.message ?? "");
      if (!missing) throw err;
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: CHAIN.hexId,
            chainName: CHAIN.name,
            nativeCurrency: CHAIN.currency,
            rpcUrls: [CHAIN.rpcUrl],
            blockExplorerUrls: [CHAIN.explorerUrl],
          },
        ],
      });
      // Some wallets add and switch in one step, others only add. Switch again to be sure.
      const now = hexToNumber(await provider.request({ method: "eth_chainId" }).catch(() => null));
      if (now !== CHAIN.id) await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN.hexId }] });
    }
    const chainId = hexToNumber(await provider.request({ method: "eth_chainId" }).catch(() => null));
    walletStore.patch({ chainId, switching: false });
    return chainId === CHAIN.id;
  } catch (err) {
    walletStore.patch({ switching: false, error: isUserRejection(err) ? "Network switch cancelled in the wallet." : describeWalletError(err) });
    return false;
  }
}

export function openConnect(): void {
  requestProviders();
  walletStore.patch({ connectOpen: true, error: null });
}
export function closeConnect(): void {
  walletStore.patch({ connectOpen: false });
}

export function getActiveProvider(): EIP1193Provider | null {
  return activeProvider;
}

export const onStudionet = (s: WalletState): boolean => s.status === "connected" && s.chainId === CHAIN.id;

export class WalletNotReady extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WalletNotReady";
  }
}

/** Makes sure a wallet is connected on Studionet before a transaction. Opens the dialogs the user needs. */
export async function ensureWalletReady(): Promise<{ account: string; provider: EIP1193Provider }> {
  let st = walletStore.get();
  if (st.status !== "connected" || !activeProvider || !st.account) {
    openConnect();
    throw new WalletNotReady("Connect your wallet to continue.");
  }
  if (st.chainId !== CHAIN.id) {
    const ok = await switchToStudionet();
    st = walletStore.get();
    if (!ok || st.chainId !== CHAIN.id) throw new WalletNotReady(`Switch your wallet to ${CHAIN.name} (chain ${CHAIN.id}) to continue.`);
  }
  return { account: st.account!, provider: activeProvider! };
}

export function useWallet() {
  return useStore(walletStore);
}

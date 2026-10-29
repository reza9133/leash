// EIP-6963: multi-injected provider discovery.
// A page dispatches "eip6963:requestProvider"; every installed wallet answers with an "eip6963:announceProvider"
// event that carries its identity (uuid, name, icon, rdns) and its EIP-1193 provider. No window.ethereum is needed.

export interface EIP1193Provider {
  request(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<unknown>;
  on?(event: string, listener: (...args: any[]) => void): unknown;
  removeListener?(event: string, listener: (...args: any[]) => void): unknown;
}

export interface ProviderInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

export interface ProviderDetail {
  info: ProviderInfo;
  provider: EIP1193Provider;
}

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

const isProvider = (p: unknown): p is EIP1193Provider => !!p && typeof (p as EIP1193Provider).request === "function";

/** Accepts an announcement only when it has the shape the standard requires. */
export function parseAnnouncement(detail: unknown): ProviderDetail | null {
  const d = detail as { info?: Partial<ProviderInfo>; provider?: unknown } | null;
  if (!d || !d.info || !isProvider(d.provider)) return null;
  const { uuid, name, icon, rdns } = d.info;
  if (typeof uuid !== "string" || typeof name !== "string" || typeof rdns !== "string" || !uuid || !name) return null;
  // The icon is shown in an <img>. The standard requires a data URI; anything else is dropped.
  const safeIcon = typeof icon === "string" && /^data:image\//i.test(icon) ? icon : "";
  return { info: { uuid, name: name.slice(0, 60), icon: safeIcon, rdns: rdns.slice(0, 120) }, provider: d.provider };
}

/** Starts listening for wallets. Returns a function that stops listening. */
export function startDiscovery(onProvider: (detail: ProviderDetail) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (event: Event) => {
    const parsed = parseAnnouncement((event as CustomEvent).detail);
    if (parsed) onProvider(parsed);
  };
  window.addEventListener("eip6963:announceProvider", handler);
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  return () => window.removeEventListener("eip6963:announceProvider", handler);
}

/** Asks the wallets to announce themselves again (for example when the connect dialog opens). */
export function requestProviders(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("eip6963:requestProvider"));
}

/** Last resort for in-app browsers that predate EIP-6963: the legacy window.ethereum object. */
export function legacyProvider(): ProviderDetail | null {
  if (typeof window === "undefined" || !isProvider(window.ethereum)) return null;
  const icon =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#39434f"/><path d="M8 12h14a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H10a3 3 0 0 1-3-3V11a3 3 0 0 1 3-3h12" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/><circle cx="21" cy="18" r="1.6" fill="#fff"/></svg>',
    );
  return { info: { uuid: "legacy-window-ethereum", name: "Browser wallet", icon, rdns: "legacy.window.ethereum" }, provider: window.ethereum };
}

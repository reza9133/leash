// The GenLayer SDK is loaded on first use, so the landing page does not pay for it.
// Reads go through one client without an account. Writes use a client bound to the connected wallet's own
// EIP-1193 provider (the one found through EIP-6963), never to a global window.ethereum.
import { CONTRACT_ADDRESS } from "../config";
import type { EIP1193Provider } from "./wallet/eip6963";

type Calldata = string | number | bigint | boolean | null;

interface SdkClient {
  readContract(args: { address: string; functionName: string; args?: Calldata[] }): Promise<unknown>;
  writeContract(args: { address: string; functionName: string; args?: Calldata[]; value?: bigint }): Promise<string>;
  getTransaction(args: { hash: string }): Promise<Record<string, any>>;
}

let sdkPromise: Promise<{ createClient: (c: Record<string, unknown>) => SdkClient; chain: unknown }> | null = null;

function loadSdk() {
  sdkPromise ??= Promise.all([import("genlayer-js"), import("genlayer-js/chains")]).then(([sdk, chains]) => ({
    createClient: sdk.createClient as unknown as (c: Record<string, unknown>) => SdkClient,
    chain: chains.studionet,
  }));
  return sdkPromise;
}

let reader: Promise<SdkClient> | null = null;
export function getReader(): Promise<SdkClient> {
  reader ??= loadSdk().then(({ createClient, chain }) => createClient({ chain }));
  return reader;
}

const writers = new WeakMap<EIP1193Provider, Map<string, Promise<SdkClient>>>();
export function getWriter(account: string, provider: EIP1193Provider): Promise<SdkClient> {
  let byAccount = writers.get(provider);
  if (!byAccount) {
    byAccount = new Map();
    writers.set(provider, byAccount);
  }
  const key = account.toLowerCase();
  let client = byAccount.get(key);
  if (!client) {
    client = loadSdk().then(({ createClient, chain }) => createClient({ chain, account, provider }));
    byAccount.set(key, client);
  }
  return client;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A call that reads contract state. Retried twice, because public RPC endpoints drop requests now and then. */
export async function readView<T>(functionName: string, args: Calldata[] = []): Promise<T> {
  const client = await getReader();
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const raw = await client.readContract({ address: CONTRACT_ADDRESS, functionName, args });
      if (typeof raw === "string") return JSON.parse(raw) as T;
      if (raw && typeof raw === "object") return raw as T;
      throw new Error("The contract returned an empty answer.");
    } catch (err) {
      lastError = err;
      if (isContractRefusal(err)) break;
      await sleep(350 * (attempt + 1));
    }
  }
  throw normalizeError(lastError);
}

/** Errors the contract itself raised (a missing mandate, say) are final; retrying them is pointless. */
function isContractRefusal(err: unknown): boolean {
  return /No such (mandate|request)|not a valid address/i.test(errorText(err));
}

export function errorText(err: unknown): string {
  if (!err) return "";
  if (typeof err === "string") return err;
  const e = err as { shortMessage?: string; message?: string; details?: string; data?: unknown };
  return [e.shortMessage, e.message, e.details].filter(Boolean).join(" ");
}

export function normalizeError(err: unknown): Error {
  const text = errorText(err);
  if (/No such mandate/i.test(text)) return new Error("No such mandate.");
  if (/No such request/i.test(text)) return new Error("No such request.");
  if (/Failed to fetch|NetworkError|fetch failed|Load failed/i.test(text)) return new Error("Cannot reach the GenLayer Studionet RPC. Check your connection and try again.");
  return new Error(text.split("\n")[0].slice(0, 240) || "The request failed.");
}

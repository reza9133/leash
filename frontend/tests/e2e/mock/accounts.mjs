// Fixed test accounts. The keys are public test values; they never hold anything.
import { privateKeyToAccount } from "viem/accounts";

const key = (n) => `0x${n.toString(16).padStart(64, "0")}`;
const make = (name, n) => ({ name, key: key(n), address: privateKeyToAccount(key(n)).address });

export const ACCOUNTS = {
  owner: make("owner", 0xa11ce),
  guardian: make("guardian", 0xb0b),
  agent: make("agent", 0xc0de),
  agent2: make("agent2", 0xc0df),
  watcher: make("watcher", 0xd00d),
  stranger: make("stranger", 0xe1e),
  payee: make("payee", 0xfa11),
};

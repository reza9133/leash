// Deployment constants. The contract address can be overridden at build time with VITE_LEASH_ADDRESS.

const envAddress = (import.meta.env.VITE_LEASH_ADDRESS as string | undefined)?.trim();

/** The deployed Leash contract on GenLayer Studionet. */
export const CONTRACT_ADDRESS: string = envAddress || "0x13Ad9bC5C0a1fcC19f5C410b6685EB6029893CB5";

/** GenLayer Studionet, as defined by the GenLayer SDK. */
export const CHAIN = {
  id: 61999,
  hexId: "0xf22f",
  name: "GenLayer Studionet",
  rpcUrl: "https://studio.genlayer.com/api",
  explorerUrl: "https://explorer-studio.genlayer.com",
  currency: { name: "GEN Token", symbol: "GEN", decimals: 18 },
} as const;

/** The deployed contract in the GenLayer Studio explorer. */
export const CONTRACT_EXPLORER_URL: string = `${CHAIN.explorerUrl}/address/${CONTRACT_ADDRESS}`;

export const LINKS = {
  github: "https://github.com/reza9133/leash",
  githubContract: "https://github.com/reza9133/leash/blob/main/contracts/leash.py",
  twitter: "https://x.com/amirhp771",
  twitterHandle: "@amirhp771",
  genlayer: "https://www.genlayer.com",
  genlayerDocs: "https://docs.genlayer.com",
} as const;

export const APP_NAME = "Leash";

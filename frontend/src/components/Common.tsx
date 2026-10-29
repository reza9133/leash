// Small pieces that several pages share.
import type { ReactNode } from "react";
import { Wallet } from "lucide-react";
import { CHAIN } from "../config";
import { formatGen, weiToGenText } from "../lib/format";
import { onStudionet, openConnect, useWallet } from "../lib/wallet/wallet";
import { ROLE_LABEL } from "../lib/roles";
import type { Role } from "../lib/types";
import { Button, Chip, EmptyState } from "./ui";

/** An amount in GEN. The exact value is in the tooltip. */
export function Gen({ wei, max }: { wei: string | bigint; max?: number }) {
  return (
    <span className="num gen" title={`${weiToGenText(wei)} GEN`}>
      {formatGen(wei, { max })}
    </span>
  );
}

export function PageHead({ title, children, actions }: { title: ReactNode; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page page-head">
      <div>
        <h1>{title}</h1>
        {children && <p>{children}</p>}
      </div>
      {actions && <div className="page-head__actions">{actions}</div>}
    </div>
  );
}

export function RoleChip({ role }: { role: Role }) {
  const tone = role === "owner" ? "accent" : role === "guardian" ? "info" : role === "seat" ? "ok" : "neutral";
  return <Chip tone={tone}>{ROLE_LABEL[role]}</Chip>;
}

/** What a page shows when it needs a wallet and none is connected. */
export function ConnectPrompt({ title = "Connect a wallet", children }: { title?: string; children?: ReactNode }) {
  const w = useWallet();
  return (
    <EmptyState
      title={title}
      action={
        <Button variant="primary" icon={<Wallet size={16} />} busy={w.status === "connecting"} onClick={() => openConnect()} data-testid="connect-prompt">
          Connect wallet
        </Button>
      }
    >
      {children ?? `Your mandates, seats and requests are tied to your address. Connect a wallet on ${CHAIN.name} to see them.`}
    </EmptyState>
  );
}

/** The wallet account when it is connected on the right network, else null. */
export function useAccount(): { account: string | null; ready: boolean; connected: boolean } {
  const w = useWallet();
  return { account: w.account, ready: onStudionet(w), connected: w.status === "connected" };
}

// Everything the user sees about their wallet: the header button and menu, the connect dialog that lists the
// wallets found through EIP-6963, and the banner that asks to switch to GenLayer Studionet.
import { useEffect, useRef, useState } from "react";
import { TriangleAlert, ChevronDown, Copy, ExternalLink, LogOut, Network, Plug, Repeat, Wallet } from "lucide-react";
import { CHAIN, CONTRACT_ADDRESS, CONTRACT_EXPLORER_URL } from "../config";
import { shortAddr } from "../lib/format";
import { closeConnect, connectWallet, disconnectWallet, onStudionet, openConnect, switchToStudionet, useWallet } from "../lib/wallet/wallet";
import { Button, Callout, CopyButton, ExternalLinkText, Modal } from "./ui";
import { LeashSpinner } from "./Spinners";

function WalletIcon({ icon, name, size = 22 }: { icon?: string; name: string; size?: number }) {
  if (icon) return <img src={icon} alt="" width={size} height={size} className="wallet-icon" />;
  return (
    <span className="wallet-icon wallet-icon--blank" style={{ width: size, height: size }} aria-hidden>
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function WalletButton() {
  const w = useWallet();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (w.status !== "connected" || !w.account || !w.active) {
    return (
      <Button variant="primary" size="sm" icon={w.status === "connecting" ? undefined : <Wallet size={16} />} busy={w.status === "connecting"} onClick={() => openConnect()} data-testid="connect-button">
        {w.status === "connecting" ? "Connecting" : "Connect wallet"}
      </Button>
    );
  }

  const right = onStudionet(w);
  return (
    <div className="wallet" ref={root}>
      <button type="button" className={`wallet-pill ${right ? "" : "is-wrong"}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} data-testid="wallet-pill">
        <WalletIcon icon={w.active.icon} name={w.active.name} size={20} />
        <span className="wallet-pill__addr mono">{shortAddr(w.account, 6, 4)}</span>
        <i className={`wallet-pill__dot ${right ? "is-ok" : "is-bad"}`} title={right ? CHAIN.name : "Wrong network"} />
        <ChevronDown size={15} aria-hidden />
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu__head">
            <WalletIcon icon={w.active.icon} name={w.active.name} size={28} />
            <div>
              <strong>{w.active.name}</strong>
              <span className={right ? "menu__net is-ok" : "menu__net is-bad"}>{right ? CHAIN.name : `Wrong network (chain ${w.chainId ?? "unknown"})`}</span>
            </div>
          </div>
          <div className="menu__addr">
            <code>{w.account}</code>
            <CopyButton value={w.account} label="Copy your address" />
          </div>
          {!right && (
            <div className="menu__section">
              <Button variant="primary" size="sm" busy={w.switching} icon={<Repeat size={15} />} onClick={() => void switchToStudionet()}>
                Switch to {CHAIN.name}
              </Button>
            </div>
          )}
          <a className="menu__item" role="menuitem" href={CONTRACT_EXPLORER_URL} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={16} /> Open the contract in the explorer
          </a>
          <button
            type="button"
            className="menu__item"
            role="menuitem"
            onClick={() => {
              void navigator.clipboard?.writeText(CONTRACT_ADDRESS);
              setOpen(false);
            }}
          >
            <Copy size={16} /> Copy the contract address
          </button>
          <button
            type="button"
            className="menu__item menu__item--danger"
            role="menuitem"
            data-testid="disconnect-button"
            onClick={() => {
              setOpen(false);
              void disconnectWallet();
            }}
          >
            <LogOut size={16} /> Disconnect
          </button>
        </div>
      )}
    </div>
  );
}

export function ConnectModal() {
  const w = useWallet();
  const connected = w.status === "connected";
  const right = onStudionet(w);
  const [justConnected, setJustConnected] = useState(false);

  // When the wallet connects on the right network, close the dialog after a short confirmation.
  useEffect(() => {
    if (!w.connectOpen) {
      setJustConnected(false);
      return;
    }
    if (connected && right) {
      setJustConnected(true);
      const t = window.setTimeout(() => closeConnect(), 900);
      return () => window.clearTimeout(t);
    }
  }, [w.connectOpen, connected, right]);

  return (
    <Modal open={w.connectOpen} onClose={closeConnect} title={connected && !right ? "Switch network" : connected ? "Wallet connected" : "Connect a wallet"}>
      {connected && !right && (
        <div className="stack">
          <Callout tone="warn" title={`Your wallet is on chain ${w.chainId ?? "unknown"}`}>
            Leash runs on {CHAIN.name} (chain {CHAIN.id}). Switch the network in your wallet to read and send transactions. If the wallet does not know the network yet, it will offer to add it.
          </Callout>
          <Button variant="primary" busy={w.switching} icon={<Repeat size={16} />} onClick={() => void switchToStudionet()} data-testid="switch-network">
            Switch to {CHAIN.name}
          </Button>
          {w.error && <p className="field__error" role="alert">{w.error}</p>}
          <Button variant="ghost" size="sm" onClick={() => void disconnectWallet()}>
            Disconnect instead
          </Button>
        </div>
      )}

      {connected && right && (
        <div className="connect-done">
          <svg viewBox="0 0 52 52" width="56" height="56" aria-hidden>
            <circle cx="26" cy="26" r="23" fill="none" stroke="var(--ok)" strokeWidth="3" />
            <path d="M15 27l8 8 14-16" fill="none" stroke="var(--ok)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p>
            Connected to <strong>{w.active?.name}</strong> on {CHAIN.name}.
          </p>
          {!justConnected && <Button onClick={closeConnect}>Close</Button>}
        </div>
      )}

      {!connected && (
        <div className="stack">
          <p className="muted">Choose one of the wallets installed in this browser. Leash never asks for your keys; every transaction is signed in your wallet.</p>
          {w.status === "connecting" ? (
            <div className="connect-wait">
              <LeashSpinner size={52} label="Waiting for the wallet" />
              <p>
                <strong>Approve the connection in your wallet.</strong>
                <br />
                <span className="muted">If no window appeared, open the wallet extension yourself.</span>
              </p>
            </div>
          ) : w.providers.length > 0 ? (
            <ul className="wallet-list" data-testid="wallet-list">
              {w.providers.map((p) => (
                <li key={p.info.uuid}>
                  <button type="button" className="wallet-option" onClick={() => void connectWallet(p.info.uuid)} data-testid={`wallet-${p.info.rdns}`}>
                    <WalletIcon icon={p.info.icon} name={p.info.name} size={36} />
                    <span>
                      <strong>{p.info.name}</strong>
                      <small className="mono">{p.info.rdns}</small>
                    </span>
                    <Plug size={18} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          ) : !w.scanned ? (
            <div className="connect-wait">
              <LeashSpinner size={40} label="Looking for wallets" />
              <p className="muted">Looking for wallets in this browser.</p>
            </div>
          ) : (
            <div className="stack">
              <Callout tone="note" title="No wallet found">
                Install a browser wallet such as <ExternalLinkText href="https://metamask.io/download/">MetaMask</ExternalLinkText> or <ExternalLinkText href="https://rabby.io">Rabby</ExternalLinkText>, then reload this page. Wallets announce themselves to the page using EIP-6963, so any compatible wallet will show up here.
              </Callout>
              <Button size="sm" onClick={() => window.location.reload()}>
                Reload the page
              </Button>
            </div>
          )}
          {w.error && (
            <p className="field__error" role="alert">
              <TriangleAlert size={14} style={{ verticalAlign: "-2px" }} /> {w.error}
            </p>
          )}
          <p className="connect-foot muted">
            <Network size={14} aria-hidden /> After connecting you will be asked to use {CHAIN.name} (chain {CHAIN.id}).
          </p>
        </div>
      )}
    </Modal>
  );
}

/** A strip under the header that appears when the wallet is connected to another network. */
export function NetworkBanner() {
  const w = useWallet();
  if (w.status !== "connected" || onStudionet(w)) return null;
  return (
    <div className="net-banner" role="alert" data-testid="network-banner">
      <div className="page net-banner__inner">
        <TriangleAlert size={18} aria-hidden />
        <p>
          <strong>Wrong network.</strong> Your wallet is on chain {w.chainId ?? "unknown"}. Leash runs on {CHAIN.name} (chain {CHAIN.id}).
        </p>
        <Button variant="primary" size="sm" busy={w.switching} onClick={() => void switchToStudionet()} data-testid="banner-switch">
          Switch network
        </Button>
        {w.error && <span className="net-banner__error">{w.error}</span>}
      </div>
    </div>
  );
}

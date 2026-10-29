// The frame around every page: header, theme switch, transaction panel, footer and first-load splash.
import { useEffect, useRef, useState } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { ExternalLink, Menu, Moon, Sun, SunMoon, X } from "lucide-react";
import { CHAIN, CONTRACT_ADDRESS, LINKS } from "../config";
import { shortAddr } from "../lib/format";
import { useNow } from "../lib/hooks";
import { STATUS_TEXT } from "../lib/receipt";
import { THEMES, setTheme, useTheme, type ThemeName } from "../lib/theme";
import { dismissTx, useTxs, type TxEntry } from "../lib/tx";
import { ConnectModal, NetworkBanner, WalletButton } from "./WalletUI";
import { GitHubIcon, XIcon } from "./Icons";
import { GenLayerMark, LeashMark, Wordmark } from "./Logo";
import { ConsensusSpinner, OrbitLoader, type ConsensusPhase } from "./Spinners";
import { Address, CopyButton, IconButton } from "./ui";

// ---- theme switch ------------------------------------------------------------------------------------------------------------

const THEME_META: Record<ThemeName, { label: string; Icon: typeof Sun }> = {
  light: { label: "Light", Icon: Sun },
  dim: { label: "Dim", Icon: SunMoon },
  dark: { label: "Dark", Icon: Moon },
};

export function ThemeSwitch() {
  const theme = useTheme();
  return (
    <div className="theme-switch" role="radiogroup" aria-label="Colour theme">
      {THEMES.map((t) => {
        const { label, Icon } = THEME_META[t];
        return (
          <button key={t} type="button" role="radio" aria-checked={theme === t} aria-label={`${label} theme`} title={`${label} theme`} className={theme === t ? "is-active" : ""} onClick={() => setTheme(t)} data-testid={`theme-${t}`}>
            <Icon size={16} />
          </button>
        );
      })}
    </div>
  );
}

// ---- header ----------------------------------------------------------------------------------------------------------------------

const NAV = [
  { to: "/app", label: "App" },
  { to: "/explore", label: "Explorer" },
  { to: "/docs", label: "Docs" },
];

export function Header() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  return (
    <header className="header">
      <div className="page header__inner">
        <Wordmark />
        <nav className="header__nav" aria-label="Main">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => `nav-link ${isActive ? "is-active" : ""}`}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="header__tools">
          <a className="icon-btn header__social" href={LINKS.github} target="_blank" rel="noopener noreferrer" aria-label="Leash on GitHub" title="GitHub">
            <GitHubIcon size={18} />
          </a>
          <ThemeSwitch />
          <WalletButton />
          <IconButton label={open ? "Close menu" : "Open menu"} className="header__burger" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            {open ? <X size={20} /> : <Menu size={20} />}
          </IconButton>
        </div>
      </div>
      {open && (
        <nav className="drawer" aria-label="Mobile">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => `drawer__link ${isActive ? "is-active" : ""}`}>
              {n.label}
            </NavLink>
          ))}
          <a className="drawer__link" href={LINKS.github} target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          <a className="drawer__link" href={LINKS.twitter} target="_blank" rel="noopener noreferrer">
            {LINKS.twitterHandle} on X
          </a>
        </nav>
      )}
    </header>
  );
}

// ---- footer ------------------------------------------------------------------------------------------------------------------------

export function Footer() {
  return (
    <footer className="footer">
      <div className="stitch footer__stitch" aria-hidden />
      <div className="page footer__grid">
        <div className="footer__brand">
          <Wordmark size={24} />
          <p>A spending mandate for autonomous agents, with an AI reviewer that can only say no.</p>
          <p className="footer__genlayer">
            <GenLayerMark size={18} />
            <span>
              Built on <a href={LINKS.genlayer} target="_blank" rel="noopener noreferrer">GenLayer</a>, deployed on {CHAIN.name}.
            </span>
          </p>
        </div>
        <nav aria-label="Product" className="footer__col">
          <h4>Product</h4>
          <Link to="/app">Open the app</Link>
          <Link to="/app/new">Create a mandate</Link>
          <Link to="/explore">Explorer</Link>
        </nav>
        <nav aria-label="Learn" className="footer__col">
          <h4>Learn</h4>
          <Link to="/docs/overview">Overview</Link>
          <Link to="/docs/quickstart">Quick start</Link>
          <Link to="/docs/contract-interface">Contract interface</Link>
          <Link to="/docs/security">Security model</Link>
        </nav>
        <nav aria-label="Project" className="footer__col">
          <h4>Project</h4>
          <a href={LINKS.github} target="_blank" rel="noopener noreferrer" className="footer__ext">
            <GitHubIcon size={15} /> Source on GitHub
          </a>
          <a href={LINKS.githubContract} target="_blank" rel="noopener noreferrer" className="footer__ext">
            <ExternalLink size={15} /> Contract source
          </a>
          <a href={LINKS.twitter} target="_blank" rel="noopener noreferrer" className="footer__ext">
            <XIcon size={14} /> {LINKS.twitterHandle}
          </a>
        </nav>
      </div>
      <div className="page footer__base">
        <p className="footer__contract">
          Contract <Address value={CONTRACT_ADDRESS} head={8} tail={6} />
        </p>
        <p>Studionet is a test network. Leash has not been audited; do not use value you cannot lose.</p>
      </div>
    </footer>
  );
}

// ---- transaction panel -------------------------------------------------------------------------------------------------------------

function phaseOf(t: TxEntry): ConsensusPhase {
  if (t.phase === "wallet") return "wallet";
  if (t.phase === "done") return "done";
  if (t.phase === "failed") return "failed";
  if (t.phase === "submitted") return "queue";
  switch (t.statusName) {
    case "PROPOSING":
      return "propose";
    case "REVEALING":
      return "reveal";
    default:
      return "commit";
  }
}

function elapsed(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

function TxCard({ tx }: { tx: TxEntry }) {
  const now = useNow(1000);
  const running = tx.phase === "wallet" || tx.phase === "submitted" || tx.phase === "consensus";
  const end = tx.finishedAt ?? now * 1000;
  const status =
    tx.phase === "wallet"
      ? "Confirm the transaction in your wallet"
      : tx.phase === "done"
        ? "Done"
        : tx.phase === "failed"
          ? "Failed"
          : (tx.statusName && STATUS_TEXT[tx.statusName]) || "Waiting for the validators";

  // A finished success fades out by itself; failures stay until they are closed.
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (tx.phase === "done") {
      timer.current = window.setTimeout(() => dismissTx(tx.id), 12000);
      return () => window.clearTimeout(timer.current);
    }
  }, [tx.phase, tx.id]);

  return (
    <li className={`tx tx--${tx.phase}`} data-testid="tx-card" data-phase={tx.phase}>
      <ConsensusSpinner phase={phaseOf(tx)} size={56} />
      <div className="tx__body">
        <strong>{tx.label}</strong>
        <span className="tx__status" aria-live="polite">{status}</span>
        {tx.message && <span className="tx__message">{tx.message}</span>}
        {tx.phase === "done" && tx.returned && tx.fn === "create_mandate" && <span className="tx__message tx__message--ok">Mandate #{tx.returned} created.</span>}
        {tx.phase === "done" && tx.returned && tx.fn === "request_payment" && <span className="tx__message tx__message--ok">Request #{tx.returned} filed.</span>}
        {running && tx.slow && tx.phase !== "wallet" && <span className="tx__hint">AI reviews can take a few minutes. You can keep browsing; this panel keeps watching.</span>}
        <span className="tx__meta">
          {tx.hash && (
            <>
              <code title={tx.hash}>{shortAddr(tx.hash, 8, 6)}</code>
              <CopyButton value={tx.hash} label="Copy transaction hash" />
            </>
          )}
          <span className="num">{elapsed(end - tx.startedAt)}</span>
        </span>
      </div>
      <IconButton label="Dismiss" className="tx__close" onClick={() => dismissTx(tx.id)}>
        <X size={16} />
      </IconButton>
    </li>
  );
}

export function TxDock() {
  const list = useTxs().filter((t) => !t.dismissed).slice(-4);
  if (!list.length) return null;
  return (
    <ul className="tx-dock" aria-label="Transactions">
      {list.map((t) => (
        <TxCard key={t.id} tx={t} />
      ))}
    </ul>
  );
}

// ---- first-load splash -------------------------------------------------------------------------------------------------------------

export function Splash() {
  const [state, setState] = useState<"show" | "hide" | "gone">(() => {
    try {
      return sessionStorage.getItem("leash.splash") ? "gone" : "show";
    } catch {
      return "gone";
    }
  });
  useEffect(() => {
    if (state !== "show") return;
    const minimum = new Promise((r) => window.setTimeout(r, 800));
    const fonts = (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready ?? Promise.resolve();
    void Promise.race([Promise.all([minimum, fonts]), new Promise((r) => window.setTimeout(r, 2500))]).then(() => {
      try {
        sessionStorage.setItem("leash.splash", "1");
      } catch {
        /* ignore */
      }
      setState("hide");
      window.setTimeout(() => setState("gone"), 450);
    });
  }, [state]);
  if (state === "gone") return null;
  return (
    <div className={`splash ${state === "hide" ? "is-hiding" : ""}`} aria-hidden={state === "hide"} data-testid="splash">
      <OrbitLoader size={170} label="Loading Leash" />
      <div className="splash__word">
        <LeashMark size={30} />
        <span>leash</span>
      </div>
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById("main")?.focus(); }}>
        Skip to content
      </a>
      <Header />
      <NetworkBanner />
      <main id="main" tabIndex={-1} className="main">
        {children}
      </main>
      <Footer />
      <TxDock />
      <ConnectModal />
      <Splash />
    </>
  );
}

export { CONTRACT_ADDRESS };

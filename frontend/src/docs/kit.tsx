// Building blocks for documentation pages.
import { createContext, useContext, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Link2 } from "lucide-react";
import { Callout } from "../components/ui";
import { StateChip } from "../components/StateChip";
import { S, type StateName } from "../lib/types";

export const DocSlugContext = createContext<string>("overview");

function Heading({ level, id, children }: { level: 2 | 3; id: string; children: ReactNode }) {
  const slug = useContext(DocSlugContext);
  const Tag = level === 2 ? "h2" : "h3";
  return (
    <Tag id={id} className="docs-h">
      {children}
      <Link to={`/docs/${slug}/${id}`} className="docs-anchor" aria-label="Link to this section">
        <Link2 size={14} />
      </Link>
    </Tag>
  );
}

export const H2 = ({ id, children }: { id: string; children: ReactNode }) => <Heading level={2} id={id}>{children}</Heading>;
export const H3 = ({ id, children }: { id: string; children: ReactNode }) => <Heading level={3} id={id}>{children}</Heading>;

export const Lead = ({ children }: { children: ReactNode }) => <p className="docs-lead">{children}</p>;

export function Note({ tone = "note", title, children }: { tone?: "note" | "tip" | "warn" | "danger"; title?: string; children: ReactNode }) {
  return <Callout tone={tone} title={title}>{children}</Callout>;
}

export function MethodLink({ name }: { name: string }) {
  return (
    <Link to={`/docs/contract-interface/${name}`} className="docs-method">
      <code>{name}</code>
    </Link>
  );
}

export function StateLink({ state }: { state: StateName }) {
  return (
    <Link to={`/docs/request-lifecycle/${state.toLowerCase()}`} className="docs-state" aria-label={`State ${state}`}>
      <StateChip state={S[state]} />
    </Link>
  );
}

export function DocTable({ children }: { children: ReactNode }) {
  return (
    <div className="table-wrap docs-table">
      <table className="table">{children}</table>
    </div>
  );
}

export function Steps({ children }: { children: ReactNode }) {
  return <ol className="docs-steps">{children}</ol>;
}

export function Figure({ caption, children }: { caption: ReactNode; children: ReactNode }) {
  return (
    <figure className="docs-figure">
      <div className="docs-figure__body">{children}</div>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

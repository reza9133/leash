import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { api } from "../lib/api";
import { useAsync, useDocumentTitle, useNow } from "../lib/hooks";
import { roleOf, seatOf } from "../lib/roles";
import { useWallet } from "../lib/wallet/wallet";
import { PageHead, RoleChip } from "../components/Common";
import { Address, ButtonLink, Chip, EmptyState, ErrorState, TabPanel, Tabs } from "../components/ui";
import { PageLoader } from "../components/Spinners";
import { Overview } from "./mandate/Overview";
import { RequestsTab } from "./mandate/RequestsTab";
import { Seats } from "./mandate/Seats";
import { Manage } from "./mandate/Manage";

type TabId = "overview" | "requests" | "seats" | "manage";
const TAB_IDS: TabId[] = ["overview", "requests", "seats", "manage"];

export default function Mandate() {
  const params = useParams();
  const id = Number(params.id);
  const valid = /^\d+$/.test(params.id ?? "");
  const [search, setSearch] = useSearchParams();
  const tab = (TAB_IDS as string[]).includes(search.get("tab") ?? "") ? (search.get("tab") as TabId) : "overview";
  const w = useWallet();
  const now = useNow(15000);
  const data = useAsync(() => api.mandate(id), [id], { enabled: valid, interval: 20000 });
  const m = data.data;
  useDocumentTitle(m ? m.name : `Mandate ${params.id ?? ""}`);

  if (!valid) return <NotFound what="mandate" />;
  if (data.loading && !m) return <PageLoader label="Loading the mandate" />;
  if (data.error && !m) {
    return /No such mandate/i.test(data.error.message) ? (
      <NotFound what="mandate" id={id} />
    ) : (
      <div className="page section">
        <ErrorState error={data.error} retry={data.reload} />
      </div>
    );
  }
  if (!m) return null;

  const role = roleOf(m, w.account);
  const ended = m.ended || (m.expires_at !== 0 && now >= m.expires_at);
  const seat = seatOf(m, w.account);
  const isSeat = !!seat && seat.active;
  const setTab = (t: TabId) => setSearch(t === "overview" ? {} : { tab: t }, { replace: true });

  return (
    <>
      <div className="page crumb">
        <Link to="/app" className="back">
          <ArrowLeft size={15} /> Your mandates
        </Link>
      </div>
      <PageHead title={m.name} actions={<ButtonLink to="/explore" variant="ghost" size="sm">Explorer</ButtonLink>}>
        <span className="head-meta">
          <span className="num">Mandate #{m.id}</span>
          {role !== "none" && <RoleChip role={role} />}
          {ended ? <Chip tone="neutral">Ended</Chip> : m.paused ? <Chip tone="warn" dot>Paused</Chip> : <Chip tone="ok" dot>Active</Chip>}
          <span>
            Owner <Address value={m.owner} />
          </span>
          {m.guardian && (
            <span>
              Guardian <Address value={m.guardian} />
            </span>
          )}
        </span>
      </PageHead>

      <div className="page">
        <Tabs<TabId>
          label="Mandate sections"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "overview", label: "Overview" },
            { id: "requests", label: "Requests", count: m.requests },
            { id: "seats", label: "Seats and payees", count: m.delegates.filter((d) => d.active).length },
            { id: "manage", label: "Manage" },
          ]}
        />
        <TabPanel id="overview" active={tab === "overview"}>
          <Overview m={m} now={now} />
        </TabPanel>
        <TabPanel id="requests" active={tab === "requests"}>
          <RequestsTab m={m} me={w.account} isSeat={isSeat} />
        </TabPanel>
        <TabPanel id="seats" active={tab === "seats"}>
          <Seats m={m} me={w.account} role={role} />
        </TabPanel>
        <TabPanel id="manage" active={tab === "manage"}>
          <Manage m={m} role={role} />
        </TabPanel>
      </div>
    </>
  );
}

export function NotFound({ what, id }: { what: string; id?: number }) {
  return (
    <div className="page section">
      <EmptyState title={`No ${what} ${id !== undefined ? `#${id}` : "with that number"}`} action={<ButtonLink to="/app" variant="primary">Back to your mandates</ButtonLink>}>
        Numbers start at 0 and count up as {what}s are created. Check the number, or look in the explorer.
      </EmptyState>
    </div>
  );
}

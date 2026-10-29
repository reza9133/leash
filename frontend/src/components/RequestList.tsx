// A list of payment requests. Used on the mandate page.
import { Link } from "react-router-dom";
import { relativeTime, sameAddr } from "../lib/format";
import { useNow } from "../lib/hooks";
import type { RequestRow } from "../lib/types";
import { Gen } from "./Common";
import { StateChip } from "./StateChip";
import { Address } from "./ui";

export function RequestList({ rows, me }: { rows: RequestRow[]; me?: string | null }) {
  const now = useNow(30000);
  return (
    <div className="table-wrap">
      <table className="table" data-testid="request-table">
        <thead>
          <tr>
            <th>Request</th>
            <th>Status</th>
            <th className="num">Amount</th>
            <th>Purpose</th>
            <th>Payee</th>
            <th>Filed</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <Link to={`/app/requests/${r.id}`}>#{r.id}</Link>
                {sameAddr(r.delegate, me) && <span className="muted"> yours</span>}
              </td>
              <td>
                <StateChip state={r.state} />
              </td>
              <td className="num">
                <Gen wei={r.amount} />
              </td>
              <td className="cell-wrap">{r.purpose}</td>
              <td>
                <Address value={r.payee} />
              </td>
              <td className="muted" title={new Date(r.created * 1000).toLocaleString()}>
                {relativeTime(r.created, now)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

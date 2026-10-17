import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Modal } from "../components/Modal";
import { ActivityLogDetail } from "../components/ActivityLogDetail";
import { api, report } from "../services/api";
import { formatDate, localDate, possession } from "../utils/date";
import { RequestDetail } from "./RequestDetail";
import { Catalog } from "./Management";
import type { BorrowRequest, Log, Role, User } from "../types";

function adminNameClass(role?: Role | null) {
  const colors = {
    Developer: "admin-name-developer",
    Admin: "admin-name-admin",
    User: "admin-name-user",
  };
  return `admin-name-badge ${role ? colors[role] : "admin-name-unknown"}`;
}
export function Dashboard({
  user,
  notify,
}: {
  user: User;
  notify: (message: string, kind?: "success" | "error" | "info") => void;
}) {
  const [requests, setRequests] = useState<BorrowRequest[]>([]),
    [counts, setCounts] = useState<Record<string, number>>({}),
    [loading, setLoading] = useState(true),
    [search, setSearch] = useState(""),
    [toolSearch, setToolSearch] = useState(""),
    [now, setNow] = useState(Date.now()),
    [when, setWhen] = useState(""),
    [status, setStatus] = useState("all"),
    [selected, setSelected] = useState<BorrowRequest | null>(null),
    [modal, setModal] = useState(""),
    [qr, setQr] = useState(""),
    [logs, setLogs] = useState<Log[]>([]),
    [logSearch, setLogSearch] = useState(""),
    [logDate, setLogDate] = useState(""),
    [logDetail, setLogDetail] = useState<Log | null>(null);
  const admin = user.role !== "User";
  async function reload() {
    try {
      const [records, summary] = await Promise.all([
        api<BorrowRequest[]>("/requests"),
        api<Record<string, number>>("/dashboard"),
      ]);
      setRequests(records);
      setCounts(summary);
      setNow(Date.now());
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void reload();
    const timer = setInterval(() => void reload(), 30000);
    return () => clearInterval(timer);
  }, [user.id]);
  async function inspect(id: string) {
    try {
      setSelected(await api<BorrowRequest>("/requests/" + id));
    } catch (e) {
      notify((e as Error).message);
    }
  }
  async function open(which: string) {
    try {
      if (which === "qr")
        setQr(
          await QRCode.toDataURL(window.location.origin + "/", {
            width: 200,
            margin: 1,
          }),
        );
      if (which === "logs") setLogs(await api<Log[]>("/logs"));
      setModal(which);
    } catch (e) {
      notify((e as Error).message);
    }
  }
  const filtered = requests.filter(
    (r) =>
      [
        r.borrower_name,
        r.reference,
        r.plate,
        ...r.items.map((i) => i.name),
      ].some((v) => v.toLowerCase().includes(search.toLowerCase())) &&
      (!when || localDate(r.request_date) === when) &&
      (status === "all" || r.status === status),
  );
  const exportReport = (kind: string) =>
    report(kind).catch((e) => notify(e.message));
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Total Requests",
            count: Object.values(counts).reduce(
              (total, count) => total + count,
              0,
            ),
            icon: "folder-open",
            color: "blue",
          },
          {
            label: "Pending Review",
            count: counts["Pending Approval"] || 0,
            icon: "hourglass-half",
            color: "amber",
          },
          {
            label: "Currently Borrowed",
            count: counts.Issued || 0,
            icon: "hand-holding-hand",
            color: "indigo",
          },
          {
            label: "Returned & Closed",
            count: counts.Completed || 0,
            icon: "circle-check",
            color: "emerald",
          },
        ].map((k) => (
          <div
            key={k.label}
            className="relative bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-center"
          >
            <div className="w-full px-12 text-center">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {k.label}
              </p>
              <p className="text-2xl font-black mt-0.5">{k.count}</p>
            </div>
            <div className={`kpi-${k.color} absolute right-4 p-3 rounded-xl`}>
              <i className={`fas fa-${k.icon} text-lg`} />
            </div>
          </div>
        ))}
      </div>
      <div className="dashboard-actions bg-white p-4 rounded-xl border shadow-sm flex flex-col gap-4">
        <div className="flex flex-wrap justify-center gap-2">
          <button className="btn-secondary" onClick={() => open("qr")}>
            <i className="fas fa-qrcode mr-1" />
            Generate QR
          </button>
          {admin && (
            <>
              <button
                className="btn-primary bg-emerald-600"
                onClick={() => exportReport("requests")}
              >
                Export Borrow Reports
              </button>
            </>
          )}
          <button
            className="btn-secondary"
            onClick={() => open("borrower-tools")}
          >
            Equipment Registry
          </button>
          {admin && (
            <>
              <button className="btn-secondary" onClick={() => open("catalog")}>
                Tools Catalog
              </button>
              <button
                className="btn-primary bg-purple-600"
                onClick={() => open("logs")}
              >
                Activity Logs
              </button>
            </>
          )}
        </div>
        <div className="flex flex-col sm:flex-row justify-center gap-2">
          <input
            className="input sm:max-w-xs"
            aria-label="Search requests"
            placeholder="Search borrower, tool, plate..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <input
            type="date"
            aria-label="Filter requests by date"
            className="input sm:w-auto"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
          />
          <select
            className="input sm:w-auto"
            aria-label="Filter requests by status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">All Status</option>
            <option>Pending Approval</option>
            <option value="Issued">Currently Issued</option>
            <option value="Completed">Completed / Returned</option>
          </select>
        </div>
      </div>
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b bg-slate-50 text-center">
          <h3 className="font-bold text-sm">
            <i className="fas fa-list-check text-indigo-600 mr-2" />
            Equipment Issuance & Return Log
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table request-records">
            <thead>
              <tr>
                {[
                  "Request Details",
                  "Name",
                  "Items Summary",
                  "Issued By",
                  "Received By",
                  "Status",
                  "Action",
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td
                    data-label="Request Details"
                    className="font-mono max-w-56 break-all"
                  >
                    <b>{r.reference}</b>
                    <p className="text-[10px] text-slate-400">
                      {formatDate(r.request_date)}
                    </p>
                  </td>
                  <td data-label="Name">
                    <b>{r.borrower_name}</b>
                    <p className="text-[11px] text-slate-500">
                      {r.position} • {r.plate}
                    </p>
                  </td>
                  <td data-label="Tools">
                    {r.items.map((i) => (
                      <span className="badge inline-block mr-1 mb-1" key={i.id}>
                        {i.name} ({i.returned_qty}/{i.requested_qty} ret)
                      </span>
                    ))}
                  </td>
                  <td data-label="Issued By">
                    {r.released_name ? (
                      <span
                        className={adminNameClass(r.released_role)}
                        title={`Equipment issued by ${r.released_name}`}
                      >
                        {r.released_name}
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td data-label="Received By">
                    {r.received_name ? (
                      <span
                        className={adminNameClass(r.received_role)}
                        title={`Equipment received by ${r.received_name}`}
                      >
                        {r.received_name}
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td data-label="Status">
                    <span
                      className={`badge ${r.status === "Completed" ? "bg-emerald-100 text-emerald-800" : r.status === "Issued" ? "bg-indigo-100 text-indigo-800" : "bg-amber-100 text-amber-800"}`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td data-label="Action">
                    <button
                      className="btn-secondary whitespace-nowrap"
                      onClick={() => inspect(r.id)}
                    >
                      {admin && r.status === "Issued"
                        ? "Process Return"
                        : admin
                          ? "Inspect / Process"
                          : "View Request"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && (
            <p className="empty">
              {loading
                ? "Loading requests…"
                : "No equipment request records found."}
            </p>
          )}
        </div>
      </div>
      {selected && (
        <RequestDetail
          request={selected}
          user={user}
          notify={notify}
          onClose={() => setSelected(null)}
          onSaved={() => reload()}
        />
      )}{" "}
      {modal === "catalog" && (
        <Catalog notify={notify} onClose={() => setModal("")} />
      )}{" "}
      {modal === "qr" && (
        <Modal
          title="Borrower Form Access QR Code"
          titleCentered
          onClose={() => setModal("")}
        >
          <img alt="Borrower form QR code" src={qr} className="mx-auto" />
          <p className="text-xs text-slate-500">
            Scan QR with mobile device to open borrower loan form instantly.
          </p>
          <input
            readOnly
            className="input"
            aria-label="Borrower form link"
            value={window.location.origin + "/"}
          />
          <button
            className="btn-primary block ml-auto"
            onClick={() =>
              navigator.clipboard
                .writeText(window.location.origin + "/")
                .then(() => notify("Borrower link copied.", "success"))
                .catch(() => notify("Select and copy the link."))
            }
          >
            Copy
          </button>
        </Modal>
      )}{" "}
      {modal === "borrower-tools" && (
        <Modal
          wide
          title="Tools and Equipment Inventory Overview"
          centered
          expanded
          onClose={() => setModal("")}
        >
          <div className="flex justify-center">
            <input
              className="input max-w-xl text-center"
              aria-label="Search borrower added tools"
              placeholder="Search borrower, request number, or tool..."
              value={toolSearch}
              onChange={(e) => setToolSearch(e.target.value)}
            />
          </div>
          {admin && (
            <div className="flex justify-end">
              <button
                className="btn-primary"
                onClick={() => exportReport("borrower-tools")}
              >
                Export Tools
              </button>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="data-table inventory-overview">
              <thead>
                <tr>
                  {[
                    "Request No.",
                    "Name",
                    "Item",
                    "Requested",
                    "Returned",
                    "Status",
                    "Notes",
                    "Requested Date",
                    "Returned Date",
                    "TIME IN POSSESSION",
                    "TOTAL BORROWING DURATION",
                  ].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {requests.flatMap((r) =>
                  r.items
                    .filter((i) =>
                      [r.borrower_name, r.reference, i.name].some((value) =>
                        value
                          .toLowerCase()
                          .includes(toolSearch.trim().toLowerCase()),
                      ),
                    )
                    .map((i) => (
                      <tr key={i.id}>
                        <td>{r.reference}</td>
                        <td>{r.borrower_name}</td>
                        <td>{i.name}</td>
                        <td>{i.requested_qty}</td>
                        <td>{i.returned_qty}</td>
                        <td>{i.return_status}</td>
                        <td>{i.note}</td>
                        <td>{formatDate(r.request_date)}</td>
                        <td>{formatDate(i.returned_at || null)}</td>
                        <td>
                          {i.returned_at
                            ? "-"
                            : possession(r.borrow_date, null, now)}
                        </td>
                        <td>
                          {i.returned_at
                            ? possession(r.request_date, i.returned_at, now)
                            : "-"}
                        </td>
                      </tr>
                    )),
                )}
              </tbody>
            </table>
          </div>
        </Modal>
      )}{" "}
      {modal === "logs" && (
        <Modal
          wide
          title="System Activity & Audit Logs"
          centered
          onClose={() => setModal("")}
        >
          <div className="flex flex-wrap justify-center gap-2">
            <input
              className="input sm:w-80"
              placeholder="Search logs by action, user, or details..."
              aria-label="Search logs"
              value={logSearch}
              onChange={(e) => setLogSearch(e.target.value)}
            />
            <input
              type="date"
              className="input w-auto"
              aria-label="Filter logs by date"
              value={logDate}
              onChange={(e) => setLogDate(e.target.value)}
            />
            <button
              className="btn-primary"
              onClick={() => exportReport("logs")}
            >
              Export Logs
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Latest 5,000 entries. Export includes all authorized logs.
          </p>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  {[
                    "Timestamp",
                    "User",
                    "Action Category",
                    "Detailed Log Description",
                    "Action",
                  ].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs
                  .filter(
                    (l) =>
                      `${l.action} ${l.actor} ${l.details}`
                        .toLowerCase()
                        .includes(logSearch.toLowerCase()) &&
                      (!logDate || localDate(l.created_at) === logDate),
                  )
                  .map((l) => (
                    <tr key={l.id}>
                      <td>{formatDate(l.created_at)}</td>
                      <td>{l.actor}</td>
                      <td>{l.action}</td>
                      <td>{l.details}</td>
                      <td>
                        <button
                          className="btn-secondary"
                          onClick={() => setLogDetail(l)}
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
      {logDetail && (
        <ActivityLogDetail
          key={logDetail.id}
          log={logDetail}
          onClose={() => setLogDetail(null)}
          onInspect={(id) => {
            void inspect(id);
            setLogDetail(null);
            setModal("");
          }}
        />
      )}
    </div>
  );
}

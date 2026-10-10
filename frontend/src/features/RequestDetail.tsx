import { useState } from "react";
import { Modal } from "../components/Modal";
import { Photo } from "../components/Photo";
import { Signature } from "../components/Signature";
import { api, multipart } from "../services/api";
import { formatDate, possession } from "../utils/date";
import type { BorrowRequest, User } from "../types";
export function RequestDetail({
  request,
  user,
  onClose,
  onSaved,
  notify,
}: {
  request: BorrowRequest;
  user: User;
  onClose: () => void;
  onSaved: () => void;
  notify: (msg: string) => void;
}) {
  const [items, setItems] = useState(
      request.items.map((i) => ({
        id: i.id,
        returnedQty: i.returned_qty,
        status: i.return_status,
        conditionNote: i.condition_note,
      })),
    ),
    [photo, setPhoto] = useState<Blob | null>(null),
    [sig, setSig] = useState<Blob | null>(null),
    [busy, setBusy] = useState(false),
    [lightbox, setLightbox] = useState<string | null>(null);
  const allowed = user.role !== "User",
    issued = request.status === "Issued",
    pending = request.status === "Pending Approval",
    editable = allowed && issued;
  async function save() {
    setBusy(true);
    try {
      await api(`/requests/${request.id}/${pending ? "handover" : "returns"}`, {
        method: "POST",
        body: multipart(
          pending
            ? { version: request.version }
            : { version: request.version, items },
          pending
            ? { handoverPhoto: photo }
            : { returnPhoto: photo, returnSignature: sig },
        ),
      });
      notify(
        pending ? "Tools issued to borrower." : "Return inspection saved.",
      );
      onSaved();
      onClose();
    } catch (error) {
      notify((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      wide
      title={`Borrow Request: ${request.borrower_name}`}
      onClose={onClose}
    >
      <div className="flex flex-wrap gap-2">
        <span className="font-mono text-xs text-indigo-700 break-all">
          {request.reference}
        </span>
        <span className="badge">{request.status}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border text-xs">
        <div>
          <p className="section-title">Borrower Name</p>
          <p className="font-bold text-sm">{request.borrower_name}</p>
          {request.position}
        </div>
        <div>
          <p className="section-title">Vehicle / Car Plate</p>
          {request.plate}
        </div>
        <div>
          <p className="section-title">Time & Possession</p>Req:{" "}
          {formatDate(request.request_date)}
          <br />
          Possession: {possession(request.borrow_date, request.return_date)}
        </div>
      </div>
      <div className="grid md:grid-cols-2 bg-indigo-50/50 border border-indigo-100 rounded-xl p-3.5 text-xs">
        <p>
          Released By: <b>{request.released_name || "Not Released Yet"}</b>
        </p>
        <p>
          Received By: <b>{request.received_name || "Not Received Yet"}</b>
        </p>
      </div>
      <div className="flex justify-between items-center gap-2">
        <h4 className="section-title">Itemized Return & Condition Checklist</h4>
        {editable && (
          <button
            disabled={busy}
            className="btn-secondary"
            onClick={() =>
              setItems(
                items.map((i, index) => ({
                  ...i,
                  returnedQty: request.items[index].requested_qty,
                  status: "Returned",
                })),
              )
            }
          >
            Tag All Returned Completely
          </button>
        )}
      </div>
      <div className="overflow-x-auto rounded-xl border">
        <table className="data-table">
          <thead>
            <tr>
              {[
                "Tool Name / Spec",
                "Req Qty",
                "Returned Qty",
                "Return Status",
                "Condition Notes / Remarks",
              ].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {request.items.map((item, index) => (
              <tr key={item.id}>
                <td>
                  <b>{item.name}</b>
                  <p>{item.note}</p>
                </td>
                <td>{item.requested_qty}</td>
                <td>
                  <input
                    aria-label={`Returned quantity for ${item.name}`}
                    className="input min-w-20"
                    type="number"
                    min={item.returned_qty}
                    max={item.requested_qty}
                    disabled={!editable || busy}
                    value={items[index].returnedQty}
                    onChange={(e) =>
                      setItems(
                        items.map((i, n) =>
                          n === index
                            ? { ...i, returnedQty: Number(e.target.value) }
                            : i,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <select
                    aria-label={`Return status for ${item.name}`}
                    className="input min-w-32"
                    disabled={!editable || busy}
                    value={items[index].status}
                    onChange={(e) =>
                      setItems(
                        items.map((i, n) =>
                          n === index ? { ...i, status: e.target.value } : i,
                        ),
                      )
                    }
                  >
                    {[
                      "Not returned",
                      "partial return",
                      "Returned",
                      "Not working",
                    ].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    aria-label={`Condition notes for ${item.name}`}
                    className="input min-w-40"
                    maxLength={2000}
                    disabled={!editable || busy}
                    value={items[index].conditionNote}
                    onChange={(e) =>
                      setItems(
                        items.map((i, n) =>
                          n === index
                            ? { ...i, conditionNote: e.target.value }
                            : i,
                        ),
                      )
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {["borrower", "handover", "return"].map((stage) => (
          <div
            key={stage}
            className="bg-slate-50 p-3 rounded-xl border space-y-2"
          >
            <span className="section-title">
              {stage === "borrower"
                ? "1. Initial Request Photo & Signature"
                : stage === "handover"
                  ? "2. Admin Before-Handover Photo"
                  : "3. Return Photo & Receiving Signature"}
            </span>
            {request.attachments
              ?.filter((a) => a.kind.startsWith(stage))
              .map((a) => (
                <button
                  key={a.id}
                  className="block w-full"
                  onClick={() => setLightbox(a.id)}
                >
                  <img
                    src={`/api/attachments/${a.id}`}
                    alt={a.kind}
                    className="max-h-32 mx-auto rounded-lg bg-white border"
                  />
                  <span className="text-[10px] text-slate-400">
                    {formatDate(a.created_at)}
                  </span>
                </button>
              ))}
          </div>
        ))}
      </div>
      {allowed && (pending || issued) && (
        <fieldset disabled={busy} className="grid md:grid-cols-2 gap-6">
          <Photo
            value={photo}
            onChange={setPhoto}
            label={
              pending ? "Admin Before-Handover Photo" : "Return Condition Photo"
            }
            notify={notify}
          />
          {issued && (
            <Signature onChange={setSig} label="Borrower Return Signature" />
          )}
        </fieldset>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t">
        <button className="btn-secondary" onClick={onClose}>
          Close
        </button>
        {allowed && (pending || issued) ? (
          <button className="btn-primary" disabled={busy} onClick={save}>
            {busy
              ? "Saving…"
              : pending
                ? "Confirm & Handover Tools"
                : "Save Return Inspection"}
          </button>
        ) : (
          request.status === "Completed" && (
            <span className="text-xs font-bold text-slate-500">
              Record Completed & Locked (Read-Only)
            </span>
          )
        )}
      </div>
      {!!request.events?.length && (
        <details className="text-xs">
          <summary className="cursor-pointer font-bold">
            Handover and return history
          </summary>
          {request.events.map((event) => (
            <p key={event.id} className="p-2 border-b">
              {formatDate(event.created_at)} — {event.actor}: {event.kind}
              <br />
              {event.kind === "handover"
                ? "Tools handed over."
                : Array.isArray(event.inspection)
                  ? event.inspection
                      .map(
                        (item: {
                          id: string;
                          returnedQty: number;
                          status: string;
                          conditionNote: string;
                        }) => {
                          const original = request.items.find(
                            (i) => i.id === item.id,
                          );
                          return `${original?.name || "Item"}: ${item.returnedQty}/${original?.requested_qty ?? "-"} returned — ${item.status}${item.conditionNote ? "; " + item.conditionNote : ""}`;
                        },
                      )
                      .join(" • ")
                  : "Return inspection recorded."}
            </p>
          ))}
        </details>
      )}
      {lightbox && (
        <Modal
          wide
          title="Original Photo View"
          onClose={() => setLightbox(null)}
        >
          <img
            alt="Attachment enlarged"
            src={`/api/attachments/${lightbox}`}
            className="max-h-[70vh] mx-auto"
          />
        </Modal>
      )}
    </Modal>
  );
}

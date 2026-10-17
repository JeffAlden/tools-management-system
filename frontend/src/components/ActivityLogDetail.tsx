import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { AttachmentImage } from "./AttachmentImage";
import { api } from "../services/api";
import { formatDate } from "../utils/date";
import { requestTimeline } from "../utils/requestTimeline";
import type { BorrowRequest, Log, Attachment } from "../types";
const labels: Record<string, string> = {
  borrowerPhoto: "Borrower Request Photo",
  borrowerSignature: "Borrower Signature",
  handoverPhoto: "Handover Photo",
  returnPhoto: "Return Photo",
  returnSignature: "Return Signature",
};
export function ActivityLogDetail({
  log,
  onClose,
  onInspect,
}: {
  log: Log;
  onClose: () => void;
  onInspect: (id: string) => void;
}) {
  const [request, setRequest] = useState<BorrowRequest | null>(null),
    [error, setError] = useState(""),
    [preview, setPreview] = useState<Attachment | null>(null);
  useEffect(() => {
    let active = true;
    setRequest(null);
    setError("");
    setPreview(null);
    if (log.request_id)
      api<BorrowRequest>("/requests/" + log.request_id)
        .then((r) => {
          if (active) setRequest(r);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [log.request_id]);
  return (
    <Modal centered title="Activity Log Details" onClose={onClose}>
      <p className="text-xs">
        {formatDate(log.created_at)} — {log.actor}
      </p>
      <h4 className="font-bold">{log.action}</h4>
      <p className="text-sm">{log.details}</p>
      {log.request_id && !request && !error && (
        <p role="status" className="text-xs">
          Loading photos and signatures…
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-rose-600">
          {error}
        </p>
      )}
      {request && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-left">
          <h4 className="text-xs font-bold text-indigo-800 mb-4 text-center">
            Request to Return — {request.reference}
          </h4>
          <ol
            aria-label="Request to return timeline"
            className="relative isolate before:absolute before:inset-y-0 before:left-1/2 before:w-0.5 before:-translate-x-1/2 before:bg-slate-200"
          >
            {requestTimeline(request).map((step, index) => (
              <li key={step.id} className="relative pb-6 last:pb-0">
                <span
                  className={`relative z-10 mx-auto mb-3 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold ${step.pending ? "bg-slate-200 text-slate-500" : step.kind === "return" ? "bg-emerald-100 text-emerald-800" : step.kind === "handover" ? "bg-amber-100 text-amber-800" : "bg-indigo-100 text-indigo-800"}`}
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                <div className="relative z-10 rounded-xl border border-slate-200 bg-white p-3 text-center">
                <h5
                  className={`text-xs font-bold ${step.pending ? "text-slate-500" : "text-slate-800"}`}
                >
                  {step.title}
                </h5>
                {step.when && (
                  <p className="text-[10px] text-slate-500 mt-1">
                    {formatDate(step.when)}
                  </p>
                )}
                {step.actor && (
                  <p className="text-[11px] text-slate-600 mt-1">
                    {step.kind === "request"
                      ? "Requested by"
                      : step.kind === "handover"
                        ? "Issued by"
                        : "Received by"}{" "}
                    {step.actor}
                  </p>
                )}
                {step.pending ? (
                  <p className="text-[11px] text-slate-400 mt-1">
                    {step.kind === "handover"
                      ? "Equipment has not been issued yet."
                      : "Equipment has not been fully returned yet."}
                  </p>
                ) : !step.attachments.length ? (
                  <p className="text-[11px] text-slate-400 mt-2">
                    No photos or signatures were added.
                  </p>
                ) : null}
                <div className="flex flex-wrap justify-center gap-2 mt-3 empty:hidden">
                  {step.attachments.map((a) => (
                    <button
                      key={a.id}
                      className="w-[calc(50%_-_0.25rem)] max-w-40 min-w-0 text-center group"
                      onClick={() => setPreview(a)}
                      aria-label={`Preview ${labels[a.kind] || a.kind}`}
                    >
                      <span className="relative block">
                        <AttachmentImage
                          id={a.id}
                          sizes="(max-width: 400px) 100px, 140px"
                          alt={labels[a.kind] || a.kind}
                          className="h-24 w-full object-contain bg-white rounded-lg border border-slate-200 shadow-sm group-hover:opacity-80"
                        />
                        <span className="absolute bottom-1 right-1 bg-slate-900/80 text-white text-[9px] px-1 rounded">
                          <i className="fas fa-search-plus mr-1" />
                          Preview
                        </span>
                      </span>
                      <span className="block text-[10px] text-slate-600 mt-1 leading-4 break-words">
                        {labels[a.kind] || a.kind}
                      </span>
                    </button>
                  ))}
                </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
      {request && (
        <button className="btn-primary" onClick={() => onInspect(request.id)}>
          Inspect Associated Request
        </button>
      )}
      {preview && (
        <Modal
          wide
          title={labels[preview.kind] || "Original Photo View"}
          onClose={() => setPreview(null)}
        >
          <AttachmentImage
            preview
            id={preview.id}
            alt={labels[preview.kind] || preview.kind}
            className="max-h-[70vh] mx-auto"
          />
        </Modal>
      )}
    </Modal>
  );
}

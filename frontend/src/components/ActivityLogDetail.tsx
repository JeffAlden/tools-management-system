import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { api } from "../services/api";
import { formatDate } from "../utils/date";
import type { BorrowRequest, Log, Attachment } from "../types";
const labels: Record<string,string> = {borrowerPhoto:"Borrower Request Photo",borrowerSignature:"Borrower Signature",handoverPhoto:"Handover Photo",returnPhoto:"Return Photo",returnSignature:"Return Signature"};
export function ActivityLogDetail({log,onClose,onInspect}:{log:Log;onClose:()=>void;onInspect:(id:string)=>void}) {
  const [request,setRequest]=useState<BorrowRequest|null>(null),[error,setError]=useState(""),[preview,setPreview]=useState<Attachment|null>(null);
  useEffect(()=>{let active=true;
    if(log.request_id)api<BorrowRequest>("/requests/"+log.request_id).then(r=>{if(active)setRequest(r);}).catch(e=>{if(active)setError(e.message);});
    return ()=>{active=false;};
  },[log.request_id]);
  return <Modal centered title="Activity Log Details" onClose={onClose}>
    <p className="text-xs">{formatDate(log.created_at)} — {log.actor}</p>
    <h4 className="font-bold">{log.action}</h4><p className="text-sm">{log.details}</p>
    {log.request_id && !request && !error && <p role="status" className="text-xs">Loading photos and signatures…</p>}
    {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
    {!!request?.attachments?.length && <div className="bg-purple-50 border border-purple-100 rounded-lg p-3">
      <h4 className="text-xs font-bold text-purple-800 mb-2">Photos & Signatures — {request.reference}</h4>
      <div className="flex flex-wrap justify-center gap-3 pb-2">{request.attachments.map(a=><button key={a.id} className="relative shrink-0 group" onClick={()=>setPreview(a)} aria-label={`Preview ${labels[a.kind] || a.kind}`}>
        <img src={`/api/attachments/${a.id}`} alt={labels[a.kind] || a.kind} className="h-20 w-24 object-contain bg-white rounded-lg border border-purple-200 shadow-sm group-hover:opacity-80" />
        <span className="absolute bottom-1 right-1 bg-slate-900/80 text-white text-[9px] px-1 rounded"><i className="fas fa-search-plus mr-1"/>Preview</span>
        <span className="block text-[10px] max-w-24 mt-1">{labels[a.kind] || a.kind}</span>
      </button>)}</div>
    </div>}
    {request && <button className="btn-primary" onClick={()=>onInspect(request.id)}>Inspect Associated Request</button>}
    {preview && <Modal wide title={labels[preview.kind] || "Original Photo View"} onClose={()=>setPreview(null)}><img src={`/api/attachments/${preview.id}`} alt={labels[preview.kind] || preview.kind} className="max-h-[70vh] mx-auto"/></Modal>}
  </Modal>;
}

import { useState, type FormEvent } from "react";
import { Photo } from "../components/Photo";
import { Signature } from "../components/Signature";
import { api, multipart } from "../services/api";
import { nowLocal } from "../utils/date";
import type { BorrowRequest } from "../types";
const emptyItem = () => ({
  key: crypto.randomUUID(),
  name: "",
  requestedQty: 1,
  note: "",
});
export function BorrowerForm({
  notify,
  onSubmitted,
}: {
  notify: (msg: string, kind?: "success" | "error" | "info") => void;
  onSubmitted: () => void;
}) {
  const [name, setName] = useState(""),
    [position, setPosition] = useState(""),
    [plate, setPlate] = useState(""),
    [when, setWhen] = useState(nowLocal),
    [items, setItems] = useState([emptyItem()]),
    [photo, setPhoto] = useState<Blob | null>(null),
    [signature, setSignature] = useState<Blob | null>(null),
    [revision, setRevision] = useState(0),
    [busy, setBusy] = useState(false),
    [reference, setReference] = useState("Assigned on submit");
  function reset() {
    setName("");
    setPosition("");
    setPlate("");
    setWhen(nowLocal());
    setItems([emptyItem()]);
    setPhoto(null);
    setSignature(null);
    setRevision((x) => x + 1);
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!signature) {
      notify("Borrower signature is required.");
      return;
    }
    setBusy(true);
    try {
      const request = await api<Pick<BorrowRequest, "id" | "reference" | "status">>("/requests", {
        method: "POST",
        body: multipart(
          {
            borrowerName: name,
            position,
            plate,
            requestDate: new Date(when).toISOString(),
            items: items.map(({ key, ...item }) => item),
          },
          { borrowerPhoto: photo, borrowerSignature: signature },
        ),
      });
      reset();
      setReference(request.reference);
      notify(`Borrow request submitted successfully! ${request.reference}`, "success");
      onSubmitted();
    } catch (error) {
      notify((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function update(key: string, field: string, value: string | number) {
    setItems((current) =>
      current.map((item) =>
        item.key === key ? { ...item, [field]: value } : item,
      ),
    );
  }
  return (
    <section className="max-w-3xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 text-white relative overflow-hidden bg-[#002366]">
          <div
            className="absolute inset-0 pointer-events-none bg-right bg-no-repeat bg-contain opacity-[.12]"
            style={{
              backgroundImage: "url('/assets/00-altech-logo-blue-white.webp')",
            }}
          />
          <div className="form-hero flex items-center justify-between relative z-10 gap-3">
            <div>
              <span className="px-2.5 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full text-[11px] font-semibold tracking-wide uppercase">
                Equipment Borrow Request
              </span>
              <h2 className="text-xl font-bold mt-2">
                Tools & Equipment Borrowing Form
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                Please fill in borrower information and tool items required for
                deployment.
              </p>
            </div>
            <div className="text-right shrink-0 max-w-[180px]">
              <span className="text-xs font-mono bg-white/10 px-3 py-1 rounded-lg border border-white/10 block font-semibold text-indigo-200 break-all">
                {reference}
              </span>
              <span className="text-[10px] text-slate-400 mt-1 block">
                Form Reference ID
              </span>
            </div>
          </div>
        </div>
        <form onSubmit={submit} className="p-6 space-y-6">
          <fieldset disabled={busy} className="space-y-6">
            <div>
              <h3 className="section-title mb-3">
                <i className="fas fa-id-card text-indigo-600 mr-1.5" />
                Borrower Identification
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="field-label">
                  Borrower Full Name *
                  <input
                    className="input mt-1"
                    required
                    maxLength={150}
                    placeholder="e.g. Juan Cruz"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label className="field-label">
                  Position / Role *
                  <input
                    className="input mt-1"
                    required
                    maxLength={150}
                    placeholder="e.g. Technical Leadman"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                  />
                </label>
                <label className="field-label">
                  Vehicle / Car Plate Number *
                  <input
                    className="input mt-1"
                    required
                    maxLength={40}
                    placeholder="e.g. ABC 1234"
                    value={plate}
                    onChange={(e) => setPlate(e.target.value)}
                  />
                </label>
                <label className="field-label">
                  Request Date *
                  <input
                    type="datetime-local"
                    required
                    className="input mt-1"
                    value={when}
                    onChange={(e) => setWhen(e.target.value)}
                  />
                </label>
              </div>
            </div>
            <hr className="border-slate-100" />
            <div>
              <div className="flex items-center justify-between mb-3 gap-2">
                <h3 className="section-title">
                  <i className="fas fa-wrench text-indigo-600 mr-1.5" />
                  Requested Tools & Equipment Items
                </h3>
                <button
                  type="button"
                  disabled={items.length >= 100}
                  onClick={() => setItems((x) => [...x, emptyItem()])}
                  className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold border border-indigo-200 shrink-0"
                >
                  <i className="fas fa-plus mr-1" />
                  Add Item Row
                </button>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left border-collapse text-xs min-w-[550px]">
                  <thead className="bg-slate-100 text-slate-700 uppercase font-semibold text-[10px]">
                    <tr>
                      <th className="p-2.5">Item Name / Description *</th>
                      <th className="p-2.5 w-24">Qty *</th>
                      <th className="p-2.5">Note / Specs / Serial</th>
                      <th className="p-2.5 w-12 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {items.map((item) => (
                      <tr key={item.key} className="hover:bg-slate-50">
                        <td className="p-2">
                          <input
                            aria-label="Tool name"
                            className="input px-2.5 py-1.5"
                            required
                            maxLength={200}
                            value={item.name}
                            placeholder="e.g. Electric Cordless Drill 18V"
                            onChange={(e) =>
                              update(item.key, "name", e.target.value)
                            }
                          />
                        </td>
                        <td className="p-2">
                          <input
                            aria-label="Requested quantity"
                            className="input px-2 py-1.5 text-center font-bold"
                            type="number"
                            min={1}
                            max={1000000}
                            required
                            value={item.requestedQty}
                            onChange={(e) =>
                              update(
                                item.key,
                                "requestedQty",
                                Number(e.target.value),
                              )
                            }
                          />
                        </td>
                        <td className="p-2">
                          <input
                            aria-label="Tool specifications"
                            className="input px-2.5 py-1.5"
                            maxLength={2000}
                            placeholder="e.g. SN-884920 / Good condition"
                            value={item.note}
                            onChange={(e) =>
                              update(item.key, "note", e.target.value)
                            }
                          />
                        </td>
                        <td className="p-2 text-center">
                          <button
                            aria-label="Remove item"
                            type="button"
                            disabled={items.length === 1}
                            onClick={() =>
                              setItems((x) =>
                                x.filter((i) => i.key !== item.key),
                              )
                            }
                            className="text-slate-400 hover:text-rose-600 p-1"
                          >
                            <i className="fas fa-trash-can" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <hr className="border-slate-100" />
            <div className="borrower-capture-grid grid grid-cols-1 md:grid-cols-2 gap-6">
              <Photo
                value={photo}
                onChange={setPhoto}
                label="Borrower / Request Item Photo"
                notify={notify}
              />
              <Signature key={revision} onChange={setSignature} />
            </div>
            <div className="form-actions pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={reset}
                className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-100"
              >
                Reset Form
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md"
              >
                <i className="fas fa-paper-plane mr-2" />
                {busy ? "Submitting…" : "Submit"}
              </button>
            </div>
          </fieldset>
        </form>
      </div>
    </section>
  );
}

import { HttpError } from "../middleware/errors.js";
import type { ReturnItem } from "../validators/index.js";
export function validateReturns(
  existing: Record<string, any>[],
  updates: ReturnItem[],
): boolean {
  if (
    existing.length !== updates.length ||
    new Set(updates.map((x) => x.id)).size !== updates.length
  )
    throw new HttpError(400, "Include each request item exactly once.");
  return updates
    .map((item) => {
      const prev = existing.find((x) => x.id === item.id);
      if (
        !prev ||
        item.returnedQty < prev.returned_qty ||
        item.returnedQty > prev.requested_qty
      )
        throw new HttpError(
          400,
          "Returned quantity must be cumulative and within requested quantity.",
        );
      const complete = item.returnedQty === prev.requested_qty;
      if (
        (item.status === "Returned" && !complete) ||
        (item.status === "Not returned" && item.returnedQty !== 0) ||
        (item.status === "partial return" &&
          (item.returnedQty === 0 || complete)) ||
        (item.status === "Not working" && item.returnedQty === 0)
      )
        throw new HttpError(
          400,
          "Return status must agree with returned quantity.",
        );
      return complete && ["Returned", "Not working"].includes(item.status);
    })
    .every(Boolean);
}

import { rows, type DB } from "./db.js";
import { HttpError, type User } from "../middleware/security.js";
export async function getRequest(db: DB, id: string, user: User) {
  const [record] = await rows(
    db,
    `SELECT r.*,CONCAT(rel.name,' (',rel.username,')') AS released_name,CONCAT(rec.name,' (',rec.username,')') AS received_name FROM borrow_requests r LEFT JOIN users rel ON rel.id=r.released_by LEFT JOIN users rec ON rec.id=r.received_by WHERE r.id=?`,
    [id],
  );
  if (!record) throw new HttpError(404, "Request not found.");
  return {
    ...record,
    items: await rows(
      db,
      "SELECT * FROM borrow_request_items WHERE request_id=? ORDER BY id",
      [id],
    ),
    attachments: await rows(
      db,
      "SELECT id,kind,size_bytes,created_at,event_id FROM attachments WHERE request_id=? ORDER BY created_at,id",
      [id],
    ),
    events: (
      await rows(
        db,
        `SELECT h.id,h.kind,h.inspection,h.created_at,CONCAT(u.name,' (',u.username,')') AS actor FROM handover_returns h JOIN users u ON u.id=h.actor_id WHERE h.request_id=? ORDER BY h.created_at,h.id`,
        [id],
      )
    ).map((event) => ({
      ...event,
      inspection:
        typeof event.inspection === "string"
          ? JSON.parse(event.inspection)
          : event.inspection,
    })),
  };
}
export async function listRequests(
  db: DB,
  user: User,
): Promise<(Record<string, any> & { items: Record<string, any>[] })[]> {
  const records = await rows(
    db,
    `SELECT r.*,CONCAT(rel.name,' (',rel.username,')') AS released_name,CONCAT(rec.name,' (',rec.username,')') AS received_name FROM borrow_requests r LEFT JOIN users rel ON rel.id=r.released_by LEFT JOIN users rec ON rec.id=r.received_by ORDER BY r.created_at DESC`,
  );
  // Authenticated roles share the read-only dashboard; writes still require ownership.
  const items = await rows(
    db,
    "SELECT * FROM borrow_request_items ORDER BY id",
  );
  const returns = await rows(
    db,
    "SELECT request_id,inspection,created_at FROM handover_returns WHERE kind='return' ORDER BY created_at,id",
  );
  const returnedAt = new Map<string, string>();
  const quantities = new Map(
    items.map((item) => [item.id, item.requested_qty]),
  );
  for (const event of returns) {
    const inspection =
      typeof event.inspection === "string"
        ? JSON.parse(event.inspection)
        : event.inspection;
    for (const item of inspection) {
      if (
        !returnedAt.has(item.id) &&
        item.returnedQty >= quantities.get(item.id)
      )
        returnedAt.set(item.id, event.created_at);
    }
  }
  return records.map((record) => ({
    ...record,
    items: items
      .filter((i) => i.request_id === record.id)
      .map((item) => ({
        ...item,
        returned_at: returnedAt.get(item.id) || null,
      })),
  }));
}

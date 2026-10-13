import { Router } from "express";
import { randomUUID, randomInt } from "node:crypto";
import path from "node:path";
import rateLimit from "express-rate-limit";
import { pool, rows, transaction } from "../repositories/db.js";
import { getRequest, listRequests } from "../repositories/requests.js";
import {
  authenticated,
  roles,
  audit,
  HttpError,
} from "../middleware/security.js";
import {
  requestInput,
  returnInput,
  handoverInput,
  id,
} from "../validators/index.js";
import {
  upload,
  prepareFiles,
  removeFiles,
  attach,
} from "../services/files.js";
import { validateReturns } from "../services/workflow.js";
import { uploadDir } from "../config/env.js";
export const requestsRouter = Router();
requestsRouter.get("/", authenticated, async (req, res) =>
  res.json(await listRequests(pool, req.user!)),
);
requestsRouter.get("/:id", authenticated, async (req, res) =>
  res.json(await getRequest(pool, id.parse(req.params.id), req.user!)),
);
requestsRouter.post(
  "/",
  rateLimit({
    windowMs: 60000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
  upload.fields([
    { name: "borrowerPhoto", maxCount: 1 },
    { name: "borrowerSignature", maxCount: 1 },
  ]),
  async (req, res) => {
    const input = requestInput.parse(JSON.parse(req.body.payload || "{}"));
    const files = Object.values(
      req.files || {},
    ).flat() as Express.Multer.File[];
    if (!files.some((f) => f.fieldname === "borrowerSignature"))
      throw new HttpError(400, "Borrower signature is required.");
    const prepared = await prepareFiles(files);
    const requestId = randomUUID();
    try {
      await transaction(async (db) => {
        for (let attempt = 0; ; attempt++) {
          try {
            await db.execute(
          "INSERT INTO borrow_requests(id,reference,user_id,borrower_name,position,plate,request_date) VALUES(?,?,?,?,?,?,?)",
          [
            requestId,
            "REQ-" + randomInt(100000, 1000000),
            req.user?.id ?? null,
            input.borrowerName,
            input.position,
            input.plate,
            new Date(input.requestDate),
          ],
            );
            break;
          } catch (error) {
            if ((error as { code?: string }).code !== "ER_DUP_ENTRY" || attempt >= 19)
              throw error;
          }
        }
        for (const item of input.items)
          await db.execute(
            "INSERT INTO borrow_request_items(id,request_id,name,requested_qty,note) VALUES(?,?,?,?,?)",
            [randomUUID(), requestId, item.name, item.requestedQty, item.note],
          );
        await attach(db, prepared, requestId, req.user?.id ?? null);
        await audit(
          db,
          req.user ?? null,
          "Request submitted",
          `${input.items.length} items requested.`,
          requestId,
        );
      });
    } catch (error) {
      await removeFiles(prepared);
      throw error;
    }
    if (req.user) {
      res.status(201).json(await getRequest(pool, requestId, req.user));
    } else {
      const [receipt] = await rows(pool, "SELECT id,reference,status FROM borrow_requests WHERE id=?", [requestId]);
      res.status(201).json(receipt);
    }
  },
);
requestsRouter.post(
  "/:id/handover",
  roles("Admin", "Developer", "User"),
  upload.fields([{ name: "handoverPhoto", maxCount: 1 }]),
  async (req, res) => {
    const requestId = id.parse(req.params.id),
      input = handoverInput.parse(JSON.parse(req.body.payload || "{}"));
    const prepared = await prepareFiles(
      Object.values(req.files || {}).flat() as Express.Multer.File[],
    );
    try {
      await transaction(async (db) => {
        const [record] = await rows(
          db,
          "SELECT * FROM borrow_requests WHERE id=? FOR UPDATE",
          [requestId],
        );
        if (!record) throw new HttpError(404, "Request not found.");
        if (
          record.status !== "Pending Approval" ||
          record.version !== input.version
        )
          throw new HttpError(409, "Request changed. Refresh before issuing.");
        const eventId = randomUUID();
        await db.execute(
          "UPDATE borrow_requests SET status='Issued',borrow_date=UTC_TIMESTAMP(3),released_by=?,version=version+1 WHERE id=?",
          [req.user!.id, requestId],
        );
        await db.execute(
          "INSERT INTO handover_returns(id,request_id,actor_id,kind,inspection) VALUES(?,?,?,'handover',?)",
          [
            eventId,
            requestId,
            req.user!.id,
            JSON.stringify({ approved: true }),
          ],
        );
        await attach(db, prepared, requestId, req.user!.id, eventId);
        await audit(
          db,
          req.user!,
          "Tools released",
          "Request approved and tools handed over.",
          requestId,
        );
      });
    } catch (error) {
      await removeFiles(prepared);
      throw error;
    }
    res.json(await getRequest(pool, requestId, req.user!));
  },
);
requestsRouter.post(
  "/:id/returns",
  roles("Admin", "Developer", "User"),
  upload.fields([
    { name: "returnPhoto", maxCount: 1 },
    { name: "returnSignature", maxCount: 1 },
  ]),
  async (req, res) => {
    const requestId = id.parse(req.params.id),
      input = returnInput.parse(JSON.parse(req.body.payload || "{}"));
    const prepared = await prepareFiles(
      Object.values(req.files || {}).flat() as Express.Multer.File[],
    );
    try {
      await transaction(async (db) => {
        const [record] = await rows(
          db,
          "SELECT * FROM borrow_requests WHERE id=? FOR UPDATE",
          [requestId],
        );
        if (!record) throw new HttpError(404, "Request not found.");
        if (record.status !== "Issued" || record.version !== input.version)
          throw new HttpError(
            409,
            "Request changed or is locked. Refresh before saving.",
          );
        const existing = await rows(
          db,
          "SELECT * FROM borrow_request_items WHERE request_id=? FOR UPDATE",
          [requestId],
        );
        const complete = validateReturns(existing, input.items);
        for (const item of input.items)
          await db.execute(
            "UPDATE borrow_request_items SET returned_qty=?,return_status=?,condition_note=? WHERE id=? AND request_id=?",
            [
              item.returnedQty,
              item.status,
              item.conditionNote,
              item.id,
              requestId,
            ],
          );
        await db.execute(
          "UPDATE borrow_requests SET status=?,return_date=IF(?,UTC_TIMESTAMP(3),NULL),received_by=?,version=version+1 WHERE id=?",
          [
            complete ? "Completed" : "Issued",
            complete,
            req.user!.id,
            requestId,
          ],
        );
        const eventId = randomUUID();
        await db.execute(
          "INSERT INTO handover_returns(id,request_id,actor_id,kind,inspection) VALUES(?,?,?,'return',?)",
          [eventId, requestId, req.user!.id, JSON.stringify(input.items)],
        );
        await attach(db, prepared, requestId, req.user!.id, eventId);
        await audit(
          db,
          req.user!,
          complete ? "Return completed" : "Partial return saved",
          "Cumulative return inspection recorded.",
          requestId,
        );
      });
    } catch (error) {
      await removeFiles(prepared);
      throw error;
    }
    res.json(await getRequest(pool, requestId, req.user!));
  },
);
export const attachmentsRouter = Router();
attachmentsRouter.get("/:id", authenticated, async (req, res) => {
  const [file] = await rows(
    pool,
    "SELECT a.*,r.user_id FROM attachments a JOIN borrow_requests r ON r.id=a.request_id WHERE a.id=?",
    [id.parse(req.params.id)],
  );
  if (!file) throw new HttpError(404, "Attachment not found.");
  // All authenticated roles may inspect shared requests and their photos.
  res.set({
    "Content-Type": file.mime_type,
    "Cache-Control": "private, no-store",
    "Content-Disposition": 'inline; filename="attachment.png"',
  });
  res.sendFile(path.join(uploadDir, file.storage_key), { dotfiles: "allow" });
});

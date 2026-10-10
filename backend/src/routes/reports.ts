import { Router } from "express";
import ExcelJS from "exceljs";
import path from "node:path";
import { pool, rows } from "../repositories/db.js";
import { listRequests } from "../repositories/requests.js";
import { roles, audit, HttpError } from "../middleware/security.js";
import { uploadDir } from "../config/env.js";
export const reportsRouter = Router();
reportsRouter.use(roles("Admin", "Developer"));
reportsRouter.get("/:kind", async (req, res) => {
  const kind = req.params.kind;
  if (!["requests", "tools", "borrower-tools", "logs"].includes(String(kind)))
    throw new HttpError(404, "Report not found.");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(String(kind));
  if (kind === "tools") {
    sheet.columns = [
      { header: "Tool Code / ID", key: "code", width: 24 },
      { header: "Tool / Equipment Name", key: "name", width: 40 },
      { header: "Total Stock Quantity", key: "total_qty", width: 24 },
    ];
    sheet.addRows(
      await rows(
        pool,
        "SELECT code,name,total_qty FROM tools WHERE active=1 ORDER BY name",
      ),
    );
  } else if (kind === "logs") {
    sheet.columns = ["Timestamp", "User", "Action Category", "Details"].map(
      (header) => ({ header, width: 35 }),
    );
    const logs = await rows(
      pool,
      `SELECT l.*,u.name AS actor FROM activity_logs l LEFT JOIN users u ON u.id=l.actor_id ${req.user!.role === "Admin" ? "WHERE l.actor_role IS NULL OR l.actor_role<>'Developer'" : ""} ORDER BY l.id`,
    );
    logs.forEach((l) =>
      sheet.addRow([l.created_at, l.actor, l.action, l.details]),
    );
  } else {
    const requests = await listRequests(pool, req.user!);
    if (kind === "borrower-tools") {
      sheet.columns = [
        "Request ID",
        "Borrower Name",
        "Borrower Position",
        "Request Date",
        "Tool / Item",
        "Requested Quantity",
        "Returned Quantity",
        "Return Status",
        "Notes / Specification",
        "Condition Notes",
      ].map((header) => ({ header, width: 28 }));
      requests.forEach((r) =>
        r.items.forEach((i: any) =>
          sheet.addRow([
            r.reference,
            r.borrower_name,
            r.position,
            r.request_date,
            i.name,
            i.requested_qty,
            i.returned_qty,
            i.return_status,
            i.note,
            i.condition_note,
          ]),
        ),
      );
    } else {
      const kinds = [
        "borrowerPhoto",
        "handoverPhoto",
        "returnPhoto",
        "borrowerSignature",
        "returnSignature",
      ];
      sheet.columns = [
        "Request ID",
        "Borrower",
        "Position",
        "Plate",
        "Requested",
        "Issued",
        "Returned",
        "Days in Possession",
        "Released By",
        "Received By",
        "Status",
        "Items",
        ...kinds,
      ].map((header) => ({ header, width: 25 }));
      const attachments = await rows(
        pool,
        "SELECT * FROM attachments ORDER BY created_at,id",
      );
      for (const r of requests) {
        const hours = r.borrow_date
          ? Math.max(
              0,
              Math.floor(
                ((r.return_date
                  ? new Date(r.return_date.replace(" ", "T") + "Z").getTime()
                  : Date.now()) -
                  new Date(r.borrow_date.replace(" ", "T") + "Z").getTime()) /
                  3600000,
              ),
            )
          : 0;
        const row = sheet.addRow([
          r.reference,
          r.borrower_name,
          r.position,
          r.plate,
          r.request_date,
          r.borrow_date,
          r.return_date,
          `${Math.floor(hours / 24)} day(s) ${hours % 24} hrs`,
          r.released_name,
          r.received_name,
          r.status,
          r.items
            .map(
              (i: any) =>
                `${i.name}: ${i.returned_qty}/${i.requested_qty} ${i.return_status}; ${i.note}; ${i.condition_note}`,
            )
            .join("\n"),
        ]);
        row.height = 90;
        row.alignment = { wrapText: true, vertical: "middle" };
        for (let col = 0; col < kinds.length; col++) {
          const file = attachments
            .filter((a) => a.request_id === r.id && a.kind === kinds[col])
            .at(-1);
          if (file) {
            const imageId = workbook.addImage({
              filename: path.join(uploadDir, file.storage_key),
              extension: "png",
            });
            sheet.addImage(imageId, {
              tl: { col: 12 + col, row: row.number - 1 },
              ext: { width: 140, height: 110 },
            });
          }
        }
      }
    }
  }
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  const buffer = await workbook.xlsx.writeBuffer();
  await audit(pool, req.user!, "Report exported", String(kind));
  res.set({
    "Content-Type":
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="altech-${kind}.xlsx"`,
  });
  res.send(Buffer.from(buffer));
});

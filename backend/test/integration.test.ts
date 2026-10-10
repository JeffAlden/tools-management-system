import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import argon2 from "argon2";
import sharp from "sharp";
import supertest from "supertest";
import { unlink } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
// Only a dedicated disposable MySQL database may run this suite.
if (process.env.MYSQL_DATABASE !== "altech_tms_test")
  throw new Error(
    "Set MYSQL_DATABASE=altech_tms_test; migrate that disposable database first.",
  );
const { app } = await import("../src/app.js"),
  { pool, rows } = await import("../src/repositories/db.js"),
  { uploadDir } = await import("../src/config/env.js");
const origin = process.env.APP_ORIGIN || "http://localhost:5173";
const suffix = randomUUID().slice(0, 8),
  users: { id: string; username: string; role: string }[] = [];
const requestIds: string[] = [];
const toolIds: string[] = [];
after(async () => {
  for (const toolId of toolIds)
    await pool.execute("DELETE FROM tools WHERE id=?", [toolId]);
  for (const requestId of requestIds) {
    const files = await rows(
      pool,
      "SELECT storage_key FROM attachments WHERE request_id=?",
      [requestId],
    );
    for (const file of files)
      await unlink(path.join(uploadDir, file.storage_key)).catch(() => {});
    await pool.execute("DELETE FROM activity_logs WHERE request_id=?", [
      requestId,
    ]);
    await pool.execute("DELETE FROM attachments WHERE request_id=?", [
      requestId,
    ]);
    await pool.execute("DELETE FROM handover_returns WHERE request_id=?", [
      requestId,
    ]);
    await pool.execute("DELETE FROM borrow_request_items WHERE request_id=?", [
      requestId,
    ]);
    await pool.execute("DELETE FROM borrow_requests WHERE id=?", [requestId]);
  }
  for (const user of users) {
    await pool.execute("DELETE FROM sessions WHERE user_id=?", [user.id]);
    await pool.execute("DELETE FROM activity_logs WHERE actor_id=?", [user.id]);
    await pool.execute("DELETE FROM users WHERE id=?", [user.id]);
  }
  await pool.end();
});
test("MySQL-backed security, request lifecycle, concurrency, private files and reports", async () => {
  const password = "Integration-Only-Strong123!";
  for (const role of ["Developer", "Admin", "User", "User"]) {
    const user = {
      id: randomUUID(),
      username: `test-${role}-${users.length}-${suffix}`,
      role,
    };
    users.push(user);
    await pool.execute(
      "INSERT INTO users(id,username,name,password_hash,role) VALUES(?,?,?,?,?)",
      [
        user.id,
        user.username,
        user.username,
        await argon2.hash(password),
        role,
      ],
    );
  }
  async function authenticate(index: number) {
    const agent = supertest.agent(app);
    let session = await agent.get("/api/auth/session").expect(200);
    const result = await agent
      .post("/api/auth/login")
      .set("Origin", origin)
      .set("X-CSRF-Token", session.body.csrf)
      .send({ username: users[index].username, password })
      .expect(200);
    assert.equal("password_hash" in result.body.user, false);
    return { agent, csrf: result.body.csrf };
  }
  const developer = await authenticate(0),
    admin = await authenticate(1),
    borrower = await authenticate(2),
    other = await authenticate(3);
  const createdUser = await developer.agent
    .post("/api/users")
    .set("Origin", origin)
    .set("X-CSRF-Token", developer.csrf)
    .send({
      username: `managed-${suffix}`,
      name: "Managed user",
      role: "User",
      password,
    })
    .expect(201);
  users.push({
    id: createdUser.body.id,
    username: `managed-${suffix}`,
    role: "User",
  });
  await developer.agent
    .patch("/api/users/" + users[0].id)
    .set("Origin", origin)
    .set("X-CSRF-Token", developer.csrf)
    .send({ name: "No demotion", role: "User", active: true })
    .expect(400);
  const accounts = await developer.agent.get("/api/users").expect(200);
  assert.equal(
    accounts.body.some((u: any) => "password_hash" in u),
    false,
  );
  const firstTool = await admin.agent
    .post("/api/tools")
    .set("Origin", origin)
    .set("X-CSRF-Token", admin.csrf)
    .send({ code: "TEST-" + suffix, name: "Drill", totalQty: 5 })
    .expect(201);
  toolIds.push(firstTool.body.id);
  await admin.agent
    .patch("/api/tools/" + firstTool.body.id)
    .set("Origin", origin)
    .set("X-CSRF-Token", admin.csrf)
    .send({ code: "TEST-" + suffix, name: "Updated Drill", totalQty: 6 })
    .expect(200);
  await admin.agent
    .post("/api/tools/import")
    .set("Origin", origin)
    .set("X-CSRF-Token", admin.csrf)
    .send({
      tools: [
        { code: "TEST-" + suffix, name: "Imported Drill", totalQty: 8 },
        { code: "OTHER-" + suffix, name: "Harness", totalQty: 2 },
      ],
    })
    .expect(200);
  const catalog = await admin.agent.get("/api/tools").expect(200);
  const secondTool = catalog.body.find(
    (t: any) => t.code === "OTHER-" + suffix,
  );
  toolIds.push(secondTool.id);
  assert.equal(
    catalog.body.find((t: any) => t.id === firstTool.body.id).total_qty,
    8,
  );
  await admin.agent
    .post("/api/tools/import")
    .set("Origin", origin)
    .set("X-CSRF-Token", admin.csrf)
    .send({
      tools: [{ code: "TEST-" + suffix, name: "Rejected", totalQty: -1 }],
    })
    .expect(400);
  await admin.agent
    .delete("/api/tools/" + secondTool.id)
    .set("Origin", origin)
    .set("X-CSRF-Token", admin.csrf)
    .expect(200);
  assert.equal(
    (await admin.agent.get("/api/tools").expect(200)).body.some(
      (t: any) => t.id === secondTool.id,
    ),
    false,
  );
  await supertest(app).get("/api/requests").expect(401);
  await borrower.agent.get("/api/users").expect(403);
  await admin.agent.get("/api/users").expect(403);
  await borrower.agent.get("/api/tools").expect(403);
  await admin.agent
    .post("/api/tools")
    .set("Origin", origin)
    .send({ code: "bad", name: "bad", totalQty: 1 })
    .expect(403);
  const image = await sharp({
    create: { width: 60, height: 30, channels: 4, background: "#002366" },
  })
    .png()
    .toBuffer();
  const payload = {
    borrowerName: "Integration borrower",
    position: "Technician",
    plate: "ABC 123",
    requestDate: "2025-01-01T09:30:00+08:00",
    items: [{ name: "Free text drill", requestedQty: 3, note: "SN-123" }],
  };
  const created = await borrower.agent
    .post("/api/requests")
    .set("Origin", origin)
    .set("X-CSRF-Token", borrower.csrf)
    .field("payload", JSON.stringify(payload))
    .attach("borrowerSignature", image, {
      filename: "signature.png",
      contentType: "image/png",
    })
    .attach("borrowerPhoto", image, {
      filename: "photo.png",
      contentType: "image/png",
    })
    .expect(201);
  const request = created.body;
  requestIds.push(request.id);
  assert.equal(request.status, "Pending Approval");
  assert.equal(
    new Date(request.request_date.replace(" ", "T") + "Z").toISOString(),
    "2025-01-01T01:30:00.000Z",
  );
  await other.agent.get("/api/requests/" + request.id).expect(404);
  const list = await other.agent.get("/api/requests").expect(200);
  assert.equal(
    list.body.some((r: any) => r.id === request.id),
    false,
  );
  const fileId = request.attachments[0].id;
  await supertest(app)
    .get("/api/attachments/" + fileId)
    .expect(401);
  await other.agent.get("/api/attachments/" + fileId).expect(404);
  await borrower.agent
    .get("/api/attachments/" + fileId)
    .expect(200)
    .expect("Content-Type", /image\/png/);
  await borrower.agent
    .post("/api/requests/" + request.id + "/handover")
    .set("Origin", origin)
    .set("X-CSRF-Token", borrower.csrf)
    .field("payload", JSON.stringify({ version: 1 }))
    .expect(403);
  const handover = () =>
    admin.agent
      .post("/api/requests/" + request.id + "/handover")
      .set("Origin", origin)
      .set("X-CSRF-Token", admin.csrf)
      .field("payload", JSON.stringify({ version: 1 }));
  const concurrent = await Promise.all([handover(), handover()]);
  assert.deepEqual(concurrent.map((r) => r.status).sort(), [200, 409]);
  const issued = concurrent.find((r) => r.status === 200)!.body;
  const postReturn = (version: number, qty: number, status: string) =>
    admin.agent
      .post("/api/requests/" + request.id + "/returns")
      .set("Origin", origin)
      .set("X-CSRF-Token", admin.csrf)
      .field(
        "payload",
        JSON.stringify({
          version,
          items: [
            {
              id: issued.items[0].id,
              returnedQty: qty,
              status,
              conditionNote: "Inspection note",
            },
          ],
        }),
      );
  await postReturn(2, 4, "Returned").expect(400);
  const partial = await postReturn(2, 1, "partial return").expect(200);
  assert.equal(partial.body.status, "Issued");
  await postReturn(2, 3, "Returned").expect(409);
  await postReturn(3, 0, "Not returned").expect(400);
  const completed = await admin.agent
    .post("/api/requests/" + request.id + "/returns")
    .set("Origin", origin)
    .set("X-CSRF-Token", admin.csrf)
    .field(
      "payload",
      JSON.stringify({
        version: 3,
        items: [
          {
            id: issued.items[0].id,
            returnedQty: 3,
            status: "Not working",
            conditionNote: "Broken motor",
          },
        ],
      }),
    )
    .attach("returnPhoto", image, {
      filename: "return.png",
      contentType: "image/png",
    })
    .attach("returnSignature", image, {
      filename: "return-signature.png",
      contentType: "image/png",
    })
    .expect(200);
  assert.equal(completed.body.status, "Completed");
  assert.equal(completed.body.attachments.length, 4);
  assert.equal(completed.body.events.length, 3);
  assert.equal(Array.isArray(completed.body.events.at(-1).inspection), true);
  await postReturn(4, 3, "Returned").expect(409);
  const adminLogs = await admin.agent.get("/api/logs").expect(200);
  assert.equal(
    adminLogs.body.some((l: any) => l.actor === users[0].username),
    false,
  );
  const report = await admin.agent
    .get("/api/reports/requests")
    .buffer(true)
    .parse((response, callback) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      response.on("end", () => callback(null, Buffer.concat(chunks)));
    })
    .expect(200)
    .expect("Content-Type", /spreadsheetml/);
  assert.ok(report.body.length > 1000);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(report.body);
  assert.ok(workbook.worksheets[0].getImages().length >= 4);
  assert.ok(workbook.worksheets[0].getRow(2).values);
  await borrower.agent.get("/api/reports/requests").expect(403);
  await borrower.agent
    .post("/api/requests")
    .set("Origin", origin)
    .set("X-CSRF-Token", borrower.csrf)
    .field("payload", JSON.stringify(payload))
    .attach("borrowerSignature", Buffer.from("not an image"), {
      filename: "evil.png",
      contentType: "image/png",
    })
    .expect(400);
  const blank = await sharp({
    create: {
      width: 60,
      height: 30,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .png()
    .toBuffer();
  await borrower.agent
    .post("/api/requests")
    .set("Origin", origin)
    .set("X-CSRF-Token", borrower.csrf)
    .field("payload", JSON.stringify(payload))
    .attach("borrowerSignature", blank, {
      filename: "blank.png",
      contentType: "image/png",
    })
    .expect(400);
  await admin.agent
    .post("/api/tools")
    .set("Origin", origin)
    .set("X-CSRF-Token", "é".repeat(64))
    .send({ code: "bad", name: "bad", totalQty: 1 })
    .expect(403);
  await borrower.agent
    .post("/api/auth/logout")
    .set("Origin", origin)
    .set("X-CSRF-Token", borrower.csrf)
    .send({})
    .expect(200);
  await borrower.agent.get("/api/requests").expect(401);
  const fresh = await authenticate(2);
  assert.equal(
    (await fresh.agent.get("/api/requests/" + request.id).expect(200)).body
      .status,
    "Completed",
  );
  const reset = await developer.agent
    .post("/api/users/" + users[2].id + "/password")
    .set("Origin", origin)
    .set("X-CSRF-Token", developer.csrf)
    .send({ newPassword: "Reset-Strong-Password123!" })
    .expect(200);
  assert.equal(reset.body.ok, true);
  await fresh.agent.get("/api/requests").expect(401);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { requestTimeline } from "../src/utils/requestTimeline.js";
import type { Attachment, BorrowRequest } from "../src/types";

const base: BorrowRequest = {
  id: "request",
  user_id: null,
  reference: "REQ-123456",
  borrower_name: "Test Borrower",
  position: "Staff",
  plate: "TEST",
  request_date: "2026-10-18 01:00:00",
  borrow_date: null,
  return_date: null,
  released_name: null,
  received_name: null,
  status: "Pending Approval",
  version: 1,
  items: [],
};
const file = (
  id: string,
  kind: string,
  event_id: string | null = null,
): Attachment => ({ id, kind, event_id, created_at: "2026-10-18 02:00:00" });

test("pending requests show request, awaiting issue, and awaiting return", () => {
  const steps = requestTimeline({
    ...base,
    attachments: [file("signature", "borrowerSignature")],
  });
  assert.deepEqual(
    steps.map((s) => s.title),
    ["Request submitted", "Awaiting issuance", "Awaiting return"],
  );
  assert.equal(steps[0].attachments[0].id, "signature");
  assert.equal(steps.filter((s) => s.pending).length, 2);
});

test("partial returns stay separate, ordered, and linked to the right photos", () => {
  const steps = requestTimeline({
    ...base,
    status: "Completed",
    events: [
      {
        id: "final",
        kind: "return",
        created_at: "2026-10-18 04:00:00",
        actor: "Receiver",
        inspection: [],
      },
      {
        id: "issue",
        kind: "handover",
        created_at: "2026-10-18 02:00:00",
        actor: "Issuer",
        inspection: {},
      },
      {
        id: "partial",
        kind: "return",
        created_at: "2026-10-18 03:00:00",
        actor: "Receiver",
        inspection: [],
      },
    ],
    attachments: [
      file("r", "borrowerPhoto"),
      file("i", "handoverPhoto", "issue"),
      file("p", "returnPhoto", "partial"),
      file("f", "returnSignature", "final"),
    ],
  });
  assert.deepEqual(
    steps.map((s) => s.title),
    [
      "Request submitted",
      "Equipment issued",
      "Partial return recorded",
      "Return completed",
    ],
  );
  assert.deepEqual(
    steps.map((s) => s.attachments.map((a) => a.id)),
    [["r"], ["i"], ["p"], ["f"]],
  );
});

test("legacy files are not lost, duplicated, or mistaken for completed partial returns", () => {
  const files = [
    file("a", "borrowerSignature"),
    file("b", "handoverPhoto"),
    file("c", "returnPhoto"),
    file("d", "custom"),
  ];
  const steps = requestTimeline({
    ...base,
    status: "Issued",
    borrow_date: "2026-10-18 01:30:00",
    attachments: files,
  });
  assert.deepEqual(
    steps
      .flatMap((s) => s.attachments)
      .map((f) => f.id)
      .sort(),
    files.map((f) => f.id).sort(),
  );
  assert.ok(!steps.some((s) => s.title === "Return completed"));
});

test("legacy issuance stays before recorded returns even without a handover event", () => {
  const steps = requestTimeline({
    ...base,
    status: "Completed",
    borrow_date: "2026-10-18 02:00:00",
    events: [
      {
        id: "return",
        kind: "return",
        created_at: "2026-10-18 03:00:00",
        actor: "Receiver",
        inspection: [],
      },
    ],
  });
  assert.deepEqual(
    steps.map((s) => s.title),
    ["Request submitted", "Equipment issued", "Return completed"],
  );
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { validateReturns } from "../src/services/workflow.js";
import { password, requestInput, toolImport } from "../src/validators/index.js";
import { parseCatalog } from "../../frontend/src/utils/catalog.ts";
import { utils, write } from "xlsx";
const id = randomUUID(),
  existing = [{ id, requested_qty: 3, returned_qty: 1 }];
test("partial and damaged full return completion follows source behavior", () => {
  assert.equal(
    validateReturns(existing, [
      { id, returnedQty: 2, status: "partial return", conditionNote: "" },
    ]),
    false,
  );
  assert.equal(
    validateReturns(existing, [
      {
        id,
        returnedQty: 3,
        status: "Not working",
        conditionNote: "motor failed",
      },
    ]),
    true,
  );
});
test("rejects regression, over-return, unknown and duplicate items", () => {
  for (const updates of [
    [
      {
        id,
        returnedQty: 0,
        status: "Not returned" as const,
        conditionNote: "",
      },
    ],
    [{ id, returnedQty: 4, status: "Returned" as const, conditionNote: "" }],
    [
      {
        id: randomUUID(),
        returnedQty: 3,
        status: "Returned" as const,
        conditionNote: "",
      },
    ],
    [
      { id, returnedQty: 3, status: "Returned" as const, conditionNote: "" },
      { id, returnedQty: 3, status: "Returned" as const, conditionNote: "" },
    ],
  ])
    assert.throws(() => validateReturns(existing, updates));
});
test("rejects contradictory return status", () => {
  assert.throws(() =>
    validateReturns(existing, [
      { id, returnedQty: 1, status: "Returned", conditionNote: "" },
    ]),
  );
  assert.throws(() =>
    validateReturns(existing, [
      { id, returnedQty: 3, status: "partial return", conditionNote: "" },
    ]),
  );
});
test("password policy rejects legacy default credentials", () => {
  for (const value of [
    "developer",
    "admin",
    "user",
    "aaaaaaaaaaaa",
    "Abcdefghijk1",
  ])
    assert.equal(password.safeParse(value).success, false);
  assert.equal(password.safeParse("Test-Strong-Pass123!").success, true);
});
test("request validates actual fields and positive integer quantities", () => {
  const input = {
    borrowerName: "Borrower",
    position: "Technician",
    plate: "ABC 123",
    requestDate: new Date().toISOString(),
    items: [{ name: "Drill", requestedQty: 1, note: "" }],
  };
  assert.equal(requestInput.safeParse(input).success, true);
  for (const requestedQty of [0, -1, 1.5, 1000001])
    assert.equal(
      requestInput.safeParse({
        ...input,
        items: [{ ...input.items[0], requestedQty }],
      }).success,
      false,
    );
  assert.equal(
    requestInput.safeParse({ ...input, extra: "forged" }).success,
    false,
  );
});
test("catalog import rejects malformed quantities", () => {
  assert.equal(
    toolImport.safeParse({
      tools: [{ code: "T1", name: "Drill", totalQty: -1 }],
    }).success,
    false,
  );
});
test("catalog parser preserves XLSX, XLS and CSV formats including quoted names", () => {
  const book = utils.book_new();
  utils.book_append_sheet(
    book,
    utils.aoa_to_sheet([
      ["Tool Code / ID", "Tool / Equipment Name", "Total Stock Quantity"],
      ["T-1", "Drill, 18V", 0],
    ]),
    "Tools",
  );
  for (const bookType of ["xlsx", "biff8", "csv"] as const) {
    const data = write(book, { type: "array", bookType });
    assert.deepEqual(parseCatalog(data), [
      { code: "T-1", name: "Drill, 18V", totalQty: 0 },
    ]);
  }
  const bad = utils.book_new();
  utils.book_append_sheet(
    bad,
    utils.aoa_to_sheet([["Unexpected"], ["value"]]),
    "Bad",
  );
  assert.throws(() =>
    parseCatalog(write(bad, { type: "array", bookType: "xlsx" })),
  );
});

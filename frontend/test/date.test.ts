import { test } from "node:test";
import assert from "node:assert/strict";
import { possession } from "../src/utils/date.js";

test("possession uses UTC handover time and stops at the supplied return time", () => {
  const now = Date.parse("2026-10-13T12:00:00Z");
  assert.equal(possession(null, null, now), "0 hrs (Not Issued)");
  assert.equal(possession("2026-10-11 10:00:00", null, now), "2 day(s) 2 hrs");
  assert.equal(
    possession("2026-10-10 10:00:00", "2026-10-12 15:00:00", now),
    "2 day(s) 5 hrs",
  );
  assert.equal(possession("2026-10-14 10:00:00", null, now), "0 hrs");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { api, ApiError, report } from "../src/services/api.js";

const connectionMessage = "Please check your internet connection and try again.";

test("shared API keeps HTTP errors and handles rejected fetches", async (t) => {
  const originalFetch = globalThis.fetch;
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (navigatorDescriptor) Object.defineProperty(globalThis, "navigator", navigatorDescriptor);
    else Reflect.deleteProperty(globalThis, "navigator");
  });

  await t.test("successful login preserves response, CSRF header and credentials", async () => {
    const user = { id: "staff-id", name: "Test Staff", role: "User" };
    globalThis.fetch = async () => Response.json({ user, csrf: "test-csrf" });
    assert.deepEqual(await api("/auth/login", { method: "POST", body: "{}" }), { user, csrf: "test-csrf" });
    globalThis.fetch = async (url, options) => {
      assert.equal(url, "/api/auth/logout");
      assert.equal(options?.credentials, "same-origin");
      assert.equal(new Headers(options?.headers).get("X-CSRF-Token"), "test-csrf");
      return Response.json({ ok: true });
    };
    assert.deepEqual(await api("/auth/logout", { method: "POST" }), { ok: true });
  });

  for (const [status, message] of [
    [400, "Return status must agree with returned quantity."],
    [401, "Invalid username or password."],
    [403, "Access denied."],
    [404, "Request not found."],
    [500, "The server could not process this request."],
  ] as const) {
    await t.test(`HTTP ${status} keeps its server message and status`, async () => {
      // Offline hints must never replace an actual server response.
      Object.defineProperty(globalThis, "navigator", { configurable: true, value: { onLine: false } });
      globalThis.fetch = async () => Response.json({ error: message }, { status });
      await assert.rejects(api("/auth/login", { method: "POST", body: "{}" }),
        (error) => error instanceof ApiError && error.status === status && error.message === message);
    });
  }

  for (const online of [false, true]) {
    for (const failure of [new TypeError("Failed to fetch"), new TypeError("NetworkError when attempting to fetch resource."), new DOMException("DNS connection failed", "NetworkError")]) {
      await t.test(`network rejection is friendly with onLine=${online}: ${failure.message}`, async () => {
        Object.defineProperty(globalThis, "navigator", { configurable: true, value: { onLine: online } });
        globalThis.fetch = async () => { throw failure; };
        for (const path of ["/auth/login", "/auth/logout", "/requests", "/users", "/tools"]) {
          await assert.rejects(api(path, { method: "POST", body: "{}" }),
            (error) => error instanceof ApiError && error.status === 0 && error.message === connectionMessage);
        }
        await assert.rejects(report("requests"),
          (error) => error instanceof ApiError && error.status === 0 && error.message === connectionMessage);
      });
    }
  }

  await t.test("existing caller catch/finally stops loading and permits retry", async () => {
    let busy = false;
    let displayedMessage = "";
    async function submit() {
      busy = true;
      try { return await api("/auth/login", { method: "POST", body: "{}" }); }
      catch (error) { displayedMessage = (error as Error).message; }
      finally { busy = false; }
    }
    globalThis.fetch = async () => { throw new TypeError("Failed to fetch"); };
    await submit();
    assert.equal(busy, false);
    assert.equal(displayedMessage, connectionMessage);
    globalThis.fetch = async () => Response.json({ user: { name: "Test Staff" } });
    assert.deepEqual(await submit(), { user: { name: "Test Staff" } });
    assert.equal(busy, false);
  });

  await t.test("HTTP non-JSON error fallback and intentional cancellation stay unchanged", async () => {
    globalThis.fetch = async () => new Response("bad gateway", { status: 500 });
    await assert.rejects(api("/requests"), (error) => error instanceof ApiError && error.status === 500 && error.message === "Request failed.");
    const cancelled = new DOMException("Request aborted", "AbortError");
    globalThis.fetch = async () => { throw cancelled; };
    await assert.rejects(api("/requests"), (error) => error === cancelled);
  });
});

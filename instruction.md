# Feature implementation standards

## API and network errors

- Use the shared `api()` helper in `frontend/src/services/api.ts` for application API requests. The minified bundle may use a different name, such as `Ft`.
- Detect connectivity failures by catching rejections from `fetch()` itself. Show this exact message through the existing notification handler:

  `Please check your internet connection and try again.`

- Keep the `ApiError` structure. Status `0` indicates no HTTP response was received; preserve actual HTTP statuses and meaningful server messages for 400, 401, 403, 404, 500, and other server responses.
- `navigator.onLine` may be used only as an additional hint. It does not prove the server is reachable and must not be the sole failure detector or replace a server's response. The current helper relies on rejected fetches without requiring this hint.
- Use the same fetch wrapper for report downloads. Do not show raw browser connectivity messages such as Failed to fetch or NetworkError.
- Keep HTTP response parsing and HTTP error handling outside the fetch rejection catch. Do not label every application/server/validation error as a connection failure. Preserve intentional AbortError cancellation behavior.
- Keep existing caller try/catch/finally blocks and loading resets. Pass the error message to the existing notification system; do not change authentication, endpoints, or server behavior for presentation-only error improvements.
- Show startup connection failures only in the bottom-right toast; do not duplicate them in an inline status card. Show one toast per outage, not a toast on every automatic background attempt. Explicit user attempts may show their own errors.
- Do not permanently disable Sign In because startup is offline. On submit, establish the session/CSRF token first if needed, then submit credentials. Disable the button only while that attempt is in progress and always reset it in finally. Share concurrent startup/retry/sign-in session checks and cancel obsolete background updates once connected.
- Test successful requests, invalid credentials, HTTP errors, offline and unreachable-server failures even when onLine is true, loading reset, retry, and other shared-helper consumers. Use mocks or a disposable test environment; do not use business data for automated tests.

Run the focused shared-helper tests from the project root:

```powershell
node node_modules/tsx/dist/cli.mjs --test frontend/test/api.test.ts
```

## Change records and publishing

- Record each change, touched files, and validation in `workspace-changes` using Markdown files. Keep these local notes out of commits.
- Commit or push only when the user requests it. Otherwise, keep changes local and report validation limits.

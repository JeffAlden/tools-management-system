# Original-source inspection and migration decisions

Reference: `tools_management_system.html` (2,659 lines). The original is retained unchanged, including its insecure legacy examples; it is never served by the new application.

## Interface and dependencies

Inter typeface; Tailwind utility classes; Font Awesome 6.4; navy #002366 navbar, form hero and footer. Borrower card is max-w-3xl, rounded-2xl with p-6 sections, small text, two-column desktop fields, horizontally scrollable tool table. Header watermark opacity .12. Body uses the company image with a slate .4 overlay, fixed cover background. Mobile breakpoint 640px stacks navigation and actions; tablet breakpoint 1024px constrains logo width. Footer text is preserved.

Required assets all exist: altech-logo.png (navbar), altech-logo2.png (favicon), 00-altech-logo-blue-white.png (watermark), company-scaled-1.png (background). Other supplied logos are retained too. New app bundles fonts/icons locally; original CDN Tailwind, SheetJS, ExcelJS, FileSaver and QRCode.js are replaced by installed dependencies and backend ExcelJS exports.

## Actual behavior

- Public borrower form: name, position, mandatory plate, datetime-local, arbitrary item name, integer quantity, per-item note/spec/serial, optional photo, mandatory drawn signature. Dynamic rows, reset, submission toast. There is no separate overall remarks field.
- Photo workflow: live getUserMedia, snap JPEG, upload with preview/remove, camera release on close. Separate handover and return photos. Two signature canvases.
- Dashboard: total/pending/issued/completed counters; search borrower, reference, plate and item; local-calendar date and status filters; inspect modal, possession duration, releasing/receiving actor.
- Approval and issuance are one action: Pending Approval → Issued. No rejection/cancellation workflow exists. Return inspection saves cumulative returned quantities and statuses Not returned, partial return, Returned, Not working. Full quantities with Returned or Not working close the request; partial returns keep Issued. Completed records are locked in the UI.
- Catalog only has Excel import/export; it is independent of free-text requests. There is no stock decrement, reservation or catalog CRUD UI. Borrower-added tools is a report, not catalog inventory.
- Request XLSX embeds five photo/signature fields; other exports cover catalog, requested items and logs. QR links to the current form URL. Activity logs support search/date, record details and linked photo viewing.
- Legacy users have Developer/Admin/User roles, but all logged-in users can see and mutate requests. Admin can manage several account types; role changes are not implemented. Developer logs are hidden by frontend heuristics.

## Corrections and explicit decisions

1. No legacy business data or default catalog/accounts are imported. Setup creates exactly one Developer, using operator-supplied credentials.
2. Login is required to submit (the same form remains visible). This supplies durable ownership so User can view only their own records. No self-registration or public anonymous records.
3. Developer alone manages accounts/roles. Admin manages tools/workflows/reports/logs. User has read access to their own requests/attachments and submission only. Authorization is enforced server-side.
4. Selected request date is honored (legacy ignores it and always stores now). References are generated server-side with UUIDs (legacy random six digits can collide).
5. Cumulative returns are validated, cannot decrease or exceed requested quantities, and status must agree with quantity. Full Not working returns close as in the original; they do not imply usable stock.
6. Catalog remains separate from arbitrary borrower items. No inferred inventory allocation or stock enforcement is introduced. CRUD and transactional catalog upsert import are added. Import never silently wipes the catalog.
7. Photos/signatures are decoded, size/type checked, re-encoded PNGs and stored privately; metadata/history stays in MySQL. Completed records cannot be edited server-side. Return signature remains optional as in source.
8. Source has no due dates, sites, rejection rules, tool assignment or recovery-email service. These are not invented. Password reset is an authorized Developer action; users can change their own passwords.
9. Inspection photos are saved together with the handover/return action. Closing without saving discards staged images; earlier saved photos/signatures remain in history. Original tool specifications are kept separately from subsequent condition notes, instead of being overwritten by the return inspection.

## Phase plan and API

Database schema is in database/schema.sql. Users, hashed opaque sessions, tools, requests, items, private attachments, immutable handover/return inspection events and audit logs are separate tables with foreign keys, checks and indexes.

API: GET /api/auth/session; POST /api/auth/login, /logout, /password; GET/POST /api/requests; GET /api/requests/:id; POST /:id/handover, /:id/returns; GET /api/attachments/:id; GET /api/dashboard; GET/POST /api/tools; PATCH/DELETE /api/tools/:id; POST /api/tools/import; GET/POST /api/users; PATCH /api/users/:id; POST /api/users/:id/password; GET /api/logs; GET /api/reports/:kind (requests, tools, borrower-tools, logs).

Implement source inspection/schema first, then React form, protected database API, lifecycle/accounts/reports, then security/integration checks and deployment. Verification status and remaining deployment prerequisites belong in docs/verification.md; implementation alone is not proof of working cloud deployment.

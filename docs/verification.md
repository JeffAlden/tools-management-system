# Verification status — 11 October 2026

## Passed locally

- Follow-up changes: request references now use REQ plus six digits (unique index and duplicate retries); the named existing request was shortened without changing its internal ID. Navbar sign-in was removed and verified in the browser; authentication remains available through the dashboard and submit action. Activity-log details now fetch the associated request through its authorized endpoint and display all available photo/signature thumbnails with enlarged previews, including historical return attachments. Builds, seven unit tests and the SQL/API integration scenario passed after these changes. The new log-preview interactions still require a signed-in browser acceptance check.

- Frontend TypeScript check and Vite production build; backend TypeScript compilation.
- Seven unit tests: return completion/partial/damaged rules, duplicate/missing/unknown items, decreasing and excessive quantities, contradictory statuses, strong password policy, request schema validation, and catalog parser round trips across XLSX, XLS and CSV with quoted names and zero stock.
- One real SQL/API integration scenario with many assertions: authenticated sessions, no password-hash responses, unauthenticated access rejection, User/Admin/Developer permissions, Developer account creation, self-demotion refusal, catalog create/update/import/archive, invalid import rejection, request-date timezone conversion, own-request scope, private image access, simultaneous handover conflict, partial return, stale version, quantity regression/overflow, full damaged return, completed record lock, inspection/attachment history, Developer log filtering, XLSX generation with embedded images, corrupt/blank image rejection, malformed CSRF token rejection, logout, fresh-session persistence and password-reset session revocation.
- Clean preview database checked: one Developer; zero tools, requests, request items, attachments and handover/return records. No legacy localStorage data imported.
- npm audit reports zero known vulnerabilities for the installed dependency tree. Sharp/Tailwind were upgraded; the ExcelJS UUID dependency is overridden to a patched compatible release. Catalog import uses the official SheetJS 0.20.3 distribution.
- Browser preview connects to the live API. ALTECH logos, actual company background and header watermark load. Computed navbar/form hero/footer colors are rgb(0,35,102), exactly #002366.
- Desktop viewport 1440×1000 and phone viewport 390×844 inspected. Phone document width is 375px (vertical scrollbar included), with no whole-page horizontal overflow; the tool table scrolls within its container. Added a second row, edited name/quantity, and reset back to one row in the browser.
- Browser workflow passed against the live API: secure Developer login, selected-date submission, photo upload and pointer-drawn signature, dashboard counts, handover, complete return with another photo/signature, closed status and completed record lock. All four private images loaded after reopening the record. The synthetic request and its files were removed afterward to restore the clean preview database.
- Git ignores .env, encrypted bootstrap credentials, database files and private uploads. The original source is preserved unchanged.

Screenshots: [desktop](screenshots/borrower-desktop.jpg), [phone](screenshots/borrower-mobile.jpg).

## Engine distinction

The installed MySQL directory contained Workbench's client only. Official MySQL server download attempts failed (unavailable vendor endpoints). Integration tests therefore ran against an isolated MariaDB 10.4.28 instance using mysql2 and the real relational schema, not a mocked database. These results verify the tested MySQL-protocol workflows; they are not proof that MySQL 8.4 itself has passed. The app/deployment target remains MySQL 8.4. .github/workflows/verify.yml provides a disposable MySQL 8.4 CI service and Docker build checks, but that workflow has not run in GitHub during this session.

## Still required before acceptance/sign-off

1. Run the integration suite and setup/migration checks against MySQL 8.4; run the supplied CI workflow and build/start the Docker production images. Docker is not installed locally, so container builds and Caddy certificate issuance have not been tested here.
2. Choose cloud provider/project, region and domain; provision managed MySQL, production secrets and encrypted persistent uploads. Deploy, verify HTTPS, private database connectivity and provider backups. No cloud resources have been provisioned and no public deployment URL exists yet.
3. Run acceptance on actual desktop and mobile devices. Real camera permissions/hardware and touch signature behavior have not been exercised; desktop browser submission, pointer signatures, file uploads and handover/return passed with synthetic images.
4. Verify shared records from separate real devices/locations and browser closure; backend fresh-session persistence is tested, but multi-location internet access requires the deployed host.
5. Execute a paired database/file backup and restore drill on the target environment; document the measured recovery point and time.

The implementation is available for local review. The project should not be described as fully deployed or as satisfying all acceptance criteria until these remaining checks pass.

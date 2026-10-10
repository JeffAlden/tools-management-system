# ALTECH Tools Management System

React/TypeScript/Vite/Tailwind frontend, Express/TypeScript REST API, centralized MySQL 8.4 database and private attachment storage. The original HTML and provided images remain unchanged in the repository; the legacy HTML is not served. No localStorage business records are read or written by the new app.

Read [source inspection and behavior decisions](docs/inspection.md), [deployment and recovery](docs/deployment.md), and [verification status](docs/verification.md) before operating the application.

## Current local preview

The preview is running at http://localhost:5173 and now uses altech_tms in your XAMPP/phpMyAdmin database server at 127.0.0.1:3306 (MariaDB 10.4.28), with a separate application database account. It was initialized with exactly one Developer account and no tools, requests or attachments. Production targets MySQL 8.4; that engine and cloud deployment still need validation. Runtime settings are in the ignored .env file. The generated initial password is encrypted with Windows DPAPI for the current Windows user; reveal it privately by running from the project folder:

```powershell
.\.local\show-first-login.ps1
```

Username: developer. Change the password after first login. No password is included in source or the public app. The .local scripts/data are temporary machine-specific preview artifacts and are excluded from Git. A fresh checkout uses the setup procedure below with your own MySQL and initial-account credentials.

If PowerShell blocks the local password-display script, run `powershell -NoProfile -ExecutionPolicy Bypass -File .\.local\show-first-login.ps1` from the project folder. This applies only to that process. The encrypted file works only under the Windows user on this computer that created it; it is not the setup method for another computer.

### Initial Developer on another computer

For a new empty database, copy .env.example to .env and configure MYSQL_HOST, MYSQL_PORT, MYSQL_DATABASE, MYSQL_USER and MYSQL_PASSWORD for that database. The MySQL password is separate from the Developer login password. Create the empty database and its scoped database user before migration.

After `npm ci`, run `npm run db:migrate`. Then choose your Developer credentials using a private PowerShell prompt:

```powershell
$env:SETUP_USERNAME = 'developer'
$env:SETUP_NAME = 'Developer'
$taskSetupSecret = Read-Host 'Choose a new Developer password' -AsSecureString
try {
  $env:SETUP_PASSWORD = [Net.NetworkCredential]::new('', $taskSetupSecret).Password
  npm run db:setup
} finally {
  Remove-Item Env:SETUP_PASSWORD, Env:SETUP_USERNAME, Env:SETUP_NAME -ErrorAction SilentlyContinue
  $taskSetupSecret = $null
}
npm run dev
```

Choose 12–128 characters including uppercase, lowercase, a number and a symbol; save it in your password manager. The script hashes it with Argon2id and stores only the hash. Setup refuses to run when any user already exists and cannot reset an existing account. A restored database retains its existing accounts/passwords, so do not run setup after restoring a backup. To let another computer access the same shared records, connect it to the existing deployed application rather than initializing a separate database.

## Local setup (PowerShell)

Requires Node 22.12+ or 24, MySQL 8.4 (or Docker), and npm. Node 20.19+ can compile the app but deployment uses Node 24.

```powershell
Copy-Item .env.example .env
# Edit .env: provide unique database credentials and setup account values.
npm ci
docker compose --env-file .env -f deployment/compose.local.yml up -d
npm run db:migrate
npm run db:setup
# Remove SETUP_PASSWORD and other SETUP_* values from .env after success.
npm run dev
```

For Docker local MySQL add MYSQL_ROOT_PASSWORD to .env; use a separate strong value. If using existing MySQL instead, create database altech_tms (utf8mb4), create tms_app with privileges on this database, and omit Docker. Migration needs CREATE/ALTER/INDEX privileges; production runtime should have only SELECT/INSERT/UPDATE/DELETE. There are no supplied default credentials. The setup password must contain 12–128 characters, uppercase, lowercase, number and symbol. Setup refuses to run after any account exists. Developer manages all accounts through Users. Admin can list Admin/User accounts and create Regular Users; Developer accounts are excluded from Admin responses. Role changes, account edits and password resets remain Developer-only.

Open http://localhost:5173. Vite proxies /api to 127.0.0.1:3001. Cookies and uploads remain same-origin. HTTPS is needed for camera capture except on localhost. Sign in using the account you created. The borrower form has the original fields; login supplies ownership without adding fields. Regular users see My Requests. Admin/Developer see the dashboard and can hand over tools, save partial returns and complete inspections. Developer alone manages accounts. Change password by clicking your name in the navbar.

```powershell
npm run build
npm test
# Integration tests must use the separate disposable database altech_tms_test:
$env:MYSQL_DATABASE='altech_tms_test'
npm run db:migrate
npm run test:integration
Remove-Item Env:MYSQL_DATABASE
```

Integration tests insert synthetic fixtures and remove their own rows/files; never point them at a production database. The suite deliberately requires the exact database name above. It does not seed the application database.

## Important files

- frontend/src/features/BorrowerForm.tsx: source-matched borrower form and capture controls.
- frontend/src/features/Dashboard.tsx, RequestDetail.tsx, Management.tsx: requests, inspections, catalog, logs and accounts.
- frontend/src/services/api.ts: typed REST requests, in-memory CSRF token and multipart uploads. No credentials or business persistence in browser storage.
- backend/src/middleware/security.ts: hashed opaque cookie sessions, CSRF/origin checks, roles and audit writes.
- backend/src/routes: REST controllers for auth, request lifecycle, catalog, accounts and Excel reports.
- backend/src/services: image validation/private storage and return rules.
- backend/src/repositories: parameterized database operations and transaction helper.
- database/schema.sql: relational schema, indexes, foreign keys and constraints; seeds/ documents clean setup.
- deployment/: Docker builds, local MySQL and production Caddy HTTPS configuration.

## Environment variables

All variables are backend/operator settings; none are compiled into frontend code.

| Variable | Purpose |
| --- | --- |
| NODE_ENV | development/test/production; production enables secure cookies and requires HTTPS and DB TLS |
| PORT | API port, default 3001 |
| APP_ORIGIN | Exact public browser origin without trailing slash; http://localhost:5173 locally |
| MYSQL_HOST / MYSQL_PORT | Database endpoint, restricted to backend access |
| MYSQL_DATABASE | Database name |
| MYSQL_USER / MYSQL_PASSWORD | Unique database user and secret |
| MYSQL_SSL_CA | CA file path; required in production, certificate validation remains enabled |
| UPLOAD_DIR | Private filesystem directory; persistent encrypted volume in production |
| TRUST_PROXY | 1 only behind the supplied trusted reverse proxy; otherwise 0 |
| SETUP_USERNAME / SETUP_NAME / SETUP_PASSWORD | Operator-provided initial account; remove after initialization |
| MYSQL_ROOT_PASSWORD | Local Docker initialization only; not an API runtime credential |
| DOMAIN | Production Caddy hostname, e.g. tools.example.com |
| MYSQL_CA_FILE | Host CA path mounted at /run/mysql-ca.pem by production Compose |

Permanent attachment storage currently uses a private persistent volume, with random keys and metadata in MySQL. Do not expose the upload directory as a static route. All downloads enforce session and request ownership. Every partial return keeps its own photo/signature and inspection snapshot. Back up database and files together.

Catalog names remain independent of free-text requests, as in the source; stock totals are reference quantities, not automatic allocation. Imports accept XLSX/XLS/CSV with exported catalog headers and upsert by code, preserving other tools. Requests have no invented due-date, rejection or multi-site fields.

Operational limits: one API instance for in-memory rate limits and shared filesystem; request list loads all authorized requests, log view loads newest 5,000, exports include all authorized records. For larger deployments add pagination, streaming reports, object storage and a shared rate limiter before scaling horizontally.

# ALTECH Tools Management System

Shared tools and equipment borrowing system for ALTECH staff. Borrowers submit requests with quantities, photos and signatures. Admins manage the catalog, handovers, returns, reports and Regular User creation. Developers manage all accounts. Records are stored in MySQL and accessible across devices and locations for authorized users.

Stack: React / TypeScript / Vite / Tailwind (frontend), Express / TypeScript (API), MySQL. Passwords are hashed with Argon2id. Sessions and role checks are enforced on the backend. Attachments are private.

## Clone and install

Requires Node 22.12+ (24 recommended), npm, and MySQL 8.4. XAMPP MariaDB 10.4 has been tested; MySQL 8.4 and production still require validation.

```powershell
git clone https://github.com/JeffAlden/tools-management-system.git
cd tools-management-system
npm ci
Copy-Item .env.example .env
```

## Database setup

In phpMyAdmin or an authorized MySQL connection, replace the password placeholder and run:

```sql
CREATE DATABASE altech_tms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'tms_app'@'127.0.0.1' IDENTIFIED BY '<choose-your-strong-database-password>';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES ON altech_tms.* TO 'tms_app'@'127.0.0.1';
```

Edit `.env`:

- `MYSQL_HOST=127.0.0.1`
- `MYSQL_PORT=3306`
- `MYSQL_DATABASE=altech_tms`
- `MYSQL_USER=tms_app`
- `MYSQL_PASSWORD=<your database password>`
- `APP_ORIGIN=http://localhost:5173`
- `PORT=3001`
- `UPLOAD_DIR=./uploads`

Keep secrets private. `.env` is ignored by Git. The MySQL password is separate from application login passwords.

```powershell
npm run db:migrate
```

Alternatively, set `MYSQL_ROOT_PASSWORD` and `MYSQL_PASSWORD` in `.env` and run:

```powershell
docker compose --env-file .env -f deployment/compose.local.yml up -d
```

before migration. Do not run two database servers on port 3306.

## Initial account setup

Choose a password of 12–128 characters containing uppercase, lowercase, number, and symbol. Store it in a password manager. From the project root:

```powershell
$env:SETUP_USERNAME = 'developer'
$env:SETUP_NAME = 'Developer'
$taskSetupSecret = Read-Host 'Choose Developer password' -AsSecureString
try {
  $env:SETUP_PASSWORD = [Net.NetworkCredential]::new('', $taskSetupSecret).Password
  npm run db:setup
} finally {
  Remove-Item Env:SETUP_PASSWORD, Env:SETUP_USERNAME, Env:SETUP_NAME -ErrorAction SilentlyContinue
  $taskSetupSecret = $null
}
```

Setup stores only a password hash and aborts if any users already exist. Restored databases keep their existing accounts.

## Run backend and frontend

From the repository root, use two terminals:

```powershell
# Terminal 1 – backend (http://localhost:3001)
npm run dev --workspace backend
```

```powershell
# Terminal 2 – frontend (http://localhost:5173)
npm run dev --workspace frontend
```

Or run both with `npm run dev`. Open http://localhost:5173. The Dashboard or Submit route opens the login page. Vite proxies `/api` to the backend. Camera capture requires HTTPS except on localhost. On other machines, `localhost` refers to that machine; use the same deployed instance to share records.

## Build and test

```powershell
npm run build
npm test
```

Integration tests require a separate disposable database named `altech_tms_test`. Configure its connection via process environment variables, migrate it, then run `npm run test:integration`. Never test against business data. GitHub CI provides an isolated MySQL 8.4 service.

## Project layout

- `frontend/` – UI, components, API client, and required brand images
- `backend/` – authentication, roles, REST endpoints, workflows, uploads, and tests
- `database/` – schema and initialization notes
- `deployment/` – Docker, HTTPS, and local/production configuration
- `docs/` – behavior decisions, verification limits, and deployment/backup procedures

Production requires HTTPS, restricted MySQL access, DB TLS CA, private persistent uploads, and secure environment variables. Back up SQL and uploads together. After migrations, runtime database privileges should be limited to `SELECT`, `INSERT`, `UPDATE`, and `DELETE`. A single API instance is supported, horizontal scaling needs shared rate limiting and storage.

Environment variables are documented in `.env.example` and the deployment guide. Secrets, `node_modules`, builds, uploads, logs, and backups are excluded from Git.
```
# ALTECH Tools Management System

A shared tools and equipment borrowing system for ALTECH staff. Borrowers submit requests with quantities, photos and signatures. Admins manage the catalog, handovers, returns, reports and Regular User creation. Developers manage all accounts. Centralized MySQL records support authorized access across devices and locations.

React/TypeScript/Vite/Tailwind frontend; Express/TypeScript API; MySQL database. Passwords use Argon2id hashes, sessions and backend role checks. Attachments are private. Business records are never persisted in browser localStorage.

## Clone and install

Requires Node 22.12+ (24 recommended), npm and MySQL 8.4. XAMPP MariaDB 10.4 compatibility has been tested; MySQL 8.4 and production deployment still need validation.

```powershell
git clone https://github.com/JeffAlden/tools-management-system.git
cd tools-management-system
npm ci
Copy-Item .env.example .env
```

## Database setup

In phpMyAdmin SQL or an authorized MySQL administrator connection, replace the password placeholder and run:

```sql
CREATE DATABASE altech_tms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'tms_app'@'127.0.0.1' IDENTIFIED BY '<choose-your-strong-database-password>';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES ON altech_tms.* TO 'tms_app'@'127.0.0.1';
```

Edit .env: MYSQL_HOST=127.0.0.1, MYSQL_PORT=3306, MYSQL_DATABASE=altech_tms, MYSQL_USER=tms_app, MYSQL_PASSWORD=your chosen database password, APP_ORIGIN=http://localhost:5173, PORT=3001, UPLOAD_DIR=./uploads. Keep secrets private; .env is ignored by Git. The MySQL password is separate from the application login password.

```powershell
npm run db:migrate
```

Alternatively configure MYSQL_ROOT_PASSWORD and MYSQL_PASSWORD in .env and run `docker compose --env-file .env -f deployment/compose.local.yml up -d` before migration. Do not run two database servers on port 3306.

## Initial Developer setup

There is no default login password. Choose 12–128 characters with uppercase, lowercase, number and symbol. Save it in your password manager. Run from the project root:

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

Setup stores only a password hash and refuses if users already exist. Restored databases retain their existing accounts. Developer manages all accounts; Admin sees Admin/User accounts and creates Regular Users. Developer accounts are hidden from Admin. Role changes, account edits and password resets remain Developer-only.

## Run backend and frontend

Use two terminals from the repository root:

```powershell
# Terminal 1: backend, http://localhost:3001
npm run dev --workspace backend
```

```powershell
# Terminal 2: frontend, http://localhost:5173
npm run dev --workspace frontend
```

Or `npm run dev` starts both. Open http://localhost:5173. Dashboard or Submit opens login. Vite proxies /api to the backend. Camera capture needs HTTPS except on localhost. On other computers localhost refers to that computer; use the same deployed application to share records.

## Build and test

```powershell
npm run build
npm test
```

Integration tests require a separate disposable database named altech_tms_test. Configure its connection using process environment variables, migrate it, then run `npm run test:integration`. Never test against business records. GitHub CI includes an isolated MySQL 8.4 service.

## Project organization

- frontend/: UI, components, API client and the four required brand images.
- backend/: authentication, roles, REST endpoints, workflows, uploads and tests.
- database/: relational schema and initialization documentation.
- deployment/: Docker, HTTPS and local/production configurations.
- docs/: behavior decisions, verification limits and deployment/backup procedures.

See [deployment and backup/restore](docs/deployment.md), [behavior decisions](docs/inspection.md) and [verification](docs/verification.md). Production requires HTTPS, restricted MySQL, DB TLS CA, private persistent uploads and secure environment variables. Back up SQL and uploads together. After migrations, runtime DB privileges should be SELECT/INSERT/UPDATE/DELETE only. One API instance is supported; horizontal scaling requires shared rate limiting and storage.

Environment settings are listed in .env.example and the deployment guide. Secrets, node_modules, builds, uploads, logs and backups are excluded from Git. Unused legacy HTML, duplicate assets and preview screenshots are excluded from the runnable project.

# ALTECH Tools Management System

Shared tools and equipment borrowing system for ALTECH staff. Borrowers submit requests with quantities, photos and signatures. Admins manage the catalog, handovers, returns, reports and Regular User creation. Developers manage all accounts. Records are stored in MySQL and accessible across devices and locations for authorized users.

Stack: React / TypeScript / Vite / Tailwind (frontend), Express / TypeScript (API), MySQL. Passwords are hashed with Argon2id. Sessions and role checks are enforced on the backend. Attachments are private.

## Fresh installation: follow these steps in order

No reference-backup folder or default Developer password is needed. Use this procedure for a new empty database. If the database already has users, skip initial-account setup and use an existing login.

### 1. Start MySQL

Open XAMPP and start MySQL. Start Apache too if you use phpMyAdmin at http://localhost/phpmyadmin/. Keep MySQL running while using the application.

### 2. Clone and install

Requires Node 22.12+ (24 recommended), npm, and MySQL 8.4. XAMPP MariaDB 10.4 has been tested; MySQL 8.4 and production still require validation.

```powershell
git clone https://github.com/JeffAlden/tools-management-system.git
cd tools-management-system
npm ci
Copy-Item .env.example .env
```

Run commands from the project root containing the main package.json. Do not overwrite an already configured .env. Stop running development servers with Ctrl+C before npm ci; on Windows they can lock dependency files and cause EPERM errors. Installing dependencies does not create the database or Developer account.

### 3. Create the empty database and database account

In phpMyAdmin or an authorized MySQL connection, replace the password placeholder and run:

```sql
CREATE DATABASE altech_tms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'tms_app'@'127.0.0.1' IDENTIFIED BY '<choose-your-strong-database-password>';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES ON altech_tms.* TO 'tms_app'@'127.0.0.1';
```

### 4. Configure .env — not .env.example

`.env.example` is a public template, not your active configuration. The backend reads `.env`. Never put real passwords in `.env.example` or commit them to GitHub. `MYSQL_USER` and `MYSQL_PASSWORD` identify the database account; they are not the username/password entered on the login screen.

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

### 5. Create the tables

```powershell
npm run db:migrate
```

Alternatively, set `MYSQL_ROOT_PASSWORD` and `MYSQL_PASSWORD` in `.env` and run:

```powershell
docker compose --env-file .env -f deployment/compose.local.yml up -d
```

before migration. Do not run two database servers on port 3306.

### 6. Create the first Developer (once only)

Choose a password of 12–128 characters containing uppercase, lowercase, number, and symbol. Store it in a password manager. From the project root:

```powershell
$env:SETUP_USERNAME = Read-Host 'Choose Developer username'
$env:SETUP_NAME = Read-Host 'Your full name'
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

Wait for **Initial Developer created**. Remember the username and password you chose; the full name is the display name. Password characters do not appear while typing. The PowerShell process variables above are temporary, so there is no need to store the Developer password in .env or .env.example. Without this step, a fresh database has no account and login cannot succeed.

### 7. Start the application

The easiest option starts frontend and backend together:

```powershell
npm run dev
```

Keep this terminal open. Alternatively, start them separately as shown below.

From the repository root, use two terminals:

```powershell
# Terminal 1 – backend (http://localhost:3001)
npm run dev --workspace backend
```

```powershell
# Terminal 2 – frontend (http://localhost:5173)
npm run dev --workspace frontend
```

Or run both with `npm run dev`. Open http://localhost:5173. Borrowers can submit without login; the Tools Dashboard requires staff login. Vite proxies `/api` to the backend. Camera capture requires HTTPS except on localhost. On other machines, `localhost` refers to that machine; use the same deployed instance to share records.

### 8. Sign in

Open **http://localhost:5173**, click **Tools Dashboard**, then the login button. Enter the Developer username and password chosen in step 6 and click Sign In. Use localhost consistently when APP_ORIGIN is http://localhost:5173; switching to 127.0.0.1 changes the origin and login requests will be rejected.

## Everyday startup and troubleshooting

After initial setup, start MySQL in XAMPP and run npm run dev from the project folder. Do not repeat npm ci or Developer setup every day. Run migrations when an application update requires them.

- Connecting to the server: the frontend retries while the backend starts. Keep the terminal open and check its API errors. http://localhost:3001/api/health should return {"ok":true} when the API can reach MySQL.
- Invalid username/password: use the application credentials chosen in step 6, not the MySQL account. A fresh database requires first-user setup.
- EPERM during npm ci: stop all project development servers using Ctrl+C and retry. If still locked, restart Windows and install before starting the application.
- Existing users: setup intentionally refuses; log in with the existing account. Restoring a database backup preserves users and password hashes.
- Photo storage: MySQL holds metadata; files live in backend/uploads for UPLOAD_DIR=./uploads. Back up and restore both. Git does not contain uploaded images.

A fresh office database is a separate system. For shared records across locations, use one deployed application and centralized database. If real credentials were committed to .env.example, remove them and change the exposed credentials.

## Build and test

Borrowers submit requests without signing in. A borrower signature is required; guest submissions still use a session security token and rate limiting. Signed-in User, Admin, and Developer staff can review requests, hand over tools, and record returns regardless of who submitted the request.

Application updates require `npm run db:migrate` before starting the new API. Migration 3 permits guest request/attachment ownership and changes existing six-digit references from `REQ123456` to `REQ-123456`. The Coolify deployment runs migrations at startup; managed-MySQL deployments must run them separately.

Each account has one active authenticated session. A successful sign-in revokes earlier sessions for that account; their next protected request is denied. Use separate staff accounts rather than sharing credentials. Failed sign-ins do not revoke existing sessions.

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

Production requires HTTPS, restricted MySQL access, DB TLS CA, private persistent uploads, and secure environment variables. Back up SQL and uploads together. After migrations, runtime database privileges should be limited to `SELECT`, `INSERT`, `UPDATE`, and `DELETE`. A single API instance is supported, horizontal scaling needs shared rate limiting and storage.

Environment variable names are listed in `.env.example`. Secrets, `node_modules`, builds, uploads, logs, and backups are excluded from Git.

## Contabo VPS with Coolify

Use Ubuntu 24.04 and self-hosted Coolify. Add this repository as a Git-based Docker Compose application, branch `main`, base directory `/`, Compose location `/docker-compose.yaml`. This file builds three services: `web`, `api`, and private MySQL 8.4. Coolify terminates HTTPS; the web container serves the frontend and forwards `/api` to the backend. MySQL requires TLS; only its public CA is shared with the API. MySQL is bound only to VPS loopback `127.0.0.1:13306` for SSH-tunneled desktop access. Neither the API nor database has a public port.

After loading the Compose file, review these runtime environment variables in Coolify:

- `APP_ORIGIN` is fixed in the Compose file to `https://www.jeffreypalino.com` (no trailing slash); it does not require editing in Coolify.
- `SERVICE_PASSWORD_64_MYSQL`: Coolify automatically generates this 64-character password for the application's database user.
- `SERVICE_PASSWORD_64_MYSQLROOT`: Coolify automatically generates a separate 64-character password for database administration.

The Compose file sets `APP_ORIGIN` to `https://www.jeffreypalino.com`; edit that non-secret value in the repository if using another address. Coolify stores generated passwords privately and reuses them across deployments. The same generated application password is passed to MySQL initialization and the API, so no manual SQL password matching is required. Keep the generated values in a password manager. MySQL initialization variables apply only when its data volume is empty; changing them later does not change existing database passwords. Existing installations must retain their current passwords when switching variable names; automatic generation is intended for fresh installations.

Point your domain's DNS A record to the VPS public IPv4 address. Assign the HTTPS domain to the `web` service, internal port `80`, only. Leave `api` and `mysql` without public domains. Allow public HTTP/HTTPS to Coolify's proxy. Save, load the Compose file, and deploy. The API runs migrations before starting; it does not create any users or import legacy data.

Once deployment is healthy, open the `api` container's Terminal in Coolify and run this Bash-compatible setup sequence. Enter your chosen Developer account details when prompted; the password is hidden and isn't placed in shell history:

```bash
read -r -p 'Developer username: ' SETUP_USERNAME
read -r -p 'Full name: ' SETUP_NAME
read -r -s -p 'Developer password: ' SETUP_PASSWORD; echo
export SETUP_USERNAME SETUP_NAME SETUP_PASSWORD
node backend/dist/scripts/setup.js
unset SETUP_USERNAME SETUP_NAME SETUP_PASSWORD
```

The password must satisfy the application's account validation (12–128 characters, uppercase, lowercase, number, and symbol). Setup refuses when users already exist. Log in through the application dashboard with this account. Coolify's administrator account is separate.

Named volumes preserve `mysql_data`, `mysql_ca`, and `uploads` across ordinary redeployments. Do not delete these volumes when updating. Volume persistence is not a backup: export MySQL using `mysqldump --single-transaction --no-tablespaces` and copy the uploads volume to separate storage regularly. To restore, stop the API, import SQL into the same schema, restore the uploads files with the API user's ownership, then restart. Keep the database CA volume with the associated database volume; never regenerate or discard it independently. The database user needs schema privileges for startup migrations; a stricter runtime-only account requires running migrations separately.

This Coolify configuration requires deployment verification on the VPS; a local frontend/backend build does not verify Docker networking, MySQL TLS, HTTPS, or persistence. Existing managed-MySQL deployments can continue using `deployment/compose.production.yml`.

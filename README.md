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

Or run both with `npm run dev`. Open http://localhost:5173. The Dashboard or Submit route opens the login page. Vite proxies `/api` to the backend. Camera capture requires HTTPS except on localhost. On other machines, `localhost` refers to that machine; use the same deployed instance to share records.

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

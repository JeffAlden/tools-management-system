# ALTECH Tools Management System

A web app for recording who requested tools and equipment, who issued them, and when they were returned. It replaces scattered borrowing records with a shared log that authorized staff can search, review, and export.

Borrowers fill out a request with item quantities and a signature. Staff review the request, record the handover, inspect returned items, and keep photos and return history with the record. The app is intended for ALTECH teams managing equipment used for work and deployment.

## What the app includes

| Feature | What it is for |
| --- | --- |
| Borrower Request | Submit borrower details, items, quantities, notes, an optional photo, and the required borrower signature. |
| Tools Dashboard | See request totals, pending requests, issued equipment, and completed returns. |
| Equipment Issuance & Return Log | Search/filter requests and inspect their issue and return records. |
| Issued By / Received By | Identify the staff involved, with role-colored name badges. |
| Equipment Registry | View requested items, quantities, return status, dates, and durations across requests. |
| Tools Catalog | Maintain tool codes, names, and total quantities; import/export catalog data. |
| Reports and Activity Logs | Export records and review recorded actions. |
| Members | Manage staff accounts according to your role. |
| Generate QR | Provide a QR code linking to the borrower form. |

## How to use the app

### Submit a borrowing request

1. Open your team's app address and select **Borrower Request**. No login is required for this form.
2. Enter your full name, position, vehicle/car plate, and request date/time.
3. Enter each item's name, quantity, and any notes. Add another item if needed.
4. Take or upload a photo if useful. Allow camera access when the browser asks.
5. Draw your signature in the signature box. A borrower signature is required.
6. Submit the form and keep the generated request number, such as `REQ-123456`.

The request appears as **Pending Approval**. Submitting a request does not issue the equipment automatically.

### Sign in and issue equipment

1. Select **Tools Dashboard** and use the login form with your application username and password.
2. Search for the borrower, tool, or plate, or filter by date/status.
3. Open the pending request using its action button. Review the borrower, items, quantities, photo, and signature.
4. Capture or upload the **Admin Before-Handover Photo** if needed.
5. Click **Confirm & Handover Tools** when the handover is ready.

The request becomes **Issued**, and the app records the issuance time and staff member. User, Admin, and Developer accounts can perform this workflow.

### Record a return

1. Find an issued request and open it. Depending on your role, its action button is **Process Return** or **View Request**.
2. Enter each item's returned quantity, return status, and condition notes.
3. Use **Tag All Returned Completely** only when every listed item has been fully returned.
4. Add the return condition photo and borrower return signature as appropriate.
5. Click **Save Return Inspection**.

Partial returns remain **Issued**. A fully completed return becomes **Completed** and its request detail is read-only. Photos and handover/return history remain available in the record.

### Review the inventory and durations

Select **Equipment Registry** to open **Tools and Equipment Inventory Overview**. Search by borrower, request number, or tool. 

| Column | Meaning |
| --- | --- |
| TIME IN POSSESSION | Time from issuance until now for an item still out. Displays a dash after return, or `0 hrs (Not Issued)` before issuance. |
| TOTAL BORROWING DURATION | Time from the original request until the item was returned, including the waiting time before issuance. Displays a dash until return. |

Durations use whole hours, switching to days and hours after 24 hours. Requested Date and Returned Date display date and time despite their shorter headings.

## Tech stack

Versions below reflect the repository's package declarations and deployment files.

| Area | Technology |
| --- | --- |
| Frontend | React 19, TypeScript 5.9, Vite 6, Tailwind CSS 4 |
| UI assets | Font Awesome 6 icons and Inter font |
| Backend | Node.js, Express 5, TypeScript |
| Database | MySQL 8.4 in the supplied Docker configurations; `mysql2` database driver |

### Install the app's packages

```powershell
npm ci
```

Wait until PowerShell returns to its prompt without an error. This downloads the app's required packages. It does not create the database or a login account.

### Create an empty database and a database account

In phpMyAdmin, select the **SQL** tab at the server level. Paste the SQL below, replacing `REPLACE_WITH_YOUR_DATABASE_PASSWORD` with a strong password you choose, then click **Go**. Do not use an apostrophe in the replacement unless you know how to escape it in SQL.

```sql
CREATE DATABASE altech_tms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'tms_app'@'127.0.0.1' IDENTIFIED BY 'REPLACE_WITH_YOUR_DATABASE_PASSWORD';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES ON altech_tms.* TO 'tms_app'@'127.0.0.1';
```

You should see `altech_tms` in the database list. Save the database password privately: you will need it in the next step. These statements require a database administrator connection. If the database/account already exists, use its existing configuration instead of rerunning this creation step.

### Configure the app

For a new installation only, copy the configuration template:

```powershell
Copy-Item .env.example .env
notepad .env
```

In Notepad, update these lines. Replace the password placeholder with the exact database password from step 5. Keep the other template settings for local use.

```dotenv
NODE_ENV=development
PORT=3001
APP_ORIGIN=http://localhost:5173
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_DATABASE=altech_tms
MYSQL_USER=tms_app
MYSQL_PASSWORD="REPLACE_WITH_YOUR_DATABASE_PASSWORD"
MYSQL_SSL_CA=
UPLOAD_DIR=./uploads
TRUST_PROXY=0
```

Keep the database password inside the double quotes, especially if it contains `#` or spaces. Save and close Notepad. Leave `SETUP_USERNAME`, `SETUP_NAME`, and `SETUP_PASSWORD` blank in the file; the next account step supplies them temporarily.

**Two different passwords:** `MYSQL_PASSWORD` lets the app connect to its database. Your password lets you sign in to the website. 

### Create the database tables

```powershell
npm run db:migrate
```

Wait for **Schema version 4 ready.** This creates the required tables and applies outstanding migrations. If it fails, check MySQL is running and verify the database settings from step 6 before continuing.

### Create the first Developer account

This step runs once on a fresh database. There is no default login or default password.

Choose a username containing 3–64 letters, numbers, underscores, dots, or hyphens. Choose a password with 12–128 characters including an uppercase letter, lowercase letter, number, and symbol. Store your chosen login privately.

Paste this complete block into PowerShell and enter the requested details:

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

Password characters are hidden while typing. Wait for **Initial Developer created**. Use the chosen username to log in, not the full display name. The script stores a password hash and removes its temporary setup variables afterward.

If you see **Setup refused: users already exist**, use an existing account. This protects an existing installation; restoring a database also restores its accounts.

### Start the app

```powershell
npm run dev
```

This starts the backend and frontend together. Keep the terminal open. Open **http://localhost:5173** in your browser, you should see the borrower form. Select **Tools Dashboard** and sign in using credentials.

The backend uses port `3001`; the frontend uses port `5173` and forwards `/api` requests to the backend. If Vite chooses another port, free port 5173 and restart, or update `APP_ORIGIN` to the actual frontend address and restart the backend.

## Project folders

| Location | Contents |
| --- | --- |
| `frontend/` | Pages, UI components, styles, API client, and brand images. |
| `backend/` | API routes, authentication, account roles, workflows, file storage, and tests. |
| `database/` | Database schema and migrations. |
| `deployment/` | Docker images, Caddy configuration, and local/production deployment files. |
| `.env.example` | Public configuration template. |
| `workspace-changes/` | Local Markdown change notes; excluded from Git. |

Secrets, installed packages, generated builds, uploads, logs, backups, and local change notes are excluded from Git by `.gitignore`.

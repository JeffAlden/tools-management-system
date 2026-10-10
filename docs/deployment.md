# Cloud deployment and recovery

## Architecture

One cloud Linux VM running Docker Compose: Caddy serves the built frontend and proxies /api to one private Express container. A managed MySQL 8.4 database is reachable only from the VM on its private network or tightly restricted provider firewall. MySQL port is never published by production Compose. Uploaded images use an encrypted persistent Docker volume. This supports multiple locations through the shared HTTPS origin. Horizontal scaling requires shared object storage and a distributed rate limiter; the supplied deployment is intentionally one API instance.

## Deploy

1. Choose a cloud project/region, VM and managed MySQL instance. Create DNS A/AAAA records for your chosen DOMAIN. Permit inbound 80/443 to Caddy; restrict SSH to authorized administration. On managed MySQL permit connections only from the backend VM; use private networking when supported. Do not permit public 0.0.0.0/0 access to 3306.
2. Create an empty utf8mb4 database. Create a migration/setup account with database-scoped DDL/DML privileges and a separate runtime account with SELECT/INSERT/UPDATE/DELETE only. Use provider secret management to provision .env outside Git, mode 600. Download the provider's database CA. Set MYSQL_SSL_CA=/run/mysql-ca.pem in .env, MYSQL_CA_FILE to its absolute host path, NODE_ENV=production, APP_ORIGIN=https://your-domain, TRUST_PROXY=1, PORT=3001 and DOMAIN=your-domain. Generate your own database and initial Developer passwords.
3. From repository root build containers:

```sh
docker compose --env-file .env -f deployment/compose.production.yml build
```

4. Using migration/setup credentials temporarily in the secret environment, initialize schema and the first Developer. Commands use built JavaScript, not dev tooling:

```sh
docker compose --env-file .env -f deployment/compose.production.yml run --rm --no-deps api node backend/dist/scripts/migrate.js
docker compose --env-file .env -f deployment/compose.production.yml run --rm --no-deps api node backend/dist/scripts/setup.js
```

5. Remove SETUP_* values. Switch MYSQL_USER/MYSQL_PASSWORD to the restricted runtime account. Start:

```sh
docker compose --env-file .env -f deployment/compose.production.yml up -d
```

Caddy automatically obtains/renews certificates when DNS and ports are correct. Caddy state persists across container updates. Verify HTTPS and /api/health, cookie Secure/HttpOnly/SameSite attributes, developer login and account creation. Run acceptance smoke tests on desktop and phones from at least two networks. Verify unauthorized API calls and attachment downloads fail. No actual cloud deployment is implied by these files.

## Production operations

Use provider-managed secrets and disk encryption. API logs emit generic errors with error codes, never bodies/passwords/cookies; MySQL activity_logs records business actions transactionally. Collect container logs centrally; restrict access and set retention. Alert on health failures, 5xx rates, disk usage, backup failure and database capacity. Keep Node/base images and npm lockfile patched. Never expose the original HTML, which contains old insecure examples.

There is no public setup HTTP endpoint. Sessions are opaque 256-bit random tokens; only token digests are stored in MySQL. Sessions last eight hours; expired sessions are periodically removed. Password changes/reset and role changes revoke sessions. CSRF requires both the exact Origin and synchronizer token. SQL uses bound parameters; React escapes displayed user input. Uploads accept only PNG/JPEG/WebP, maximum 5 MB per file and 20 million input pixels; images are decoded/re-encoded as PNG, stripping metadata and active content. Memory pressure must be monitored; the upload limiter applies before request submission. Files are stored before transaction commit and removed on normal rollback; a process crash in that window can leave an orphan file, which may be reconciled against attachments.storage_key during maintenance. Never delete referenced files.

## Backup

Use managed MySQL automated daily backups and point-in-time recovery, with encrypted retention and a separate administrative recovery account. Back up the private uploads volume to encrypted object storage with matching retention. Treat signatures and photos as sensitive personal data. Establish a retention policy with the organization.

For a consistent manual backup, enter a maintenance window and stop API writes. Caddy may remain running, but it will report API unavailability. Use a MySQL option file (mode 600) containing backup account credentials, host and TLS CA; never put passwords on the command line.

```sh
docker compose --env-file .env -f deployment/compose.production.yml stop api
mysqldump --defaults-extra-file=/secure/tms-backup.cnf --single-transaction --routines --triggers --hex-blob --set-gtid-purged=OFF altech_tms > /secure/backups/tms.sql
# Replace ACTUAL_UPLOADS_VOLUME with the resolved volume from docker volume ls.
docker run --rm -v ACTUAL_UPLOADS_VOLUME:/source:ro -v /secure/backups:/backup alpine tar -czf /backup/uploads.tar.gz -C /source .
docker compose --env-file .env -f deployment/compose.production.yml start api
```

Record schema version, timestamp, application Git revision, checksums and encryption metadata; upload both artifacts together to access-controlled backup storage. Check command success before ending maintenance. Database credentials in option files must be rotated and never committed.

## Restore drill

1. Restore to an isolated empty MySQL database and new private volume, with API stopped. Never overwrite a live database without an approved recovery plan.
2. Restore the paired SQL and upload archive; preserve node user ownership (UID 1000) and permissions. Use mysql --defaults-extra-file=/secure/tms-restore.cnf altech_tms < tms.sql and unpack the archive into the new volume.
3. Delete sessions in the restored database to invalidate old cookies. Run the migration command with the restored schema's compatible application release; do not rerun initial account setup.
4. Verify row counts, foreign keys, selected file hashes, login, request status/history, attachment downloads and report images. Test a synthetic handover/return in the isolated environment.
5. Record measured recovery time/data-loss window and restore results. Only then switch service traffic using the organization's recovery procedure. Schedule restore drills at least quarterly.

Backup commands/configuration are provided; real managed backups, restore drills, certificates and cloud connectivity must be verified on the chosen deployment.

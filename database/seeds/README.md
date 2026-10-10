# Clean initialization

Run npm run db:setup after migrations. It requires SETUP_USERNAME, SETUP_NAME and SETUP_PASSWORD from the backend environment, validates password strength, hashes using Argon2id and refuses to seed if any users exist. Concurrent setup is guarded by a MySQL advisory lock. No default password, tool rows or imported records exist. Remove setup variables after success.

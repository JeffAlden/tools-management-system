ALTER TABLE sessions ADD COLUMN last_seen_at DATETIME(3) NULL;
ALTER TABLE sessions ADD COLUMN last_active_at DATETIME(3) NULL;

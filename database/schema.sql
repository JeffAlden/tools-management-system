CREATE TABLE IF NOT EXISTS users (
 id CHAR(36) PRIMARY KEY, username VARCHAR(64) NOT NULL UNIQUE, name VARCHAR(150) NOT NULL,
 password_hash VARCHAR(255) NOT NULL, role ENUM('Developer','Admin','User') NOT NULL,
 active BOOLEAN NOT NULL DEFAULT TRUE, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS sessions (
 token_hash CHAR(64) PRIMARY KEY, csrf CHAR(64) NOT NULL, user_id CHAR(36) NULL,
 expires_at DATETIME(3) NOT NULL, FOREIGN KEY(user_id) REFERENCES users(id), INDEX(expires_at), INDEX(user_id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS tools (
 id CHAR(36) PRIMARY KEY, code VARCHAR(64) NOT NULL UNIQUE, name VARCHAR(200) NOT NULL,
 total_qty INT NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
 CHECK(total_qty >= 0), INDEX(name)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS borrow_requests (
 id CHAR(36) PRIMARY KEY, reference VARCHAR(48) NOT NULL UNIQUE, user_id CHAR(36) NOT NULL,
 borrower_name VARCHAR(150) NOT NULL, position VARCHAR(150) NOT NULL, plate VARCHAR(40) NOT NULL,
 request_date DATETIME(3) NOT NULL, status ENUM('Pending Approval','Issued','Completed') NOT NULL DEFAULT 'Pending Approval',
 borrow_date DATETIME(3) NULL, return_date DATETIME(3) NULL,
 released_by CHAR(36) NULL, received_by CHAR(36) NULL, version INT NOT NULL DEFAULT 1,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
 FOREIGN KEY(user_id) REFERENCES users(id), FOREIGN KEY(released_by) REFERENCES users(id), FOREIGN KEY(received_by) REFERENCES users(id),
 INDEX(user_id,created_at), INDEX(status,request_date), INDEX(request_date), INDEX(borrower_name), INDEX(plate)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS borrow_request_items (
 id CHAR(36) PRIMARY KEY, request_id CHAR(36) NOT NULL, name VARCHAR(200) NOT NULL,
 requested_qty INT NOT NULL, returned_qty INT NOT NULL DEFAULT 0, note VARCHAR(2000) NOT NULL DEFAULT '',
 condition_note VARCHAR(2000) NOT NULL DEFAULT '',
 return_status ENUM('Not returned','partial return','Returned','Not working') NOT NULL DEFAULT 'Not returned',
 FOREIGN KEY(request_id) REFERENCES borrow_requests(id), INDEX(request_id), INDEX(name),
 CHECK(requested_qty > 0), CHECK(returned_qty >= 0 AND returned_qty <= requested_qty)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS handover_returns (
 id CHAR(36) PRIMARY KEY, request_id CHAR(36) NOT NULL, actor_id CHAR(36) NOT NULL,
 kind ENUM('handover','return') NOT NULL, inspection JSON NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 FOREIGN KEY(request_id) REFERENCES borrow_requests(id), FOREIGN KEY(actor_id) REFERENCES users(id), INDEX(request_id,created_at)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS attachments (
 id CHAR(36) PRIMARY KEY, request_id CHAR(36) NOT NULL, event_id CHAR(36) NULL, uploaded_by CHAR(36) NOT NULL,
 kind ENUM('borrowerPhoto','borrowerSignature','handoverPhoto','returnPhoto','returnSignature') NOT NULL,
 storage_key VARCHAR(80) NOT NULL UNIQUE, mime_type VARCHAR(40) NOT NULL, size_bytes INT NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 FOREIGN KEY(request_id) REFERENCES borrow_requests(id), FOREIGN KEY(event_id) REFERENCES handover_returns(id),
 FOREIGN KEY(uploaded_by) REFERENCES users(id), INDEX(request_id,created_at), CHECK(size_bytes > 0)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS activity_logs (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, actor_id CHAR(36) NULL, actor_role ENUM('Developer','Admin','User') NULL,
 action VARCHAR(100) NOT NULL, details VARCHAR(2000) NOT NULL, request_id CHAR(36) NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 FOREIGN KEY(actor_id) REFERENCES users(id), FOREIGN KEY(request_id) REFERENCES borrow_requests(id),
 INDEX(created_at), INDEX(request_id), INDEX(actor_id,created_at)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS schema_migrations (
 version INT PRIMARY KEY, applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

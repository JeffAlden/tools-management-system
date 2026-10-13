ALTER TABLE borrow_requests MODIFY user_id CHAR(36) NULL;
ALTER TABLE attachments MODIFY uploaded_by CHAR(36) NULL;
UPDATE borrow_requests SET reference = CONCAT('REQ-', SUBSTRING(reference, 4)) WHERE reference REGEXP '^REQ[0-9]{6}$';

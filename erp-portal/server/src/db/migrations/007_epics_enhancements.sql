-- Epic 3 Enhancements: project-level tracking and receipt attachment for expenses
ALTER TABLE expense_entries
  ADD COLUMN project_id CHAR(36) NULL AFTER tenant_id,
  ADD COLUMN receipt_url VARCHAR(500) NULL AFTER description,
  ADD CONSTRAINT expense_project_fk FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
  ADD INDEX expense_project_idx (tenant_id, project_id);

ALTER TABLE income_entries
  ADD COLUMN project_id CHAR(36) NULL AFTER tenant_id,
  ADD CONSTRAINT income_project_fk FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
  ADD INDEX income_project_idx (tenant_id, project_id);

-- Epic 4 Enhancements: GST breakdown and Razorpay Payment Link tracking
ALTER TABLE quotations
  ADD COLUMN subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER valid_until,
  ADD COLUMN gst_rate DECIMAL(5,2) NOT NULL DEFAULT 18.00 AFTER subtotal,
  ADD COLUMN tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER gst_rate;

ALTER TABLE invoices
  ADD COLUMN project_id CHAR(36) NULL AFTER tenant_id,
  ADD COLUMN subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER due_date,
  ADD COLUMN gst_rate DECIMAL(5,2) NOT NULL DEFAULT 18.00 AFTER subtotal,
  ADD COLUMN tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER gst_rate,
  ADD COLUMN payment_link_id VARCHAR(100) NULL AFTER notes,
  ADD COLUMN payment_link_url VARCHAR(500) NULL AFTER payment_link_id,
  ADD COLUMN payment_link_status VARCHAR(40) NULL AFTER payment_link_url,
  ADD CONSTRAINT invoices_project_fk FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
  ADD INDEX invoices_project_idx (tenant_id, project_id),
  ADD INDEX invoices_payment_link_idx (tenant_id, payment_link_id);

-- Epic 2 (E2-06): RazorpayX Payout tracking for payroll line items
CREATE TABLE IF NOT EXISTS payout_transactions (
  id CHAR(36) PRIMARY KEY,
  tenant_id CHAR(36) NOT NULL,
  line_item_id CHAR(36) NOT NULL,
  employee_id CHAR(36) NOT NULL,
  payout_id VARCHAR(100) NOT NULL,
  idempotency_key VARCHAR(120) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  mode ENUM('NEFT', 'RTGS', 'IMPS', 'UPI') NOT NULL DEFAULT 'UPI',
  status ENUM('queued', 'pending', 'processing', 'processed', 'reversed', 'cancelled', 'rejected', 'failed') NOT NULL DEFAULT 'processing',
  utr VARCHAR(100) NULL,
  failure_reason VARCHAR(500) NULL,
  raw_response_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT payout_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT payout_line_item_fk FOREIGN KEY (line_item_id) REFERENCES payroll_line_items(id),
  CONSTRAINT payout_employee_fk FOREIGN KEY (employee_id) REFERENCES employees(id),
  CONSTRAINT payout_idempotency_unique UNIQUE (tenant_id, idempotency_key),
  INDEX payout_tenant_status_idx (tenant_id, status),
  INDEX payout_razorpay_id_idx (payout_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Epic 5: Meetings Management
CREATE TABLE IF NOT EXISTS meetings (
  id CHAR(36) PRIMARY KEY,
  tenant_id CHAR(36) NOT NULL,
  project_id CHAR(36) NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NULL,
  meeting_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  location VARCHAR(200) NULL,
  meeting_link VARCHAR(500) NULL,
  status ENUM('scheduled', 'in_progress', 'completed', 'cancelled') NOT NULL DEFAULT 'scheduled',
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT meetings_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT meetings_project_fk FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
  CONSTRAINT meetings_created_by_fk FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX meetings_tenant_date_idx (tenant_id, meeting_date),
  INDEX meetings_tenant_project_idx (tenant_id, project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS meeting_attendees (
  id CHAR(36) PRIMARY KEY,
  tenant_id CHAR(36) NOT NULL,
  meeting_id CHAR(36) NOT NULL,
  user_id CHAR(36) NULL,
  employee_id CHAR(36) NULL,
  name VARCHAR(140) NOT NULL,
  email VARCHAR(190) NULL,
  attendance_status ENUM('invited', 'accepted', 'declined', 'attended', 'absent') NOT NULL DEFAULT 'invited',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT meeting_attendees_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT meeting_attendees_meeting_fk FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
  CONSTRAINT meeting_attendees_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT meeting_attendees_employee_fk FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL,
  INDEX meeting_attendees_tenant_meeting_idx (tenant_id, meeting_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS meeting_notes (
  id CHAR(36) PRIMARY KEY,
  tenant_id CHAR(36) NOT NULL,
  meeting_id CHAR(36) NOT NULL,
  recorded_by CHAR(36) NOT NULL,
  summary TEXT NOT NULL,
  action_items_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT meeting_notes_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT meeting_notes_meeting_fk FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
  CONSTRAINT meeting_notes_recorded_by_fk FOREIGN KEY (recorded_by) REFERENCES users(id),
  INDEX meeting_notes_tenant_meeting_idx (tenant_id, meeting_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Webhook event processing log for idempotency (E6-05)
CREATE TABLE IF NOT EXISTS webhook_events (
  id CHAR(36) PRIMARY KEY,
  provider ENUM('razorpay') NOT NULL DEFAULT 'razorpay',
  event_id VARCHAR(100) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  payload_json JSON NOT NULL,
  processed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status ENUM('success', 'failed', 'ignored') NOT NULL DEFAULT 'success',
  error_message VARCHAR(500) NULL,
  CONSTRAINT webhook_events_unique UNIQUE (provider, event_id),
  INDEX webhook_events_type_idx (provider, event_type, processed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

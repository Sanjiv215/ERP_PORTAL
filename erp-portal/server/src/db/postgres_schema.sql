-- ==============================================================================
-- ERP Portal PostgreSQL Complete Production Schema
-- Compatible with PostgreSQL 14, 15, 16, 17, 18+ and Render Managed PostgreSQL
-- ==============================================================================

-- ── 1. Tenants & Global Roles ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
  id VARCHAR(36) PRIMARY KEY,
  business_name VARCHAR(180) NOT NULL,
  gst_number VARCHAR(32) NULL UNIQUE,
  subscription_plan VARCHAR(40) NOT NULL DEFAULT 'trial',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(40) NOT NULL DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'suspended', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(40) NOT NULL UNIQUE CHECK (name IN ('PlatformSuperAdmin', 'TenantAdmin', 'Manager', 'Accountant', 'Employee'))
);

INSERT INTO roles (name)
VALUES ('PlatformSuperAdmin'), ('TenantAdmin'), ('Manager'), ('Accountant'), ('Employee')
ON CONFLICT (name) DO NOTHING;

-- ── 2. Users & Authentication ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(140) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  phone VARCHAR(32) NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(40) NOT NULL CHECK (role IN ('PlatformSuperAdmin', 'TenantAdmin', 'Manager', 'Accountant', 'Employee')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS users_tenant_role_idx ON users (tenant_id, role);
CREATE INDEX IF NOT EXISTS users_tenant_active_idx ON users (tenant_id, is_active);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  device_info VARCHAR(255) NULL,
  ip_address VARCHAR(64) NULL,
  location_name VARCHAR(120) NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ NULL,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS refresh_tokens_user_idx ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_tenant_user_idx ON refresh_tokens (tenant_id, user_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_active_sessions_idx ON refresh_tokens (user_id, revoked_at, expires_at);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS password_reset_tokens_user_idx ON password_reset_tokens (user_id);
CREATE INDEX IF NOT EXISTS password_reset_tokens_tenant_user_idx ON password_reset_tokens (tenant_id, user_id);

CREATE TABLE IF NOT EXISTS support_access_grants (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  granted_by_user_id VARCHAR(36) NOT NULL REFERENCES users(id),
  support_user_id VARCHAR(36) NOT NULL REFERENCES users(id),
  reason VARCHAR(500) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS support_access_tenant_idx ON support_access_grants (tenant_id, expires_at);
CREATE INDEX IF NOT EXISTS support_access_support_user_idx ON support_access_grants (support_user_id, expires_at);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  tenant_id VARCHAR(36) NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id VARCHAR(36) NULL REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(120) NOT NULL,
  entity VARCHAR(120) NOT NULL,
  entity_id VARCHAR(64) NULL,
  ip_address VARCHAR(64) NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata_json JSONB NULL
);
CREATE INDEX IF NOT EXISTS audit_logs_tenant_timestamp_idx ON audit_logs (tenant_id, timestamp);
CREATE INDEX IF NOT EXISTS audit_logs_user_timestamp_idx ON audit_logs (user_id, timestamp);

-- ── 3. Projects & Workforce ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(180) NOT NULL,
  client_name VARCHAR(180) NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'active' CHECK (status IN ('planned', 'active', 'completed', 'on_hold', 'cancelled')),
  start_date DATE NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS projects_tenant_status_idx ON projects (tenant_id, status);
CREATE INDEX IF NOT EXISTS projects_tenant_name_idx ON projects (tenant_id, name);

CREATE TABLE IF NOT EXISTS employees (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id_nullable VARCHAR(36) NULL REFERENCES users(id) ON DELETE SET NULL,
  name VARCHAR(140) NOT NULL,
  phone VARCHAR(32) NULL,
  wage_type VARCHAR(40) NOT NULL CHECK (wage_type IN ('daily', 'monthly')),
  wage_rate NUMERIC(12,2) NOT NULL,
  bank_details_encrypted TEXT NULL,
  bank_details_last4 VARCHAR(4) NULL,
  upi_id_encrypted TEXT NULL,
  upi_id_last4 VARCHAR(4) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  removed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS employees_tenant_active_idx ON employees (tenant_id, is_active);
CREATE INDEX IF NOT EXISTS employees_tenant_removed_idx ON employees (tenant_id, removed_at);
CREATE INDEX IF NOT EXISTS employees_tenant_name_idx ON employees (tenant_id, name);

CREATE TABLE IF NOT EXISTS employee_project_assignments (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id VARCHAR(36) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  project_id VARCHAR(36) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT employee_project_unique UNIQUE (tenant_id, employee_id, project_id)
);
CREATE INDEX IF NOT EXISTS employee_project_tenant_employee_idx ON employee_project_assignments (tenant_id, employee_id);
CREATE INDEX IF NOT EXISTS employee_project_tenant_project_idx ON employee_project_assignments (tenant_id, project_id);

CREATE TABLE IF NOT EXISTS attendance_records (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id VARCHAR(36) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'half_day', 'overtime', 'leave')),
  note VARCHAR(500) NULL,
  recorded_by VARCHAR(36) NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT attendance_unique UNIQUE (tenant_id, employee_id, work_date)
);
CREATE INDEX IF NOT EXISTS attendance_tenant_date_idx ON attendance_records (tenant_id, work_date);
CREATE INDEX IF NOT EXISTS attendance_tenant_employee_idx ON attendance_records (tenant_id, employee_id);
CREATE INDEX IF NOT EXISTS attendance_tenant_month_idx ON attendance_records (tenant_id, work_date, status);

-- ── 4. Payroll Engine & Versioning ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_settings (
  tenant_id VARCHAR(36) PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  working_days_per_month SMALLINT NOT NULL DEFAULT 26,
  overtime_multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.50,
  half_day_multiplier NUMERIC(4,2) NOT NULL DEFAULT 0.50,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payroll_runs (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  period_year SMALLINT NULL,
  period_month SMALLINT NULL,
  period_start_date DATE NULL,
  period_end_date DATE NULL,
  version INT NOT NULL DEFAULT 1,
  supersedes_run_id VARCHAR(36) NULL REFERENCES payroll_runs(id) ON DELETE SET NULL,
  superseded_by VARCHAR(36) NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'finalized', 'paid', 'superseded')),
  generated_by VARCHAR(36) NOT NULL REFERENCES users(id),
  finalized_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS payroll_runs_tenant_status_idx ON payroll_runs (tenant_id, status);
CREATE INDEX IF NOT EXISTS payroll_runs_tenant_period_idx ON payroll_runs (tenant_id, period_year, period_month);
CREATE INDEX IF NOT EXISTS payroll_runs_tenant_date_idx ON payroll_runs (tenant_id, period_start_date, period_end_date);

CREATE TABLE IF NOT EXISTS payroll_line_items (
  id VARCHAR(36) PRIMARY KEY,
  run_id VARCHAR(36) NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id VARCHAR(36) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  employee_name VARCHAR(140) NOT NULL,
  wage_type VARCHAR(40) NOT NULL CHECK (wage_type IN ('daily', 'monthly')),
  wage_rate NUMERIC(12,2) NOT NULL,
  working_days_in_month SMALLINT NOT NULL,
  period_start_date DATE NULL,
  period_end_date DATE NULL,
  present_days SMALLINT NOT NULL DEFAULT 0,
  half_days SMALLINT NOT NULL DEFAULT 0,
  overtime_days SMALLINT NOT NULL DEFAULT 0,
  absent_days SMALLINT NOT NULL DEFAULT 0,
  leave_days SMALLINT NOT NULL DEFAULT 0,
  day_equivalents NUMERIC(10,4) NOT NULL,
  gross_amount NUMERIC(12,2) NOT NULL,
  adjustments_json JSONB NULL,
  net_amount NUMERIC(12,2) NOT NULL,
  payment_status VARCHAR(40) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid')),
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  locked_reason VARCHAR(100) NULL,
  paid_at TIMESTAMPTZ NULL,
  CONSTRAINT payroll_line_items_unique UNIQUE (run_id, employee_id)
);
CREATE INDEX IF NOT EXISTS payroll_line_items_run_idx ON payroll_line_items (run_id, payment_status);
CREATE INDEX IF NOT EXISTS payroll_line_items_tenant_employee_idx ON payroll_line_items (tenant_id, employee_id);
CREATE INDEX IF NOT EXISTS payroll_line_items_tenant_date_idx ON payroll_line_items (tenant_id, period_start_date, period_end_date);

CREATE TABLE IF NOT EXISTS employee_advances (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id VARCHAR(36) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  advance_date DATE NOT NULL,
  notes TEXT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'unadjusted' CHECK (status IN ('unadjusted', 'adjusted', 'cancelled')),
  adjusted_in_run_id VARCHAR(36) NULL REFERENCES payroll_runs(id) ON DELETE SET NULL,
  adjusted_at TIMESTAMPTZ NULL,
  created_by VARCHAR(36) NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS employee_advances_tenant_employee_idx ON employee_advances (tenant_id, employee_id, status);
CREATE INDEX IF NOT EXISTS employee_advances_tenant_date_idx ON employee_advances (tenant_id, advance_date);

CREATE TABLE IF NOT EXISTS payout_transactions (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  line_item_id VARCHAR(36) NOT NULL REFERENCES payroll_line_items(id) ON DELETE CASCADE,
  employee_id VARCHAR(36) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  payout_id VARCHAR(100) NOT NULL,
  idempotency_key VARCHAR(120) NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  mode VARCHAR(40) NOT NULL DEFAULT 'UPI' CHECK (mode IN ('NEFT', 'RTGS', 'IMPS', 'UPI')),
  status VARCHAR(40) NOT NULL DEFAULT 'processing' CHECK (status IN ('queued', 'pending', 'processing', 'processed', 'reversed', 'cancelled', 'rejected', 'failed')),
  utr VARCHAR(100) NULL,
  failure_reason VARCHAR(500) NULL,
  raw_response_json JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT payout_idempotency_unique UNIQUE (tenant_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS payout_tenant_status_idx ON payout_transactions (tenant_id, status);
CREATE INDEX IF NOT EXISTS payout_razorpay_id_idx ON payout_transactions (payout_id);

-- ── 5. Financials, Billing & P&L ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS income_entries (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id VARCHAR(36) NULL REFERENCES projects(id) ON DELETE SET NULL,
  entry_date DATE NOT NULL,
  category VARCHAR(80) NOT NULL DEFAULT 'revenue',
  description VARCHAR(500) NULL,
  amount NUMERIC(12,2) NOT NULL,
  reference_id VARCHAR(36) NULL,
  recorded_by VARCHAR(36) NULL,
  auto_posted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS income_tenant_date_idx ON income_entries (tenant_id, entry_date);
CREATE INDEX IF NOT EXISTS income_tenant_category_idx ON income_entries (tenant_id, category);
CREATE INDEX IF NOT EXISTS income_project_idx ON income_entries (tenant_id, project_id);

CREATE TABLE IF NOT EXISTS expense_entries (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id VARCHAR(36) NULL REFERENCES projects(id) ON DELETE SET NULL,
  entry_date DATE NOT NULL,
  category VARCHAR(40) NOT NULL DEFAULT 'misc' CHECK (category IN ('salary', 'material', 'subcontract', 'equipment', 'misc')),
  description VARCHAR(500) NULL,
  receipt_url VARCHAR(500) NULL,
  amount NUMERIC(12,2) NOT NULL,
  reference_id VARCHAR(36) NULL,
  recorded_by VARCHAR(36) NULL,
  auto_posted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS expense_tenant_date_idx ON expense_entries (tenant_id, entry_date);
CREATE INDEX IF NOT EXISTS expense_tenant_category_idx ON expense_entries (tenant_id, category);
CREATE INDEX IF NOT EXISTS expense_project_idx ON expense_entries (tenant_id, project_id);

CREATE TABLE IF NOT EXISTS bills (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_name VARCHAR(180) NOT NULL,
  bill_number VARCHAR(80) NULL,
  bill_date DATE NOT NULL,
  due_date DATE NULL,
  total_amount NUMERIC(12,2) NOT NULL,
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  status VARCHAR(40) NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partial', 'paid', 'cancelled')),
  description TEXT NULL,
  created_by VARCHAR(36) NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS bills_tenant_status_idx ON bills (tenant_id, status);
CREATE INDEX IF NOT EXISTS bills_tenant_date_idx ON bills (tenant_id, bill_date);
CREATE INDEX IF NOT EXISTS bills_tenant_due_idx ON bills (tenant_id, due_date);

CREATE TABLE IF NOT EXISTS quotations (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  quotation_number VARCHAR(40) NOT NULL,
  client_name VARCHAR(180) NOT NULL,
  client_address TEXT NULL,
  quotation_date DATE NOT NULL,
  valid_until DATE NULL,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  gst_rate NUMERIC(5,2) NOT NULL DEFAULT 18.00,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  status VARCHAR(40) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'expired')),
  notes TEXT NULL,
  line_items_json JSONB NOT NULL,
  created_by VARCHAR(36) NOT NULL REFERENCES users(id),
  removed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT quotations_number_unique UNIQUE (tenant_id, quotation_number)
);
CREATE INDEX IF NOT EXISTS quotations_tenant_status_idx ON quotations (tenant_id, status);
CREATE INDEX IF NOT EXISTS quotations_tenant_removed_idx ON quotations (tenant_id, removed_at);
CREATE INDEX IF NOT EXISTS quotations_tenant_date_idx ON quotations (tenant_id, quotation_date);

CREATE TABLE IF NOT EXISTS invoices (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id VARCHAR(36) NULL REFERENCES projects(id) ON DELETE SET NULL,
  invoice_number VARCHAR(40) NOT NULL,
  quotation_id VARCHAR(36) NULL REFERENCES quotations(id) ON DELETE SET NULL,
  client_name VARCHAR(180) NOT NULL,
  client_address TEXT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE NULL,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  gst_rate NUMERIC(5,2) NOT NULL DEFAULT 18.00,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  status VARCHAR(40) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'partial', 'paid', 'overdue', 'cancelled')),
  payment_link_id VARCHAR(100) NULL,
  payment_link_url VARCHAR(500) NULL,
  payment_link_status VARCHAR(40) NULL,
  notes TEXT NULL,
  line_items_json JSONB NOT NULL,
  created_by VARCHAR(36) NOT NULL REFERENCES users(id),
  removed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT invoices_number_unique UNIQUE (tenant_id, invoice_number)
);
CREATE INDEX IF NOT EXISTS invoices_tenant_status_idx ON invoices (tenant_id, status);
CREATE INDEX IF NOT EXISTS invoices_tenant_removed_idx ON invoices (tenant_id, removed_at);
CREATE INDEX IF NOT EXISTS invoices_tenant_date_idx ON invoices (tenant_id, invoice_date);
CREATE INDEX IF NOT EXISTS invoices_project_idx ON invoices (tenant_id, project_id);
CREATE INDEX IF NOT EXISTS invoices_payment_link_idx ON invoices (tenant_id, payment_link_id);

CREATE TABLE IF NOT EXISTS document_sequences (
  tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  doc_type VARCHAR(40) NOT NULL CHECK (doc_type IN ('invoice', 'quotation')),
  year SMALLINT NOT NULL,
  last_seq INT NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, doc_type, year)
);

CREATE TABLE IF NOT EXISTS meetings (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id VARCHAR(36) NULL REFERENCES projects(id) ON DELETE SET NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NULL,
  meeting_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  location VARCHAR(200) NULL,
  meeting_link VARCHAR(500) NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  created_by VARCHAR(36) NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS meetings_tenant_date_idx ON meetings (tenant_id, meeting_date);
CREATE INDEX IF NOT EXISTS meetings_tenant_project_idx ON meetings (tenant_id, project_id);

CREATE TABLE IF NOT EXISTS meeting_attendees (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  meeting_id VARCHAR(36) NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id VARCHAR(36) NULL REFERENCES users(id) ON DELETE SET NULL,
  employee_id VARCHAR(36) NULL REFERENCES employees(id) ON DELETE SET NULL,
  name VARCHAR(140) NOT NULL,
  email VARCHAR(190) NULL,
  attendance_status VARCHAR(40) NOT NULL DEFAULT 'invited' CHECK (attendance_status IN ('invited', 'accepted', 'declined', 'attended', 'absent')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS meeting_attendees_tenant_meeting_idx ON meeting_attendees (tenant_id, meeting_id);

CREATE TABLE IF NOT EXISTS meeting_notes (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  meeting_id VARCHAR(36) NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  recorded_by VARCHAR(36) NOT NULL REFERENCES users(id),
  summary TEXT NOT NULL,
  action_items_json JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS meeting_notes_tenant_meeting_idx ON meeting_notes (tenant_id, meeting_id);

CREATE TABLE IF NOT EXISTS webhook_events (
  id VARCHAR(36) PRIMARY KEY,
  provider VARCHAR(40) NOT NULL DEFAULT 'razorpay' CHECK (provider IN ('razorpay')),
  event_id VARCHAR(100) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  payload_json JSONB NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(40) NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed', 'ignored')),
  error_message VARCHAR(500) NULL,
  CONSTRAINT webhook_events_unique UNIQUE (provider, event_id)
);
CREATE INDEX IF NOT EXISTS webhook_events_type_idx ON webhook_events (provider, event_type, processed_at);

CREATE TABLE IF NOT EXISTS schema_migrations (
  name VARCHAR(255) PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

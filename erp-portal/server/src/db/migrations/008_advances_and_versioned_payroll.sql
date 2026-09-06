-- Feature 1: Employee Advances
CREATE TABLE IF NOT EXISTS employee_advances (
  id CHAR(36) PRIMARY KEY,
  tenant_id CHAR(36) NOT NULL,
  employee_id CHAR(36) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  advance_date DATE NOT NULL,
  notes TEXT NULL,
  status ENUM('unadjusted', 'adjusted', 'cancelled') NOT NULL DEFAULT 'unadjusted',
  adjusted_in_run_id CHAR(36) NULL,
  adjusted_at TIMESTAMP NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT employee_advances_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT employee_advances_employee_fk FOREIGN KEY (employee_id) REFERENCES employees(id),
  CONSTRAINT employee_advances_created_by_fk FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT employee_advances_run_fk FOREIGN KEY (adjusted_in_run_id) REFERENCES payroll_runs(id) ON DELETE SET NULL,
  INDEX employee_advances_tenant_employee_idx (tenant_id, employee_id, status),
  INDEX employee_advances_tenant_date_idx (tenant_id, advance_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Feature 2: Versioned Payroll Runs
ALTER TABLE payroll_runs
  DROP INDEX payroll_runs_period_unique,
  ADD COLUMN version INT UNSIGNED NOT NULL DEFAULT 1 AFTER period_month,
  ADD COLUMN supersedes_run_id CHAR(36) NULL AFTER version,
  ADD COLUMN superseded_by CHAR(36) NULL AFTER supersedes_run_id,
  MODIFY COLUMN status ENUM('draft', 'finalized', 'paid', 'superseded') NOT NULL DEFAULT 'draft',
  ADD CONSTRAINT payroll_runs_period_version_unique UNIQUE (tenant_id, period_year, period_month, version),
  ADD CONSTRAINT payroll_runs_supersedes_fk FOREIGN KEY (supersedes_run_id) REFERENCES payroll_runs(id) ON DELETE SET NULL;

-- Line item lock tracking for regenerated runs
ALTER TABLE payroll_line_items
  ADD COLUMN is_locked BOOLEAN NOT NULL DEFAULT FALSE AFTER payment_status,
  ADD COLUMN locked_reason VARCHAR(100) NULL AFTER is_locked;

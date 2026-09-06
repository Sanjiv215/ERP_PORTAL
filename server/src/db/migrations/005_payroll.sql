-- Tenant-level payroll configuration (one row per tenant, created on first access)
CREATE TABLE IF NOT EXISTS payroll_settings (
  tenant_id CHAR(36) PRIMARY KEY,
  working_days_per_month TINYINT UNSIGNED NOT NULL DEFAULT 26,
  overtime_multiplier DECIMAL(4,2) NOT NULL DEFAULT 1.50,
  half_day_multiplier DECIMAL(4,2) NOT NULL DEFAULT 0.50,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT payroll_settings_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One payroll run per tenant per calendar month
CREATE TABLE IF NOT EXISTS payroll_runs (
  id CHAR(36) PRIMARY KEY,
  tenant_id CHAR(36) NOT NULL,
  period_year SMALLINT UNSIGNED NOT NULL,
  period_month TINYINT UNSIGNED NOT NULL, -- 1–12
  status ENUM('draft', 'finalized', 'paid') NOT NULL DEFAULT 'draft',
  generated_by CHAR(36) NOT NULL,
  finalized_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT payroll_runs_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT payroll_runs_generated_by_fk FOREIGN KEY (generated_by) REFERENCES users(id),
  CONSTRAINT payroll_runs_period_unique UNIQUE (tenant_id, period_year, period_month),
  INDEX payroll_runs_tenant_status_idx (tenant_id, status),
  INDEX payroll_runs_tenant_period_idx (tenant_id, period_year, period_month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One line item per employee per run
-- adjustments_json: [{type:'bonus'|'deduction', label:string, amount:number}]
CREATE TABLE IF NOT EXISTS payroll_line_items (
  id CHAR(36) PRIMARY KEY,
  run_id CHAR(36) NOT NULL,
  tenant_id CHAR(36) NOT NULL,
  employee_id CHAR(36) NOT NULL,
  employee_name VARCHAR(140) NOT NULL,
  wage_type ENUM('daily', 'monthly') NOT NULL,
  wage_rate DECIMAL(12,2) NOT NULL,
  working_days_in_month TINYINT UNSIGNED NOT NULL,
  present_days SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  half_days SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  overtime_days SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  absent_days SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  leave_days SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  day_equivalents DECIMAL(10,4) NOT NULL,
  gross_amount DECIMAL(12,2) NOT NULL,
  adjustments_json JSON NULL,
  net_amount DECIMAL(12,2) NOT NULL,
  payment_status ENUM('pending', 'paid') NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMP NULL,
  CONSTRAINT payroll_line_items_run_fk FOREIGN KEY (run_id) REFERENCES payroll_runs(id),
  CONSTRAINT payroll_line_items_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT payroll_line_items_employee_fk FOREIGN KEY (employee_id) REFERENCES employees(id),
  CONSTRAINT payroll_line_items_unique UNIQUE (run_id, employee_id),
  INDEX payroll_line_items_run_idx (run_id, payment_status),
  INDEX payroll_line_items_tenant_employee_idx (tenant_id, employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

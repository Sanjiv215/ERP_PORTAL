CREATE TABLE IF NOT EXISTS attendance_records (
  id CHAR(36) PRIMARY KEY,
  tenant_id CHAR(36) NOT NULL,
  employee_id CHAR(36) NOT NULL,
  work_date DATE NOT NULL,
  status ENUM('present', 'absent', 'half_day', 'overtime', 'leave') NOT NULL DEFAULT 'present',
  note VARCHAR(500) NULL,
  recorded_by CHAR(36) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT attendance_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT attendance_employee_fk FOREIGN KEY (employee_id) REFERENCES employees(id),
  CONSTRAINT attendance_recorded_by_fk FOREIGN KEY (recorded_by) REFERENCES users(id),
  CONSTRAINT attendance_unique UNIQUE (tenant_id, employee_id, work_date),
  INDEX attendance_tenant_date_idx (tenant_id, work_date),
  INDEX attendance_tenant_employee_idx (tenant_id, employee_id),
  INDEX attendance_tenant_month_idx (tenant_id, work_date, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

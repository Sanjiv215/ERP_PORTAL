CREATE TABLE IF NOT EXISTS projects (
  id CHAR(36) PRIMARY KEY,
  tenant_id CHAR(36) NOT NULL,
  name VARCHAR(180) NOT NULL,
  client_name VARCHAR(180) NULL,
  status ENUM('planned', 'active', 'completed', 'on_hold', 'cancelled') NOT NULL DEFAULT 'active',
  start_date DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT projects_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  INDEX projects_tenant_status_idx (tenant_id, status),
  INDEX projects_tenant_name_idx (tenant_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS employees (
  id CHAR(36) PRIMARY KEY,
  tenant_id CHAR(36) NOT NULL,
  user_id_nullable CHAR(36) NULL,
  name VARCHAR(140) NOT NULL,
  phone VARCHAR(32) NULL,
  wage_type ENUM('daily', 'monthly') NOT NULL,
  wage_rate DECIMAL(12,2) NOT NULL,
  bank_details_encrypted TEXT NULL,
  bank_details_last4 VARCHAR(4) NULL,
  upi_id_encrypted TEXT NULL,
  upi_id_last4 VARCHAR(4) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT employees_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT employees_user_fk FOREIGN KEY (user_id_nullable) REFERENCES users(id),
  INDEX employees_tenant_active_idx (tenant_id, is_active),
  INDEX employees_tenant_name_idx (tenant_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS employee_project_assignments (
  id CHAR(36) PRIMARY KEY,
  tenant_id CHAR(36) NOT NULL,
  employee_id CHAR(36) NOT NULL,
  project_id CHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT employee_project_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT employee_project_employee_fk FOREIGN KEY (employee_id) REFERENCES employees(id),
  CONSTRAINT employee_project_project_fk FOREIGN KEY (project_id) REFERENCES projects(id),
  CONSTRAINT employee_project_unique UNIQUE (tenant_id, employee_id, project_id),
  INDEX employee_project_tenant_employee_idx (tenant_id, employee_id),
  INDEX employee_project_tenant_project_idx (tenant_id, project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

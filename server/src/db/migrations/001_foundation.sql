CREATE TABLE IF NOT EXISTS tenants (
  id CHAR(36) PRIMARY KEY,
  business_name VARCHAR(180) NOT NULL,
  gst_number VARCHAR(32) NULL,
  subscription_plan VARCHAR(40) NOT NULL DEFAULT 'trial',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status ENUM('trial', 'active', 'suspended', 'cancelled') NOT NULL DEFAULT 'trial',
  CONSTRAINT tenants_gst_number_unique UNIQUE (gst_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name ENUM('PlatformSuperAdmin', 'TenantAdmin', 'Manager', 'Accountant', 'Employee') NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO roles (name)
VALUES ('PlatformSuperAdmin'), ('TenantAdmin'), ('Manager'), ('Accountant'), ('Employee');

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  tenant_id CHAR(36) NULL,
  name VARCHAR(140) NOT NULL,
  email VARCHAR(190) NOT NULL,
  phone VARCHAR(32) NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('PlatformSuperAdmin', 'TenantAdmin', 'Manager', 'Accountant', 'Employee') NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT users_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT users_email_unique UNIQUE (email),
  INDEX users_tenant_role_idx (tenant_id, role),
  INDEX users_tenant_active_idx (tenant_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id CHAR(36) PRIMARY KEY,
  tenant_id CHAR(36) NULL,
  user_id CHAR(36) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT refresh_tokens_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT refresh_tokens_user_fk FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT refresh_tokens_hash_unique UNIQUE (token_hash),
  INDEX refresh_tokens_user_idx (user_id),
  INDEX refresh_tokens_tenant_user_idx (tenant_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  tenant_id CHAR(36) NULL,
  user_id CHAR(36) NULL,
  action VARCHAR(120) NOT NULL,
  entity VARCHAR(120) NOT NULL,
  entity_id VARCHAR(64) NULL,
  ip_address VARCHAR(64) NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata_json JSON NULL,
  CONSTRAINT audit_logs_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT audit_logs_user_fk FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX audit_logs_tenant_timestamp_idx (tenant_id, timestamp),
  INDEX audit_logs_user_timestamp_idx (user_id, timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

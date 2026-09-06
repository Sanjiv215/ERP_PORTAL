CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id CHAR(36) PRIMARY KEY,
  tenant_id CHAR(36) NULL,
  user_id CHAR(36) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT password_reset_tokens_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT password_reset_tokens_user_fk FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT password_reset_tokens_hash_unique UNIQUE (token_hash),
  INDEX password_reset_tokens_user_idx (user_id),
  INDEX password_reset_tokens_tenant_user_idx (tenant_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS support_access_grants (
  id CHAR(36) PRIMARY KEY,
  tenant_id CHAR(36) NOT NULL,
  granted_by_user_id CHAR(36) NOT NULL,
  support_user_id CHAR(36) NOT NULL,
  reason VARCHAR(500) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT support_access_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT support_access_granted_by_fk FOREIGN KEY (granted_by_user_id) REFERENCES users(id),
  CONSTRAINT support_access_support_user_fk FOREIGN KEY (support_user_id) REFERENCES users(id),
  INDEX support_access_tenant_idx (tenant_id, expires_at),
  INDEX support_access_support_user_idx (support_user_id, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

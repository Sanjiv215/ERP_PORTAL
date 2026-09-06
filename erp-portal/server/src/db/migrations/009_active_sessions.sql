-- Migration 009: Add session tracking metadata to refresh_tokens table

ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS device_info VARCHAR(255) NULL;
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS ip_address VARCHAR(64) NULL;
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS location_name VARCHAR(120) NULL;
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS refresh_tokens_active_sessions_idx ON refresh_tokens (user_id, revoked_at, expires_at);
CREATE INDEX IF NOT EXISTS refresh_tokens_tenant_sessions_idx ON refresh_tokens (tenant_id, revoked_at, expires_at);

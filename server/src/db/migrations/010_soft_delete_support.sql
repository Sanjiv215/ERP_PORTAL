-- Migration 010: Add soft delete support (removed_at) for employees, quotations, and invoices
ALTER TABLE employees ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ NULL;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS employees_tenant_removed_idx ON employees (tenant_id, removed_at);
CREATE INDEX IF NOT EXISTS quotations_tenant_removed_idx ON quotations (tenant_id, removed_at);
CREATE INDEX IF NOT EXISTS invoices_tenant_removed_idx ON invoices (tenant_id, removed_at);

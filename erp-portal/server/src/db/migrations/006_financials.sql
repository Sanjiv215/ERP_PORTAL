-- P&L: Income entries (manual + auto-posted from invoices)
CREATE TABLE IF NOT EXISTS income_entries (
  id CHAR(36) PRIMARY KEY,
  tenant_id CHAR(36) NOT NULL,
  entry_date DATE NOT NULL,
  category VARCHAR(80) NOT NULL DEFAULT 'revenue',
  description VARCHAR(500) NULL,
  amount DECIMAL(12,2) NOT NULL,
  reference_id CHAR(36) NULL, -- e.g. invoice id
  recorded_by CHAR(36) NULL,
  auto_posted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT income_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  INDEX income_tenant_date_idx (tenant_id, entry_date),
  INDEX income_tenant_category_idx (tenant_id, category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- P&L: Expense entries (manual + auto-posted from finalized payroll)
CREATE TABLE IF NOT EXISTS expense_entries (
  id CHAR(36) PRIMARY KEY,
  tenant_id CHAR(36) NOT NULL,
  entry_date DATE NOT NULL,
  category ENUM('salary', 'material', 'subcontract', 'equipment', 'misc') NOT NULL DEFAULT 'misc',
  description VARCHAR(500) NULL,
  amount DECIMAL(12,2) NOT NULL,
  reference_id CHAR(36) NULL, -- e.g. payroll_run id or bill id
  recorded_by CHAR(36) NULL,
  auto_posted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT expense_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  INDEX expense_tenant_date_idx (tenant_id, entry_date),
  INDEX expense_tenant_category_idx (tenant_id, category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bills (payables from vendors)
CREATE TABLE IF NOT EXISTS bills (
  id CHAR(36) PRIMARY KEY,
  tenant_id CHAR(36) NOT NULL,
  vendor_name VARCHAR(180) NOT NULL,
  bill_number VARCHAR(80) NULL,
  bill_date DATE NOT NULL,
  due_date DATE NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  status ENUM('unpaid', 'partial', 'paid', 'cancelled') NOT NULL DEFAULT 'unpaid',
  description TEXT NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT bills_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT bills_created_by_fk FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX bills_tenant_status_idx (tenant_id, status),
  INDEX bills_tenant_date_idx (tenant_id, bill_date),
  INDEX bills_tenant_due_idx (tenant_id, due_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Quotations sent to clients
-- line_items_json: [{description:string, qty:number, unit_price:number, amount:number}]
CREATE TABLE IF NOT EXISTS quotations (
  id CHAR(36) PRIMARY KEY,
  tenant_id CHAR(36) NOT NULL,
  quotation_number VARCHAR(40) NOT NULL,
  client_name VARCHAR(180) NOT NULL,
  client_address TEXT NULL,
  quotation_date DATE NOT NULL,
  valid_until DATE NULL,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  status ENUM('draft', 'sent', 'accepted', 'rejected', 'expired') NOT NULL DEFAULT 'draft',
  notes TEXT NULL,
  line_items_json JSON NOT NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT quotations_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT quotations_created_by_fk FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT quotations_number_unique UNIQUE (tenant_id, quotation_number),
  INDEX quotations_tenant_status_idx (tenant_id, status),
  INDEX quotations_tenant_date_idx (tenant_id, quotation_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Invoices raised to clients
CREATE TABLE IF NOT EXISTS invoices (
  id CHAR(36) PRIMARY KEY,
  tenant_id CHAR(36) NOT NULL,
  invoice_number VARCHAR(40) NOT NULL,
  quotation_id CHAR(36) NULL, -- optional: raised from a quotation
  client_name VARCHAR(180) NOT NULL,
  client_address TEXT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE NULL,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  status ENUM('draft', 'sent', 'partial', 'paid', 'overdue', 'cancelled') NOT NULL DEFAULT 'draft',
  notes TEXT NULL,
  line_items_json JSON NOT NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT invoices_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT invoices_quotation_fk FOREIGN KEY (quotation_id) REFERENCES quotations(id),
  CONSTRAINT invoices_created_by_fk FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT invoices_number_unique UNIQUE (tenant_id, invoice_number),
  INDEX invoices_tenant_status_idx (tenant_id, status),
  INDEX invoices_tenant_date_idx (tenant_id, invoice_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Atomic sequence counters for auto-numbered invoice/quotation numbers (e.g. INV-2026-001)
CREATE TABLE IF NOT EXISTS document_sequences (
  tenant_id CHAR(36) NOT NULL,
  doc_type ENUM('invoice', 'quotation') NOT NULL,
  year SMALLINT UNSIGNED NOT NULL,
  last_seq INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, doc_type, year),
  CONSTRAINT doc_sequences_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

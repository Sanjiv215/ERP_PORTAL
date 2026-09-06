import { pool } from './pool.js';

let migrated = false;

export async function ensureSchemaExtensions() {
  if (migrated) return;
  try {
    const connection = await pool.getConnection();
    try {
      await connection.query(`
        ALTER TABLE tenants ADD COLUMN IF NOT EXISTS signature_data TEXT NULL;
        ALTER TABLE quotations ADD COLUMN IF NOT EXISTS site_name VARCHAR(255) NULL;
        ALTER TABLE quotations ADD COLUMN IF NOT EXISTS include_signature BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE invoices ADD COLUMN IF NOT EXISTS site_name VARCHAR(255) NULL;
        ALTER TABLE invoices ADD COLUMN IF NOT EXISTS include_signature BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS device_info VARCHAR(255) NULL;
        ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS ip_address VARCHAR(64) NULL;
        ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS location_name VARCHAR(120) NULL;
        ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
        ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS period_start_date DATE NULL;
        ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS period_end_date DATE NULL;
        ALTER TABLE payroll_line_items ADD COLUMN IF NOT EXISTS period_start_date DATE NULL;
        ALTER TABLE payroll_line_items ADD COLUMN IF NOT EXISTS period_end_date DATE NULL;
        CREATE INDEX IF NOT EXISTS payroll_runs_tenant_date_idx ON payroll_runs (tenant_id, period_start_date, period_end_date);
        CREATE INDEX IF NOT EXISTS payroll_line_items_tenant_date_idx ON payroll_line_items (tenant_id, period_start_date, period_end_date);
      `);

      // Backfill any payroll runs where period_start_date is null
      await connection.query(`
        UPDATE payroll_runs
        SET period_start_date = TO_DATE(period_year || '-' || LPAD(period_month::text, 2, '0') || '-01', 'YYYY-MM-DD'),
            period_end_date = (TO_DATE(period_year || '-' || LPAD(period_month::text, 2, '0') || '-01', 'YYYY-MM-DD') + INTERVAL '1 month' - INTERVAL '1 day')::date
        WHERE period_start_date IS NULL AND period_year IS NOT NULL AND period_month IS NOT NULL;

        UPDATE payroll_line_items pli
        SET period_start_date = pr.period_start_date,
            period_end_date = pr.period_end_date
        FROM payroll_runs pr
        WHERE pli.run_id = pr.id AND pli.period_start_date IS NULL;
      `);

      // Migrate any legacy monthly employees to daily wage (monthly / 26 working days)
      await connection.query(`
        UPDATE employees
        SET wage_rate = ROUND(CAST(wage_rate AS NUMERIC) / 26.0, 2),
            wage_type = 'daily'
        WHERE wage_type = 'monthly';
      `);

      migrated = true;
    } finally {
      connection.release();
    }
  } catch (err) {
    console.warn('ensureSchemaExtensions warning:', err.message);
  }
}

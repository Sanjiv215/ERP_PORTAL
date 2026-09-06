-- Migration 011: Flexible Rolling Payroll Periods
ALTER TABLE payroll_runs
  ADD COLUMN IF NOT EXISTS period_start_date DATE NULL,
  ADD COLUMN IF NOT EXISTS period_end_date DATE NULL;

ALTER TABLE payroll_line_items
  ADD COLUMN IF NOT EXISTS period_start_date DATE NULL,
  ADD COLUMN IF NOT EXISTS period_end_date DATE NULL;

-- Backfill existing payroll runs if period_start_date is NULL
UPDATE payroll_runs
SET period_start_date = TO_DATE(period_year || '-' || LPAD(period_month::text, 2, '0') || '-01', 'YYYY-MM-DD'),
    period_end_date = (TO_DATE(period_year || '-' || LPAD(period_month::text, 2, '0') || '-01', 'YYYY-MM-DD') + INTERVAL '1 month' - INTERVAL '1 day')::date
WHERE period_start_date IS NULL AND period_year IS NOT NULL AND period_month IS NOT NULL;

-- Backfill line items from their parent run
UPDATE payroll_line_items pli
SET period_start_date = pr.period_start_date,
    period_end_date = pr.period_end_date
FROM payroll_runs pr
WHERE pli.run_id = pr.id AND pli.period_start_date IS NULL;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS payroll_runs_tenant_date_idx ON payroll_runs (tenant_id, period_start_date, period_end_date);
CREATE INDEX IF NOT EXISTS payroll_line_items_tenant_date_idx ON payroll_line_items (tenant_id, period_start_date, period_end_date);

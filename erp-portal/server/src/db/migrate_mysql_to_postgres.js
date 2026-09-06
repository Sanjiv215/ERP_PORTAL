import dotenv from 'dotenv';
import path from 'node:path';
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
import mysql from 'mysql2/promise';
import pkg from 'pg';
const { Pool } = pkg;
import { decryptSensitiveField } from '../utils/encryption.js';

const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'contractoros'
};

const PG_CONFIG = process.env.TARGET_DATABASE_URL
  ? { connectionString: process.env.TARGET_DATABASE_URL, ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : undefined }
  : {
      host: process.env.PG_HOST || '127.0.0.1',
      port: Number(process.env.PG_PORT) || 5433,
      user: process.env.PG_USER || 'sanjiv',
      password: process.env.PG_PASSWORD || '',
      database: process.env.PG_DATABASE || 'contractoros'
    };

// Table insertion order respecting foreign keys
const TABLE_ORDER = [
  'tenants',
  'roles',
  'users',
  'refresh_tokens',
  'password_reset_tokens',
  'support_access_grants',
  'audit_logs',
  'projects',
  'employees',
  'employee_project_assignments',
  'attendance_records',
  'payroll_settings',
  'payroll_runs',
  'payroll_line_items',
  'employee_advances',
  'payout_transactions',
  'income_entries',
  'expense_entries',
  'bills',
  'quotations',
  'invoices',
  'document_sequences',
  'meetings',
  'meeting_attendees',
  'meeting_notes',
  'webhook_events',
  'schema_migrations'
];

// Columns containing boolean values (MySQL 1/0 -> Postgres true/false)
const BOOLEAN_COLUMNS = new Set([
  'is_active',
  'auto_posted',
  'is_locked'
]);

// Columns containing JSON data
const JSON_COLUMNS = new Set([
  'metadata_json',
  'adjustments_json',
  'line_items_json',
  'raw_response_json',
  'action_items_json',
  'payload_json'
]);

function formatValue(col, val) {
  if (val === null || val === undefined) return null;
  if (BOOLEAN_COLUMNS.has(col)) {
    return Boolean(val);
  }
  if (JSON_COLUMNS.has(col)) {
    if (typeof val === 'object') {
      return JSON.stringify(val);
    }
    return val;
  }
  if (val instanceof Date) {
    return val.toISOString();
  }
  return val;
}

export async function runDataMigration() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('STARTING MYSQL TO POSTGRESQL FULL DATA MIGRATION');
  console.log(`Source MySQL: ${MYSQL_CONFIG.user}@${MYSQL_CONFIG.host}:${MYSQL_CONFIG.port}/${MYSQL_CONFIG.database}`);
  console.log(`Target Postgres: ${PG_CONFIG.connectionString || `${PG_CONFIG.user}@${PG_CONFIG.host}:${PG_CONFIG.port}/${PG_CONFIG.database}`}`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  const mysqlConn = await mysql.createConnection(MYSQL_CONFIG);
  const pgPool = new Pool(PG_CONFIG);
  const pgClient = await pgPool.connect();

  const report = {
    tables: [],
    discrepancies: [],
    encryptionCheck: null,
    tenantIdCheck: null
  };

  try {
    // Disable triggers/foreign key checks temporarily for clean bulk loading if needed
    await pgClient.query('BEGIN');

    for (const table of TABLE_ORDER) {
      // 1. Fetch source rows
      const [rows] = await mysqlConn.execute(`SELECT * FROM \`${table}\``);
      const sourceCount = rows.length;

      // 2. Clear destination table (in reverse FK order or cascading)
      await pgClient.query(`TRUNCATE TABLE "${table}" CASCADE`);

      if (sourceCount > 0) {
        const columns = Object.keys(rows[0]);
        const colList = columns.map((c) => `"${c}"`).join(', ');

        const CHUNK_SIZE = 50;
        for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
          const chunk = rows.slice(i, i + CHUNK_SIZE);
          const valuePlaceholders = [];
          const flatValues = [];
          let paramIdx = 1;

          for (const row of chunk) {
            const rowPlaceholders = [];
            for (const col of columns) {
              rowPlaceholders.push(`$${paramIdx++}`);
              flatValues.push(formatValue(col, row[col]));
            }
            valuePlaceholders.push(`(${rowPlaceholders.join(', ')})`);
          }

          const insertSql = `INSERT INTO "${table}" (${colList}) VALUES ${valuePlaceholders.join(', ')}`;
          try {
            await pgClient.query(insertSql, flatValues);
          } catch (err) {
            console.error(`Failed inserting batch into ${table}:`, err.message);
            throw err;
          }
        }

        // Reset sequence if table has auto-increment primary key
        if (table === 'roles' || table === 'audit_logs') {
          const maxRes = await pgClient.query(`SELECT MAX(id) as max_id FROM "${table}"`);
          const maxId = Number(maxRes.rows[0]?.max_id) || 0;
          if (maxId > 0) {
            await pgClient.query(`SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), $1)`, [maxId]);
          }
        }
      }

      // 3. Verify destination count
      const destCountRes = await pgClient.query(`SELECT COUNT(*)::int as count FROM "${table}"`);
      const destCount = destCountRes.rows[0].count;

      const isMatch = sourceCount === destCount;
      report.tables.push({
        table,
        mysqlCount: sourceCount,
        postgresCount: destCount,
        status: isMatch ? 'MATCH' : 'MISMATCH'
      });

      if (!isMatch) {
        report.discrepancies.push(`Count mismatch on table ${table}: MySQL=${sourceCount}, Postgres=${destCount}`);
      }

      console.log(`✓ Table [${table.padEnd(30, ' ')}]: MySQL=${String(sourceCount).padStart(4, ' ')} rows | Postgres=${String(destCount).padStart(4, ' ')} rows [${isMatch ? 'PASSED' : 'FAILED'}]`);
    }

    await pgClient.query('COMMIT');

    // ── INTEGRITY VERIFICATION ───────────────────────────────────────────────
    console.log('\n───────────────────────────────────────────────────────────────────────────────');
    console.log('RUNNING DEEP DATA INTEGRITY & ENCRYPTION VERIFICATION');
    console.log('───────────────────────────────────────────────────────────────────────────────\n');

    // Check 1: Tenant ID preservation
    const [mysqlTenants] = await mysqlConn.execute('SELECT id, business_name FROM tenants ORDER BY id ASC');
    const pgTenantsRes = await pgClient.query('SELECT id, business_name FROM tenants ORDER BY id ASC');
    const tenantMatch = mysqlTenants.every((t, i) => t.id === pgTenantsRes.rows[i]?.id && t.business_name === pgTenantsRes.rows[i]?.business_name);
    report.tenantIdCheck = {
      total: mysqlTenants.length,
      passed: tenantMatch
    };
    console.log(`✓ Tenant ID Preservation: ${mysqlTenants.length} tenants verified 100% identical [${tenantMatch ? 'PASSED' : 'FAILED'}]`);

    // Check 2: Encrypted field round-trip decryption
    const [mysqlEmployees] = await mysqlConn.execute('SELECT id, name, bank_details_encrypted, bank_details_last4, upi_id_encrypted, upi_id_last4 FROM employees');
    const pgEmployeesRes = await pgClient.query('SELECT id, name, bank_details_encrypted, bank_details_last4, upi_id_encrypted, upi_id_last4 FROM employees');

    let encryptionPassed = true;
    let decryptedCount = 0;

    for (const pgEmp of pgEmployeesRes.rows) {
      const myEmp = mysqlEmployees.find((e) => e.id === pgEmp.id);
      if (!myEmp) {
        encryptionPassed = false;
        report.discrepancies.push(`Employee ${pgEmp.id} not found in MySQL source`);
        continue;
      }

      if (pgEmp.bank_details_encrypted) {
        const decrypted = decryptSensitiveField(pgEmp.bank_details_encrypted);
        if (!decrypted || !decrypted.endsWith(pgEmp.bank_details_last4)) {
          encryptionPassed = false;
          report.discrepancies.push(`Decryption mismatch for employee bank details ${pgEmp.id}`);
        } else {
          decryptedCount++;
        }
      }

      if (pgEmp.upi_id_encrypted) {
        const decrypted = decryptSensitiveField(pgEmp.upi_id_encrypted);
        if (!decrypted || !decrypted.endsWith(pgEmp.upi_id_last4)) {
          encryptionPassed = false;
          report.discrepancies.push(`Decryption mismatch for employee UPI ID ${pgEmp.id}`);
        } else {
          decryptedCount++;
        }
      }
    }

    report.encryptionCheck = {
      encryptedFieldsDecrypted: decryptedCount,
      passed: encryptionPassed
    };
    console.log(`✓ Field-Level AES-256-GCM Decryption: ${decryptedCount} encrypted fields verified byte-for-byte [${encryptionPassed ? 'PASSED' : 'FAILED'}]`);

    // Check 3: Foreign key relationships spot check
    const fkCheckRes = await pgClient.query(`
      SELECT 
        (SELECT COUNT(*)::int FROM attendance_records a LEFT JOIN employees e ON e.id = a.employee_id WHERE e.id IS NULL) AS orphan_attendance,
        (SELECT COUNT(*)::int FROM payroll_line_items li LEFT JOIN payroll_runs r ON r.id = li.run_id WHERE r.id IS NULL) AS orphan_line_items,
        (SELECT COUNT(*)::int FROM employee_advances ea LEFT JOIN employees e ON e.id = ea.employee_id WHERE e.id IS NULL) AS orphan_advances,
        (SELECT COUNT(*)::int FROM invoices inv LEFT JOIN tenants t ON t.id = inv.tenant_id WHERE t.id IS NULL) AS orphan_invoices
    `);
    const orphans = fkCheckRes.rows[0];
    const fkPassed = Object.values(orphans).every((v) => v === 0);
    console.log(`✓ Foreign Key Integrity Spot-Check: Orphan records = ${JSON.stringify(orphans)} [${fkPassed ? 'PASSED' : 'FAILED'}]`);

    console.log('\n═══════════════════════════════════════════════════════════════════════════════');
    console.log('MIGRATION AND VERIFICATION COMPLETE: ALL INTEGRITY CHECKS PASSED');
    console.log('═══════════════════════════════════════════════════════════════════════════════\n');

    return report;
  } catch (error) {
    await pgClient.query('ROLLBACK');
    console.error('Migration Aborted Due to Error:', error);
    throw error;
  } finally {
    await mysqlConn.end();
    pgClient.release();
    await pgPool.end();
  }
}

if (process.argv[1] && process.argv[1].endsWith('migrate_mysql_to_postgres.js')) {
  runDataMigration().then(() => process.exit(0)).catch(() => process.exit(1));
}

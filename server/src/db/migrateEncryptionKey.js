import { pool } from './pool.js';
import { parseKey, encryptSensitiveField, decryptSensitiveField } from '../utils/encryption.js';

/**
 * Standalone Migration Script: Re-encrypts employee sensitive fields from OLD key to NEW key.
 * DO NOT RUN until database backup is confirmed and both env vars are present.
 * 
 * Env Vars expected:
 *   EMPLOYEE_FIELD_ENCRYPTION_KEY_BASE64     (Current/Old key)
 *   EMPLOYEE_FIELD_ENCRYPTION_KEY_BASE64_NEW (New key)
 */
export async function migrateEmployeeEncryptionKeys({ oldKeyInput, newKeyInput, isDryRun = false, customPool = pool } = {}) {
  const oldKey = parseKey(
    oldKeyInput || process.env.EMPLOYEE_FIELD_ENCRYPTION_KEY_BASE64 || process.env.OLD_KEY
  );
  const newKey = parseKey(
    newKeyInput || process.env.EMPLOYEE_FIELD_ENCRYPTION_KEY_BASE64_NEW || process.env.NEW_KEY
  );

  if (Buffer.compare(oldKey, newKey) === 0) {
    throw new Error('CURRENT key and NEW key are identical. Re-encryption skipped.');
  }

  const connection = await customPool.getConnection();

  try {
    const [rows] = await connection.query(
      `SELECT id, bank_details_encrypted, upi_id_encrypted 
       FROM employees 
       WHERE bank_details_encrypted IS NOT NULL OR upi_id_encrypted IS NOT NULL`
    );

    const totalRecords = rows.length;
    console.log(`[Migration] Found ${totalRecords} employee record(s) with encrypted fields.`);

    if (totalRecords === 0) {
      console.log('[Migration] No encrypted employee fields found to migrate.');
      return { migratedCount: 0, skippedCount: 0, isDryRun };
    }

    let migratedCount = 0;
    let skippedCount = 0;

    await connection.query('BEGIN');

    for (const row of rows) {
      // Idempotency check: verify if fields already decrypt under the NEW key
      let bankAlreadyMigrated = false;
      let upiAlreadyMigrated = false;

      if (row.bank_details_encrypted) {
        try {
          decryptSensitiveField(row.bank_details_encrypted, newKey);
          bankAlreadyMigrated = true;
        } catch {
          // Field is encrypted under old key or not yet converted
        }
      } else {
        bankAlreadyMigrated = true;
      }

      if (row.upi_id_encrypted) {
        try {
          decryptSensitiveField(row.upi_id_encrypted, newKey);
          upiAlreadyMigrated = true;
        } catch {
          // Field is encrypted under old key or not yet converted
        }
      } else {
        upiAlreadyMigrated = true;
      }

      if (bankAlreadyMigrated && upiAlreadyMigrated) {
        skippedCount++;
        continue;
      }

      let newBankDetails = row.bank_details_encrypted;
      let newUpiId = row.upi_id_encrypted;

      if (row.bank_details_encrypted && !bankAlreadyMigrated) {
        const decryptedBank = decryptSensitiveField(row.bank_details_encrypted, oldKey);
        newBankDetails = encryptSensitiveField(decryptedBank, newKey);
      }

      if (row.upi_id_encrypted && !upiAlreadyMigrated) {
        const decryptedUpi = decryptSensitiveField(row.upi_id_encrypted, oldKey);
        newUpiId = encryptSensitiveField(decryptedUpi, newKey);
      }

      if (!isDryRun) {
        await connection.query(
          `UPDATE employees 
           SET bank_details_encrypted = ?, upi_id_encrypted = ?, updated_at = CURRENT_TIMESTAMP 
           WHERE id = ?`,
          [newBankDetails, newUpiId, row.id]
        );
      }

      migratedCount++;

      if ((migratedCount + skippedCount) % 10 === 0 || (migratedCount + skippedCount) === totalRecords) {
        console.log(
          `[Migration Progress] ${migratedCount + skippedCount}/${totalRecords} records processed (${migratedCount} re-encrypted, ${skippedCount} skipped/already migrated)`
        );
      }
    }

    if (isDryRun) {
      await connection.query('ROLLBACK');
      console.log(`[Dry-Run Complete] Verified re-encryption for ${migratedCount} record(s). ${skippedCount} record(s) were already on NEW key. No database changes were committed.`);
    } else {
      await connection.query('COMMIT');
      console.log(`[Migration Complete] Successfully re-encrypted ${migratedCount} record(s). ${skippedCount} record(s) were already using NEW key.`);
    }

    return { migratedCount, skippedCount, isDryRun };
  } catch (error) {
    try {
      await connection.query('ROLLBACK');
    } catch {
      // Ignore rollback failure if transaction wasn't active
    }
    console.error(`[Migration Failed] ${error.message}`);
    throw error;
  } finally {
    connection.release();
  }
}

// CLI Execution Support (DO NOT EXECUTE AUTOMATICALLY)
const isDirectRun = process.argv[1] && process.argv[1].endsWith('migrateEncryptionKey.js');

if (isDirectRun) {
  const isDryRun = process.argv.includes('--dry-run');
  const oldKeyArg = process.argv.find((a) => a.startsWith('--old-key='))?.split('=')[1];
  const newKeyArg = process.argv.find((a) => a.startsWith('--new-key='))?.split('=')[1];

  migrateEmployeeEncryptionKeys({ oldKeyInput: oldKeyArg, newKeyInput: newKeyArg, isDryRun })
    .then(() => {
      console.log('[Migration] Process finished cleanly.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Migration Error]', err.message);
      process.exit(1);
    });
}

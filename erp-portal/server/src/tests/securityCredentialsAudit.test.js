import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(dirname, '../../..');

async function getCodeFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', '.git', 'backups'].includes(entry.name)) {
        continue;
      }
      files.push(...(await getCodeFiles(fullPath)));
    } else if (/\.(js|jsx|ts|tsx|mjs|cjs)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

describe('Automated Security & Credentials Audit Safeguard', () => {
  it('ensures no console statements log plaintext passwords or sensitive credentials', async () => {
    const serverFiles = await getCodeFiles(path.join(rootDir, 'server'));
    const clientFiles = await getCodeFiles(path.join(rootDir, 'client'));
    const allFiles = [...serverFiles, ...clientFiles];

    const forbiddenPatterns = [
      /console\.(log|info|warn|error)\(.*password.*:.*\)/i,
      /console\.(log|info|warn|error)\(.*Virendra@2811#/i,
      /console\.(log|info|warn|error)\(.*sanjiv@123/i
    ];

    const violations = [];

    for (const filePath of allFiles) {
      // Skip this audit test file itself
      if (filePath.includes('securityCredentialsAudit.test.js')) continue;

      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        for (const pattern of forbiddenPatterns) {
          if (pattern.test(line)) {
            violations.push(`${path.relative(rootDir, filePath)}:${index + 1}: ${line.trim()}`);
          }
        }
      });
    }

    expect(violations).toEqual([]);
  });

  it('verifies seed scripts use environment variables for passwords', async () => {
    const resetSeedPath = path.join(rootDir, 'server/src/db/reset_and_seed_user.js');
    const demoSeedPath = path.join(rootDir, 'server/src/db/seed_demo_account.js');

    const resetContent = await fs.readFile(resetSeedPath, 'utf8');
    const demoContent = await fs.readFile(demoSeedPath, 'utf8');

    expect(resetContent).not.toContain("'Virendra@2811#'");
    expect(demoContent).not.toContain("'sanjiv@123'");

    expect(resetContent).toContain('process.env.ADMIN_ACCOUNT_PASSWORD');
    expect(demoContent).toContain('process.env.DEMO_ACCOUNT_PASSWORD');
  });
});

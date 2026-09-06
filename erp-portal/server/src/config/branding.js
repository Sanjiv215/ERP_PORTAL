import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOGO_PNG_PATH = path.resolve(__dirname, '../assets/erp-logo.png');

let cachedLogoBuffer = null;

export function getBrandLogoBuffer() {
  if (cachedLogoBuffer) return cachedLogoBuffer;
  try {
    if (fs.existsSync(LOGO_PNG_PATH)) {
      cachedLogoBuffer = fs.readFileSync(LOGO_PNG_PATH);
      return cachedLogoBuffer;
    }
  } catch (err) {
    console.warn('Could not read brand logo buffer:', err.message);
  }
  return null;
}

export const BRAND = {
  name: 'ERP Portal',
  tagline: 'Enterprise Operations & Resource Planning',
  logoPath: LOGO_PNG_PATH,
  colors: {
    primaryNavy: '#0F5394',
    secondaryTeal: '#0A8F9E',
    darkSlate: '#0F172A',
    bodyText: '#334155',
    mutedText: '#64748B',
    lightBg: '#F8FAFC',
    border: '#E2E8F0',
    white: '#FFFFFF'
  },
  footerDisclaimer: 'This is a computer-generated document issued by ERP Portal.',
  signatoryTitle: 'Authorized Signatory'
};

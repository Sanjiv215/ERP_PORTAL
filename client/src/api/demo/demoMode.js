export const DEMO_CREDENTIALS = {
  email: 'test@erpportal.com',
  password: 'Test@1234',
  role: 'TenantAdmin',
  name: 'Alex Morgan',
  tenantName: 'Apex Infrastructure & Tech Ltd',
  gstNumber: '27AAACA1234A1Z5'
};

export function isDemoMode() {
  if (typeof window === 'undefined') {
    return import.meta.env.VITE_DEMO_MODE === 'true' || import.meta.env.VITE_DEMO_MODE === true;
  }

  // Check explicit environment variable
  if (import.meta.env.VITE_DEMO_MODE === 'true' || import.meta.env.VITE_DEMO_MODE === true) {
    return true;
  }

  // Check localStorage manual override
  if (window.localStorage.getItem('erp_demo_mode') === 'true') {
    return true;
  }

  // Automatic fallback on Vercel deployment domains if no backend is specified
  const host = window.location.hostname || '';
  if (host.endsWith('.vercel.app') && !import.meta.env.VITE_API_BASE_URL) {
    return true;
  }

  return false;
}

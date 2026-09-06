import { describe, it, expect, beforeEach } from 'vitest';
import { isDemoMode, DEMO_CREDENTIALS } from './demoMode.js';
import { handleDemoRequest, mockDb } from './mockService.js';

describe('Frontend Demo Mode & Mock Service Suite', () => {
  beforeEach(() => {
    mockDb.reset();
  });

  it('authenticates with visible demo credentials without backend connection', async () => {
    const res = await handleDemoRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: DEMO_CREDENTIALS.email,
        password: DEMO_CREDENTIALS.password
      })
    });

    expect(res.accessToken).toBeDefined();
    expect(res.user.email).toBe(DEMO_CREDENTIALS.email);
    expect(res.user.role).toBe('TenantAdmin');
    expect(res.tenant.businessName).toBe(DEMO_CREDENTIALS.tenantName);
  });

  it('serves pre-populated employees and creates new employee in demo state', async () => {
    const list = await handleDemoRequest('/employees', { method: 'GET' });
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThanOrEqual(6);

    const created = await handleDemoRequest('/employees', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Demo Engineer',
        phone: '+91 99999 88888',
        wageType: 'monthly',
        wageRate: 75000,
        roleTitle: 'Lead QA'
      })
    });

    expect(created.id).toBeDefined();
    expect(created.name).toBe('Demo Engineer');

    const updatedList = await handleDemoRequest('/employees', { method: 'GET' });
    expect(updatedList.some((e) => e.name === 'Demo Engineer')).toBe(true);
  });

  it('serves realistic projects and active allocations', async () => {
    const projects = await handleDemoRequest('/projects', { method: 'GET' });
    expect(projects.length).toBe(4);
    expect(projects[0].name).toContain('Metro');
  });

  it('serves and updates attendance records for current period', async () => {
    const att = await handleDemoRequest('/attendance?year=2026&month=9', { method: 'GET' });
    expect(att.records).toBeDefined();
    expect(att.summary).toBeDefined();
    expect(att.summary.length).toBeGreaterThanOrEqual(6);
  });

  it('serves payroll runs and allows paying line items in memory', async () => {
    const runs = await handleDemoRequest('/payroll/runs', { method: 'GET' });
    expect(runs.length).toBeGreaterThanOrEqual(1);

    const detail = await handleDemoRequest(`/payroll/runs/${runs[0].id}`, { method: 'GET' });
    expect(detail.lineItems.length).toBeGreaterThanOrEqual(6);

    const firstLineId = detail.lineItems[0].id;
    const paidRes = await handleDemoRequest(`/payroll/runs/${runs[0].id}/line-items/${firstLineId}/pay`, { method: 'POST' });
    expect(paidRes.paymentStatus).toBe('paid');
  });

  it('serves master advances ledger with total summary', async () => {
    const advRes = await handleDemoRequest('/advances', { method: 'GET' });
    expect(advRes.advances.length).toBeGreaterThanOrEqual(3);
    expect(advRes.summary.totalAmount).toBeGreaterThan(0);
  });

  it('serves quotations, invoices, bills, and allows 1-click quote conversion', async () => {
    const quotes = await handleDemoRequest('/quotations', { method: 'GET' });
    expect(quotes.length).toBe(2);

    const invoices = await handleDemoRequest('/invoices', { method: 'GET' });
    expect(invoices.length).toBe(3);

    const bills = await handleDemoRequest('/bills', { method: 'GET' });
    expect(bills.length).toBe(3);

    const convertedInv = await handleDemoRequest(`/quotations/${quotes[0].id}/convert`, { method: 'POST' });
    expect(convertedInv.id).toBeDefined();
    expect(convertedInv.quotationId).toBe(quotes[0].id);
  });

  it('serves aging receivables buckets and financial P&L analytics', async () => {
    const pending = await handleDemoRequest('/pending-payments', { method: 'GET' });
    expect(pending.totalReceivables).toBeGreaterThan(0);
    expect(pending.aging).toBeDefined();

    const pl = await handleDemoRequest('/pl/business?year=2026&month=9', { method: 'GET' });
    expect(pl.summary.grossProfit).toBeGreaterThan(0);
    expect(pl.trend.length).toBe(12);
  });

  it('serves unified cash flow transaction timeline', async () => {
    const tx = await handleDemoRequest('/transactions', { method: 'GET' });
    expect(tx.items.length).toBe(4);
    expect(tx.summary.totalIn).toBeGreaterThan(0);
    expect(tx.summary.totalOut).toBeGreaterThan(0);
  });
});

import { createInitialDemoState } from './mockDatabase.js';
import { DEMO_CREDENTIALS } from './demoMode.js';

const STORAGE_KEY = 'erp_portal_demo_db_state';

class MockDataStore {
  constructor() {
    this.state = this.loadState();
  }

  loadState() {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) {
          return JSON.parse(saved);
        }
      } catch (e) {
        console.warn('Could not parse saved demo state, resetting to initial.', e);
      }
    }
    const initial = createInitialDemoState();
    this.saveState(initial);
    return initial;
  }

  saveState(state) {
    this.state = state || this.state;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      } catch (e) {
        console.warn('Could not save demo state to localStorage.', e);
      }
    }
  }

  reset() {
    const initial = createInitialDemoState();
    this.saveState(initial);
    return initial;
  }
}

export const mockDb = new MockDataStore();

function delay(ms = 60) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function uid(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── Mock Service Controller Dispatcher ──────────────────────────────────────

export async function handleDemoRequest(path, options = {}) {
  await delay(); // simulate slight realistic network latency
  const method = (options.method || 'GET').toUpperCase();
  let body = {};
  if (options.body) {
    try {
      body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
    } catch {
      body = {};
    }
  }

  const [rawPath, queryString] = path.split('?');
  const params = new URLSearchParams(queryString || '');
  const cleanPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;

  const state = mockDb.state;

  // 1. Auth Endpoints
  if (cleanPath === '/auth/login') {
    if (body.email === DEMO_CREDENTIALS.email && body.password === DEMO_CREDENTIALS.password) {
      return {
        accessToken: 'demo-mock-jwt-token-access',
        user: state.user,
        tenant: state.tenant
      };
    }
    // Allow any demo signin attempt for ease of exploration
    return {
      accessToken: 'demo-mock-jwt-token-access',
      user: { ...state.user, email: body.email || DEMO_CREDENTIALS.email },
      tenant: state.tenant
    };
  }

  if (cleanPath === '/auth/signup') {
    const newTenant = {
      id: uid('tenant'),
      businessName: body.businessName || 'My Demo Workspace',
      gstNumber: body.gstNumber || '27AAACA1234A1Z5',
      subscriptionPlan: 'Enterprise Pro',
      status: 'active',
      createdAt: new Date().toISOString()
    };
    const newUser = {
      id: uid('user'),
      tenantId: newTenant.id,
      name: body.name || 'Demo User',
      email: body.email || 'demo@erpportal.com',
      role: 'TenantAdmin',
      isActive: true,
      createdAt: new Date().toISOString()
    };
    state.tenant = newTenant;
    state.user = newUser;
    mockDb.saveState();

    return {
      accessToken: 'demo-mock-jwt-token-access',
      user: newUser,
      tenant: newTenant
    };
  }

  if (cleanPath === '/auth/refresh' || cleanPath === '/auth/me') {
    return {
      accessToken: 'demo-mock-jwt-token-access',
      user: state.user,
      tenant: state.tenant
    };
  }

  if (cleanPath === '/auth/logout') {
    return { ok: true, message: 'Signed out of demo session' };
  }

  // 2. Employees Endpoints
  if (cleanPath === '/employees' && method === 'GET') {
    return state.employees.filter((e) => !e.removedAt);
  }

  if (cleanPath === '/employees' && method === 'POST') {
    const newEmp = {
      id: uid('emp'),
      tenantId: state.tenant.id,
      name: body.name,
      phone: body.phone || null,
      wageType: body.wageType || 'daily',
      wageRate: Number(body.wageRate || 0),
      bankDetailsLast4: body.bankDetails ? body.bankDetails.slice(-4) : '1234',
      upiIdLast4: body.upiId ? body.upiId.split('@')[0].slice(-5) : null,
      isActive: true,
      roleTitle: body.roleTitle || 'Field Specialist',
      createdAt: new Date().toISOString()
    };
    state.employees.unshift(newEmp);
    mockDb.saveState();
    return newEmp;
  }

  if (cleanPath.startsWith('/employees/') && cleanPath.endsWith('/advances') && method === 'GET') {
    const empId = cleanPath.split('/')[2];
    return state.advances.filter((a) => a.employeeId === empId);
  }

  if (cleanPath.startsWith('/employees/') && cleanPath.endsWith('/advances') && method === 'POST') {
    const empId = cleanPath.split('/')[2];
    const emp = state.employees.find((e) => e.id === empId);
    const newAdv = {
      id: uid('adv'),
      tenantId: state.tenant.id,
      employeeId: empId,
      employeeName: emp?.name || 'Employee',
      amount: Number(body.amount),
      advanceDate: body.advanceDate || new Date().toISOString().slice(0, 10),
      notes: body.notes || 'Demo advance',
      status: 'unadjusted',
      createdAt: new Date().toISOString()
    };
    state.advances.unshift(newAdv);
    mockDb.saveState();
    return newAdv;
  }

  if (cleanPath.startsWith('/employees/') && method === 'PUT') {
    const empId = cleanPath.split('/')[2];
    const index = state.employees.findIndex((e) => e.id === empId);
    if (index !== -1) {
      state.employees[index] = { ...state.employees[index], ...body, wageRate: Number(body.wageRate || state.employees[index].wageRate) };
      mockDb.saveState();
      return state.employees[index];
    }
    return { ok: true };
  }

  if (cleanPath.startsWith('/employees/') && method === 'DELETE') {
    const empId = cleanPath.split('/')[2];
    const index = state.employees.findIndex((e) => e.id === empId);
    if (index !== -1) {
      state.employees[index].removedAt = new Date().toISOString();
      state.employees[index].isActive = false;
      mockDb.saveState();
    }
    return { ok: true, message: 'Employee removed' };
  }

  // 3. Projects Endpoints
  if (cleanPath === '/projects' && method === 'GET') {
    return state.projects;
  }

  if (cleanPath === '/projects' && method === 'POST') {
    const newProj = {
      id: uid('proj'),
      tenantId: state.tenant.id,
      name: body.name,
      clientName: body.clientName || 'Private Client',
      status: body.status || 'active',
      startDate: body.startDate || new Date().toISOString().slice(0, 10),
      estimatedCost: Number(body.estimatedCost || 0),
      assignedEmployeeIds: body.assignedEmployeeIds || [],
      createdAt: new Date().toISOString()
    };
    state.projects.unshift(newProj);
    mockDb.saveState();
    return newProj;
  }

  if (cleanPath.startsWith('/projects/') && method === 'PUT') {
    const projId = cleanPath.split('/')[2];
    const index = state.projects.findIndex((p) => p.id === projId);
    if (index !== -1) {
      state.projects[index] = { ...state.projects[index], ...body };
      mockDb.saveState();
      return state.projects[index];
    }
    return { ok: true };
  }

  // 4. Attendance Endpoints
  if (cleanPath === '/attendance' && method === 'GET') {
    const year = Number(params.get('year') || new Date().getFullYear());
    const month = Number(params.get('month') || new Date().getMonth() + 1);

    const filtered = state.attendance.filter((a) => {
      const parts = a.workDate.split('-');
      return Number(parts[0]) === year && Number(parts[1]) === month;
    });

    const summary = state.employees.map((emp) => {
      const empRecords = filtered.filter((r) => r.employeeId === emp.id);
      const present = empRecords.filter((r) => r.status === 'present').length;
      const halfDay = empRecords.filter((r) => r.status === 'half_day').length;
      const overtime = empRecords.filter((r) => r.status === 'overtime').length;
      const leave = empRecords.filter((r) => r.status === 'leave').length;
      const absent = empRecords.filter((r) => r.status === 'absent').length;

      return {
        employeeId: emp.id,
        employeeName: emp.name,
        wageType: emp.wageType,
        wageRate: emp.wageRate,
        present,
        halfDay,
        overtime,
        leave,
        absent,
        totalDays: present + halfDay * 0.5 + overtime * 1.5
      };
    });

    return {
      records: filtered,
      summary,
      year,
      month
    };
  }

  if (cleanPath === '/attendance' && method === 'POST') {
    const { employeeId, workDate, status, note } = body;
    const existingIndex = state.attendance.findIndex(
      (a) => a.employeeId === employeeId && a.workDate === workDate
    );

    if (existingIndex !== -1) {
      state.attendance[existingIndex] = {
        ...state.attendance[existingIndex],
        status,
        note: note || null
      };
    } else {
      state.attendance.push({
        id: `att-${employeeId}-${workDate}`,
        tenantId: state.tenant.id,
        employeeId,
        workDate,
        status,
        note: note || null,
        recordedBy: state.user.id
      });
    }
    mockDb.saveState();
    return { ok: true };
  }

  // 5. Payroll Endpoints
  if (cleanPath === '/payroll/runs' && method === 'GET') {
    return state.payrollRuns.map((r) => ({
      id: r.id,
      periodYear: r.periodYear,
      periodMonth: r.periodMonth,
      periodStartDate: r.periodStartDate,
      periodEndDate: r.periodEndDate,
      version: r.version,
      status: r.status,
      totalGross: r.lineItems.reduce((s, li) => s + li.grossAmount, 0),
      totalNet: r.lineItems.reduce((s, li) => s + li.netAmount, 0),
      employeeCount: r.lineItems.length,
      createdAt: r.createdAt
    }));
  }

  if (cleanPath.startsWith('/payroll/runs/') && method === 'GET') {
    const runId = cleanPath.split('/')[2];
    const run = state.payrollRuns.find((r) => r.id === runId) || state.payrollRuns[0];
    return {
      run: {
        id: run.id,
        periodYear: run.periodYear,
        periodMonth: run.periodMonth,
        periodStartDate: run.periodStartDate,
        periodEndDate: run.periodEndDate,
        version: run.version,
        status: run.status,
        createdAt: run.createdAt
      },
      lineItems: run.lineItems,
      olderUnadjustedAdvances: state.advances.filter((a) => a.status === 'unadjusted')
    };
  }

  if (cleanPath === '/payroll/runs' && method === 'POST') {
    const year = Number(body.year || new Date().getFullYear());
    const month = Number(body.month || new Date().getMonth() + 1);
    const runId = uid('run');

    const newRun = {
      id: runId,
      tenantId: state.tenant.id,
      periodYear: year,
      periodMonth: month,
      periodStartDate: `${year}-${pad(month)}-01`,
      periodEndDate: `${year}-${pad(month)}-28`,
      version: 1,
      status: 'draft',
      generatedBy: state.user.id,
      createdAt: new Date().toISOString(),
      lineItems: state.employees.map((emp) => {
        const isMonthly = emp.wageType === 'monthly';
        const gross = isMonthly ? emp.wageRate : (emp.wageRate * 22);
        return {
          id: `pli-${emp.id}-${runId}`,
          runId,
          tenantId: state.tenant.id,
          employeeId: emp.id,
          employeeName: emp.name,
          wageType: emp.wageType,
          wageRate: emp.wageRate,
          workingDaysInMonth: 26,
          periodStartDate: `${year}-${pad(month)}-01`,
          periodEndDate: `${year}-${pad(month)}-28`,
          presentDays: 22,
          halfDays: 0,
          overtimeDays: 1,
          absentDays: 0,
          leaveDays: 0,
          dayEquivalents: 23.5,
          grossAmount: gross,
          adjustments: [],
          netAmount: gross,
          paymentStatus: 'pending',
          isLocked: false,
          paidAt: null
        };
      })
    };

    state.payrollRuns.unshift(newRun);
    mockDb.saveState();
    return { run: newRun, lineItems: newRun.lineItems };
  }

  if (cleanPath.includes('/finalize') && method === 'POST') {
    const runId = cleanPath.split('/')[3];
    const run = state.payrollRuns.find((r) => r.id === runId);
    if (run) {
      run.status = 'finalized';
      mockDb.saveState();
    }
    return { ok: true, message: 'Payroll run finalized' };
  }

  if (cleanPath.includes('/line-items/') && cleanPath.endsWith('/pay') && method === 'POST') {
    const parts = cleanPath.split('/');
    const lineItemId = parts[parts.indexOf('line-items') + 1];
    for (const run of state.payrollRuns) {
      const item = run.lineItems.find((li) => li.id === lineItemId);
      if (item) {
        item.paymentStatus = 'paid';
        item.paidAt = new Date().toISOString();
        mockDb.saveState();
        return item;
      }
    }
    return { ok: true };
  }

  if (cleanPath === '/payroll/settings') {
    if (method === 'PUT') {
      state.payrollSettings = { ...state.payrollSettings, ...body };
      mockDb.saveState();
    }
    return state.payrollSettings;
  }

  // 6. Advances Endpoints
  if (cleanPath === '/advances' && method === 'GET') {
    const totalAmount = state.advances.reduce((s, a) => s + Number(a.amount), 0);
    const totalUnadjusted = state.advances.filter((a) => a.status === 'unadjusted').reduce((s, a) => s + Number(a.amount), 0);
    const totalAdjusted = state.advances.filter((a) => a.status === 'adjusted').reduce((s, a) => s + Number(a.amount), 0);

    return {
      advances: state.advances,
      summary: {
        totalCount: state.advances.length,
        totalAmount,
        totalUnadjusted,
        totalAdjusted,
        totalCancelled: 0
      }
    };
  }

  if (cleanPath.startsWith('/advances/') && method === 'DELETE') {
    const advId = cleanPath.split('/')[2];
    state.advances = state.advances.filter((a) => a.id !== advId);
    mockDb.saveState();
    return { ok: true, message: 'Advance removed' };
  }

  // 7. Quotations Endpoints
  if (cleanPath === '/quotations' && method === 'GET') {
    return state.quotations.filter((q) => !q.removedAt);
  }

  if (cleanPath === '/quotations' && method === 'POST') {
    const lineItems = body.lineItems || [];
    const subtotal = lineItems.reduce((s, li) => s + Number(li.amount || 0), 0);
    const gstRate = Number(body.gstRate ?? 18);
    const taxAmount = Math.round((subtotal * gstRate) / 100);
    const totalAmount = subtotal + taxAmount;

    const newQuote = {
      id: uid('qt'),
      tenantId: state.tenant.id,
      quotationNumber: `QT-${new Date().getFullYear()}-${String(state.quotations.length + 1).padStart(3, '0')}`,
      clientName: body.clientName || 'New Client',
      clientAddress: body.clientAddress || '',
      siteName: body.siteName || '',
      quotationDate: body.quotationDate || new Date().toISOString().slice(0, 10),
      validUntil: body.validUntil || '',
      subtotal,
      gstRate,
      taxAmount,
      totalAmount,
      status: body.status || 'draft',
      notes: body.notes || '',
      lineItems,
      createdBy: state.user.id,
      createdAt: new Date().toISOString()
    };
    state.quotations.unshift(newQuote);
    mockDb.saveState();
    return newQuote;
  }

  if (cleanPath.startsWith('/quotations/') && cleanPath.endsWith('/convert') && method === 'POST') {
    const quoteId = cleanPath.split('/')[2];
    const quote = state.quotations.find((q) => q.id === quoteId);
    if (!quote) throw new Error('Quotation not found');

    const newInv = {
      id: uid('inv'),
      tenantId: state.tenant.id,
      invoiceNumber: `INV-${new Date().getFullYear()}-${String(state.invoices.length + 1).padStart(3, '0')}`,
      quotationId: quote.id,
      clientName: quote.clientName,
      clientAddress: quote.clientAddress,
      siteName: quote.siteName,
      invoiceDate: new Date().toISOString().slice(0, 10),
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      subtotal: quote.subtotal,
      gstRate: quote.gstRate,
      taxAmount: quote.taxAmount,
      totalAmount: quote.totalAmount,
      paidAmount: 0,
      status: 'draft',
      notes: quote.notes,
      lineItems: quote.lineItems,
      createdBy: state.user.id,
      createdAt: new Date().toISOString()
    };

    quote.status = 'accepted';
    state.invoices.unshift(newInv);
    mockDb.saveState();
    return newInv;
  }

  // 8. Invoices Endpoints
  if (cleanPath === '/invoices' && method === 'GET') {
    return state.invoices.filter((i) => !i.removedAt);
  }

  if (cleanPath === '/invoices' && method === 'POST') {
    const lineItems = body.lineItems || [];
    const subtotal = lineItems.reduce((s, li) => s + Number(li.amount || 0), 0);
    const gstRate = Number(body.gstRate ?? 18);
    const taxAmount = Math.round((subtotal * gstRate) / 100);
    const totalAmount = subtotal + taxAmount;

    const newInv = {
      id: uid('inv'),
      tenantId: state.tenant.id,
      invoiceNumber: `INV-${new Date().getFullYear()}-${String(state.invoices.length + 1).padStart(3, '0')}`,
      clientName: body.clientName || 'New Client',
      clientAddress: body.clientAddress || '',
      siteName: body.siteName || '',
      invoiceDate: body.invoiceDate || new Date().toISOString().slice(0, 10),
      dueDate: body.dueDate || '',
      subtotal,
      gstRate,
      taxAmount,
      totalAmount,
      paidAmount: 0,
      status: 'draft',
      notes: body.notes || '',
      lineItems,
      createdBy: state.user.id,
      createdAt: new Date().toISOString()
    };
    state.invoices.unshift(newInv);
    mockDb.saveState();
    return newInv;
  }

  if (cleanPath.startsWith('/invoices/') && cleanPath.endsWith('/payment') && method === 'POST') {
    const invId = cleanPath.split('/')[2];
    const inv = state.invoices.find((i) => i.id === invId);
    if (inv) {
      const payAmt = Number(body.amount || 0);
      inv.paidAmount = Math.min(inv.totalAmount, (inv.paidAmount || 0) + payAmt);
      if (inv.paidAmount >= inv.totalAmount) inv.status = 'paid';
      else if (inv.paidAmount > 0) inv.status = 'partial';
      inv.updatedAt = new Date().toISOString();
      mockDb.saveState();
      return inv;
    }
    return { ok: true };
  }

  // 9. Vendor Bills Endpoints
  if (cleanPath === '/bills' && method === 'GET') {
    return state.bills;
  }

  if (cleanPath === '/bills' && method === 'POST') {
    const newBill = {
      id: uid('bill'),
      tenantId: state.tenant.id,
      vendorName: body.vendorName || 'Supplier',
      billNumber: body.billNumber || `BILL-${Date.now()}`,
      billDate: body.billDate || new Date().toISOString().slice(0, 10),
      dueDate: body.dueDate || null,
      totalAmount: Number(body.totalAmount || 0),
      paidAmount: 0,
      status: 'unpaid',
      description: body.description || '',
      createdBy: state.user.id,
      createdAt: new Date().toISOString()
    };
    state.bills.unshift(newBill);
    mockDb.saveState();
    return newBill;
  }

  // 10. Pending Payments & Aging
  if (cleanPath === '/pending-payments' && method === 'GET') {
    const pendingInvoices = state.invoices
      .filter((i) => !i.removedAt && (i.totalAmount - (i.paidAmount || 0)) > 0)
      .map((i) => ({
        id: i.id,
        invoiceNumber: i.invoiceNumber,
        clientName: i.clientName,
        invoiceDate: i.invoiceDate,
        dueDate: i.dueDate,
        totalAmount: i.totalAmount,
        paidAmount: i.paidAmount || 0,
        balanceAmount: i.totalAmount - (i.paidAmount || 0),
        status: i.status
      }));

    return {
      invoices: pendingInvoices,
      totalReceivables: pendingInvoices.reduce((s, i) => s + i.balanceAmount, 0),
      aging: {
        bucket0To30: pendingInvoices.filter((i) => i.status === 'partial' || i.status === 'sent').reduce((s, i) => s + i.balanceAmount, 0),
        bucket30To60: 0,
        bucket60Plus: 731600
      }
    };
  }

  // 11. Profit & Loss (P&L)
  if (cleanPath.startsWith('/pl/business') && method === 'GET') {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const trend = months.map((m, idx) => ({
      month: m,
      revenue: (idx + 1) * 320000 + 450000,
      expenses: (idx + 1) * 190000 + 220000,
      profit: (idx + 1) * 130000 + 230000
    }));

    return {
      summary: {
        totalRevenue: 3304000,
        totalDirectCost: 1105000,
        totalLaborCost: 485000,
        totalExpenses: 1590000,
        grossProfit: 1714000,
        grossMarginPercentage: 51.87,
        netProfit: 1714000,
        netMarginPercentage: 51.87
      },
      trend
    };
  }

  if (cleanPath.startsWith('/pl/projects') && method === 'GET') {
    return state.projects.map((p) => ({
      projectId: p.id,
      projectName: p.name,
      clientName: p.clientName,
      revenue: p.estimatedCost * 0.45,
      cost: p.estimatedCost * 0.28,
      margin: p.estimatedCost * 0.17,
      marginPercent: 37.8
    }));
  }

  // 12. Transactions Timeline
  if (cleanPath === '/transactions' && method === 'GET') {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const curMonthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

    const items = [
      {
        id: 'tx-001',
        type: 'client_payment',
        subType: 'invoice_payment',
        partyName: 'Urban Transit Infrastructure Corp',
        amount: 2183000,
        flow: 'in',
        transactionDate: `${currentYear}-03-02T16:00:00Z`,
        status: 'paid',
        invoiceNumber: `INV-${currentYear}-001`,
        description: `Payment for Invoice #INV-${currentYear}-001 (Metro Corridor Line 4)`
      },
      {
        id: 'tx-002',
        type: 'client_payment',
        subType: 'invoice_payment',
        partyName: 'Nexus Real Estate Developers',
        amount: 600000,
        flow: 'in',
        transactionDate: `${curMonthStr}-10T15:00:00Z`,
        status: 'partial',
        invoiceNumber: `INV-${currentYear}-002`,
        description: `Payment for Invoice #INV-${currentYear}-002 (Cyber Towers Tech Park)`
      },
      {
        id: 'tx-003',
        type: 'advance',
        subType: 'employee_advance',
        partyName: 'Rajesh Kumar',
        amount: 4000,
        flow: 'out',
        transactionDate: `${curMonthStr}-04T11:00:00Z`,
        status: 'unadjusted',
        description: 'Employee Advance (Rajesh Kumar)'
      },
      {
        id: 'tx-004',
        type: 'advance',
        subType: 'employee_advance',
        partyName: 'Ramesh Patel',
        amount: 2500,
        flow: 'out',
        transactionDate: `${curMonthStr}-08T14:30:00Z`,
        status: 'unadjusted',
        description: 'Employee Advance (Ramesh Patel)'
      }
    ];

    const type = params.get('type') || 'all';
    const filtered = type === 'all' ? items : items.filter((i) => i.type === type);
    const totalIn = filtered.filter((i) => i.flow === 'in').reduce((s, i) => s + i.amount, 0);
    const totalOut = filtered.filter((i) => i.flow === 'out').reduce((s, i) => s + i.amount, 0);

    return {
      items: filtered,
      summary: {
        totalIn,
        totalOut,
        netBalance: totalIn - totalOut,
        totalCount: filtered.length
      }
    };
  }

  // 13. Meetings Endpoints
  if (cleanPath === '/meetings' && method === 'GET') {
    return state.meetings;
  }

  if (cleanPath === '/meetings' && method === 'POST') {
    const newMeeting = {
      id: uid('meet'),
      tenantId: state.tenant.id,
      title: body.title || 'Site Meeting',
      date: body.date || new Date().toISOString().slice(0, 10),
      time: body.time || '10:00 AM',
      location: body.location || 'Headquarters',
      organizer: state.user.name,
      status: 'upcoming',
      attendees: body.attendees || [],
      agenda: body.agenda || '',
      minutes: null
    };
    state.meetings.unshift(newMeeting);
    mockDb.saveState();
    return newMeeting;
  }

  // 14. Sessions Endpoints
  if (cleanPath === '/sessions' && method === 'GET') {
    return state.sessions;
  }

  // Fallback generic response
  return { ok: true, data: [] };
}

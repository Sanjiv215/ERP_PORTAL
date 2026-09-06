import { DEMO_CREDENTIALS } from './demoMode.js';

const today = new Date();
const currentYear = today.getFullYear();
const currentMonth = today.getMonth() + 1;
const pad = (n) => String(n).padStart(2, '0');
const curMonthStr = `${currentYear}-${pad(currentMonth)}`;

export function createInitialDemoState() {
  const tenantId = 'demo-tenant-001';
  const adminId = 'demo-user-001';

  const tenant = {
    id: tenantId,
    businessName: DEMO_CREDENTIALS.tenantName,
    gstNumber: DEMO_CREDENTIALS.gstNumber,
    subscriptionPlan: 'Enterprise Pro',
    status: 'active',
    createdAt: `${currentYear}-01-01T00:00:00.000Z`
  };

  const user = {
    id: adminId,
    tenantId,
    name: DEMO_CREDENTIALS.name,
    email: DEMO_CREDENTIALS.email,
    role: DEMO_CREDENTIALS.role,
    isActive: true,
    createdAt: `${currentYear}-01-01T00:00:00.000Z`
  };

  const employees = [
    {
      id: 'emp-001',
      tenantId,
      name: 'Vikram Mehta',
      phone: '+91 98201 44556',
      wageType: 'monthly',
      wageRate: 65000,
      bankDetailsLast4: '4821',
      upiIdLast4: 'mehta',
      isActive: true,
      roleTitle: 'Senior Project Manager',
      createdAt: `${currentYear}-01-15T09:00:00.000Z`
    },
    {
      id: 'emp-002',
      tenantId,
      name: 'Priya Sharma',
      phone: '+91 98450 11223',
      wageType: 'monthly',
      wageRate: 52000,
      bankDetailsLast4: '9012',
      upiIdLast4: 'priya',
      isActive: true,
      roleTitle: 'Chief Quantity Surveyor',
      createdAt: `${currentYear}-02-01T09:00:00.000Z`
    },
    {
      id: 'emp-003',
      tenantId,
      name: 'Rajesh Kumar',
      phone: '+91 97110 88776',
      wageType: 'daily',
      wageRate: 1400,
      bankDetailsLast4: '3341',
      upiIdLast4: null,
      isActive: true,
      roleTitle: 'Site Supervisor',
      createdAt: `${currentYear}-01-10T09:00:00.000Z`
    },
    {
      id: 'emp-004',
      tenantId,
      name: 'Mohd Aslam',
      phone: '+91 99234 55667',
      wageType: 'daily',
      wageRate: 1100,
      bankDetailsLast4: '7789',
      upiIdLast4: 'aslam',
      isActive: true,
      roleTitle: 'Lead Electrician & HVAC',
      createdAt: `${currentYear}-03-05T09:00:00.000Z`
    },
    {
      id: 'emp-005',
      tenantId,
      name: 'Ramesh Patel',
      phone: '+91 98980 33221',
      wageType: 'daily',
      wageRate: 950,
      bankDetailsLast4: '6120',
      upiIdLast4: null,
      isActive: true,
      roleTitle: 'Master Carpenter',
      createdAt: `${currentYear}-02-15T09:00:00.000Z`
    },
    {
      id: 'emp-006',
      tenantId,
      name: 'Anjali Verma',
      phone: '+91 98711 22334',
      wageType: 'monthly',
      wageRate: 38000,
      bankDetailsLast4: '1154',
      upiIdLast4: 'anjali',
      isActive: true,
      roleTitle: 'Procurement Specialist',
      createdAt: `${currentYear}-04-01T09:00:00.000Z`
    }
  ];

  const projects = [
    {
      id: 'proj-001',
      tenantId,
      name: 'Metro Corridor Line 4 — Station Fit-Out',
      clientName: 'Urban Transit Infrastructure Corp',
      status: 'active',
      startDate: `${currentYear}-01-10`,
      estimatedCost: 14500000,
      assignedEmployeeIds: ['emp-001', 'emp-003', 'emp-004'],
      createdAt: `${currentYear}-01-10T10:00:00.000Z`
    },
    {
      id: 'proj-002',
      tenantId,
      name: 'Cyber Towers Tech Park — Tower B Interior',
      clientName: 'Nexus Real Estate Developers',
      status: 'active',
      startDate: `${currentYear}-02-15`,
      estimatedCost: 8200000,
      assignedEmployeeIds: ['emp-002', 'emp-005', 'emp-006'],
      createdAt: `${currentYear}-02-15T10:00:00.000Z`
    },
    {
      id: 'proj-003',
      tenantId,
      name: 'Green Energy Solar Microgrid Substation',
      clientName: 'SunPower Renewable Utilities',
      status: 'active',
      startDate: `${currentYear}-03-01`,
      estimatedCost: 5600000,
      assignedEmployeeIds: ['emp-001', 'emp-004'],
      createdAt: `${currentYear}-03-01T10:00:00.000Z`
    },
    {
      id: 'proj-004',
      tenantId,
      name: 'Riverside Logistics Distribution Hub',
      clientName: 'Apex Supply Chain Logistics',
      status: 'planned',
      startDate: `${currentYear}-08-01`,
      estimatedCost: 12000000,
      assignedEmployeeIds: ['emp-002', 'emp-003'],
      createdAt: `${currentYear}-04-12T10:00:00.000Z`
    }
  ];

  // Attendance Records for current month
  const attendance = [];
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const todayDay = Math.min(today.getDate(), daysInMonth);

  for (let day = 1; day <= todayDay; day++) {
    const dayOfWeek = new Date(currentYear, currentMonth - 1, day).getDay();
    const dateStr = `${currentYear}-${pad(currentMonth)}-${pad(day)}`;

    // Skip Sundays
    if (dayOfWeek === 0) continue;

    employees.forEach((emp, index) => {
      let status = 'present';
      let note = null;

      // Deterministic variety in attendance
      if (day % 7 === 0 && index === 2) {
        status = 'half_day';
        note = 'Half day site duty';
      } else if (day % 11 === 0 && index === 4) {
        status = 'leave';
        note = 'Approved leave';
      } else if (day % 5 === 0 && (index === 3 || index === 4)) {
        status = 'overtime';
        note = '1.5x Overtime shift';
      }

      attendance.push({
        id: `att-${emp.id}-${dateStr}`,
        tenantId,
        employeeId: emp.id,
        workDate: dateStr,
        status,
        note,
        recordedBy: adminId
      });
    });
  }

  const payrollSettings = {
    tenantId,
    workingDaysPerMonth: 26,
    overtimeMultiplier: 1.5,
    halfDayMultiplier: 0.5
  };

  const advances = [
    {
      id: 'adv-001',
      tenantId,
      employeeId: 'emp-003',
      employeeName: 'Rajesh Kumar',
      amount: 4000,
      advanceDate: `${curMonthStr}-04`,
      notes: 'Festival advance request',
      status: 'unadjusted',
      createdAt: `${curMonthStr}-04T11:00:00.000Z`
    },
    {
      id: 'adv-002',
      tenantId,
      employeeId: 'emp-005',
      employeeName: 'Ramesh Patel',
      amount: 2500,
      advanceDate: `${curMonthStr}-08`,
      notes: 'Emergency medical tool expense',
      status: 'unadjusted',
      createdAt: `${curMonthStr}-08T14:30:00.000Z`
    },
    {
      id: 'adv-003',
      tenantId,
      employeeId: 'emp-004',
      employeeName: 'Mohd Aslam',
      amount: 5000,
      advanceDate: `${currentYear}-${pad(Math.max(1, currentMonth - 1))}-12`,
      notes: 'Travel advance for site inspection',
      status: 'adjusted',
      adjustedInRunId: 'run-prev-001',
      adjustedAt: `${currentYear}-${pad(Math.max(1, currentMonth - 1))}-28T18:00:00.000Z`,
      createdAt: `${currentYear}-${pad(Math.max(1, currentMonth - 1))}-12T10:00:00.000Z`
    }
  ];

  const quotations = [
    {
      id: 'qt-001',
      tenantId,
      quotationNumber: `QT-${currentYear}-001`,
      clientName: 'Urban Transit Infrastructure Corp',
      clientAddress: 'Plot 45, BKC Industrial Complex, Mumbai 400051',
      siteName: 'Metro Station 14 Concourse',
      quotationDate: `${currentYear}-01-12`,
      validUntil: `${currentYear}-02-28`,
      subtotal: 1850000,
      gstRate: 18,
      taxAmount: 333000,
      totalAmount: 2183000,
      status: 'accepted',
      notes: 'Includes structural glazing, HVAC ducted louvers, and 12-month workmanship warranty.',
      lineItems: [
        { description: 'Structural steel sub-framing & powder coated panels', quantity: 1200, unit: 'sqft', unitPrice: 850, amount: 1020000 },
        { description: 'Commercial HVAC ducting and diffusers', quantity: 45, unit: 'units', unitPrice: 9000, amount: 405000 },
        { description: 'LED architectural canopy illumination', quantity: 1, unit: 'lot', unitPrice: 425000, amount: 425000 }
      ],
      createdBy: adminId,
      createdAt: `${currentYear}-01-12T11:00:00.000Z`
    },
    {
      id: 'qt-002',
      tenantId,
      quotationNumber: `QT-${currentYear}-002`,
      clientName: 'Nexus Real Estate Developers',
      clientAddress: 'Level 18, Cyber Towers, Hitec City, Hyderabad 500081',
      siteName: 'Tower B Executive Lounge',
      quotationDate: `${currentYear}-03-05`,
      validUntil: `${currentYear}-04-15`,
      subtotal: 1240000,
      gstRate: 18,
      taxAmount: 223200,
      totalAmount: 1463200,
      status: 'sent',
      notes: 'Acoustic wall panelling, premium veneer reception desk, and smart IoT lighting integration.',
      lineItems: [
        { description: 'Teak veneer executive wall panels with acoustic backing', quantity: 800, unit: 'sqft', unitPrice: 950, amount: 760000 },
        { description: 'Custom monolithic marble reception counter', quantity: 1, unit: 'unit', unitPrice: 280000, amount: 280000 },
        { description: 'Smart IoT lighting control modules and fixtures', quantity: 1, unit: 'lot', unitPrice: 200000, amount: 200000 }
      ],
      createdBy: adminId,
      createdAt: `${currentYear}-03-05T14:00:00.000Z`
    }
  ];

  const invoices = [
    {
      id: 'inv-001',
      tenantId,
      invoiceNumber: `INV-${currentYear}-001`,
      quotationId: 'qt-001',
      projectId: 'proj-001',
      projectName: 'Metro Corridor Line 4 — Station Fit-Out',
      clientName: 'Urban Transit Infrastructure Corp',
      clientAddress: 'Plot 45, BKC Industrial Complex, Mumbai 400051',
      siteName: 'Metro Station 14 Concourse',
      invoiceDate: `${currentYear}-02-15`,
      dueDate: `${currentYear}-03-15`,
      subtotal: 1850000,
      gstRate: 18,
      taxAmount: 333000,
      totalAmount: 2183000,
      paidAmount: 2183000,
      status: 'paid',
      notes: 'Milestone 1 — 100% Station Concourse Completion (Paid in Full via RTGS)',
      lineItems: [
        { description: 'Structural steel sub-framing & powder coated panels', quantity: 1200, unit: 'sqft', unitPrice: 850, amount: 1020000 },
        { description: 'Commercial HVAC ducting and diffusers', quantity: 45, unit: 'units', unitPrice: 9000, amount: 405000 },
        { description: 'LED architectural canopy illumination', quantity: 1, unit: 'lot', unitPrice: 425000, amount: 425000 }
      ],
      createdBy: adminId,
      createdAt: `${currentYear}-02-15T10:00:00.000Z`,
      updatedAt: `${currentYear}-03-02T16:00:00.000Z`
    },
    {
      id: 'inv-002',
      tenantId,
      invoiceNumber: `INV-${currentYear}-002`,
      quotationId: null,
      projectId: 'proj-002',
      projectName: 'Cyber Towers Tech Park — Tower B Interior',
      clientName: 'Nexus Real Estate Developers',
      clientAddress: 'Level 18, Cyber Towers, Hitec City, Hyderabad 500081',
      siteName: 'Tower B Executive Lounge',
      invoiceDate: `${curMonthStr}-02`,
      dueDate: `${curMonthStr}-22`,
      subtotal: 950000,
      gstRate: 18,
      taxAmount: 171000,
      totalAmount: 1121000,
      paidAmount: 600000,
      status: 'partial',
      notes: 'Mobilization & 50% Material Procured Milestone. ₹6,00,000 received on account.',
      lineItems: [
        { description: 'Mobilization advance & site structural survey', quantity: 1, unit: 'milestone', unitPrice: 450000, amount: 450000 },
        { description: 'Teak veneer panels procurement & pre-fabrication', quantity: 500, unit: 'sqft', unitPrice: 1000, amount: 500000 }
      ],
      createdBy: adminId,
      createdAt: `${curMonthStr}-02T09:30:00.000Z`,
      updatedAt: `${curMonthStr}-10T15:00:00.000Z`
    },
    {
      id: 'inv-003',
      tenantId,
      invoiceNumber: `INV-${currentYear}-003`,
      quotationId: null,
      projectId: 'proj-003',
      projectName: 'Green Energy Solar Microgrid Substation',
      clientName: 'SunPower Renewable Utilities',
      clientAddress: 'Industrial Zone Sector 9, Pune 411028',
      siteName: 'Substation Control Building',
      invoiceDate: `${currentYear}-${pad(Math.max(1, currentMonth - 2))}-10`,
      dueDate: `${currentYear}-${pad(Math.max(1, currentMonth - 1))}-10`,
      subtotal: 620000,
      gstRate: 18,
      taxAmount: 111600,
      totalAmount: 731600,
      paidAmount: 0,
      status: 'sent',
      notes: 'Overdue control room foundation & cabling raceway work.',
      lineItems: [
        { description: 'Reinforced concrete foundation pads', quantity: 4, unit: 'pads', unitPrice: 85000, amount: 340000 },
        { description: 'High-voltage copper busbar raceways and grounding', quantity: 1, unit: 'lot', unitPrice: 280000, amount: 280000 }
      ],
      createdBy: adminId,
      createdAt: `${currentYear}-${pad(Math.max(1, currentMonth - 2))}-10T11:00:00.000Z`,
      updatedAt: `${currentYear}-${pad(Math.max(1, currentMonth - 2))}-10T11:00:00.000Z`
    }
  ];

  const bills = [
    {
      id: 'bill-001',
      tenantId,
      vendorName: 'Tata Steel Structural Solutions Ltd',
      billNumber: 'TATA-2026-9921',
      billDate: `${currentYear}-01-20`,
      dueDate: `${currentYear}-02-20`,
      totalAmount: 480000,
      paidAmount: 480000,
      status: 'paid',
      description: 'Heavy gauge steel rafters and purlins for Metro Station Project.',
      createdBy: adminId,
      createdAt: `${currentYear}-01-20T10:00:00.000Z`
    },
    {
      id: 'bill-002',
      tenantId,
      vendorName: 'Schneider Electric Industrial Automation',
      billNumber: 'SCH-88301',
      billDate: `${curMonthStr}-05`,
      dueDate: `${curMonthStr}-25`,
      totalAmount: 320000,
      paidAmount: 150000,
      status: 'partial',
      description: 'Main distribution panels, circuit breakers, and busbar trunking.',
      createdBy: adminId,
      createdAt: `${curMonthStr}-05T12:00:00.000Z`
    },
    {
      id: 'bill-003',
      tenantId,
      vendorName: 'UltraTech Cement Corporation',
      billNumber: 'UTC-55410',
      billDate: `${curMonthStr}-12`,
      dueDate: `${curMonthStr}-30`,
      totalAmount: 185000,
      paidAmount: 0,
      status: 'unpaid',
      description: '500 bags of OPC 53 Grade High-Strength Cement.',
      createdBy: adminId,
      createdAt: `${curMonthStr}-12T14:00:00.000Z`
    }
  ];

  const payrollRuns = [
    {
      id: 'run-cur-001',
      tenantId,
      periodYear: currentYear,
      periodMonth: currentMonth,
      periodStartDate: `${curMonthStr}-01`,
      periodEndDate: `${curMonthStr}-${pad(daysInMonth)}`,
      version: 1,
      status: 'draft',
      generatedBy: adminId,
      createdAt: `${curMonthStr}-15T12:00:00.000Z`,
      lineItems: employees.map((emp) => {
        const isMonthly = emp.wageType === 'monthly';
        const gross = isMonthly ? emp.wageRate : (emp.wageRate * 22);
        const advanceDeduction = emp.id === 'emp-003' ? 4000 : (emp.id === 'emp-005' ? 2500 : 0);
        const adjustments = advanceDeduction > 0 ? [
          { type: 'deduction', description: 'Advance Salary Recovery', amount: advanceDeduction }
        ] : [];
        const net = Math.max(0, gross - advanceDeduction);

        return {
          id: `pli-${emp.id}`,
          runId: 'run-cur-001',
          tenantId,
          employeeId: emp.id,
          employeeName: emp.name,
          wageType: emp.wageType,
          wageRate: emp.wageRate,
          workingDaysInMonth: 26,
          periodStartDate: `${curMonthStr}-01`,
          periodEndDate: `${curMonthStr}-${pad(daysInMonth)}`,
          presentDays: isMonthly ? 24 : 22,
          halfDays: emp.id === 'emp-003' ? 1 : 0,
          overtimeDays: (emp.id === 'emp-004' || emp.id === 'emp-005') ? 2 : 0,
          absentDays: 0,
          leaveDays: emp.id === 'emp-005' ? 1 : 0,
          dayEquivalents: isMonthly ? 26 : 22.5,
          grossAmount: gross,
          adjustments,
          netAmount: net,
          paymentStatus: 'pending',
          isLocked: false,
          paidAt: null
        };
      })
    }
  ];

  const meetings = [
    {
      id: 'meet-001',
      tenantId,
      title: 'Monthly Site Safety & Structural Review',
      date: `${curMonthStr}-18`,
      time: '10:30 AM',
      location: 'Metro Corridor Line 4 — Site Office B',
      organizer: 'Alex Morgan',
      status: 'upcoming',
      attendees: ['Vikram Mehta', 'Rajesh Kumar', 'Mohd Aslam', 'Client Lead Engineer'],
      agenda: 'Scaffolding load ratings, personal protective equipment compliance, and concrete curing log check.',
      minutes: null
    },
    {
      id: 'meet-002',
      tenantId,
      title: 'Client Progress Review — Cyber Towers Tower B',
      date: `${curMonthStr}-10`,
      time: '02:00 PM',
      location: 'Video Conference / Conference Room 1',
      organizer: 'Alex Morgan',
      status: 'completed',
      attendees: ['Priya Sharma', 'Ramesh Patel', 'Nexus Project Directors'],
      agenda: 'Milestone 1 sign-off, acoustic panel material inspection, and milestone 2 invoice payment timeline.',
      minutes: 'Client approved acoustic panel samples. Next milestone delivery scheduled for 25th of current month.'
    }
  ];

  const sessions = [
    {
      id: 'sess-001',
      tenantId,
      userId: adminId,
      deviceInfo: 'MacBook Pro (macOS 15) · Chrome 128',
      ipAddress: '127.0.0.1',
      locationName: 'Mumbai, India',
      isCurrent: true,
      lastActiveAt: new Date().toISOString()
    }
  ];

  return {
    tenant,
    user,
    employees,
    projects,
    attendance,
    payrollSettings,
    advances,
    quotations,
    invoices,
    bills,
    payrollRuns,
    meetings,
    sessions
  };
}

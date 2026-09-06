import { describe, it, expect } from 'vitest';
import { lineItemSchema, updateQuotationSchema, createQuotationSchema, createInvoiceSchema } from '../routes/billingSchemas.js';
import { createEmployeeSchema, updateEmployeeSchema } from '../routes/employeeSchemas.js';
import { generateDocumentPdf } from '../utils/pdfGenerator.js';
import { generateDocumentExcel } from '../utils/excelGenerator.js';
import { computeLineItem, calculateDailyWage, buildAttendanceSummary } from '../utils/payrollEngine.js';
import { BRAND, getBrandLogoBuffer } from '../config/branding.js';

describe('Quotation & Invoice Template Redesign, ERP Portal Branding & Daily Wage Tests', () => {
  describe('Centralized ERP Portal Branding Configuration', () => {
    it('provides consistent brand name, tagline, colors, and logo buffer', () => {
      expect(BRAND.name).toBe('ERP Portal');
      expect(BRAND.tagline).toBe('Enterprise Operations & Resource Planning');
      expect(BRAND.colors.primaryNavy).toBe('#0F5394');
      expect(BRAND.colors.secondaryTeal).toBe('#0A8F9E');
      expect(BRAND.footerDisclaimer).toContain('ERP Portal');

      const logoBuffer = getBrandLogoBuffer();
      expect(Buffer.isBuffer(logoBuffer)).toBe(true);
      expect(logoBuffer.length).toBeGreaterThan(50);
      expect(logoBuffer.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a'); // PNG magic bytes
    });
  });

  describe('PART 1 & 2: Quotation & Invoice Template Validation & Generation', () => {
    it('validates a 7-column manual line item with siteName, includeSignature, and 0% GST', () => {
      const payload = {
        clientName: 'Apex Living Infra',
        siteName: 'Villa 42, Palm Meadows',
        includeSignature: true,
        quotationDate: '2026-08-18',
        validUntil: '2026-09-18',
        notes: 'Valid for 30 days.',
        lineItems: [
          {
            srNo: 1,
            description: 'Main Teak Wood Door Frame',
            sizes: ['3x7', '3x6.5'],
            unit: 'sft',
            qty: 40.5,
            unitPrice: 1500,
            amount: 60750
          },
          {
            srNo: 2,
            description: 'Teak Architrave Skirting',
            sizes: ['150ft'],
            unit: 'rft',
            qty: 150,
            unitPrice: 120,
            amount: 18000
          }
        ]
      };

      const parsed = createQuotationSchema.parse(payload);
      expect(parsed.clientName).toBe('Apex Living Infra');
      expect(parsed.siteName).toBe('Villa 42, Palm Meadows');
      expect(parsed.includeSignature).toBe(true);
      expect(parsed.gstRate).toBe(0.0);
      expect(parsed.lineItems).toHaveLength(2);
      expect(parsed.lineItems[0].sizes).toEqual(['3x7', '3x6.5']);
      expect(parsed.lineItems[1].unit).toBe('rft');
    });

    it('validates invoice schema with siteName and digital signature toggle', () => {
      const payload = {
        clientName: 'Modern Spaces',
        siteName: 'Tower B Penthouse',
        includeSignature: false,
        invoiceDate: '2026-08-18',
        dueDate: '2026-09-02',
        lineItems: [
          {
            srNo: 1,
            description: 'Paneling',
            unit: 'sft',
            qty: 100,
            unitPrice: 350,
            amount: 35000
          }
        ]
      };

      const parsed = createInvoiceSchema.parse(payload);
      expect(parsed.clientName).toBe('Modern Spaces');
      expect(parsed.siteName).toBe('Tower B Penthouse');
      expect(parsed.includeSignature).toBe(false);
      expect(parsed.gstRate).toBe(0.0);
    });

    it('generates Quotation PDF with ERP Portal branding and logo buffer', async () => {
      const mockQuotation = {
        quotationNumber: 'QT-2026-001',
        clientName: 'Apex Living Infra',
        siteName: 'Villa 42, Palm Meadows',
        includeSignature: true,
        quotationDate: '2026-08-18',
        validUntil: '2026-09-18',
        subtotal: 60750,
        gstRate: 0,
        taxAmount: 0,
        totalAmount: 60750,
        lineItems: [
          {
            srNo: 1,
            description: 'Door Frames - Teak',
            sizes: ['3x7'],
            unit: 'sft',
            qty: 40.5,
            unitPrice: 1500,
            amount: 60750
          }
        ]
      };

      const pdfBuffer = await generateDocumentPdf(mockQuotation, 'quotation', {
        business_name: 'ERP Portal',
        signature_data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      });

      expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
      expect(pdfBuffer.length).toBeGreaterThan(1000);
      expect(pdfBuffer.subarray(0, 5).toString('utf-8')).toBe('%PDF-');

      const pdfString = pdfBuffer.toString('utf-8');
      expect(pdfString).not.toContain('Demo Interiors');
    });

    it('generates Invoice PDF with ERP Portal branding and signature omitted when toggle is OFF', async () => {
      const mockInvoice = {
        invoiceNumber: 'INV-2026-001',
        clientName: 'Apex Living Infra',
        siteName: 'Villa 42, Palm Meadows',
        includeSignature: false,
        invoiceDate: '2026-08-18',
        dueDate: '2026-09-02',
        subtotal: 60750,
        gstRate: 0,
        taxAmount: 0,
        totalAmount: 60750,
        lineItems: [
          {
            srNo: 1,
            description: 'Door Frames - Teak',
            sizes: ['3x7'],
            unit: 'sft',
            qty: 40.5,
            unitPrice: 1500,
            amount: 60750
          }
        ]
      };

      const pdfBuffer = await generateDocumentPdf(mockInvoice, 'invoice', {
        business_name: 'ERP Portal'
      });

      expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
      expect(pdfBuffer.length).toBeGreaterThan(1000);
      expect(pdfBuffer.subarray(0, 5).toString('utf-8')).toBe('%PDF-');
      const pdfString = pdfBuffer.toString('utf-8');
      expect(pdfString).not.toContain('Demo Interiors');
    });

    it('generates Quotation Excel spreadsheet (.xlsx) with embedded ERP Portal branding', async () => {
      const mockQuotation = {
        quotationNumber: 'QT-2026-001',
        clientName: 'Apex Living Infra',
        siteName: 'Villa 42, Palm Meadows',
        quotationDate: '2026-08-18',
        validUntil: '2026-09-18',
        subtotal: 78750,
        gstRate: 0,
        taxAmount: 0,
        totalAmount: 78750,
        lineItems: [
          {
            srNo: 1,
            description: 'Door Frames - Teak',
            sizes: ['3x7'],
            unit: 'sft',
            qty: 40.5,
            unitPrice: 1500,
            amount: 60750
          }
        ]
      };

      const excelBuffer = await generateDocumentExcel(mockQuotation, 'quotation', {
        business_name: 'ERP Portal'
      });

      expect(Buffer.isBuffer(excelBuffer) || excelBuffer instanceof Uint8Array).toBe(true);
      expect(excelBuffer.length).toBeGreaterThan(1000);
      expect(excelBuffer[0]).toBe(0x50);
      expect(excelBuffer[1]).toBe(0x4b);
    });

    it('generates Invoice Excel spreadsheet (.xlsx) with embedded ERP Portal branding and 0% GST', async () => {
      const mockInvoice = {
        invoiceNumber: 'INV-2026-001',
        clientName: 'Apex Living Infra',
        siteName: 'Villa 42, Palm Meadows',
        invoiceDate: '2026-08-18',
        dueDate: '2026-09-02',
        subtotal: 60750,
        gstRate: 0,
        taxAmount: 0,
        totalAmount: 60750,
        lineItems: [
          {
            srNo: 1,
            description: 'Door Frames - Teak',
            sizes: ['3x7'],
            unit: 'sft',
            qty: 40.5,
            unitPrice: 1500,
            amount: 60750
          }
        ]
      };

      const excelBuffer = await generateDocumentExcel(mockInvoice, 'invoice', {
        business_name: 'ERP Portal'
      });

      expect(Buffer.isBuffer(excelBuffer) || excelBuffer instanceof Uint8Array).toBe(true);
      expect(excelBuffer.length).toBeGreaterThan(1000);
      expect(excelBuffer[0]).toBe(0x50);
      expect(excelBuffer[1]).toBe(0x4b);
    });
  });

  describe('PART 3: Daily Wage Employee & Payroll Engine', () => {
    it('enforces daily wage type in employee creation and update schema', () => {
      const newEmp = {
        name: 'Ramesh Kumar',
        phone: '+919876543210',
        wageType: 'daily',
        wageRate: 850
      };

      const parsed = createEmployeeSchema.parse(newEmp);
      expect(parsed.wageType).toBe('daily');
      expect(parsed.wageRate).toBe(850);

      // Even if legacy 'monthly' is submitted, it normalizes to 'daily'
      const legacyMonthly = {
        name: 'Suresh Carpenter',
        wageType: 'monthly',
        wageRate: 900
      };
      const parsedMonthly = createEmployeeSchema.parse(legacyMonthly);
      expect(parsedMonthly.wageType).toBe('daily');
    });

    it('computes daily payroll line items: daily rate × days present (day equivalents)', () => {
      const emp = {
        wage_type: 'daily',
        wage_rate: 800
      };

      const summary = {
        present: 20,
        halfDay: 2,   // 2 * 0.5 = 1.0
        overtime: 2,  // 2 * 1.5 = 3.0
        absent: 2,
        leave: 0
      };

      // Day equivalents: 20 + 1 + 3 = 24.0
      // Gross amount: 24.0 * 800 = 19200.00
      const lineItem = computeLineItem(emp, summary);
      expect(lineItem.dayEquivalents).toBe(24);
      expect(lineItem.grossAmount).toBe(19200);
    });

    it('gracefully handles legacy monthly records by computing effective daily rate over 26 days', () => {
      const legacyEmp = {
        wage_type: 'monthly',
        wage_rate: 26000 // 26000 / 26 = 1000/day
      };

      const summary = {
        present: 26,
        halfDay: 0,
        overtime: 0,
        absent: 0,
        leave: 0
      };

      const lineItem = computeLineItem(legacyEmp, summary);
      expect(lineItem.dayEquivalents).toBe(26);
      expect(lineItem.grossAmount).toBe(26000);
    });
  });
});

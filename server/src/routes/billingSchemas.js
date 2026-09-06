import { z } from 'zod';

const optionalDateString = z
  .string()
  .trim()
  .optional()
  .nullable()
  .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), {
    message: 'Date must be in YYYY-MM-DD format'
  })
  .transform((v) => (!v || v === '' ? null : v));

export const unitEnum = z.preprocess((v) => {
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (s === 'rft' || s === 'running feet' || s === 'running ft' || s === 'r.ft') return 'rft';
    return 'sft';
  }
  return 'sft';
}, z.enum(['sft', 'rft']).default('sft'));

export const lineItemSchema = z.object({
  id: z.string().optional(),
  srNo: z.coerce.number().int().positive().optional().nullable(),
  description: z.string().trim().min(1, 'Description is required').max(500),
  sizes: z.preprocess((val) => {
    if (Array.isArray(val)) {
      return val
        .map((s) => {
          if (typeof s === 'object' && s !== null) {
            if (s.label && s.length && s.width) return `${s.label} (${s.length}x${s.width})`;
            if (s.length && s.width) return `${s.length}x${s.width}`;
            return s.label || '';
          }
          return typeof s === 'string' ? s.trim() : String(s || '');
        })
        .filter(Boolean);
    }
    if (typeof val === 'string' && val.trim()) {
      return val.split(',').map((s) => s.trim()).filter(Boolean);
    }
    return [];
  }, z.array(z.string().trim().max(100)).default([])),
  size: z.string().trim().max(500).optional().nullable().transform((v) => (!v || v === '' ? null : v)),
  unit: unitEnum,
  qty: z.coerce.number().positive('Quantity must be greater than 0'),
  unitPrice: z.coerce.number().min(0, 'Rate / Unit price cannot be negative'),
  amount: z.coerce.number().min(0, 'Amount cannot be negative')
});

export const createQuotationSchema = z.object({
  clientName: z.string().trim().min(1, 'Client name is required').max(180),
  clientAddress: z.string().trim().max(1000).optional().nullable().transform((v) => (!v || v === '' ? null : v)),
  siteName: z.string().trim().max(180).optional().nullable().transform((v) => (!v || v === '' ? null : v)),
  includeSignature: z.boolean().optional().default(false),
  quotationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'quotationDate must be in YYYY-MM-DD format'),
  validUntil: optionalDateString,
  gstRate: z.coerce.number().min(0).max(100).default(0.0),
  notes: z.string().trim().max(5000).optional().nullable().transform((v) => (!v || v === '' ? null : v)),
  lineItems: z.array(lineItemSchema).min(1, 'At least one line item is required')
});

export const updateQuotationSchema = z.object({
  clientName: z.string().trim().min(1, 'Client name is required').max(180),
  clientAddress: z.string().trim().max(1000).optional().nullable().transform((v) => (!v || v === '' ? null : v)),
  siteName: z.string().trim().max(180).optional().nullable().transform((v) => (!v || v === '' ? null : v)),
  includeSignature: z.boolean().optional().default(false),
  quotationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'quotationDate must be in YYYY-MM-DD format'),
  validUntil: optionalDateString,
  gstRate: z.coerce.number().min(0).max(100).default(0.0),
  notes: z.string().trim().max(5000).optional().nullable().transform((v) => (!v || v === '' ? null : v)),
  lineItems: z.array(lineItemSchema).min(1, 'At least one line item is required')
});

export const updateQuotationStatusSchema = z.object({
  status: z.enum(['draft', 'sent', 'accepted', 'rejected', 'expired'])
});

export const createInvoiceSchema = z.object({
  projectId: z.string().uuid().optional().nullable().or(z.literal('')).transform((v) => (!v || v === '' ? null : v)),
  quotationId: z.string().uuid().optional().nullable().or(z.literal('')).transform((v) => (!v || v === '' ? null : v)),
  clientName: z.string().trim().min(1, 'Client name is required').max(180),
  clientAddress: z.string().trim().max(1000).optional().nullable().transform((v) => (!v || v === '' ? null : v)),
  siteName: z.string().trim().max(180).optional().nullable().transform((v) => (!v || v === '' ? null : v)),
  includeSignature: z.boolean().optional().default(false),
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'invoiceDate must be in YYYY-MM-DD format'),
  dueDate: optionalDateString,
  gstRate: z.coerce.number().min(0).max(100).default(0.0),
  notes: z.string().trim().max(5000).optional().nullable().transform((v) => (!v || v === '' ? null : v)),
  lineItems: z.array(lineItemSchema).min(1, 'At least one line item is required')
});

export const updateInvoiceStatusSchema = z.object({
  status: z.enum(['draft', 'sent', 'partial', 'paid', 'overdue', 'cancelled']),
  paidAmount: z.coerce.number().min(0).optional().nullable()
});

export const createBillSchema = z.object({
  vendorName: z.string().trim().min(1, 'Vendor name is required').max(180),
  billNumber: z.string().trim().max(80).optional().nullable().transform((v) => (!v || v === '' ? null : v)),
  billDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'billDate must be in YYYY-MM-DD format'),
  dueDate: optionalDateString,
  totalAmount: z.coerce.number().positive('Total amount must be greater than 0'),
  description: z.string().trim().max(5000).optional().nullable().transform((v) => (!v || v === '' ? null : v))
});

export const updateBillSchema = z.object({
  status: z.enum(['unpaid', 'partial', 'paid', 'cancelled']),
  paidAmount: z.coerce.number().min(0).optional()
});

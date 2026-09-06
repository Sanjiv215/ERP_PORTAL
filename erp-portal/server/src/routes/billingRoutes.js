import { Router } from 'express';
import { ROLES } from '../constants/roles.js';
import { requireRole } from '../middleware/requireRole.js';
import { resolveTenantContext } from '../middleware/resolveTenantContext.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  listQuotations,
  createQuotation,
  updateQuotation,
  updateQuotationStatus,
  deleteQuotation,
  getQuotationPdf,
  getQuotationExcel,
  listInvoices,
  createInvoice,
  convertQuotationToInvoice,
  updateInvoiceStatus,
  deleteInvoice,
  getInvoicePdf,
  getPendingPaymentsDashboard,
  listBills,
  createBill,
  updateBill
} from '../services/billingService.js';
import {
  createQuotationSchema,
  updateQuotationSchema,
  updateQuotationStatusSchema,
  createInvoiceSchema,
  updateInvoiceStatusSchema,
  createBillSchema,
  updateBillSchema
} from './billingSchemas.js';

export const billingRouter = Router();

function requestMeta(req) {
  return { ipAddress: req.ip };
}

billingRouter.use(resolveTenantContext);

// ── Quotations ────────────────────────────────────────────────────────────────

billingRouter.get(
  '/quotations',
  requireRole([ROLES.TENANT_ADMIN, ROLES.ACCOUNTANT, ROLES.MANAGER]),
  asyncHandler(async (req, res) => {
    res.json({ quotations: await listQuotations(req.context) });
  })
);

billingRouter.post(
  '/quotations',
  requireRole([ROLES.TENANT_ADMIN, ROLES.ACCOUNTANT, ROLES.MANAGER]),
  validateBody(createQuotationSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json({ quotation: await createQuotation(req.context, req.body, requestMeta(req)) });
  })
);

billingRouter.put(
  '/quotations/:quotationId',
  requireRole([ROLES.TENANT_ADMIN, ROLES.ACCOUNTANT, ROLES.MANAGER]),
  validateBody(updateQuotationSchema),
  asyncHandler(async (req, res) => {
    res.json({ quotation: await updateQuotation(req.context, req.params.quotationId, req.body, requestMeta(req)) });
  })
);

billingRouter.patch(
  '/quotations/:quotationId/status',
  requireRole([ROLES.TENANT_ADMIN, ROLES.ACCOUNTANT]),
  validateBody(updateQuotationStatusSchema),
  asyncHandler(async (req, res) => {
    res.json({ quotation: await updateQuotationStatus(req.context, req.params.quotationId, req.body.status, requestMeta(req)) });
  })
);

billingRouter.post(
  '/quotations/:quotationId/convert',
  requireRole([ROLES.TENANT_ADMIN, ROLES.ACCOUNTANT]),
  asyncHandler(async (req, res) => {
    res.status(201).json({ invoice: await convertQuotationToInvoice(req.context, req.params.quotationId, requestMeta(req)) });
  })
);

billingRouter.delete(
  '/quotations/:quotationId',
  requireRole([ROLES.TENANT_ADMIN, ROLES.ACCOUNTANT]),
  asyncHandler(async (req, res) => {
    res.json(await deleteQuotation(req.context, req.params.quotationId, requestMeta(req)));
  })
);

billingRouter.get(
  '/quotations/:quotationId/pdf',
  requireRole([ROLES.TENANT_ADMIN, ROLES.ACCOUNTANT, ROLES.MANAGER]),
  asyncHandler(async (req, res) => {
    const { filename, buffer } = await getQuotationPdf(req.context, req.params.quotationId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  })
);

billingRouter.get(
  '/quotations/:quotationId/xlsx',
  requireRole([ROLES.TENANT_ADMIN, ROLES.ACCOUNTANT, ROLES.MANAGER]),
  asyncHandler(async (req, res) => {
    const { filename, buffer } = await getQuotationExcel(req.context, req.params.quotationId);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  })
);

// ── Invoices ──────────────────────────────────────────────────────────────────

billingRouter.get(
  '/invoices',
  requireRole([ROLES.TENANT_ADMIN, ROLES.ACCOUNTANT, ROLES.MANAGER]),
  asyncHandler(async (req, res) => {
    res.json({ invoices: await listInvoices(req.context) });
  })
);

billingRouter.post(
  '/invoices',
  requireRole([ROLES.TENANT_ADMIN, ROLES.ACCOUNTANT]),
  validateBody(createInvoiceSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json({ invoice: await createInvoice(req.context, req.body, requestMeta(req)) });
  })
);

billingRouter.patch(
  '/invoices/:invoiceId/status',
  requireRole([ROLES.TENANT_ADMIN, ROLES.ACCOUNTANT]),
  validateBody(updateInvoiceStatusSchema),
  asyncHandler(async (req, res) => {
    res.json({ invoice: await updateInvoiceStatus(req.context, req.params.invoiceId, req.body, requestMeta(req)) });
  })
);

billingRouter.delete(
  '/invoices/:invoiceId',
  requireRole([ROLES.TENANT_ADMIN, ROLES.ACCOUNTANT]),
  asyncHandler(async (req, res) => {
    res.json(await deleteInvoice(req.context, req.params.invoiceId, requestMeta(req)));
  })
);

billingRouter.get(
  '/invoices/:invoiceId/pdf',
  requireRole([ROLES.TENANT_ADMIN, ROLES.ACCOUNTANT, ROLES.MANAGER]),
  asyncHandler(async (req, res) => {
    const { filename, buffer } = await getInvoicePdf(req.context, req.params.invoiceId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  })
);

// E4-05: Pending Payments & Aging Dashboard
billingRouter.get(
  '/pending-payments',
  requireRole([ROLES.TENANT_ADMIN, ROLES.ACCOUNTANT]),
  asyncHandler(async (req, res) => {
    res.json(await getPendingPaymentsDashboard(req.context));
  })
);

// ── Bills ─────────────────────────────────────────────────────────────────────

billingRouter.get(
  '/bills',
  requireRole([ROLES.TENANT_ADMIN, ROLES.ACCOUNTANT, ROLES.MANAGER]),
  asyncHandler(async (req, res) => {
    res.json({ bills: await listBills(req.context) });
  })
);

billingRouter.post(
  '/bills',
  requireRole([ROLES.TENANT_ADMIN, ROLES.ACCOUNTANT]),
  validateBody(createBillSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json({ bill: await createBill(req.context, req.body, requestMeta(req)) });
  })
);

billingRouter.patch(
  '/bills/:billId',
  requireRole([ROLES.TENANT_ADMIN, ROLES.ACCOUNTANT]),
  validateBody(updateBillSchema),
  asyncHandler(async (req, res) => {
    res.json({ bill: await updateBill(req.context, req.params.billId, req.body, requestMeta(req)) });
  })
);

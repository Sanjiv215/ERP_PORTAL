import { randomUUID } from 'node:crypto';
import { pool, withTransaction } from '../db/pool.js';
import { AppError } from '../middleware/errorHandler.js';
import { appendAuditLog } from '../repositories/auditRepository.js';
import {
  getNextDocumentNumber,
  listQuotationsByTenant,
  findQuotationById,
  createQuotationRecord,
  updateQuotationRecord,
  updateQuotationStatusRecord,
  softDeleteQuotationRecord,
  findInvoiceByQuotationId,
  findTenantDetailsById,
  listInvoicesByTenant,
  findInvoiceById,
  createInvoiceRecord,
  updateInvoiceStatusAndPayment,
  softDeleteInvoiceRecord,
  listBillsByTenant,
  findBillById,
  createBillRecord,
  updateBillStatusRecord,
  getPendingPaymentsAging
} from '../repositories/billingRepository.js';
import { generateDocumentPdf } from '../utils/pdfGenerator.js';
import { generateDocumentExcel } from '../utils/excelGenerator.js';

function publicQuotation(q) {
  if (!q) return null;
  return {
    id: q.id,
    tenantId: q.tenant_id,
    quotationNumber: q.quotation_number,
    clientName: q.client_name,
    clientAddress: q.client_address,
    siteName: q.site_name || null,
    includeSignature: Boolean(q.include_signature),
    quotationDate: q.quotation_date,
    validUntil: q.valid_until,
    subtotal: Number(q.subtotal),
    gstRate: Number(q.gst_rate),
    taxAmount: Number(q.tax_amount),
    totalAmount: Number(q.total_amount),
    status: q.status,
    notes: q.notes,
    lineItems: q.lineItems || [],
    createdAt: q.created_at,
    updatedAt: q.updated_at
  };
}

function publicInvoice(inv) {
  if (!inv) return null;
  return {
    id: inv.id,
    tenantId: inv.tenant_id,
    projectId: inv.project_id,
    projectName: inv.project_name || null,
    invoiceNumber: inv.invoice_number,
    quotationId: inv.quotation_id,
    clientName: inv.client_name,
    clientAddress: inv.client_address,
    siteName: inv.site_name || null,
    includeSignature: Boolean(inv.include_signature),
    invoiceDate: inv.invoice_date,
    dueDate: inv.due_date,
    subtotal: Number(inv.subtotal),
    gstRate: Number(inv.gst_rate),
    taxAmount: Number(inv.tax_amount),
    totalAmount: Number(inv.total_amount),
    paidAmount: Number(inv.paid_amount),
    status: inv.status,
    notes: inv.notes,
    paymentLinkId: inv.payment_link_id,
    paymentLinkUrl: inv.payment_link_url,
    paymentLinkStatus: inv.payment_link_status,
    lineItems: inv.lineItems || [],
    createdAt: inv.created_at,
    updatedAt: inv.updated_at
  };
}

function publicBill(b) {
  if (!b) return null;
  return {
    id: b.id,
    vendorName: b.vendor_name,
    billNumber: b.bill_number,
    billDate: b.bill_date,
    dueDate: b.due_date,
    totalAmount: Number(b.total_amount),
    paidAmount: Number(b.paid_amount),
    status: b.status,
    description: b.description,
    createdAt: b.created_at
  };
}

// ── Quotations (E4-01) ────────────────────────────────────────────────────────

export async function listQuotations(context) {
  const connection = await pool.getConnection();
  try {
    const rows = await listQuotationsByTenant(connection, context.tenantId);
    return rows.map(publicQuotation);
  } finally {
    connection.release();
  }
}

export async function createQuotation(context, payload, requestMeta) {
  return withTransaction(async (connection) => {
    const quotationNumber = await getNextDocumentNumber(connection, context.tenantId, 'quotation');
    const q = await createQuotationRecord(connection, context.tenantId, payload, quotationNumber, context.userId);

    await appendAuditLog(connection, {
      tenantId: context.tenantId,
      userId: context.userId,
      action: 'quotation.create',
      entity: 'quotations',
      entityId: q.id,
      ipAddress: requestMeta.ipAddress
    });

    return publicQuotation(q);
  });
}

export async function updateQuotation(context, quotationId, payload, requestMeta) {
  return withTransaction(async (connection) => {
    const existing = await findQuotationById(connection, context.tenantId, quotationId);
    if (!existing || existing.removed_at) throw new AppError(404, 'Quotation not found', 'NOT_FOUND');

    const linkedInvoice = await findInvoiceByQuotationId(connection, context.tenantId, quotationId);
    if (existing.status === 'accepted' || linkedInvoice) {
      throw new AppError(400, 'Quotation has already been converted to an invoice and cannot be modified', 'QUOTATION_LOCKED');
    }

    const updated = await updateQuotationRecord(connection, context.tenantId, quotationId, payload);

    await appendAuditLog(connection, {
      tenantId: context.tenantId,
      userId: context.userId,
      action: 'quotation.update',
      entity: 'quotations',
      entityId: quotationId,
      ipAddress: requestMeta.ipAddress
    });

    return publicQuotation(updated);
  });
}

export async function updateQuotationStatus(context, quotationId, status, requestMeta) {
  return withTransaction(async (connection) => {
    const existing = await findQuotationById(connection, context.tenantId, quotationId);
    if (!existing || existing.removed_at) throw new AppError(404, 'Quotation not found', 'NOT_FOUND');

    const updated = await updateQuotationStatusRecord(connection, context.tenantId, quotationId, status);

    await appendAuditLog(connection, {
      tenantId: context.tenantId,
      userId: context.userId,
      action: 'quotation.status_update',
      entity: 'quotations',
      entityId: quotationId,
      ipAddress: requestMeta.ipAddress
    });

    return publicQuotation(updated);
  });
}

export async function deleteQuotation(context, quotationId, requestMeta) {
  return withTransaction(async (connection) => {
    const existing = await findQuotationById(connection, context.tenantId, quotationId);
    if (!existing || existing.removed_at) {
      throw new AppError(404, 'Quotation not found', 'NOT_FOUND');
    }

    const linkedInvoice = await findInvoiceByQuotationId(connection, context.tenantId, quotationId);
    if (existing.status === 'accepted' || linkedInvoice) {
      throw new AppError(400, 'This quotation has been converted to an invoice and cannot be deleted', 'QUOTATION_CONVERTED_CANNOT_DELETE');
    }

    await softDeleteQuotationRecord(connection, context.tenantId, quotationId);

    await appendAuditLog(connection, {
      tenantId: context.tenantId,
      userId: context.userId,
      action: 'quotation.delete',
      entity: 'quotations',
      entityId: quotationId,
      ipAddress: requestMeta.ipAddress,
      metadata: { quotationNumber: existing.quotation_number }
    });

    return { id: quotationId, quotationNumber: existing.quotation_number, message: 'Quotation deleted successfully' };
  });
}

export async function getQuotationPdf(context, quotationId) {
  const connection = await pool.getConnection();
  try {
    const q = await findQuotationById(connection, context.tenantId, quotationId);
    if (!q) throw new AppError(404, 'Quotation not found', 'NOT_FOUND');

    const tenant = await findTenantDetailsById(connection, context.tenantId);
    const pdfBuffer = await generateDocumentPdf(publicQuotation(q), 'quotation', tenant || {});

    return {
      filename: `ERP_Portal_Quotation_${q.quotation_number}.pdf`,
      buffer: pdfBuffer
    };
  } finally {
    connection.release();
  }
}

export async function getQuotationExcel(context, quotationId) {
  const connection = await pool.getConnection();
  try {
    const q = await findQuotationById(connection, context.tenantId, quotationId);
    if (!q) throw new AppError(404, 'Quotation not found', 'NOT_FOUND');

    const tenant = await findTenantDetailsById(connection, context.tenantId);
    const excelBuffer = await generateDocumentExcel(publicQuotation(q), 'quotation', tenant || {});

    return {
      filename: `ERP_Portal_Quotation_${q.quotation_number}.xlsx`,
      buffer: excelBuffer
    };
  } finally {
    connection.release();
  }
}

export async function getInvoicePdf(context, invoiceId) {
  const connection = await pool.getConnection();
  try {
    const inv = await findInvoiceById(connection, context.tenantId, invoiceId);
    if (!inv) throw new AppError(404, 'Invoice not found', 'NOT_FOUND');

    const tenant = await findTenantDetailsById(connection, context.tenantId);
    const pdfBuffer = await generateDocumentPdf(publicInvoice(inv), 'invoice', tenant || {});

    return {
      filename: `ERP_Portal_Invoice_${inv.invoice_number}.pdf`,
      buffer: pdfBuffer
    };
  } finally {
    connection.release();
  }
}

// ── Invoices & Quotation->Invoice Conversion (E4-02, E4-03) ───────────────────

export async function listInvoices(context) {
  const connection = await pool.getConnection();
  try {
    const rows = await listInvoicesByTenant(connection, context.tenantId);
    return rows.map(publicInvoice);
  } finally {
    connection.release();
  }
}

export async function createInvoice(context, payload, requestMeta) {
  return withTransaction(async (connection) => {
    const invoiceNumber = await getNextDocumentNumber(connection, context.tenantId, 'invoice');
    const inv = await createInvoiceRecord(connection, context.tenantId, payload, invoiceNumber, context.userId);

    await appendAuditLog(connection, {
      tenantId: context.tenantId,
      userId: context.userId,
      action: 'invoice.create',
      entity: 'invoices',
      entityId: inv.id,
      ipAddress: requestMeta.ipAddress
    });

    return publicInvoice(inv);
  });
}

export async function convertQuotationToInvoice(context, quotationId, requestMeta) {
  return withTransaction(async (connection) => {
    const quotation = await findQuotationById(connection, context.tenantId, quotationId);
    if (!quotation || quotation.removed_at) throw new AppError(404, 'Quotation not found', 'NOT_FOUND');

    const invoiceNumber = await getNextDocumentNumber(connection, context.tenantId, 'invoice');

    const invoicePayload = {
      quotationId: quotation.id,
      clientName: quotation.client_name,
      clientAddress: quotation.client_address,
      siteName: quotation.site_name || null,
      includeSignature: Boolean(quotation.include_signature),
      invoiceDate: new Date().toISOString().slice(0, 10),
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      gstRate: Number(quotation.gst_rate || 0),
      notes: `Converted from Quotation ${quotation.quotation_number}`,
      lineItems: quotation.lineItems
    };

    const inv = await createInvoiceRecord(connection, context.tenantId, invoicePayload, invoiceNumber, context.userId);
    await updateQuotationStatusRecord(connection, context.tenantId, quotationId, 'accepted');

    await appendAuditLog(connection, {
      tenantId: context.tenantId,
      userId: context.userId,
      action: 'quotation.convert_to_invoice',
      entity: 'invoices',
      entityId: inv.id,
      ipAddress: requestMeta.ipAddress
    });

    return publicInvoice(inv);
  });
}

export async function updateInvoiceStatus(context, invoiceId, payload, requestMeta) {
  return withTransaction(async (connection) => {
    const existing = await findInvoiceById(connection, context.tenantId, invoiceId);
    if (!existing || existing.removed_at) throw new AppError(404, 'Invoice not found', 'NOT_FOUND');

    const inv = await updateInvoiceStatusAndPayment(
      connection,
      context.tenantId,
      invoiceId,
      payload.status,
      payload.paidAmount !== undefined ? payload.paidAmount : null
    );

    // Auto-post income to P&L when invoice is marked paid
    if (payload.status === 'paid' && existing.status !== 'paid') {
      await connection.execute(
        `INSERT INTO income_entries (id, tenant_id, project_id, entry_date, category, description, amount, reference_id, recorded_by, auto_posted)
         VALUES (?, ?, ?, ?, 'revenue', ?, ?, ?, ?, TRUE)`,
        [
          randomUUID(),
          context.tenantId,
          inv.project_id || null,
          new Date().toISOString().slice(0, 10),
          `Invoice ${inv.invoice_number} — ${inv.client_name}`,
          Number(inv.total_amount),
          invoiceId,
          context.userId
        ]
      );
    }

    await appendAuditLog(connection, {
      tenantId: context.tenantId,
      userId: context.userId,
      action: 'invoice.status_update',
      entity: 'invoices',
      entityId: invoiceId,
      ipAddress: requestMeta.ipAddress
    });

    return publicInvoice(inv);
  });
}

export async function deleteInvoice(context, invoiceId, requestMeta) {
  return withTransaction(async (connection) => {
    const existing = await findInvoiceById(connection, context.tenantId, invoiceId);
    if (!existing || existing.removed_at) {
      throw new AppError(404, 'Invoice not found', 'NOT_FOUND');
    }

    const paidAmount = Number(existing.paid_amount || 0);
    if (paidAmount > 0 || ['partial', 'paid'].includes(existing.status)) {
      throw new AppError(
        400,
        'Invoices with payment history cannot be deleted. Use Cancel/Void status instead.',
        'INVOICE_HAS_PAYMENTS_CANNOT_DELETE'
      );
    }

    await softDeleteInvoiceRecord(connection, context.tenantId, invoiceId);

    await appendAuditLog(connection, {
      tenantId: context.tenantId,
      userId: context.userId,
      action: 'invoice.delete',
      entity: 'invoices',
      entityId: invoiceId,
      ipAddress: requestMeta.ipAddress,
      metadata: { invoiceNumber: existing.invoice_number }
    });

    return { id: invoiceId, invoiceNumber: existing.invoice_number, message: 'Invoice deleted successfully' };
  });
}

// ── Pending Payments & Aging Buckets (E4-05) ──────────────────────────────────

export async function getPendingPaymentsDashboard(context) {
  const connection = await pool.getConnection();
  try {
    return getPendingPaymentsAging(connection, context.tenantId);
  } finally {
    connection.release();
  }
}

// ── Bills Management ──────────────────────────────────────────────────────────

export async function listBills(context) {
  const connection = await pool.getConnection();
  try {
    const rows = await listBillsByTenant(connection, context.tenantId);
    return rows.map(publicBill);
  } finally {
    connection.release();
  }
}

export async function createBill(context, payload, requestMeta) {
  return withTransaction(async (connection) => {
    const bill = await createBillRecord(connection, context.tenantId, payload, context.userId);
    await appendAuditLog(connection, {
      tenantId: context.tenantId,
      userId: context.userId,
      action: 'bill.create',
      entity: 'bills',
      entityId: bill.id,
      ipAddress: requestMeta.ipAddress
    });
    return publicBill(bill);
  });
}

export async function updateBill(context, billId, payload, requestMeta) {
  return withTransaction(async (connection) => {
    const existing = await findBillById(connection, context.tenantId, billId);
    if (!existing) throw new AppError(404, 'Bill not found', 'NOT_FOUND');

    const updated = await updateBillStatusRecord(
      connection,
      context.tenantId,
      billId,
      payload.status,
      payload.paidAmount !== undefined ? payload.paidAmount : existing.paid_amount
    );

    await appendAuditLog(connection, {
      tenantId: context.tenantId,
      userId: context.userId,
      action: 'bill.update',
      entity: 'bills',
      entityId: billId,
      ipAddress: requestMeta.ipAddress
    });

    return publicBill(updated);
  });
}

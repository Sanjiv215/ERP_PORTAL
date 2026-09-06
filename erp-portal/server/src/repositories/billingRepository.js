import { randomUUID } from 'node:crypto';

// ── Document Number Sequences ────────────────────────────────────────────────

export async function getNextDocumentNumber(connection, tenantId, docType) {
  const year = new Date().getFullYear();
  await connection.execute(
    `INSERT INTO document_sequences (tenant_id, doc_type, year, last_seq)
     VALUES (?, ?, ?, 1)
     ON CONFLICT (tenant_id, doc_type, year) DO UPDATE SET last_seq = document_sequences.last_seq + 1`,
    [tenantId, docType, year]
  );

  const [rows] = await connection.execute(
    `SELECT last_seq FROM document_sequences WHERE tenant_id = ? AND doc_type = ? AND year = ?`,
    [tenantId, docType, year]
  );

  const seq = String(rows[0].last_seq).padStart(3, '0');
  const prefix = docType === 'invoice' ? 'INV' : 'QT';
  return `${prefix}-${year}-${seq}`;
}

// ── Quotations (E4-01) ────────────────────────────────────────────────────────

function parseLineItems(row) {
  return {
    ...row,
    clientName: row.client_name,
    clientAddress: row.client_address,
    siteName: row.site_name || null,
    includeSignature: Boolean(row.include_signature),
    removedAt: row.removed_at || null,
    lineItems: typeof row.line_items_json === 'string'
      ? JSON.parse(row.line_items_json)
      : (row.line_items_json || [])
  };
}

export async function listQuotationsByTenant(connection, tenantId) {
  const [rows] = await connection.execute(
    `SELECT id, tenant_id, quotation_number, client_name, client_address, site_name, include_signature,
            quotation_date, valid_until, subtotal, gst_rate, tax_amount, total_amount,
            status, notes, line_items_json, created_by, created_at, updated_at, removed_at
     FROM quotations
     WHERE tenant_id = ? AND removed_at IS NULL
     ORDER BY created_at DESC`,
    [tenantId]
  );
  return rows.map(parseLineItems);
}

export async function softDeleteQuotationRecord(connection, tenantId, id) {
  await connection.execute(
    `UPDATE quotations SET removed_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ? AND removed_at IS NULL`,
    [tenantId, id]
  );
}

export async function findQuotationById(connection, tenantId, id) {
  const [rows] = await connection.execute(
    `SELECT id, tenant_id, quotation_number, client_name, client_address, site_name, include_signature,
            quotation_date, valid_until, subtotal, gst_rate, tax_amount, total_amount,
            status, notes, line_items_json, created_by, created_at, updated_at, removed_at
     FROM quotations
     WHERE tenant_id = ? AND id = ?
     LIMIT 1`,
    [tenantId, id]
  );
  return rows[0] ? parseLineItems(rows[0]) : null;
}

export async function createQuotationRecord(connection, tenantId, payload, quotationNumber, createdBy) {
  const id = randomUUID();
  const subtotal = payload.lineItems.reduce((s, li) => s + Number(li.amount), 0);
  const gstRate = Number(payload.gstRate ?? 0.0);
  const taxAmount = Math.round((subtotal * gstRate) / 100 * 100) / 100;
  const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;

  await connection.execute(
    `INSERT INTO quotations
       (id, tenant_id, quotation_number, client_name, client_address, site_name, include_signature,
        quotation_date, valid_until, subtotal, gst_rate, tax_amount, total_amount,
        status, notes, line_items_json, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)`,
    [
      id,
      tenantId,
      quotationNumber,
      payload.clientName,
      payload.clientAddress || null,
      payload.siteName || null,
      Boolean(payload.includeSignature),
      payload.quotationDate,
      payload.validUntil || null,
      subtotal,
      gstRate,
      taxAmount,
      totalAmount,
      payload.notes || null,
      JSON.stringify(payload.lineItems),
      createdBy
    ]
  );

  return findQuotationById(connection, tenantId, id);
}

export async function updateQuotationRecord(connection, tenantId, id, payload) {
  const subtotal = payload.lineItems.reduce((s, li) => s + Number(li.amount), 0);
  const gstRate = Number(payload.gstRate ?? 0.0);
  const taxAmount = Math.round((subtotal * gstRate) / 100 * 100) / 100;
  const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;

  await connection.execute(
    `UPDATE quotations
     SET client_name = ?, client_address = ?, site_name = ?, include_signature = ?,
         quotation_date = ?, valid_until = ?, subtotal = ?, gst_rate = ?, tax_amount = ?, total_amount = ?,
         notes = ?, line_items_json = ?, updated_at = CURRENT_TIMESTAMP
     WHERE tenant_id = ? AND id = ?`,
    [
      payload.clientName,
      payload.clientAddress || null,
      payload.siteName || null,
      Boolean(payload.includeSignature),
      payload.quotationDate,
      payload.validUntil || null,
      subtotal,
      gstRate,
      taxAmount,
      totalAmount,
      payload.notes || null,
      JSON.stringify(payload.lineItems),
      tenantId,
      id
    ]
  );

  return findQuotationById(connection, tenantId, id);
}

export async function updateQuotationStatusRecord(connection, tenantId, id, status) {
  await connection.execute(
    `UPDATE quotations SET status = ? WHERE tenant_id = ? AND id = ?`,
    [status, tenantId, id]
  );
  return findQuotationById(connection, tenantId, id);
}

export async function findInvoiceByQuotationId(connection, tenantId, quotationId) {
  const [rows] = await connection.execute(
    `SELECT id, invoice_number, status FROM invoices WHERE tenant_id = ? AND quotation_id = ? LIMIT 1`,
    [tenantId, quotationId]
  );
  return rows[0] || null;
}

export async function findTenantDetailsById(connection, tenantId) {
  const [rows] = await connection.execute(
    `SELECT id, business_name, signature_data, subscription_plan, status, created_at
     FROM tenants
     WHERE id = ?
     LIMIT 1`,
    [tenantId]
  );
  return rows[0] || null;
}

export async function updateTenantSignatureRecord(connection, tenantId, signatureData) {
  await connection.execute(
    `UPDATE tenants SET signature_data = ? WHERE id = ?`,
    [signatureData || null, tenantId]
  );
  return findTenantDetailsById(connection, tenantId);
}

// ── Invoices (E4-02, E4-03, E4-04) ────────────────────────────────────────────

export async function listInvoicesByTenant(connection, tenantId) {
  const [rows] = await connection.execute(
    `SELECT i.id, i.tenant_id, i.project_id, p.name AS project_name, i.invoice_number, i.quotation_id,
            i.client_name, i.client_address, i.site_name, i.include_signature,
            i.invoice_date, i.due_date, i.subtotal, i.gst_rate, i.tax_amount, i.total_amount, i.paid_amount,
            i.status, i.notes, i.payment_link_id, i.payment_link_url, i.payment_link_status,
            i.line_items_json, i.created_by, i.created_at, i.updated_at, i.removed_at
     FROM invoices i
     LEFT JOIN projects p ON p.tenant_id = i.tenant_id AND p.id = i.project_id
     WHERE i.tenant_id = ? AND i.removed_at IS NULL
     ORDER BY i.created_at DESC`,
    [tenantId]
  );
  return rows.map(parseLineItems);
}

export async function softDeleteInvoiceRecord(connection, tenantId, id) {
  await connection.execute(
    `UPDATE invoices SET removed_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ? AND removed_at IS NULL`,
    [tenantId, id]
  );
}

export async function findInvoiceById(connection, tenantId, id) {
  const [rows] = await connection.execute(
    `SELECT i.id, i.tenant_id, i.project_id, p.name AS project_name, i.invoice_number, i.quotation_id,
            i.client_name, i.client_address, i.site_name, i.include_signature,
            i.invoice_date, i.due_date, i.subtotal, i.gst_rate, i.tax_amount, i.total_amount, i.paid_amount,
            i.status, i.notes, i.payment_link_id, i.payment_link_url, i.payment_link_status,
            i.line_items_json, i.created_by, i.created_at, i.updated_at, i.removed_at
     FROM invoices i
     LEFT JOIN projects p ON p.tenant_id = i.tenant_id AND p.id = i.project_id
     WHERE i.tenant_id = ? AND i.id = ?
     LIMIT 1`,
    [tenantId, id]
  );
  return rows[0] ? parseLineItems(rows[0]) : null;
}

export async function findInvoiceByPaymentLinkId(connection, paymentLinkId) {
  const [rows] = await connection.execute(
    `SELECT i.id, i.tenant_id, i.project_id, p.name AS project_name, i.invoice_number, i.quotation_id,
            i.client_name, i.client_address, i.site_name, i.include_signature,
            i.invoice_date, i.due_date, i.subtotal, i.gst_rate, i.tax_amount, i.total_amount, i.paid_amount,
            i.status, i.notes, i.payment_link_id, i.payment_link_url, i.payment_link_status,
            i.line_items_json, i.created_by, i.created_at, i.updated_at
     FROM invoices i
     LEFT JOIN projects p ON p.tenant_id = i.tenant_id AND p.id = i.project_id
     WHERE i.payment_link_id = ?
     LIMIT 1`,
    [paymentLinkId]
  );
  return rows[0] ? parseLineItems(rows[0]) : null;
}

export async function createInvoiceRecord(connection, tenantId, payload, invoiceNumber, createdBy) {
  const id = randomUUID();
  const subtotal = payload.lineItems.reduce((s, li) => s + Number(li.amount), 0);
  const gstRate = Number(payload.gstRate ?? 0.0);
  const taxAmount = Math.round((subtotal * gstRate) / 100 * 100) / 100;
  const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;

  await connection.execute(
    `INSERT INTO invoices
       (id, tenant_id, project_id, invoice_number, quotation_id, client_name, client_address, site_name, include_signature,
        invoice_date, due_date, subtotal, gst_rate, tax_amount, total_amount, paid_amount,
        status, notes, line_items_json, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.00, 'draft', ?, ?, ?)`,
    [
      id,
      tenantId,
      payload.projectId || null,
      invoiceNumber,
      payload.quotationId || null,
      payload.clientName,
      payload.clientAddress || null,
      payload.siteName || null,
      Boolean(payload.includeSignature),
      payload.invoiceDate,
      payload.dueDate || null,
      subtotal,
      gstRate,
      taxAmount,
      totalAmount,
      payload.notes || null,
      JSON.stringify(payload.lineItems),
      createdBy
    ]
  );

  return findInvoiceById(connection, tenantId, id);
}

export async function updateInvoiceStatusAndPayment(connection, tenantId, id, status, paidAmount = null) {
  if (paidAmount !== null && paidAmount !== undefined) {
    await connection.execute(
      `UPDATE invoices
       SET status = ?, paid_amount = ?, updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = ? AND id = ?`,
      [status, paidAmount, tenantId, id]
    );
  } else {
    await connection.execute(
      `UPDATE invoices
       SET status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = ? AND id = ?`,
      [status, tenantId, id]
    );
  }
  return findInvoiceById(connection, tenantId, id);
}

export async function updateInvoicePaymentLink(connection, tenantId, id, paymentLinkId, paymentLinkUrl) {
  await connection.execute(
    `UPDATE invoices
     SET payment_link_id = ?, payment_link_url = ?, payment_link_status = 'created', updated_at = CURRENT_TIMESTAMP
     WHERE tenant_id = ? AND id = ?`,
    [paymentLinkId, paymentLinkUrl, tenantId, id]
  );
  return findInvoiceById(connection, tenantId, id);
}

export async function markInvoicePaymentLinkPaid(connection, paymentLinkId, paidAmount) {
  await connection.execute(
    `UPDATE invoices
     SET status = 'paid', paid_amount = ?, payment_link_status = 'paid', updated_at = CURRENT_TIMESTAMP
     WHERE payment_link_id = ?`,
    [paidAmount, paymentLinkId]
  );
}

// ── Bills (E4-05) ────────────────────────────────────────────────────────────

export async function listBillsByTenant(connection, tenantId) {
  const [rows] = await connection.execute(
    `SELECT id, tenant_id, vendor_name, bill_number, bill_date, due_date,
            total_amount, paid_amount, status, description, created_by, created_at
     FROM bills
     WHERE tenant_id = ?
     ORDER BY created_at DESC`,
    [tenantId]
  );
  return rows;
}

export async function findBillById(connection, tenantId, id) {
  const [rows] = await connection.execute(
    `SELECT id, tenant_id, vendor_name, bill_number, bill_date, due_date,
            total_amount, paid_amount, status, description, created_by, created_at
     FROM bills
     WHERE tenant_id = ? AND id = ?
     LIMIT 1`,
    [tenantId, id]
  );
  return rows[0] || null;
}

export async function createBillRecord(connection, tenantId, payload, createdBy) {
  const id = randomUUID();
  await connection.execute(
    `INSERT INTO bills
       (id, tenant_id, vendor_name, bill_number, bill_date, due_date,
        total_amount, paid_amount, status, description, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0.00, 'unpaid', ?, ?)`,
    [
      id,
      tenantId,
      payload.vendorName,
      payload.billNumber || null,
      payload.billDate,
      payload.dueDate || null,
      payload.totalAmount,
      payload.description || null,
      createdBy
    ]
  );
  return findBillById(connection, tenantId, id);
}

export async function updateBillRecord(connection, tenantId, id, payload) {
  await connection.execute(
    `UPDATE bills
     SET vendor_name = ?, bill_number = ?, bill_date = ?, due_date = ?,
         total_amount = ?, description = ?
     WHERE tenant_id = ? AND id = ?`,
    [
      payload.vendorName,
      payload.billNumber || null,
      payload.billDate,
      payload.dueDate || null,
      payload.totalAmount,
      payload.description || null,
      tenantId,
      id
    ]
  );
  return findBillById(connection, tenantId, id);
}

export async function updateBillStatusRecord(connection, tenantId, id, status, paidAmount = null) {
  if (paidAmount !== null && paidAmount !== undefined) {
    await connection.execute(
      `UPDATE bills SET status = ?, paid_amount = ? WHERE tenant_id = ? AND id = ?`,
      [status, paidAmount, tenantId, id]
    );
  } else {
    await connection.execute(
      `UPDATE bills SET status = ? WHERE tenant_id = ? AND id = ?`,
      [status, tenantId, id]
    );
  }
  return findBillById(connection, tenantId, id);
}

// ── Aging Analysis (E4-06) ───────────────────────────────────────────────────

export async function getPendingPaymentsAging(connection, tenantId) {
  const [invoices] = await connection.execute(
    `SELECT id, invoice_number, client_name, total_amount, paid_amount,
            due_date, invoice_date, status,
            CURRENT_DATE - COALESCE(due_date, invoice_date) AS days_overdue
     FROM invoices
     WHERE tenant_id = ? AND status NOT IN ('paid', 'cancelled')
     ORDER BY days_overdue DESC`,
    [tenantId]
  );

  const [bills] = await connection.execute(
    `SELECT id, bill_number, vendor_name, total_amount, paid_amount,
            due_date, bill_date, status,
            CURRENT_DATE - COALESCE(due_date, bill_date) AS days_overdue
     FROM bills
     WHERE tenant_id = ? AND status NOT IN ('paid', 'cancelled')
     ORDER BY days_overdue DESC`,
    [tenantId]
  );

  return { invoices, bills };
}

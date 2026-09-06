import { apiDownload } from './http.js';

export async function listQuotations(authenticatedRequest) {
  const data = await authenticatedRequest('/billing/quotations');
  return data.quotations;
}

export async function createQuotation(authenticatedRequest, payload) {
  const data = await authenticatedRequest('/billing/quotations', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  return data.quotation;
}

export async function updateQuotation(authenticatedRequest, id, payload) {
  const data = await authenticatedRequest(`/billing/quotations/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
  return data.quotation;
}

export async function updateQuotationStatus(authenticatedRequest, id, status) {
  const data = await authenticatedRequest(`/billing/quotations/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  });
  return data.quotation;
}

export async function deleteQuotation(authenticatedRequest, id) {
  return authenticatedRequest(`/billing/quotations/${id}`, {
    method: 'DELETE'
  });
}

export async function convertQuotationToInvoice(authenticatedRequest, quotationId) {
  const data = await authenticatedRequest(`/billing/quotations/${quotationId}/convert`, {
    method: 'POST'
  });
  return data.invoice;
}

export async function downloadQuotationPdf(accessToken, quotationId, quotationNumber) {
  const fallback = `TheWoodWise_Quotation_${quotationNumber || quotationId}.pdf`;
  return apiDownload(`/billing/quotations/${quotationId}/pdf`, fallback, accessToken);
}

export async function downloadQuotationExcel(accessToken, quotationId, quotationNumber) {
  const fallback = `TheWoodWise_Quotation_${quotationNumber || quotationId}.xlsx`;
  return apiDownload(`/billing/quotations/${quotationId}/xlsx`, fallback, accessToken);
}

export async function listInvoices(authenticatedRequest) {
  const data = await authenticatedRequest('/billing/invoices');
  return data.invoices;
}

export async function createInvoice(authenticatedRequest, payload) {
  const data = await authenticatedRequest('/billing/invoices', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  return data.invoice;
}

export async function updateInvoiceStatus(authenticatedRequest, id, payload) {
  const body = typeof payload === 'string' ? { status: payload } : payload;
  const data = await authenticatedRequest(`/billing/invoices/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify(body)
  });
  return data.invoice;
}

export async function deleteInvoice(authenticatedRequest, id) {
  return authenticatedRequest(`/billing/invoices/${id}`, {
    method: 'DELETE'
  });
}

export async function downloadInvoicePdf(accessToken, invoiceId, invoiceNumber) {
  const fallback = `TheWoodWise_Invoice_${invoiceNumber || invoiceId}.pdf`;
  return apiDownload(`/billing/invoices/${invoiceId}/pdf`, fallback, accessToken);
}

export async function getPendingPayments(authenticatedRequest) {
  return authenticatedRequest('/billing/pending-payments');
}

export async function listBills(authenticatedRequest) {
  const data = await authenticatedRequest('/billing/bills');
  return data.bills;
}

export async function createBill(authenticatedRequest, payload) {
  const data = await authenticatedRequest('/billing/bills', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  return data.bill;
}

export async function updateBill(authenticatedRequest, id, payload) {
  const data = await authenticatedRequest(`/billing/bills/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
  return data.bill;
}

export async function updateBillStatus(authenticatedRequest, id, status) {
  return updateBill(authenticatedRequest, id, { status });
}

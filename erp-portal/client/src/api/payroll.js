import { apiDownload } from './http.js';

export async function listPayrollRuns(authenticatedRequest) {
  const data = await authenticatedRequest('/payroll/runs');
  return data.runs;
}

export async function generatePayrollRun(authenticatedRequest, payloadOrYear, maybeMonth) {
  const body = typeof payloadOrYear === 'object' && payloadOrYear !== null
    ? payloadOrYear
    : { year: payloadOrYear, month: maybeMonth };

  return authenticatedRequest('/payroll/runs', {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

export async function previewPayrollRun(authenticatedRequest, payload = {}) {
  return authenticatedRequest('/payroll/runs/preview', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function getPayrollRun(authenticatedRequest, runId) {
  return authenticatedRequest(`/payroll/runs/${runId}`);
}

export async function finalizeRun(authenticatedRequest, runId) {
  return authenticatedRequest(`/payroll/runs/${runId}/finalize`, {
    method: 'POST'
  });
}

export async function resyncPayrollRun(authenticatedRequest, runId) {
  return authenticatedRequest(`/payroll/runs/${runId}/resync`, {
    method: 'POST'
  });
}

export async function addAdjustment(authenticatedRequest, runId, lineItemId, adjustment) {
  return authenticatedRequest(`/payroll/runs/${runId}/line-items/${lineItemId}/adjustments`, {
    method: 'POST',
    body: JSON.stringify(adjustment)
  });
}

export async function removeAdjustment(authenticatedRequest, runId, lineItemId, adjustmentId) {
  return authenticatedRequest(
    `/payroll/runs/${runId}/line-items/${lineItemId}/adjustments/${adjustmentId}`,
    { method: 'DELETE' }
  );
}

export async function markPaid(authenticatedRequest, runId, lineItemId) {
  return authenticatedRequest(`/payroll/runs/${runId}/line-items/${lineItemId}/paid`, {
    method: 'PATCH'
  });
}

export async function getPayslipData(authenticatedRequest, runId, lineItemId) {
  return authenticatedRequest(`/payroll/runs/${runId}/line-items/${lineItemId}/payslip`);
}

export const getPayslip = getPayslipData;

export async function downloadPayslipPdf(accessToken, runId, lineItemId, empName = 'employee') {
  const safeName = (empName || 'employee').replace(/\s+/g, '_');
  return apiDownload(
    `/payroll/runs/${runId}/line-items/${lineItemId}/payslip/pdf`,
    `Payslip_${safeName}.pdf`,
    accessToken
  );
}

export async function getSettings(authenticatedRequest) {
  return authenticatedRequest('/payroll/settings');
}

export async function saveSettings(authenticatedRequest, settings) {
  return authenticatedRequest('/payroll/settings', {
    method: 'PUT',
    body: JSON.stringify(settings)
  });
}

export async function previewPayrollRegeneration(authenticatedRequest, payloadOrYear, maybeMonth) {
  const body = typeof payloadOrYear === 'object' && payloadOrYear !== null
    ? payloadOrYear
    : { year: payloadOrYear, month: maybeMonth };

  return authenticatedRequest('/payroll/runs/regenerate-preview', {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

export async function regeneratePayrollRun(authenticatedRequest, payloadOrYear, maybeMonth) {
  const body = typeof payloadOrYear === 'object' && payloadOrYear !== null
    ? payloadOrYear
    : { year: payloadOrYear, month: maybeMonth };

  return authenticatedRequest('/payroll/runs/regenerate', {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

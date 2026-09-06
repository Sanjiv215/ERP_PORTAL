import { apiDownload } from './http.js';

export async function listTransactions(authenticatedRequest, params = {}) {
  const q = new URLSearchParams();
  if (params.type && params.type !== 'all') q.set('type', params.type);
  if (params.startDate) q.set('startDate', params.startDate);
  if (params.endDate) q.set('endDate', params.endDate);
  if (params.projectId) q.set('projectId', params.projectId);

  const queryStr = q.toString() ? `?${q.toString()}` : '';
  return authenticatedRequest(`/transactions${queryStr}`);
}

export async function downloadTransactionsReport(accessToken, params = {}, format = 'pdf') {
  const q = new URLSearchParams();
  if (params.type && params.type !== 'all') q.set('type', params.type);
  if (params.startDate) q.set('startDate', params.startDate);
  if (params.endDate) q.set('endDate', params.endDate);
  if (params.projectId) q.set('projectId', params.projectId);
  q.set('format', format);

  const ext = format === 'excel' || format === 'xlsx' ? 'xlsx' : 'pdf';
  const defaultFilename = `Transaction_History_${new Date().toISOString().slice(0, 10)}.${ext}`;
  return apiDownload(`/transactions/export?${q.toString()}`, defaultFilename, accessToken);
}


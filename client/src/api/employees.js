import { apiRequest } from './http.js';

/**
 * All employee endpoints use `tenantId` derived from the JWT on the server.
 * The client never sends or constructs a tenantId.
 */

export async function listEmployees(authenticatedRequest, includeRemoved = false) {
  const url = includeRemoved ? '/employees?includeRemoved=true' : '/employees';
  const data = await authenticatedRequest(url);
  return data.employees;
}

export async function deleteEmployee(authenticatedRequest, employeeId) {
  const data = await authenticatedRequest(`/employees/${employeeId}`, {
    method: 'DELETE'
  });
  return data.employee;
}

export async function createEmployee(authenticatedRequest, payload) {
  const data = await authenticatedRequest('/employees', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  return data.employee;
}

export async function updateEmployee(authenticatedRequest, employeeId, payload) {
  const data = await authenticatedRequest(`/employees/${employeeId}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
  return data.employee;
}

export async function setEmployeeActive(authenticatedRequest, employeeId, isActive) {
  const data = await authenticatedRequest(`/employees/${employeeId}/active`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive })
  });
  return data.employee;
}

export const changeEmployeeStatus = setEmployeeActive;

export async function recordEmployeeAdvance(authenticatedRequest, employeeId, payload) {
  const data = await authenticatedRequest(`/employees/${employeeId}/advances`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  return data.advance;
}

export async function listEmployeeAdvances(authenticatedRequest, employeeId) {
  const data = await authenticatedRequest(`/employees/${employeeId}/advances`);
  return data.advances;
}

export async function listUnadjustedAdvances(authenticatedRequest) {
  const data = await authenticatedRequest('/employees/advances/unadjusted');
  return data.advances;
}

export async function listAllAdvances(authenticatedRequest, params = {}) {
  const q = new URLSearchParams();
  if (params.employeeId) q.set('employeeId', params.employeeId);
  if (params.status && params.status !== 'all') q.set('status', params.status);
  if (params.startDate) q.set('startDate', params.startDate);
  if (params.endDate) q.set('endDate', params.endDate);

  const queryStr = q.toString() ? `?${q.toString()}` : '';
  return authenticatedRequest(`/employees/advances${queryStr}`);
}

export async function removeEmployeeAdvance(authenticatedRequest, employeeId, advanceId) {
  const path = employeeId
    ? `/employees/${employeeId}/advances/${advanceId}`
    : `/employees/advances/${advanceId}`;
  const data = await authenticatedRequest(path, {
    method: 'DELETE'
  });
  return data;
}

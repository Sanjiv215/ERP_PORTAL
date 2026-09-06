export async function getBusinessPL(authenticatedRequest, year, month) {
  return authenticatedRequest(`/pl?year=${year}&month=${month}`);
}

export async function addExpense(authenticatedRequest, payload) {
  return authenticatedRequest('/pl/expenses', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function addIncome(authenticatedRequest, payload) {
  return authenticatedRequest('/pl/income', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function getProjectPL(authenticatedRequest, projectId) {
  return authenticatedRequest(`/pl/projects/${projectId}`);
}

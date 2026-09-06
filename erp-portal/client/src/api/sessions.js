export async function listUserSessions(authenticatedRequest) {
  const data = await authenticatedRequest('/sessions');
  return data.sessions || [];
}

export async function listTenantSessions(authenticatedRequest) {
  const data = await authenticatedRequest('/sessions/tenant');
  return data.sessions || [];
}

export async function revokeSession(authenticatedRequest, sessionId) {
  return authenticatedRequest(`/sessions/${sessionId}`, {
    method: 'DELETE'
  });
}

export async function revokeAllOtherSessions(authenticatedRequest) {
  return authenticatedRequest('/sessions/other', {
    method: 'DELETE'
  });
}

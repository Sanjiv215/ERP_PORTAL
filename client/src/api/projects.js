/**
 * All project endpoints use `tenantId` derived from the JWT on the server.
 * The client never sends or constructs a tenantId.
 */

export async function listProjects(authenticatedRequest) {
  const data = await authenticatedRequest('/projects');
  return data.projects;
}

export async function createProject(authenticatedRequest, payload) {
  const data = await authenticatedRequest('/projects', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  return data.project;
}

export async function updateProject(authenticatedRequest, projectId, payload) {
  const data = await authenticatedRequest(`/projects/${projectId}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
  return data.project;
}

export async function deleteProject(authenticatedRequest, projectId) {
  await authenticatedRequest(`/projects/${projectId}`, { method: 'DELETE' });
}

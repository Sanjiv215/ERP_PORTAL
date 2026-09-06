export async function listMeetings(authenticatedRequest) {
  const data = await authenticatedRequest('/meetings');
  return data.meetings;
}

export async function getMeeting(authenticatedRequest, meetingId) {
  const data = await authenticatedRequest(`/meetings/${meetingId}`);
  return data.meeting;
}

export const getMeetingDetail = getMeeting;

export async function createMeeting(authenticatedRequest, payload) {
  const data = await authenticatedRequest('/meetings', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  return data.meeting;
}

export async function updateMeeting(authenticatedRequest, meetingId, payload) {
  const data = await authenticatedRequest(`/meetings/${meetingId}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
  return data.meeting;
}

export const updateMeetingStatus = (req, id, status) => updateMeeting(req, id, { status });

export async function deleteMeeting(authenticatedRequest, meetingId) {
  await authenticatedRequest(`/meetings/${meetingId}`, {
    method: 'DELETE'
  });
}

export async function addMeetingMinutes(authenticatedRequest, meetingId, payload) {
  const data = await authenticatedRequest(`/meetings/${meetingId}/minutes`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  return data.meeting;
}

export const saveMeetingMinutes = addMeetingMinutes;

import { randomUUID } from 'node:crypto';

export async function listMeetingsByTenant(connection, tenantId) {
  const [rows] = await connection.execute(
    `SELECT m.id, m.tenant_id, m.project_id, p.name AS project_name,
            m.title, m.description, m.meeting_date, m.start_time, m.end_time,
            m.location, m.meeting_link, m.status, m.created_by, m.created_at, m.updated_at
     FROM meetings m
     LEFT JOIN projects p ON p.id = m.project_id AND p.tenant_id = m.tenant_id
     WHERE m.tenant_id = ?
     ORDER BY m.meeting_date ASC, m.start_time ASC`,
    [tenantId]
  );
  return rows;
}

export async function findMeetingById(connection, tenantId, meetingId) {
  const [rows] = await connection.execute(
    `SELECT m.id, m.tenant_id, m.project_id, p.name AS project_name,
            m.title, m.description, m.meeting_date, m.start_time, m.end_time,
            m.location, m.meeting_link, m.status, m.created_by, m.created_at, m.updated_at
     FROM meetings m
     LEFT JOIN projects p ON p.id = m.project_id AND p.tenant_id = m.tenant_id
     WHERE m.tenant_id = ? AND m.id = ?
     LIMIT 1`,
    [tenantId, meetingId]
  );
  return rows[0] || null;
}

export async function createMeetingRecord(connection, tenantId, payload, createdBy) {
  const id = randomUUID();
  await connection.execute(
    `INSERT INTO meetings
       (id, tenant_id, project_id, title, description, meeting_date, start_time, end_time, location, meeting_link, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?)`,
    [
      id,
      tenantId,
      payload.projectId || null,
      payload.title,
      payload.description || null,
      payload.meetingDate,
      payload.startTime,
      payload.endTime,
      payload.location || null,
      payload.meetingLink || null,
      createdBy
    ]
  );
  return findMeetingById(connection, tenantId, id);
}

export async function updateMeetingRecord(connection, tenantId, meetingId, payload) {
  await connection.execute(
    `UPDATE meetings
     SET project_id = ?, title = ?, description = ?, meeting_date = ?,
         start_time = ?, end_time = ?, location = ?, meeting_link = ?, status = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE tenant_id = ? AND id = ?`,
    [
      payload.projectId || null,
      payload.title,
      payload.description || null,
      payload.meetingDate,
      payload.startTime,
      payload.endTime,
      payload.location || null,
      payload.meetingLink || null,
      payload.status || 'scheduled',
      tenantId,
      meetingId
    ]
  );
  return findMeetingById(connection, tenantId, meetingId);
}

export async function deleteMeetingRecord(connection, tenantId, meetingId) {
  const [res] = await connection.execute(
    `DELETE FROM meetings WHERE tenant_id = ? AND id = ?`,
    [tenantId, meetingId]
  );
  return res.affectedRows > 0;
}

// ── Meeting Attendees (E5-03) ─────────────────────────────────────────────────

export async function listAttendeesByMeeting(connection, tenantId, meetingId) {
  const [rows] = await connection.execute(
    `SELECT id, meeting_id, user_id, employee_id, name, email, attendance_status
     FROM meeting_attendees
     WHERE tenant_id = ? AND meeting_id = ?
     ORDER BY name ASC`,
    [tenantId, meetingId]
  );
  return rows;
}

export async function replaceMeetingAttendees(connection, tenantId, meetingId, attendees) {
  await connection.execute(
    `DELETE FROM meeting_attendees WHERE tenant_id = ? AND meeting_id = ?`,
    [tenantId, meetingId]
  );

  for (const att of attendees) {
    await connection.execute(
      `INSERT INTO meeting_attendees (id, tenant_id, meeting_id, user_id, employee_id, name, email, attendance_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        tenantId,
        meetingId,
        att.userId || null,
        att.employeeId || null,
        att.name,
        att.email || null,
        att.attendanceStatus || 'invited'
      ]
    );
  }
}

// ── Meeting Minutes & Notes (E5-04) ──────────────────────────────────────────

export async function listNotesByMeeting(connection, tenantId, meetingId) {
  const [rows] = await connection.execute(
    `SELECT id, meeting_id, recorded_by, summary, action_items_json, created_at, updated_at
     FROM meeting_notes
     WHERE tenant_id = ? AND meeting_id = ?
     ORDER BY created_at DESC`,
    [tenantId, meetingId]
  );
  return rows.map((r) => ({
    ...r,
    actionItems: typeof r.action_items_json === 'string'
      ? JSON.parse(r.action_items_json)
      : (r.action_items_json || [])
  }));
}

export async function addMeetingNoteRecord(connection, tenantId, meetingId, summary, actionItems, recordedBy) {
  const id = randomUUID();
  await connection.execute(
    `INSERT INTO meeting_notes (id, tenant_id, meeting_id, recorded_by, summary, action_items_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      id,
      tenantId,
      meetingId,
      recordedBy,
      summary,
      actionItems ? JSON.stringify(actionItems) : null
    ]
  );
  return id;
}

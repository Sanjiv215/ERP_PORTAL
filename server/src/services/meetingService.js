import { pool, withTransaction } from '../db/pool.js';
import { AppError } from '../middleware/errorHandler.js';
import { appendAuditLog } from '../repositories/auditRepository.js';
import { findProjectByTenantAndId } from '../repositories/projectRepository.js';
import {
  listMeetingsByTenant,
  findMeetingById,
  createMeetingRecord,
  updateMeetingRecord,
  deleteMeetingRecord,
  listAttendeesByMeeting,
  replaceMeetingAttendees,
  listNotesByMeeting,
  addMeetingNoteRecord
} from '../repositories/meetingRepository.js';

function publicMeeting(m, attendees = [], notes = []) {
  if (!m) return null;
  return {
    id: m.id,
    tenantId: m.tenant_id,
    projectId: m.project_id,
    projectName: m.project_name,
    title: m.title,
    description: m.description,
    meetingDate: typeof m.meeting_date === 'string'
      ? m.meeting_date
      : new Date(m.meeting_date).toISOString().slice(0, 10),
    startTime: m.start_time,
    endTime: m.end_time,
    location: m.location,
    meetingLink: m.meeting_link,
    status: m.status,
    createdBy: m.created_by,
    attendees: attendees.map((a) => ({
      id: a.id,
      name: a.name,
      email: a.email,
      status: a.attendance_status
    })),
    notes: notes.map((n) => ({
      id: n.id,
      summary: n.summary,
      actionItems: n.actionItems || [],
      createdAt: n.created_at
    })),
    createdAt: m.created_at,
    updatedAt: m.updated_at
  };
}

export async function listMeetings(context) {
  const connection = await pool.getConnection();
  try {
    const rows = await listMeetingsByTenant(connection, context.tenantId);
    return rows.map((m) => publicMeeting(m));
  } finally {
    connection.release();
  }
}

export async function getMeetingDetail(context, meetingId) {
  const connection = await pool.getConnection();
  try {
    const meeting = await findMeetingById(connection, context.tenantId, meetingId);
    if (!meeting) throw new AppError(404, 'Meeting not found', 'NOT_FOUND');

    const [attendees, notes] = await Promise.all([
      listAttendeesByMeeting(connection, context.tenantId, meetingId),
      listNotesByMeeting(connection, context.tenantId, meetingId)
    ]);

    return publicMeeting(meeting, attendees, notes);
  } finally {
    connection.release();
  }
}

export async function createMeeting(context, payload, requestMeta) {
  return withTransaction(async (connection) => {
    if (payload.projectId) {
      const proj = await findProjectByTenantAndId(connection, context.tenantId, payload.projectId);
      if (!proj) throw new AppError(400, 'Invalid project for this tenant', 'INVALID_PROJECT');
    }

    const meeting = await createMeetingRecord(connection, context.tenantId, payload, context.userId);

    if (payload.attendees && payload.attendees.length > 0) {
      await replaceMeetingAttendees(connection, context.tenantId, meeting.id, payload.attendees);
    }

    await appendAuditLog(connection, {
      tenantId: context.tenantId,
      userId: context.userId,
      action: 'meeting.create',
      entity: 'meetings',
      entityId: meeting.id,
      ipAddress: requestMeta.ipAddress
    });

    const attendees = await listAttendeesByMeeting(connection, context.tenantId, meeting.id);
    return publicMeeting(meeting, attendees);
  });
}

export async function updateMeeting(context, meetingId, payload, requestMeta) {
  return withTransaction(async (connection) => {
    const existing = await findMeetingById(connection, context.tenantId, meetingId);
    if (!existing) throw new AppError(404, 'Meeting not found', 'NOT_FOUND');

    if (payload.projectId) {
      const proj = await findProjectByTenantAndId(connection, context.tenantId, payload.projectId);
      if (!proj) throw new AppError(400, 'Invalid project for this tenant', 'INVALID_PROJECT');
    }

    const meeting = await updateMeetingRecord(connection, context.tenantId, meetingId, payload);

    if (payload.attendees !== undefined) {
      await replaceMeetingAttendees(connection, context.tenantId, meetingId, payload.attendees);
    }

    await appendAuditLog(connection, {
      tenantId: context.tenantId,
      userId: context.userId,
      action: 'meeting.update',
      entity: 'meetings',
      entityId: meetingId,
      ipAddress: requestMeta.ipAddress
    });

    const [attendees, notes] = await Promise.all([
      listAttendeesByMeeting(connection, context.tenantId, meetingId),
      listNotesByMeeting(connection, context.tenantId, meetingId)
    ]);

    return publicMeeting(meeting, attendees, notes);
  });
}

export async function deleteMeeting(context, meetingId, requestMeta) {
  return withTransaction(async (connection) => {
    const existing = await findMeetingById(connection, context.tenantId, meetingId);
    if (!existing) throw new AppError(404, 'Meeting not found', 'NOT_FOUND');

    await deleteMeetingRecord(connection, context.tenantId, meetingId);

    await appendAuditLog(connection, {
      tenantId: context.tenantId,
      userId: context.userId,
      action: 'meeting.delete',
      entity: 'meetings',
      entityId: meetingId,
      ipAddress: requestMeta.ipAddress
    });
  });
}

export async function addMeetingMinutes(context, meetingId, payload, requestMeta) {
  return withTransaction(async (connection) => {
    const existing = await findMeetingById(connection, context.tenantId, meetingId);
    if (!existing) throw new AppError(404, 'Meeting not found', 'NOT_FOUND');

    const noteId = await addMeetingNoteRecord(
      connection,
      context.tenantId,
      meetingId,
      payload.summary,
      payload.actionItems || [],
      context.userId
    );

    await appendAuditLog(connection, {
      tenantId: context.tenantId,
      userId: context.userId,
      action: 'meeting.note_added',
      entity: 'meeting_notes',
      entityId: noteId,
      ipAddress: requestMeta.ipAddress
    });

    return getMeetingDetail(context, meetingId);
  });
}

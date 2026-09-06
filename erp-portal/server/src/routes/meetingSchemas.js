import { z } from 'zod';

const attendeeSchema = z.object({
  userId: z.string().uuid().optional().nullable(),
  employeeId: z.string().uuid().optional().nullable(),
  name: z.string().trim().min(1).max(140),
  email: z.string().email().optional().nullable(),
  attendanceStatus: z.enum(['invited', 'accepted', 'declined', 'attended', 'absent']).default('invited')
});

export const createMeetingSchema = z.object({
  projectId: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional().nullable(),
  meetingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'meetingDate must be YYYY-MM-DD'),
  startTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'startTime must be HH:MM'),
  endTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'endTime must be HH:MM'),
  location: z.string().trim().max(200).optional().nullable(),
  meetingLink: z.string().url().or(z.string().min(1)).optional().nullable(),
  attendees: z.array(attendeeSchema).default([])
});

export const updateMeetingSchema = z.object({
  projectId: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional().nullable(),
  meetingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'meetingDate must be YYYY-MM-DD'),
  startTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'startTime must be HH:MM'),
  endTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'endTime must be HH:MM'),
  location: z.string().trim().max(200).optional().nullable(),
  meetingLink: z.string().url().or(z.string().min(1)).optional().nullable(),
  status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']).default('scheduled'),
  attendees: z.array(attendeeSchema).optional()
});

export const addMinutesSchema = z.object({
  summary: z.string().trim().min(1).max(10000),
  actionItems: z.array(
    z.object({
      task: z.string().trim().min(1),
      assignee: z.string().trim().optional(),
      dueDate: z.string().optional()
    })
  ).default([])
});

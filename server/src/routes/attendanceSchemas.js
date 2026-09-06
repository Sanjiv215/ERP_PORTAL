import { z } from 'zod';

const attendanceStatuses = ['present', 'absent', 'half_day', 'overtime', 'leave'];

export const markAttendanceSchema = z.object({
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'workDate must be in YYYY-MM-DD format'),
  records: z.array(
    z.object({
      employeeId: z.string().uuid(),
      status: z.enum(attendanceStatuses),
      note: z.string().max(500).optional().nullable()
    })
  ).min(1)
});

export const monthQuerySchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12)
});

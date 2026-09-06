import { z } from 'zod';

const projectStatuses = ['planned', 'active', 'completed', 'on_hold', 'cancelled'];

export const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(180),
  clientName: z.string().trim().max(180).optional().nullable(),
  status: z.enum(projectStatuses).default('active'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable()
});

export const updateProjectSchema = z.object({
  name: z.string().trim().min(1).max(180),
  clientName: z.string().trim().max(180).optional().nullable(),
  status: z.enum(projectStatuses),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable()
});

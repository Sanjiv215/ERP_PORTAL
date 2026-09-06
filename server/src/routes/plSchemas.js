import { z } from 'zod';

export const createExpenseSchema = z.object({
  projectId: z.string().uuid().optional().nullable(),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'entryDate must be in YYYY-MM-DD format'),
  category: z.enum(['salary', 'material', 'subcontract', 'equipment', 'misc']),
  description: z.string().trim().max(500).optional().nullable(),
  amount: z.number().positive().finite(),
  receiptUrl: z.string().url().or(z.string().min(1)).optional().nullable()
});

export const createIncomeSchema = z.object({
  projectId: z.string().uuid().optional().nullable(),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'entryDate must be in YYYY-MM-DD format'),
  category: z.string().trim().min(1).max(80).default('revenue'),
  description: z.string().trim().max(500).optional().nullable(),
  amount: z.number().positive().finite(),
  referenceId: z.string().uuid().optional().nullable()
});

export const plQuerySchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100).default(new Date().getFullYear()),
  month: z.coerce.number().int().min(1).max(12).default(new Date().getMonth() + 1)
});

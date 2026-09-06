import { z } from 'zod';

export const generateRunSchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  periodStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  periodEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
}).refine((data) => (data.year && data.month) || data.startDate || data.periodStartDate || data.endDate || data.periodEndDate, {
  message: 'Must provide either year/month or startDate/endDate'
});

export const addAdjustmentSchema = z.object({
  type: z.enum(['bonus', 'deduction']),
  label: z.string().trim().min(1).max(200),
  amount: z.number().positive().finite()
});

export const triggerPayoutSchema = z.object({
  mode: z.enum(['UPI', 'NEFT', 'RTGS', 'IMPS']).default('UPI'),
  idempotencyKey: z.string().trim().min(8).max(120).optional()
});

export const payrollSettingsSchema = z.object({
  workingDaysPerMonth: z.coerce.number().int().min(1).max(31),
  overtimeMultiplier: z.coerce.number().min(1).max(5),
  halfDayMultiplier: z.coerce.number().min(0).max(1)
});

import { z } from 'zod';

const dailyWageTypeEnum = z.preprocess((v) => {
  return 'daily';
}, z.literal('daily').default('daily'));

export const createEmployeeSchema = z.object({
  name: z.string().trim().min(1).max(140),
  phone: z.string().trim().max(32).optional().nullable(),
  wageType: dailyWageTypeEnum,
  wageRate: z.coerce.number().positive('Daily rate must be greater than 0').finite(),
  bankDetails: z.string().trim().max(200).optional().nullable(),
  upiId: z.string().trim().max(200).optional().nullable(),
  userId: z.string().uuid().optional().nullable(),
  projectIds: z.array(z.string().uuid()).default([])
});

export const updateEmployeeSchema = z.object({
  name: z.string().trim().min(1).max(140),
  phone: z.string().trim().max(32).optional().nullable(),
  wageType: dailyWageTypeEnum,
  wageRate: z.coerce.number().positive('Daily rate must be greater than 0').finite(),
  bankDetails: z.string().trim().max(200).optional().nullable(),
  upiId: z.string().trim().max(200).optional().nullable(),
  userId: z.string().uuid().optional().nullable(),
  isActive: z.boolean(),
  projectIds: z.array(z.string().uuid()).default([])
});

export const setActiveSchema = z.object({
  isActive: z.boolean()
});

export const recordAdvanceSchema = z.object({
  amount: z.coerce.number().positive('Advance amount must be greater than 0'),
  advanceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'advanceDate must be in YYYY-MM-DD format'),
  notes: z.string().trim().max(500).optional().nullable()
});

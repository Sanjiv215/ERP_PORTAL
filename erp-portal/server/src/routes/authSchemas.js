import { z } from 'zod';

export const signupSchema = z.object({
  businessName: z.string().trim().min(2).max(180).optional().or(z.literal('')),
  gstNumber: z.string().trim().max(32).optional().or(z.literal('')),
  name: z.string().trim().min(2).max(140),
  email: z.string().email().trim().toLowerCase(),
  phone: z.string().trim().min(7).max(32).optional().or(z.literal('')),
  password: z.string().min(8).max(128),
  confirmPassword: z.string().optional(),
  acceptedTerms: z.boolean().optional().default(true)
});

export const loginSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1).max(128)
});

export const forgotPasswordSchema = z.object({
  email: z.email().trim().toLowerCase()
});

export const resetPasswordSchema = z.object({
  token: z.string().uuid(),
  password: z.string().min(10).max(128)
});

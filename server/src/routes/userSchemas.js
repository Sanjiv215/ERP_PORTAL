import { z } from 'zod';
import { ROLES } from '../constants/roles.js';

const tenantRoleSchema = z.enum([
  ROLES.TENANT_ADMIN,
  ROLES.MANAGER,
  ROLES.ACCOUNTANT,
  ROLES.EMPLOYEE
]);

export const inviteUserSchema = z.object({
  name: z.string().trim().min(2).max(140),
  email: z.email().trim().toLowerCase(),
  phone: z.string().trim().min(7).max(32).optional().or(z.literal('')),
  role: tenantRoleSchema,
  temporaryPassword: z.string().min(10).max(128).optional()
});

export const updateUserRoleSchema = z.object({
  role: tenantRoleSchema
});

export const updateUserStatusSchema = z.object({
  isActive: z.boolean()
});

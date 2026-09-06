import { z } from 'zod';

export const updateTenantStatusSchema = z.object({
  status: z.enum(['trial', 'active', 'suspended', 'cancelled'])
});

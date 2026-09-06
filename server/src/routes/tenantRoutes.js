import { Router } from 'express';
import { ROLES } from '../constants/roles.js';
import { requireRole } from '../middleware/requireRole.js';
import { resolveTenantContext } from '../middleware/resolveTenantContext.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { changeTenantStatus, listPlatformTenants } from '../services/tenantService.js';
import { updateTenantStatusSchema } from './tenantSchemas.js';

export const tenantRouter = Router();

function requestMeta(req) {
  return { ipAddress: req.ip };
}

tenantRouter.use(resolveTenantContext);
tenantRouter.use(requireRole([ROLES.PLATFORM_SUPER_ADMIN]));

tenantRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const tenants = await listPlatformTenants();
    res.json({ tenants });
  })
);

tenantRouter.patch(
  '/:tenantId/status',
  validateBody(updateTenantStatusSchema),
  asyncHandler(async (req, res) => {
    const tenant = await changeTenantStatus(req.context, req.params.tenantId, req.body, requestMeta(req));
    res.json({ tenant });
  })
);

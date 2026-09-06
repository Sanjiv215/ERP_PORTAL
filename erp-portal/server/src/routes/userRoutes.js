import { Router } from 'express';
import { ROLES } from '../constants/roles.js';
import { requireRole } from '../middleware/requireRole.js';
import { resolveTenantContext } from '../middleware/resolveTenantContext.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  changeTenantUserActiveStatus,
  changeTenantUserRole,
  inviteTenantUser,
  listTenantUsers,
  getTenantSettings,
  updateTenantSettings
} from '../services/userService.js';
import {
  inviteUserSchema,
  updateUserRoleSchema,
  updateUserStatusSchema
} from './userSchemas.js';

export const userRouter = Router();

function requestMeta(req) {
  return { ipAddress: req.ip };
}

userRouter.use(resolveTenantContext);

userRouter.get(
  '/',
  requireRole([ROLES.TENANT_ADMIN]),
  asyncHandler(async (req, res) => {
    const users = await listTenantUsers(req.context);
    res.json({ users });
  })
);

userRouter.post(
  '/',
  requireRole([ROLES.TENANT_ADMIN]),
  validateBody(inviteUserSchema),
  asyncHandler(async (req, res) => {
    const user = await inviteTenantUser(req.context, req.body, requestMeta(req));
    res.status(201).json({ user });
  })
);

userRouter.patch(
  '/:userId/role',
  requireRole([ROLES.TENANT_ADMIN]),
  validateBody(updateUserRoleSchema),
  asyncHandler(async (req, res) => {
    const user = await changeTenantUserRole(req.context, req.params.userId, req.body, requestMeta(req));
    res.json({ user });
  })
);

userRouter.patch(
  '/:userId/status',
  requireRole([ROLES.TENANT_ADMIN]),
  validateBody(updateUserStatusSchema),
  asyncHandler(async (req, res) => {
    const user = await changeTenantUserActiveStatus(
      req.context,
      req.params.userId,
      req.body,
      requestMeta(req)
    );
    res.json({ user });
  })
);

userRouter.get(
  '/tenant-settings',
  requireRole([ROLES.TENANT_ADMIN, ROLES.MANAGER, ROLES.ACCOUNTANT]),
  asyncHandler(async (req, res) => {
    const settings = await getTenantSettings(req.context);
    res.json({ settings });
  })
);

userRouter.patch(
  '/tenant-settings',
  requireRole([ROLES.TENANT_ADMIN, ROLES.MANAGER]),
  asyncHandler(async (req, res) => {
    const settings = await updateTenantSettings(req.context, req.body);
    res.json({ settings });
  })
);


import { Router } from 'express';
import { ROLES } from '../constants/roles.js';
import { requireRole } from '../middleware/requireRole.js';
import { resolveTenantContext } from '../middleware/resolveTenantContext.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  createTenantProject,
  deleteTenantProject,
  listProjects,
  updateTenantProject
} from '../services/projectService.js';
import { createProjectSchema, updateProjectSchema } from './projectSchemas.js';

export const projectRouter = Router();

function requestMeta(req) {
  return { ipAddress: req.ip };
}

// All project routes require authentication + tenant context
projectRouter.use(resolveTenantContext);

// List projects — all authenticated tenant users can view
projectRouter.get(
  '/',
  requireRole([ROLES.TENANT_ADMIN, ROLES.MANAGER, ROLES.ACCOUNTANT, ROLES.EMPLOYEE]),
  asyncHandler(async (req, res) => {
    const projects = await listProjects(req.context);
    res.json({ projects });
  })
);

// Create project — TenantAdmin and Manager only
projectRouter.post(
  '/',
  requireRole([ROLES.TENANT_ADMIN, ROLES.MANAGER]),
  validateBody(createProjectSchema),
  asyncHandler(async (req, res) => {
    const project = await createTenantProject(req.context, req.body, requestMeta(req));
    res.status(201).json({ project });
  })
);

// Update project — TenantAdmin and Manager only
projectRouter.put(
  '/:projectId',
  requireRole([ROLES.TENANT_ADMIN, ROLES.MANAGER]),
  validateBody(updateProjectSchema),
  asyncHandler(async (req, res) => {
    const project = await updateTenantProject(
      req.context,
      req.params.projectId,
      req.body,
      requestMeta(req)
    );
    res.json({ project });
  })
);

// Delete project — TenantAdmin only
projectRouter.delete(
  '/:projectId',
  requireRole([ROLES.TENANT_ADMIN]),
  asyncHandler(async (req, res) => {
    await deleteTenantProject(req.context, req.params.projectId, requestMeta(req));
    res.status(204).end();
  })
);

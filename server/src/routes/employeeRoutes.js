import { Router } from 'express';
import { ROLES } from '../constants/roles.js';
import { requireRole } from '../middleware/requireRole.js';
import { resolveTenantContext } from '../middleware/resolveTenantContext.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  changeEmployeeActiveStatus,
  createTenantEmployee,
  listEmployees,
  removeEmployee,
  updateTenantEmployee
} from '../services/employeeService.js';
import { createEmployeeSchema, setActiveSchema, updateEmployeeSchema } from './employeeSchemas.js';

export const employeeRouter = Router();

function requestMeta(req) {
  return { ipAddress: req.ip };
}

// All employee routes require authentication + tenant context
employeeRouter.use(resolveTenantContext);

// List employees — visible to TenantAdmin, Manager, Accountant
employeeRouter.get(
  '/',
  requireRole([ROLES.TENANT_ADMIN, ROLES.MANAGER, ROLES.ACCOUNTANT]),
  asyncHandler(async (req, res) => {
    const includeRemoved = req.query.includeRemoved === 'true' || req.query.showRemoved === 'true';
    const employees = await listEmployees(req.context, includeRemoved);
    res.json({ employees });
  })
);

// Create employee — TenantAdmin and Manager only
employeeRouter.post(
  '/',
  requireRole([ROLES.TENANT_ADMIN, ROLES.MANAGER]),
  validateBody(createEmployeeSchema),
  asyncHandler(async (req, res) => {
    const employee = await createTenantEmployee(req.context, req.body, requestMeta(req));
    res.status(201).json({ employee });
  })
);

// Update employee — TenantAdmin and Manager only
employeeRouter.put(
  '/:employeeId',
  requireRole([ROLES.TENANT_ADMIN, ROLES.MANAGER]),
  validateBody(updateEmployeeSchema),
  asyncHandler(async (req, res) => {
    const employee = await updateTenantEmployee(
      req.context,
      req.params.employeeId,
      req.body,
      requestMeta(req)
    );
    res.json({ employee });
  })
);

// Toggle active status — TenantAdmin only
employeeRouter.patch(
  '/:employeeId/active',
  requireRole([ROLES.TENANT_ADMIN]),
  validateBody(setActiveSchema),
  asyncHandler(async (req, res) => {
    const employee = await changeEmployeeActiveStatus(
      req.context,
      req.params.employeeId,
      req.body,
      requestMeta(req)
    );
    res.json({ employee });
  })
);

// Soft delete / remove employee — TenantAdmin only
employeeRouter.delete(
  '/:employeeId',
  requireRole([ROLES.TENANT_ADMIN]),
  asyncHandler(async (req, res) => {
    const employee = await removeEmployee(
      req.context,
      req.params.employeeId,
      requestMeta(req)
    );
    res.json({ employee, message: 'Employee removed successfully' });
  })
);

// ── Advances (Feature 1 & Master Ledger) ───────────────────────────────────

// List all advances across tenant with filters — TenantAdmin, Accountant, Manager
employeeRouter.get(
  '/advances',
  requireRole([ROLES.TENANT_ADMIN, ROLES.ACCOUNTANT, ROLES.MANAGER]),
  asyncHandler(async (req, res) => {
    const { getAllAdvances } = await import('../services/employeeService.js');
    const result = await getAllAdvances(req.context, {
      employeeId: req.query.employeeId || null,
      status: req.query.status || null,
      startDate: req.query.startDate || null,
      endDate: req.query.endDate || null
    });
    res.json(result);
  })
);

// List all unadjusted advances across tenant — TenantAdmin, Accountant, Manager
employeeRouter.get(
  '/advances/unadjusted',
  requireRole([ROLES.TENANT_ADMIN, ROLES.ACCOUNTANT, ROLES.MANAGER]),
  asyncHandler(async (req, res) => {
    const { getUnadjustedAdvances } = await import('../services/employeeService.js');
    const advances = await getUnadjustedAdvances(req.context);
    res.json({ advances });
  })
);

// Remove advance payment record standalone — TenantAdmin and Accountant
employeeRouter.delete(
  '/advances/:advanceId',
  requireRole([ROLES.TENANT_ADMIN, ROLES.ACCOUNTANT]),
  asyncHandler(async (req, res) => {
    const { removeEmployeeAdvance } = await import('../services/employeeService.js');
    const result = await removeEmployeeAdvance(
      req.context,
      null,
      req.params.advanceId,
      requestMeta(req)
    );
    res.json(result);
  })
);

// Give Advance — TenantAdmin and Accountant
employeeRouter.post(
  '/:employeeId/advances',
  requireRole([ROLES.TENANT_ADMIN, ROLES.ACCOUNTANT]),
  validateBody((await import('./employeeSchemas.js')).recordAdvanceSchema),
  asyncHandler(async (req, res) => {
    const { recordEmployeeAdvance } = await import('../services/employeeService.js');
    const advance = await recordEmployeeAdvance(
      req.context,
      req.params.employeeId,
      req.body,
      requestMeta(req)
    );
    res.status(201).json({ advance });
  })
);

// List advances for an employee — TenantAdmin, Accountant, Manager
employeeRouter.get(
  '/:employeeId/advances',
  requireRole([ROLES.TENANT_ADMIN, ROLES.ACCOUNTANT, ROLES.MANAGER]),
  asyncHandler(async (req, res) => {
    const { getEmployeeAdvances } = await import('../services/employeeService.js');
    const advances = await getEmployeeAdvances(req.context, req.params.employeeId);
    res.json({ advances });
  })
);

// Remove advance payment record — TenantAdmin and Accountant
employeeRouter.delete(
  '/:employeeId/advances/:advanceId',
  requireRole([ROLES.TENANT_ADMIN, ROLES.ACCOUNTANT]),
  asyncHandler(async (req, res) => {
    const { removeEmployeeAdvance } = await import('../services/employeeService.js');
    const result = await removeEmployeeAdvance(
      req.context,
      req.params.employeeId,
      req.params.advanceId,
      requestMeta(req)
    );
    res.json(result);
  })
);

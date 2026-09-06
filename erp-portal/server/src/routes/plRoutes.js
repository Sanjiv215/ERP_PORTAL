import { Router } from 'express';
import { ROLES } from '../constants/roles.js';
import { requireRole } from '../middleware/requireRole.js';
import { resolveTenantContext } from '../middleware/resolveTenantContext.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  addExpense,
  addIncome,
  getBusinessPL,
  getProjectPL
} from '../services/plService.js';
import {
  createExpenseSchema,
  createIncomeSchema,
  plQuerySchema
} from './plSchemas.js';

export const plRouter = Router();

function requestMeta(req) {
  return { ipAddress: req.ip };
}

plRouter.use(resolveTenantContext);

// E3-04: Business-wide P&L rollup and trend
plRouter.get(
  '/',
  requireRole([ROLES.TENANT_ADMIN, ROLES.ACCOUNTANT, ROLES.MANAGER]),
  asyncHandler(async (req, res) => {
    const { year, month } = plQuerySchema.parse(req.query);
    const pl = await getBusinessPL(req.context, year, month);
    res.json(pl);
  })
);

// E3-01: Add project expense
plRouter.post(
  '/expenses',
  requireRole([ROLES.TENANT_ADMIN, ROLES.ACCOUNTANT, ROLES.MANAGER]),
  validateBody(createExpenseSchema),
  asyncHandler(async (req, res) => {
    const result = await addExpense(req.context, req.body, requestMeta(req));
    res.status(201).json(result);
  })
);

// Add income entry
plRouter.post(
  '/income',
  requireRole([ROLES.TENANT_ADMIN, ROLES.ACCOUNTANT]),
  validateBody(createIncomeSchema),
  asyncHandler(async (req, res) => {
    const result = await addIncome(req.context, req.body, requestMeta(req));
    res.status(201).json(result);
  })
);

// E3-03: Project-level P&L dashboard
plRouter.get(
  '/projects/:projectId',
  requireRole([ROLES.TENANT_ADMIN, ROLES.ACCOUNTANT, ROLES.MANAGER]),
  asyncHandler(async (req, res) => {
    const pl = await getProjectPL(req.context, req.params.projectId);
    res.json(pl);
  })
);

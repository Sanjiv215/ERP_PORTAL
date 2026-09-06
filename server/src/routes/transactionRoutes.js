import { Router } from 'express';
import { ROLES } from '../constants/roles.js';
import { requireRole } from '../middleware/requireRole.js';
import { resolveTenantContext } from '../middleware/resolveTenantContext.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getTransactions, exportTransactionsReport } from '../services/transactionService.js';

export const transactionRouter = Router();

transactionRouter.use(resolveTenantContext);

// Unified transaction feed — TenantAdmin, Accountant, Manager
transactionRouter.get(
  '/',
  requireRole([ROLES.TENANT_ADMIN, ROLES.ACCOUNTANT, ROLES.MANAGER]),
  asyncHandler(async (req, res) => {
    const data = await getTransactions(req.context, req.query);
    res.json(data);
  })
);

// Export transaction history report (PDF / Excel)
transactionRouter.get(
  '/export',
  requireRole([ROLES.TENANT_ADMIN, ROLES.ACCOUNTANT, ROLES.MANAGER]),
  asyncHandler(async (req, res) => {
    const format = req.query.format === 'excel' || req.query.format === 'xlsx' ? 'excel' : 'pdf';
    const report = await exportTransactionsReport(req.context, req.query, format);

    res.setHeader('Content-Type', report.contentType);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Disposition', `attachment; filename="${report.filename}"`);
    res.send(report.buffer);
  })
);

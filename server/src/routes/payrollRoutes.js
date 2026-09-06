import { Router } from 'express';
import { ROLES } from '../constants/roles.js';
import { requireRole } from '../middleware/requireRole.js';
import { resolveTenantContext } from '../middleware/resolveTenantContext.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { generatePayslipPdf } from '../utils/pdfGenerator.js';
import {
  generatePayrollRun,
  resyncPayrollRun,
  previewPayrollRegeneration,
  regeneratePayrollRun,
  addAdjustment,
  removeAdjustment,
  getPayrollRunDetail,
  listRuns,
  finalizeRun,
  markLineItemPaid,
  getPayslipData,
  getSettings,
  saveSettings
} from '../services/payrollService.js';
import {
  generateRunSchema,
  addAdjustmentSchema,
  payrollSettingsSchema
} from './payrollSchemas.js';

export const payrollRouter = Router();

function requestMeta(req) {
  return { ipAddress: req.ip };
}

payrollRouter.use(resolveTenantContext);

// Settings
payrollRouter.get(
  '/settings',
  requireRole([ROLES.TENANT_ADMIN]),
  asyncHandler(async (req, res) => {
    res.json(await getSettings(req.context));
  })
);

payrollRouter.put(
  '/settings',
  requireRole([ROLES.TENANT_ADMIN]),
  validateBody(payrollSettingsSchema),
  asyncHandler(async (req, res) => {
    res.json(await saveSettings(req.context, req.body));
  })
);

// Runs list & generate
payrollRouter.get(
  '/runs',
  requireRole([ROLES.TENANT_ADMIN, ROLES.ACCOUNTANT]),
  asyncHandler(async (req, res) => {
    res.json({ runs: await listRuns(req.context) });
  })
);

payrollRouter.post(
  '/runs/preview',
  requireRole([ROLES.TENANT_ADMIN, ROLES.ACCOUNTANT]),
  asyncHandler(async (req, res) => {
    const { previewPayrollRun } = await import('../services/payrollService.js');
    res.json(await previewPayrollRun(req.context, req.body));
  })
);

payrollRouter.post(
  '/runs',
  requireRole([ROLES.TENANT_ADMIN]),
  validateBody(generateRunSchema),
  asyncHandler(async (req, res) => {
    const result = await generatePayrollRun(req.context, req.body, requestMeta(req));
    res.status(201).json(result);
  })
);

payrollRouter.get(
  '/runs/:runId',
  requireRole([ROLES.TENANT_ADMIN, ROLES.ACCOUNTANT]),
  asyncHandler(async (req, res) => {
    res.json(await getPayrollRunDetail(req.context, req.params.runId));
  })
);

payrollRouter.post(
  '/runs/:runId/finalize',
  requireRole([ROLES.TENANT_ADMIN]),
  asyncHandler(async (req, res) => {
    res.json(await finalizeRun(req.context, req.params.runId, requestMeta(req)));
  })
);

payrollRouter.post(
  '/runs/:runId/resync',
  requireRole([ROLES.TENANT_ADMIN, ROLES.ACCOUNTANT]),
  asyncHandler(async (req, res) => {
    res.json(await resyncPayrollRun(req.context, req.params.runId, requestMeta(req)));
  })
);

// Preview Payroll Regeneration (Feature 2)
payrollRouter.post(
  '/runs/regenerate-preview',
  requireRole([ROLES.TENANT_ADMIN, ROLES.ACCOUNTANT]),
  validateBody(generateRunSchema),
  asyncHandler(async (req, res) => {
    res.json(await previewPayrollRegeneration(req.context, req.body));
  })
);

// Execute Versioned Payroll Regeneration (Feature 2)
payrollRouter.post(
  '/runs/regenerate',
  requireRole([ROLES.TENANT_ADMIN]),
  validateBody(generateRunSchema),
  asyncHandler(async (req, res) => {
    const result = await regeneratePayrollRun(req.context, req.body, requestMeta(req));
    res.status(201).json(result);
  })
);

// Manual Adjustments (E2-02)
payrollRouter.post(
  '/runs/:runId/line-items/:lineItemId/adjustments',
  requireRole([ROLES.TENANT_ADMIN, ROLES.ACCOUNTANT]),
  validateBody(addAdjustmentSchema),
  asyncHandler(async (req, res) => {
    res.json(await addAdjustment(req.context, req.params.lineItemId, req.body, requestMeta(req)));
  })
);

payrollRouter.delete(
  '/runs/:runId/line-items/:lineItemId/adjustments/:adjustmentId',
  requireRole([ROLES.TENANT_ADMIN]),
  asyncHandler(async (req, res) => {
    res.json(await removeAdjustment(req.context, req.params.lineItemId, req.params.adjustmentId, requestMeta(req)));
  })
);

// Mark Paid (E2-05)
payrollRouter.patch(
  '/runs/:runId/line-items/:lineItemId/paid',
  requireRole([ROLES.TENANT_ADMIN, ROLES.ACCOUNTANT]),
  asyncHandler(async (req, res) => {
    res.json(await markLineItemPaid(req.context, req.params.lineItemId, requestMeta(req)));
  })
);

// Payslip Data (E2-04)
payrollRouter.get(
  '/runs/:runId/line-items/:lineItemId/payslip',
  requireRole([ROLES.TENANT_ADMIN, ROLES.ACCOUNTANT, ROLES.EMPLOYEE]),
  asyncHandler(async (req, res) => {
    res.json(await getPayslipData(req.context, req.params.lineItemId));
  })
);

payrollRouter.get(
  '/runs/:runId/line-items/:lineItemId/payslip/pdf',
  requireRole([ROLES.TENANT_ADMIN, ROLES.ACCOUNTANT, ROLES.EMPLOYEE]),
  asyncHandler(async (req, res) => {
    const data = await getPayslipData(req.context, req.params.lineItemId);
    const buffer = await generatePayslipPdf(data);
    const empName = data.employee?.name || data.lineItem?.employeeName || 'employee';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Disposition', `attachment; filename="Payslip_${empName.replace(/\s+/g, '_')}.pdf"`);
    res.send(buffer);
  })
);


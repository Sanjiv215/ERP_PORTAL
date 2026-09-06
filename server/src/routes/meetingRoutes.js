import { Router } from 'express';
import { ROLES } from '../constants/roles.js';
import { requireRole } from '../middleware/requireRole.js';
import { resolveTenantContext } from '../middleware/resolveTenantContext.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  listMeetings,
  getMeetingDetail,
  createMeeting,
  updateMeeting,
  deleteMeeting,
  addMeetingMinutes
} from '../services/meetingService.js';
import {
  createMeetingSchema,
  updateMeetingSchema,
  addMinutesSchema
} from './meetingSchemas.js';

export const meetingRouter = Router();

function requestMeta(req) {
  return { ipAddress: req.ip };
}

meetingRouter.use(resolveTenantContext);

// E5-02: List meetings
meetingRouter.get(
  '/',
  requireRole([ROLES.TENANT_ADMIN, ROLES.MANAGER, ROLES.ACCOUNTANT, ROLES.EMPLOYEE]),
  asyncHandler(async (req, res) => {
    res.json({ meetings: await listMeetings(req.context) });
  })
);

// E5-01: Create meeting
meetingRouter.post(
  '/',
  requireRole([ROLES.TENANT_ADMIN, ROLES.MANAGER]),
  validateBody(createMeetingSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json({ meeting: await createMeeting(req.context, req.body, requestMeta(req)) });
  })
);

// Get meeting detail
meetingRouter.get(
  '/:meetingId',
  requireRole([ROLES.TENANT_ADMIN, ROLES.MANAGER, ROLES.ACCOUNTANT, ROLES.EMPLOYEE]),
  asyncHandler(async (req, res) => {
    res.json({ meeting: await getMeetingDetail(req.context, req.params.meetingId) });
  })
);

// Update meeting
meetingRouter.put(
  '/:meetingId',
  requireRole([ROLES.TENANT_ADMIN, ROLES.MANAGER]),
  validateBody(updateMeetingSchema),
  asyncHandler(async (req, res) => {
    res.json({ meeting: await updateMeeting(req.context, req.params.meetingId, req.body, requestMeta(req)) });
  })
);

// Delete meeting
meetingRouter.delete(
  '/:meetingId',
  requireRole([ROLES.TENANT_ADMIN, ROLES.MANAGER]),
  asyncHandler(async (req, res) => {
    await deleteMeeting(req.context, req.params.meetingId, requestMeta(req));
    res.status(204).end();
  })
);

// E5-04: Add meeting minutes / notes
meetingRouter.post(
  '/:meetingId/minutes',
  requireRole([ROLES.TENANT_ADMIN, ROLES.MANAGER, ROLES.ACCOUNTANT]),
  validateBody(addMinutesSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json({ meeting: await addMeetingMinutes(req.context, req.params.meetingId, req.body, requestMeta(req)) });
  })
);

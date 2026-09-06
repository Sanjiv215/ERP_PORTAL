import { AppError } from './errorHandler.js';

export function requireRole(allowedRoles) {
  const allowed = new Set(allowedRoles);

  return (req, _res, next) => {
    if (!req.context?.role || !allowed.has(req.context.role)) {
      return next(new AppError(403, 'You do not have access to this resource', 'FORBIDDEN'));
    }

    return next();
  };
}

import { AppError } from './errorHandler.js';

export function validateBody(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const msg = result.error.issues?.map((i) => i.message).filter(Boolean).join(', ') || 'Invalid request payload';
      return next(new AppError(400, msg, 'VALIDATION_ERROR'));
    }

    req.body = result.data;
    return next();
  };
}

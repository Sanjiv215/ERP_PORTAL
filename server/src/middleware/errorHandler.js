export class AppError extends Error {
  constructor(statusCode, message, code = 'APP_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function notFoundHandler(req, res, next) {
  next(new AppError(404, 'Route not found', 'NOT_FOUND'));
}

export function errorHandler(error, req, res, _next) {
  const statusCode = error.statusCode || 500;
  const publicMessage = statusCode >= 500 ? 'Something went wrong' : error.message;

  if (statusCode >= 500) {
    console.error(error);
  }

  res.status(statusCode).json({
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message: publicMessage
    }
  });
}

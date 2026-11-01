// Operational application error class for predictable error lifecycle management.
export class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    this.details = details;

    // Captures stack trace excluding constructor invocation.
    Error.captureStackTrace(this, this.constructor);
  }
}

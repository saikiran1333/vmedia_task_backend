import { AppError } from '../utils/app_error.js';
import { HTTP_STATUS } from '../constants/http_status.js';
import { RESPONSE_MESSAGES } from '../constants/response_messages.js';

// Catches unhandled routes and routes control to centralized error pipeline.
export const notFoundHandler = (req, res, next) => {
  const error = new AppError(
    `${RESPONSE_MESSAGES.ROUTE_NOT_FOUND}: ${req.method} ${req.originalUrl}`,
    HTTP_STATUS.NOT_FOUND
  );
  next(error);
};

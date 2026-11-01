// Standardized response envelope ensuring consistent RESTful payload structures.
export class ApiResponse {
  // Dispatches successful response with standardized payload schema.
  static success(res, { statusCode = 200, message = 'Success', data = null, meta = null }) {
    return res.status(statusCode).json({
      success: true,
      statusCode,
      message,
      data,
      meta,
      timestamp: new Date().toISOString(),
    });
  }

  // Dispatches error response envelope with operational diagnostic context.
  static error(res, { statusCode = 500, message = 'Internal Server Error', errors = null }) {
    return res.status(statusCode).json({
      success: false,
      statusCode,
      message,
      errors,
      timestamp: new Date().toISOString(),
    });
  }
}

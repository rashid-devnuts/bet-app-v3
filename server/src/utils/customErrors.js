/**
 * Custom Error Classes and Error Handler Middleware
 * Simplified error handling system with a single CustomError class
 */

// Single Custom Error Class
class CustomError extends Error {
  constructor(message, statusCode = 500, errorCode = "INTERNAL_ERROR") {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 404 Not Found Middleware
 * Handles requests to routes that don't exist
 */
const notFoundHandler = (req, res, next) => {
  const error = new CustomError(
    `Route not found - ${req.originalUrl}`,
    404,
    "NOT_FOUND"
  );
  next(error);
};

/**
 * Global Error Handler Middleware
 * Handles all errors including custom errors, database errors, and server errors
 */
const errorHandler = (err, req, res, next) => {
  let error = err;

  // Convert non-custom errors to CustomError instances
  if (!(error instanceof CustomError)) {
    // Mongoose CastError (Invalid ObjectId)
    if (err.name === "CastError") {
      error = new CustomError("Invalid resource ID format", 400, "BAD_REQUEST");
    }
    // Mongoose Duplicate Key Error
    else if (err.code === 11000) {
      const field = Object.keys(err.keyValue || {})[0] || "field";
      error = new CustomError(`Duplicate ${field} value`, 409, "CONFLICT");
    }
    // Mongoose Validation Error
    else if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map((val) => val.message);
      error = new CustomError(
        `Validation failed: ${messages.join(", ")}`,
        422,
        "VALIDATION_ERROR"
      );
    }
    // JWT Errors
    else if (err.name === "JsonWebTokenError") {
      error = new CustomError("Invalid token", 401, "UNAUTHORIZED");
    } else if (err.name === "TokenExpiredError") {
      error = new CustomError("Token expired", 401, "UNAUTHORIZED");
    }
    // Axios/HTTP Errors
    else if (err.response) {
      const status = err.response.status;
      const message = err.response.data?.message || err.message;
      error = new CustomError(`API Error: ${message}`, status, "API_ERROR");
    }
    // Request Timeout
    else if (err.code === "ECONNABORTED" || err.code === "ETIMEDOUT") {
      error = new CustomError("API Request Timeout", 408, "API_TIMEOUT");
    }
    // Generic server error
    else {
      error = new CustomError(
        err.message || "Something went wrong",
        500,
        "INTERNAL_ERROR"
      );
    }
  }

  // Log error for debugging (don't log in production for client errors)
  if (error.statusCode >= 500 || process.env.NODE_ENV === "development") {
    console.error(`
🚨 Error occurred:
  Type: ${error.constructor.name}
  Code: ${error.errorCode}
  Status: ${error.statusCode}
  Message: ${error.message}
  Path: ${req.originalUrl}
  Method: ${req.method}
  Stack: ${error.stack}
    `);
  }

  // Prepare response
  const response = {
    success: false,
    error: {
      type: error.constructor.name,
      code: error.errorCode,
      message: error.message,
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      method: req.method,
    },
  };

  // Add stack trace in development
  if (process.env.NODE_ENV === "development") {
    response.error.stack = error.stack;
  }

  res.status(error.statusCode).json(response);
};

/**
 * Async Error Wrapper
 * Wraps async route handlers to catch errors automatically
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Create error response helper
 */
const createErrorResponse = (error, req) => ({
  success: false,
  error: {
    type: error.constructor.name,
    code: error.errorCode,
    message: error.message,
    timestamp: new Date().toISOString(),
    path: req?.originalUrl,
    method: req?.method,
  },
});

// Export the simplified error system
export {
  // Single Error Class
  CustomError,

  // Middleware
  notFoundHandler,
  errorHandler,
  asyncHandler,

  // Helpers
  createErrorResponse,
};

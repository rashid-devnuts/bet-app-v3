/**
 * Custom Error Classes and Error Handler Middleware
 * Comprehensive error handling system for the application
 */

// Base Custom Error Class
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

// API Related Errors
class APIError extends CustomError {
  constructor(message = "API Error", statusCode = 500) {
    super(message, statusCode, "API_ERROR");
  }
}

class SportsMonksAPIError extends APIError {
  constructor(message = "SportsMonks API Error", statusCode = 502) {
    super(message, statusCode);
    this.errorCode = "SPORTSMONKS_API_ERROR";
  }
}

class APITimeoutError extends APIError {
  constructor(message = "API Request Timeout") {
    super(message, 408);
    this.errorCode = "API_TIMEOUT";
  }
}

class APIRateLimitError extends APIError {
  constructor(message = "API Rate Limit Exceeded") {
    super(message, 429);
    this.errorCode = "API_RATE_LIMIT";
  }
}

// Client Errors (4xx)
class BadRequestError extends CustomError {
  constructor(message = "Bad Request") {
    super(message, 400, "BAD_REQUEST");
  }
}

class UnauthorizedError extends CustomError {
  constructor(message = "Unauthorized") {
    super(message, 401, "UNAUTHORIZED");
  }
}

class ForbiddenError extends CustomError {
  constructor(message = "Forbidden") {
    super(message, 403, "FORBIDDEN");
  }
}

class NotFoundError extends CustomError {
  constructor(message = "Resource Not Found") {
    super(message, 404, "NOT_FOUND");
  }
}

class ConflictError extends CustomError {
  constructor(message = "Conflict") {
    super(message, 409, "CONFLICT");
  }
}

class ValidationError extends CustomError {
  constructor(message = "Validation Error", errors = []) {
    super(message, 422, "VALIDATION_ERROR");
    this.errors = errors;
  }
}

// Server Errors (5xx)
class InternalServerError extends CustomError {
  constructor(message = "Internal Server Error") {
    super(message, 500, "INTERNAL_ERROR");
  }
}

class ServiceUnavailableError extends CustomError {
  constructor(message = "Service Unavailable") {
    super(message, 503, "SERVICE_UNAVAILABLE");
  }
}

class DatabaseError extends CustomError {
  constructor(message = "Database Error") {
    super(message, 500, "DATABASE_ERROR");
  }
}

// Data Related Errors
class DataNotFoundError extends NotFoundError {
  constructor(resource = "Data") {
    super(`${resource} not found`);
    this.errorCode = "DATA_NOT_FOUND";
  }
}

class LeaguesNotFoundError extends DataNotFoundError {
  constructor() {
    super("Leagues");
    this.errorCode = "LEAGUES_NOT_FOUND";
  }
}

class MatchesNotFoundError extends DataNotFoundError {
  constructor() {
    super("Matches");
    this.errorCode = "MATCHES_NOT_FOUND";
  }
}

class MarketsNotFoundError extends DataNotFoundError {
  constructor() {
    super("Markets");
    this.errorCode = "MARKETS_NOT_FOUND";
  }
}

class OddsNotFoundError extends DataNotFoundError {
  constructor() {
    super("Odds");
    this.errorCode = "ODDS_NOT_FOUND";
  }
}

/**
 * 404 Not Found Middleware
 * Handles requests to routes that don't exist
 */
const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError(`Route not found - ${req.originalUrl}`);
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
      error = new BadRequestError("Invalid resource ID format");
    }
    // Mongoose Duplicate Key Error
    else if (err.code === 11000) {
      const field = Object.keys(err.keyValue || {})[0] || "field";
      error = new ConflictError(`Duplicate ${field} value`);
    }
    // Mongoose Validation Error
    else if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map((val) => val.message);
      error = new ValidationError("Validation failed", messages);
    }
    // JWT Errors
    else if (err.name === "JsonWebTokenError") {
      error = new UnauthorizedError("Invalid token");
    } else if (err.name === "TokenExpiredError") {
      error = new UnauthorizedError("Token expired");
    }
    // Axios/HTTP Errors
    else if (err.response) {
      const status = err.response.status;
      const message = err.response.data?.message || err.message;

      if (status >= 400 && status < 500) {
        error = new APIError(message, status);
      } else {
        error = new SportsMonksAPIError(message, status);
      }
    }
    // Request Timeout
    else if (err.code === "ECONNABORTED" || err.code === "ETIMEDOUT") {
      error = new APITimeoutError();
    }
    // Generic server error
    else {
      error = new InternalServerError(err.message || "Something went wrong");
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

  // Add validation errors if present
  if (error.errors && error.errors.length > 0) {
    response.error.details = error.errors;
  }

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

// Export all custom errors and handlers
export {
  // Base Error
  CustomError,

  // API Errors
  APIError,
  SportsMonksAPIError,
  APITimeoutError,
  APIRateLimitError,

  // Client Errors
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,

  // Server Errors
  InternalServerError,
  ServiceUnavailableError,
  DatabaseError,

  // Data Errors
  DataNotFoundError,
  LeaguesNotFoundError,
  MatchesNotFoundError,
  MarketsNotFoundError,
  OddsNotFoundError,

  // Middleware
  notFoundHandler,
  errorHandler,
  asyncHandler,

  // Helpers
  createErrorResponse,
};

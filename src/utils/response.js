/**
 * Response utility functions for consistent API responses
 */

/**
 * Send success JSON response
 * @param {Object} res - Express response object
 * @param {*} data - Data to send
 * @param {string} message - Success message
 * @param {number} statusCode - HTTP status code (default 200)
 */
const success = (res, data = null, message = 'Success', statusCode = 200) => {
  const response = {
    success: true,
    message
  };
  
  if (data !== null) {
    response.data = data;
  }
  
  res.status(statusCode).json(response);
};

/**
 * Send error JSON response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {Error} error - Error object (optional)
 * @param {number} statusCode - HTTP status code (default 500)
 */
const error = (res, message = 'Internal server error', error = null, statusCode = 500) => {
  console.error('[API ERROR]', message, error?.message || '');
  
  const response = {
    success: false,
    message
  };
  
  if (process.env.NODE_ENV !== 'production' && error) {
    response.error = error.message;
    response.stack = error.stack;
  }
  
  res.status(statusCode).json(response);
};

/**
 * Send validation error response
 * @param {Object} res - Express response object
 * @param {string} message - Validation error message
 * @param {Object} errors - Validation errors object
 */
const validationError = (res, message = 'Validation failed', errors = {}) => {
  res.status(400).json({
    success: false,
    message,
    errors
  });
};

/**
 * Send not found response
 * @param {Object} res - Express response object
 * @param {string} message - Not found message
 */
const notFound = (res, message = 'Resource not found') => {
  res.status(404).json({
    success: false,
    message
  });
};

/**
 * Send unauthorized response
 * @param {Object} res - Express response object
 * @param {string} message - Unauthorized message
 */
const unauthorized = (res, message = 'Unauthorized access') => {
  res.status(401).json({
    success: false,
    message
  });
};

/**
 * Send forbidden response
 * @param {Object} res - Express response object
 * @param {string} message - Forbidden message
 */
const forbidden = (res, message = 'Access forbidden') => {
  res.status(403).json({
    success: false,
    message
  });
};

module.exports = {
  success,
  error,
  validationError,
  notFound,
  unauthorized,
  forbidden
};

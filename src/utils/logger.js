/**
 * Logger utility for consistent logging across the application
 */

const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};

/**
 * Format log message with timestamp and level
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {*} data - Additional data
 * @returns {string} Formatted log message
 */
const format = (level, message, data = null) => {
  const timestamp = new Date().toISOString();
  let log = `[${timestamp}] [${level}] ${message}`;
  
  if (data) {
    log += ` ${JSON.stringify(data)}`;
  }
  
  return log;
};

/**
 * Log error message
 * @param {string} message - Error message
 * @param {*} data - Additional data
 */
const error = (message, data = null) => {
  console.error(format(LOG_LEVELS.ERROR, message, data));
};

/**
 * Log warning message
 * @param {string} message - Warning message
 * @param {*} data - Additional data
 */
const warn = (message, data = null) => {
  console.warn(format(LOG_LEVELS.WARN, message, data));
};

/**
 * Log info message
 * @param {string} message - Info message
 * @param {*} data - Additional data
 */
const info = (message, data = null) => {
  console.log(format(LOG_LEVELS.INFO, message, data));
};

/**
 * Log debug message (only in development)
 * @param {string} message - Debug message
 * @param {*} data - Additional data
 */
const debug = (message, data = null) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(format(LOG_LEVELS.DEBUG, message, data));
  }
};

module.exports = {
  error,
  warn,
  info,
  debug
};

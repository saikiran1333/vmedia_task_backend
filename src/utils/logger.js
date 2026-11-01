// High-performance structured logger with log levels and timestamp formatting.
const LOG_LEVELS = Object.freeze({
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
});

// Resolves current system log level based on environment.
const currentLevel = process.env.NODE_ENV === 'production' ? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG;

// Formats log output with ISO timestamp and standardized level tag.
const formatMessage = (level, message, meta) => {
  const timestamp = new Date().toISOString();
  const metaString = meta && Object.keys(meta).length ? ` | ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level}] ${message}${metaString}`;
};

export const logger = {
  // Outputs verbose debugging information during development.
  debug: (message, meta) => {
    if (currentLevel <= LOG_LEVELS.DEBUG) {
      console.debug(formatMessage('DEBUG', message, meta));
    }
  },

  // Outputs general operational notifications.
  info: (message, meta) => {
    if (currentLevel <= LOG_LEVELS.INFO) {
      console.info(formatMessage('INFO', message, meta));
    }
  },

  // Outputs non-fatal warning messages.
  warn: (message, meta) => {
    if (currentLevel <= LOG_LEVELS.WARN) {
      console.warn(formatMessage('WARN', message, meta));
    }
  },

  // Outputs fatal and handled exception logs.
  error: (message, meta) => {
    if (currentLevel <= LOG_LEVELS.ERROR) {
      console.error(formatMessage('ERROR', message, meta));
    }
  },
};

/**
 * 🔍 CONDITIONAL LOGGER UTILITY
 * 
 * Controls logging based on environment:
 * - Development: All logs enabled
 * - Production: Only errors/warnings
 * 
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.log('Debug info');
 *   logger.error('Critical error');
 */

const isDevelopment = process.env.NODE_ENV === 'development';
const isDebugEnabled = process.env.NEXT_PUBLIC_DEBUG === 'true';

// Allow debug in production if explicitly enabled
const showDebugLogs = isDevelopment || isDebugEnabled;

export const logger = {
  /**
   * Debug/info logs - only in development
   */
  log: (...args: any[]) => {
    if (showDebugLogs) {
      console.log(...args);
    }
  },

  /**
   * Informational logs - only in development
   */
  info: (...args: any[]) => {
    if (showDebugLogs) {
      console.info(...args);
    }
  },

  /**
   * Warnings - always shown (but can be disabled in production)
   */
  warn: (...args: any[]) => {
    if (showDebugLogs) {
      console.warn(...args);
    }
  },

  /**
   * Errors - ALWAYS shown (critical)
   */
  error: (...args: any[]) => {
    console.error(...args);
  },

  /**
   * Group logs - only in development
   */
  group: (label: string) => {
    if (showDebugLogs && console.group) {
      console.group(label);
    }
  },

  groupEnd: () => {
    if (showDebugLogs && console.groupEnd) {
      console.groupEnd();
    }
  },

  /**
   * Table logs - only in development
   */
  table: (data: any) => {
    if (showDebugLogs && console.table) {
      console.table(data);
    }
  },

  /**
   * Time tracking - only in development
   */
  time: (label: string) => {
    if (showDebugLogs && console.time) {
      console.time(label);
    }
  },

  timeEnd: (label: string) => {
    if (showDebugLogs && console.timeEnd) {
      console.timeEnd(label);
    }
  },

  /**
   * Debug flag for conditional code execution
   */
  isDebug: showDebugLogs,
};

/**
 * Performance logger - only in development
 */
export const perfLogger = {
  start: (label: string) => {
    if (showDebugLogs) {
      performance.mark(`${label}-start`);
    }
  },

  end: (label: string) => {
    if (showDebugLogs) {
      try {
        performance.mark(`${label}-end`);
        performance.measure(label, `${label}-start`, `${label}-end`);
        const measure = performance.getEntriesByName(label)[0];
        logger.log(`⏱️ ${label}: ${measure.duration.toFixed(2)}ms`);
      } catch (e) {
        // Marks don't exist, ignore
      }
    }
  },
};

// Export for backwards compatibility
export default logger;


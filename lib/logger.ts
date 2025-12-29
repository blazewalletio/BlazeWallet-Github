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

/**
 * 🔒 SECURE LOGGER - Sanitization for production
 * 
 * Automatically sanitizes sensitive data in logs:
 * - Development: Full data (for debugging)
 * - Production: Sanitized data (for privacy)
 */
export const secureLogger = {
  /**
   * Hash address (show first 4 + last 4 chars)
   * Development: full address
   * Production: hashed
   */
  hashAddress(address: string | null | undefined): string {
    if (!address) return '[no address]';
    if (showDebugLogs) return address; // Full in dev
    if (address.length < 8) return '***';
    return `${address.substring(0, 4)}...${address.substring(address.length - 4)}`;
  },

  /**
   * Mask amount (round to range)
   * Development: exact amount
   * Production: masked range
   */
  maskAmount(amount: string, symbol?: string): string {
    if (showDebugLogs) return `${amount} ${symbol || ''}`.trim();
    const num = parseFloat(amount);
    if (isNaN(num)) return `[invalid] ${symbol || ''}`.trim();
    if (num < 0.01) return `<0.01 ${symbol || ''}`.trim();
    if (num < 1) return `<1 ${symbol || ''}`.trim();
    if (num < 10) return `~1-10 ${symbol || ''}`.trim();
    const rounded = Math.round(num / 10) * 10;
    return `~${rounded}-${rounded + 10} ${symbol || ''}`.trim();
  },

  /**
   * Log transaction details (sanitized)
   */
  transaction(tx: any) {
    logger.log(`   Chain: ${tx.chain}`);
    logger.log(`   Amount: ${secureLogger.maskAmount(tx.amount, tx.token_symbol)}`);
    logger.log(`   To: ${secureLogger.hashAddress(tx.to_address)}`);
    logger.log(`   From: ${secureLogger.hashAddress(tx.from_address)}`);
    logger.log(`   Status: ${tx.status}`);
  }
};

// Export for backwards compatibility
export default logger;


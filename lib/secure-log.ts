/**
 * 🔒 SECURITY: Safe logging utility
 * Only logs in development, strips sensitive data in production
 */

const isDevelopment = process.env.NODE_ENV !== 'production';

export const secureLog = {
  /**
   * General info log (safe in production)
   */
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.log('[INFO]', ...args);
    }
  },

  /**
   * Warning log (safe in production)
   */
  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn('[WARN]', ...args);
    }
  },

  /**
   * Error log (safe in production, but NO sensitive data)
   */
  error: (message: string, error?: any) => {
    if (isDevelopment) {
      console.error('[ERROR]', message, error);
    } else {
      // In production, only log generic error message
      console.error('[ERROR]', message);
    }
  },

  /**
   * ⚠️ NEVER USE IN PRODUCTION - Debug only
   * This will NEVER log in production, even if called
   */
  sensitive: (...args: any[]) => {
    if (isDevelopment) {
      console.log('[🔐 SENSITIVE - DEV ONLY]', ...args);
    }
    // Silently ignore in production
  },

  /**
   * Sanitize sensitive string (show only first few chars)
   */
  sanitize: (value: string | null | undefined, visibleChars: number = 4): string => {
    if (!value) return '[empty]';
    if (value.length <= visibleChars) return '***';
    return value.substring(0, visibleChars) + '...';
  },
};

/**
 * 🔒 SECURITY: Check if running in secure context
 */
export const isSecureContext = (): boolean => {
  if (typeof window === 'undefined') return true; // Server-side is safe
  return window.isSecureContext && window.location.protocol === 'https:';
};

/**
 * 🔒 SECURITY: Warn if not in secure context
 */
export const warnIfInsecure = () => {
  if (!isSecureContext()) {
    console.warn('⚠️ WARNING: Application is not running in a secure context (HTTPS). Sensitive data may be at risk.');
  }
};


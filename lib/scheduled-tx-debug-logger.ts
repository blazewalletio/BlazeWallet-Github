// ============================================================================
// 🔥 BLAZE WALLET - SCHEDULED TRANSACTIONS DEBUG LOGGER
// ============================================================================
// Logs alle scheduled transaction events naar localStorage voor debugging
// ============================================================================

interface LogEntry {
  timestamp: string;
  step: string;
  action: string;
  data: any;
  error?: any;
}

const STORAGE_KEY = 'blaze_scheduled_tx_debug_logs';
const MAX_LOGS = 500; // Maximum aantal log entries

class ScheduledTxDebugLogger {
  /**
   * Voeg een log entry toe
   */
  log(step: string, action: string, data: any, error?: any): void {
    if (typeof window === 'undefined') return;

    try {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        step,
        action,
        data: this.sanitizeData(data),
        error: error ? {
          message: error.message,
          stack: error.stack,
          details: error.details || error,
        } : undefined,
      };

      const logs = this.getLogs();
      logs.push(entry);

      // Beperk tot MAX_LOGS entries (oudste eerst verwijderen)
      if (logs.length > MAX_LOGS) {
        logs.splice(0, logs.length - MAX_LOGS);
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
    } catch (e) {
      console.error('Failed to save debug log:', e);
    }
  }

  /**
   * Haal alle logs op
   */
  getLogs(): LogEntry[] {
    if (typeof window === 'undefined') return [];

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('Failed to read debug logs:', e);
      return [];
    }
  }

  /**
   * Wis alle logs
   */
  clearLogs(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
  }

  /**
   * Export logs als JSON string
   */
  exportLogs(): string {
    return JSON.stringify(this.getLogs(), null, 2);
  }

  /**
   * Sanitize data voor logging (verwijder gevoelige informatie)
   */
  private sanitizeData(data: any): any {
    if (!data || typeof data !== 'object') return data;

    const sanitized = { ...data };

    // Verwijder gevoelige velden
    const sensitiveFields = [
      'mnemonic',
      'privateKey',
      'private_key',
      'encrypted_auth',
      'encryptedAuth',
      'password',
      'service_key',
      'api_key',
      'secret',
    ];

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    // Recursief sanitize nested objects
    for (const key in sanitized) {
      if (sanitized[key] && typeof sanitized[key] === 'object' && !Array.isArray(sanitized[key])) {
        sanitized[key] = this.sanitizeData(sanitized[key]);
      }
    }

    return sanitized;
  }
}

export const scheduledTxDebugLogger = new ScheduledTxDebugLogger();


/**
 * Debug Logger Service
 * Sends all debug logs to Supabase for remote inspection
 * Perfect for mobile debugging without DevTools access
 */

import { supabase } from './supabase';
import { logger } from './logger';

export type DebugLevel = 'debug' | 'info' | 'warn' | 'error';

export type DebugCategory = 
  | 'device_verification'
  | 'localStorage'
  | 'database'
  | 'auth'
  | 'wallet'
  | 'fingerprint'
  | 'session'
  | 'general';

interface DebugLogData {
  level: DebugLevel;
  category: DebugCategory;
  message: string;
  data?: any;
  deviceInfo?: any;
}

class DebugLoggerService {
  private static instance: DebugLoggerService;
  private sessionId: string;
  private userId: string | null = null;
  private enabled: boolean = true;
  private logQueue: DebugLogData[] = [];
  private isProcessing: boolean = false;

  private constructor() {
    // Generate unique session ID
    this.sessionId = this.generateSessionId();
    
    // Get user ID if available
    this.initializeUserId();
    
    logger.log('🔧 [DebugLogger] Initialized with session:', this.sessionId.substring(0, 8) + '...');
  }

  public static getInstance(): DebugLoggerService {
    if (!DebugLoggerService.instance) {
      DebugLoggerService.instance = new DebugLoggerService();
    }
    return DebugLoggerService.instance;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private async initializeUserId() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        this.userId = user.id;
        logger.log('🔧 [DebugLogger] User ID set:', user.id);
      }
    } catch (error) {
      // Ignore - user might not be logged in yet
    }
  }

  /**
   * Enable/disable debug logging
   */
  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
    logger.log(`🔧 [DebugLogger] ${enabled ? 'Enabled' : 'Disabled'}`);
  }

  /**
   * Set user ID manually (for when user logs in)
   */
  public setUserId(userId: string) {
    this.userId = userId;
    logger.log('🔧 [DebugLogger] User ID updated:', userId);
  }

  /**
   * Main logging function
   */
  public async log(
    level: DebugLevel,
    category: DebugCategory,
    message: string,
    data?: any
  ): Promise<void> {
    if (!this.enabled) return;

    // Always log to console as backup
    const consoleMessage = `[${category.toUpperCase()}] ${message}`;
    switch (level) {
      case 'debug':
        logger.log(consoleMessage, data);
        break;
      case 'info':
        logger.log(consoleMessage, data);
        break;
      case 'warn':
        logger.warn(consoleMessage, data);
        break;
      case 'error':
        logger.error(consoleMessage, data);
        break;
    }

    // Add to queue
    this.logQueue.push({ level, category, message, data });

    // Process queue (debounced)
    this.processQueue();
  }

  /**
   * Convenience methods
   */
  public debug(category: DebugCategory, message: string, data?: any) {
    return this.log('debug', category, message, data);
  }

  public info(category: DebugCategory, message: string, data?: any) {
    return this.log('info', category, message, data);
  }

  public warn(category: DebugCategory, message: string, data?: any) {
    return this.log('warn', category, message, data);
  }

  public error(category: DebugCategory, message: string, data?: any) {
    return this.log('error', category, message, data);
  }

  /**
   * Process log queue (debounced to avoid too many DB calls)
   */
  private async processQueue() {
    if (this.isProcessing || this.logQueue.length === 0) return;

    this.isProcessing = true;

    // Wait 500ms for more logs to accumulate
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      const logsToSend = [...this.logQueue];
      this.logQueue = [];

      // Get device info once
      const deviceInfo = this.getDeviceInfo();

      // Prepare batch insert
      const records = logsToSend.map(log => ({
        user_id: this.userId,
        session_id: this.sessionId,
        level: log.level,
        category: log.category,
        message: log.message,
        data: log.data || {},
        device_info: deviceInfo,
        url: typeof window !== 'undefined' ? window.location.href : null,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      }));

      // Send to Supabase
      const { error } = await supabase
        .from('debug_logs')
        .insert(records);

      if (error) {
        logger.error('❌ [DebugLogger] Failed to send logs:', error);
      } else {
        logger.log(`✅ [DebugLogger] Sent ${records.length} logs to Supabase`);
      }
    } catch (error) {
      logger.error('❌ [DebugLogger] Error processing queue:', error);
    } finally {
      this.isProcessing = false;

      // Process remaining logs if any
      if (this.logQueue.length > 0) {
        this.processQueue();
      }
    }
  }

  /**
   * Get device information
   */
  private getDeviceInfo(): any {
    if (typeof window === 'undefined') return {};

    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
      online: navigator.onLine,
      cookieEnabled: navigator.cookieEnabled,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Flush all pending logs immediately (useful before navigation)
   */
  public async flush(): Promise<void> {
    if (this.logQueue.length === 0) return;

    this.isProcessing = false; // Reset flag to allow immediate processing
    await this.processQueue();
  }

  /**
   * Get session ID (useful for manual queries)
   */
  public getSessionId(): string {
    return this.sessionId;
  }
}

// Export singleton instance
export const debugLogger = DebugLoggerService.getInstance();

// Convenience exports
export const logDebug = (category: DebugCategory, message: string, data?: any) => 
  debugLogger.debug(category, message, data);

export const logInfo = (category: DebugCategory, message: string, data?: any) => 
  debugLogger.info(category, message, data);

export const logWarn = (category: DebugCategory, message: string, data?: any) => 
  debugLogger.warn(category, message, data);

export const logError = (category: DebugCategory, message: string, data?: any) => 
  debugLogger.error(category, message, data);


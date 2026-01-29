/**
 * 📊 Analytics Tracker Service
 * 
 * Client-side analytics tracking with privacy-first design
 * - Batches events for performance
 * - Automatically flushes queue every 5 seconds
 * - Fail-safe: never blocks user actions
 * - Privacy: only tracks metadata, never sensitive data
 */

import { logger } from '@/lib/logger';

interface TransactionEvent {
  type: 'transaction_event';
  eventType: 
    | 'send_initiated' 
    | 'send_confirmed' 
    | 'send_failed'
    | 'receive_detected'
    | 'swap_initiated' 
    | 'swap_confirmed' 
    | 'swap_failed'
    | 'onramp_initiated' 
    | 'onramp_completed'
    | 'onramp_failed';
  chainKey: string;
  tokenSymbol?: string;
  valueUSD?: number;
  status: 'pending' | 'success' | 'failed';
  referenceId?: string; // Will be hashed server-side
  metadata?: Record<string, any>;
  timestamp: string;
}

interface FeatureUsageEvent {
  type: 'feature_usage';
  featureName: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

type AnalyticsEvent = TransactionEvent | FeatureUsageEvent;

export class AnalyticsTracker {
  private static instance: AnalyticsTracker;
  private queue: AnalyticsEvent[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private isEnabled: boolean = true;
  private isFlushing: boolean = false;

  // Singleton pattern
  static getInstance(): AnalyticsTracker {
    if (typeof window === 'undefined') {
      // Server-side: return dummy instance
      return {
        logTransactionEvent: async () => {},
        logFeatureUsage: async () => {},
        flush: async () => {},
        enable: () => {},
        disable: () => {},
        isAnalyticsEnabled: () => false,
      } as any;
    }

    if (!this.instance) {
      this.instance = new AnalyticsTracker();
    }
    return this.instance;
  }

  constructor() {
    if (typeof window === 'undefined') return;

    // Check if analytics is enabled (respects user preference)
    this.isEnabled = this.loadPreference();

    if (this.isEnabled) {
      // Flush queue every 5 seconds
      this.flushInterval = setInterval(() => {
        this.flush();
      }, 5000);

      // Flush on page unload
      window.addEventListener('beforeunload', () => {
        this.flush();
      });

      logger.log('📊 Analytics Tracker initialized');
    } else {
      logger.log('📊 Analytics Tracker disabled (user preference)');
    }
  }

  /**
   * Check if analytics is enabled
   */
  isAnalyticsEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Enable analytics tracking
   */
  enable(): void {
    this.isEnabled = true;
    localStorage.setItem('analytics_enabled', 'true');
    
    if (!this.flushInterval) {
      this.flushInterval = setInterval(() => {
        this.flush();
      }, 5000);
    }

    logger.log('📊 Analytics enabled');
  }

  /**
   * Disable analytics tracking
   */
  disable(): void {
    this.isEnabled = false;
    localStorage.setItem('analytics_enabled', 'false');
    
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    // Clear queue
    this.queue = [];
    
    logger.log('📊 Analytics disabled');
  }

  /**
   * Load user preference from localStorage
   */
  private loadPreference(): boolean {
    if (typeof window === 'undefined') return false;
    
    const stored = localStorage.getItem('analytics_enabled');
    
    // Default to enabled if no preference set
    return stored === null || stored === 'true';
  }

  /**
   * Log a transaction event
   * 
   * @example
   * tracker.logTransactionEvent({
   *   eventType: 'swap_confirmed',
   *   chainKey: 'ethereum',
   *   tokenSymbol: 'ETH',
   *   valueUSD: 1000,
   *   status: 'success',
   *   referenceId: '0x123...',
   *   metadata: { protocol: 'jupiter' }
   * });
   */
  async logTransactionEvent(event: Omit<TransactionEvent, 'type' | 'timestamp'>): Promise<void> {
    if (!this.isEnabled) return;

    try {
      this.queue.push({
        type: 'transaction_event',
        ...event,
        timestamp: new Date().toISOString(),
      });

      // Flush immediately if queue is large
      if (this.queue.length >= 10) {
        await this.flush();
      }
    } catch (error) {
      logger.error('[Analytics] Failed to log transaction event:', error);
      // Fail silently - never block user actions
    }
  }

  /**
   * Log a feature usage event
   * 
   * @example
   * tracker.logFeatureUsage('swap_modal_opened', { chainKey: 'ethereum' });
   * tracker.logFeatureUsage('buy_crypto_clicked', { provider: 'moonpay' });
   */
  async logFeatureUsage(featureName: string, metadata?: Record<string, any>): Promise<void> {
    if (!this.isEnabled) return;

    try {
      this.queue.push({
        type: 'feature_usage',
        featureName,
        metadata,
        timestamp: new Date().toISOString(),
      });

      // Flush if queue is large
      if (this.queue.length >= 10) {
        await this.flush();
      }
    } catch (error) {
      logger.error('[Analytics] Failed to log feature usage:', error);
      // Fail silently
    }
  }

  /**
   * Flush the event queue to the server
   */
  async flush(): Promise<void> {
    if (!this.isEnabled || this.queue.length === 0 || this.isFlushing) {
      return;
    }

    this.isFlushing = true;
    const events = [...this.queue];
    this.queue = [];

    try {
      // Get auth token
      const token = await this.getAuthToken();
      if (!token) {
        logger.warn('[Analytics] No auth token, re-queuing events');
        // Not logged in, re-queue events
        this.queue = [...events, ...this.queue];
        this.isFlushing = false;
        return;
      }

      logger.log(`[Analytics] Flushing ${events.length} events...`);

      // Send to backend
      const response = await fetch('/api/analytics/batch-log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ events }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`[Analytics] Flush failed: ${response.status} ${response.statusText}`, errorText);
        
        // Re-queue events on failure (but limit queue size)
        if (this.queue.length < 100) {
          this.queue = [...events, ...this.queue];
        }
        this.isFlushing = false;
        return;
      }

      const result = await response.json();
      logger.log(`✅ [Analytics] Flushed successfully: ${result.processed} events processed`);

    } catch (error: any) {
      logger.error('[Analytics] Flush exception:', error.message);
      
      // Re-queue events on failure (but limit queue size to prevent memory issues)
      if (this.queue.length < 100) {
        this.queue = [...events, ...this.queue];
      }
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Get auth token from Supabase session
   */
  private async getAuthToken(): Promise<string | null> {
    try {
      // Use existing supabase client to avoid multiple instances
      const { supabase } = await import('./supabase');
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        logger.warn('[Analytics] Session error:', error.message);
        return null;
      }
      
      if (!session) {
        logger.log('[Analytics] No active session');
        return null;
      }
      
      logger.log('[Analytics] Auth token retrieved');
      return session.access_token;
    } catch (error: any) {
      logger.error('[Analytics] Token error:', error.message);
      return null;
    }
  }
}

// Export singleton instance
export const analyticsTracker = AnalyticsTracker.getInstance();

// Export convenience functions
export const logTransactionEvent = (event: Parameters<AnalyticsTracker['logTransactionEvent']>[0]) => 
  analyticsTracker.logTransactionEvent(event);

export const logFeatureUsage = (featureName: string, metadata?: Record<string, any>) => 
  analyticsTracker.logFeatureUsage(featureName, metadata);

export const isAnalyticsEnabled = () => 
  analyticsTracker.isAnalyticsEnabled();

export const enableAnalytics = () => 
  analyticsTracker.enable();

export const disableAnalytics = () => 
  analyticsTracker.disable();


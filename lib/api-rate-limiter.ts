/**
 * 🔒 API Rate Limiter
 * 
 * Simple in-memory rate limiter for API endpoints
 * Fail-open: If rate limiter fails, allow request (no impact on functionality)
 */

import { logger } from '@/lib/logger';

class APIRateLimiter {
  private requests: Map<string, number[]> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Cleanup old entries every 5 minutes
    if (typeof setInterval !== 'undefined') {
      this.cleanupInterval = setInterval(() => {
        this.cleanup();
      }, 5 * 60 * 1000);
    }
  }

  /**
   * Check if request is allowed
   * @param identifier - IP address or user_id
   * @param maxRequests - Max requests per window
   * @param windowMs - Time window in milliseconds
   */
  check(identifier: string, maxRequests: number, windowMs: number): boolean {
    try {
      const now = Date.now();
      const requests = this.requests.get(identifier) || [];
      
      // Remove old requests outside window
      const recentRequests = requests.filter(time => now - time < windowMs);
      
      if (recentRequests.length >= maxRequests) {
        logger.warn(`⚠️ [Rate Limiter] Rate limit exceeded for ${identifier}: ${recentRequests.length}/${maxRequests} in ${windowMs}ms`);
        return false; // Rate limited
      }
      
      // Add current request
      recentRequests.push(now);
      this.requests.set(identifier, recentRequests);
      
      return true; // Allowed
    } catch (error) {
      // Fail-open: if rate limiter fails, allow request
      logger.error('⚠️ [Rate Limiter] Error, allowing request:', error);
      return true;
    }
  }

  /**
   * Cleanup old entries to prevent memory leak
   */
  private cleanup() {
    try {
      const now = Date.now();
      const maxAge = 10 * 60 * 1000; // 10 minutes
      
      for (const [key, requests] of this.requests.entries()) {
        const recentRequests = requests.filter(time => now - time < maxAge);
        if (recentRequests.length === 0) {
          this.requests.delete(key);
        } else {
          this.requests.set(key, recentRequests);
        }
      }
    } catch (error) {
      logger.error('⚠️ [Rate Limiter] Cleanup error:', error);
    }
  }

  /**
   * Clear all entries (for testing)
   */
  clear() {
    this.requests.clear();
  }
}

// Singleton instance
export const apiRateLimiter = new APIRateLimiter();



/**
 * Rate Limiting Service
 * Client-side rate limiting for failed login attempts
 * 
 * SECURITY:
 * - Locks account after 5 failed attempts
 * - 15-minute lockout period
 * - Stores in localStorage (client-side protection)
 * - Can be enhanced with Supabase backend later
 */

import { logger } from './logger';

const RATE_LIMIT_KEY = 'blaze_rate_limit';
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
const ATTEMPT_WINDOW = 30 * 60 * 1000; // 30 minutes

interface RateLimitData {
  userIdentifier: string;
  attemptCount: number;
  lastAttemptAt: number;
  lockedUntil: number | null;
}

export class RateLimitService {
  private static instance: RateLimitService;

  private constructor() {}

  public static getInstance(): RateLimitService {
    if (!RateLimitService.instance) {
      RateLimitService.instance = new RateLimitService();
    }
    return RateLimitService.instance;
  }

  /**
   * Get rate limit data for a user
   */
  private getData(userIdentifier: string): RateLimitData | null {
    if (typeof window === 'undefined') return null;

    try {
      const data = localStorage.getItem(`${RATE_LIMIT_KEY}_${userIdentifier}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Error reading rate limit data:', error);
      return null;
    }
  }

  /**
   * Save rate limit data for a user
   */
  private saveData(data: RateLimitData): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(
        `${RATE_LIMIT_KEY}_${data.userIdentifier}`,
        JSON.stringify(data)
      );
    } catch (error) {
      logger.error('Error saving rate limit data:', error);
    }
  }

  /**
   * Check if user is currently locked
   */
  public isLocked(userIdentifier: string): {
    isLocked: boolean;
    lockedUntil?: number;
    unlockInSeconds?: number;
    attemptCount?: number;
  } {
    const data = this.getData(userIdentifier);

    if (!data) {
      return { isLocked: false, attemptCount: 0 };
    }

    // Check if lock expired
    if (data.lockedUntil && data.lockedUntil > Date.now()) {
      const unlockInSeconds = Math.ceil((data.lockedUntil - Date.now()) / 1000);
      logger.log(`🔒 Account locked. Unlock in ${unlockInSeconds} seconds`);
      
      return {
        isLocked: true,
        lockedUntil: data.lockedUntil,
        unlockInSeconds,
        attemptCount: data.attemptCount
      };
    }

    // Check if attempts are too old (reset if > 30 minutes)
    if (data.lastAttemptAt < Date.now() - ATTEMPT_WINDOW) {
      this.clearAttempts(userIdentifier);
      return { isLocked: false, attemptCount: 0 };
    }

    return { 
      isLocked: false, 
      attemptCount: data.attemptCount 
    };
  }

  /**
   * Record a failed login attempt
   */
  public recordFailedAttempt(userIdentifier: string): {
    attemptCount: number;
    remainingAttempts: number;
    isLocked: boolean;
    lockedUntil?: number;
  } {
    const existingData = this.getData(userIdentifier);
    const now = Date.now();

    let attemptCount = 1;

    if (existingData) {
      // Check if lock expired
      if (existingData.lockedUntil && existingData.lockedUntil < now) {
        // Lock expired, reset count
        attemptCount = 1;
      }
      // Check if attempts are within window
      else if (existingData.lastAttemptAt > now - ATTEMPT_WINDOW) {
        attemptCount = existingData.attemptCount + 1;
      }
      // Attempts too old, reset
      else {
        attemptCount = 1;
      }
    }

    const isLocked = attemptCount >= MAX_ATTEMPTS;
    const lockedUntil = isLocked ? now + LOCKOUT_DURATION : null;

    const data: RateLimitData = {
      userIdentifier,
      attemptCount,
      lastAttemptAt: now,
      lockedUntil
    };

    this.saveData(data);

    const remainingAttempts = Math.max(0, MAX_ATTEMPTS - attemptCount);

    if (isLocked) {
      logger.log(`🔒 Account locked after ${MAX_ATTEMPTS} failed attempts. Lockout: 15 minutes`);
    } else {
      logger.log(`❌ Failed login attempt ${attemptCount}/${MAX_ATTEMPTS}. ${remainingAttempts} attempts remaining`);
    }

    return {
      attemptCount,
      remainingAttempts,
      isLocked,
      lockedUntil: lockedUntil || undefined
    };
  }

  /**
   * Clear all failed attempts (on successful login)
   */
  public clearAttempts(userIdentifier: string): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.removeItem(`${RATE_LIMIT_KEY}_${userIdentifier}`);
      logger.log('✅ Failed login attempts cleared');
    } catch (error) {
      logger.error('Error clearing rate limit data:', error);
    }
  }

  /**
   * Get remaining attempts
   */
  public getRemainingAttempts(userIdentifier: string): number {
    const data = this.getData(userIdentifier);
    
    if (!data) return MAX_ATTEMPTS;

    // Check if locked
    if (data.lockedUntil && data.lockedUntil > Date.now()) {
      return 0;
    }

    // Check if attempts expired
    if (data.lastAttemptAt < Date.now() - ATTEMPT_WINDOW) {
      return MAX_ATTEMPTS;
    }

    return Math.max(0, MAX_ATTEMPTS - data.attemptCount);
  }
}

// Export singleton instance
export const rateLimitService = RateLimitService.getInstance();


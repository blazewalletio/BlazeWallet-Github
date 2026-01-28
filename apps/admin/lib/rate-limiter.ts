/**
 * Simple in-memory rate limiter for device verification
 * In production, consider using Redis or similar
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn: number; // seconds
}

/**
 * Rate limit by identifier (IP, email, etc.)
 * @param identifier Unique key to rate limit by
 * @param maxAttempts Maximum attempts allowed
 * @param windowMs Time window in milliseconds
 */
export function checkRateLimit(
  identifier: string,
  maxAttempts: number = 5,
  windowMs: number = 15 * 60 * 1000 // 15 minutes default
): RateLimitResult {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  // No entry or expired - create new
  if (!entry || entry.resetAt < now) {
    rateLimitStore.set(identifier, {
      count: 1,
      resetAt: now + windowMs,
    });

    return {
      allowed: true,
      remaining: maxAttempts - 1,
      resetIn: Math.ceil(windowMs / 1000),
    };
  }

  // Entry exists and not expired
  const newCount = entry.count + 1;
  const allowed = newCount <= maxAttempts;
  
  rateLimitStore.set(identifier, {
    count: newCount,
    resetAt: entry.resetAt,
  });

  return {
    allowed,
    remaining: Math.max(0, maxAttempts - newCount),
    resetIn: Math.ceil((entry.resetAt - now) / 1000),
  };
}

/**
 * Reset rate limit for an identifier (e.g., after successful verification)
 */
export function resetRateLimit(identifier: string): void {
  rateLimitStore.delete(identifier);
}

/**
 * Get client IP from request headers
 */
export function getClientIP(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    headers.get('x-real-ip') ||
    'unknown'
  );
}


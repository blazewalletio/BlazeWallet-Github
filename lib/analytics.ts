/**
 * 📊 User Analytics Service
 * 
 * Server-side analytics tracking for user actions
 * Integrates with the user_analytics database system
 */

import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

/**
 * Track a user event in the analytics system
 * This is the main function to use for tracking user actions
 * 
 * @param userId - The user's ID
 * @param eventName - Name of the event (e.g., 'login_success', 'swap_initiated')
 * @param properties - Additional event properties (amounts, currencies, etc.)
 */
export async function trackEvent(
  userId: string,
  eventName: string,
  properties?: Record<string, any>
): Promise<void> {
  try {
    // Call the database function that handles all analytics logic
    const { error } = await (supabase as any).rpc('track_user_event', {
      p_user_id: userId,
      p_event_name: eventName,
      p_properties: properties || {},
    });

    if (error) {
      logger.error('[Analytics] Failed to track event:', {
        eventName,
        userId: userId.substring(0, 8) + '...',
        error: error.message,
      });
    }
  } catch (err: any) {
    logger.error('[Analytics] Exception tracking event:', {
      eventName,
      error: err.message,
    });
  }
}

/**
 * Helper: Track authentication events
 */
export async function trackAuth(userId: string, action: 'login' | 'signup' | 'logout', metadata?: Record<string, any>): Promise<void> {
  await trackEvent(userId, `${action}_${metadata?.success ? 'success' : 'failed'}`, metadata);
}

/**
 * Helper: Track transaction events
 */
export async function trackTransaction(
  userId: string,
  type: 'send' | 'swap' | 'receive' | 'onramp',
  status: 'initiated' | 'confirmed' | 'failed' | 'completed' | 'pending' | 'processing' | 'refunded' | 'cancelled',
  metadata?: Record<string, any>
): Promise<void> {
  await trackEvent(userId, `${type}_${status}`, metadata);
}

/**
 * Helper: Track feature usage
 */
export async function trackFeature(userId: string, featureName: string, metadata?: Record<string, any>): Promise<void> {
  await trackEvent(userId, `feature_${featureName}`, metadata);
}


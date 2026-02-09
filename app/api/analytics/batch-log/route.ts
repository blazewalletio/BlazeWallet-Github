import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import crypto from 'crypto';

// Admin client with service role (bypasses RLS) - lazy initialization
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    // During build time, use placeholder values
    if (process.env.NODE_ENV !== 'production' && typeof window === 'undefined') {
      return createClient(
        'https://placeholder-project.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      );
    }
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }
  
  return createClient(
    url.trim(),
    key.trim(),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

// Regular client for auth - use central client
// (imported from @/lib/supabase above)

/**
 * Hash a string for privacy (SHA-256)
 */
function hashString(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * POST /api/analytics/batch-log
 * 
 * Batch logging endpoint for analytics events
 * Processes multiple events in a single request for performance
 * 
 * Event types:
 * - transaction_event: Transaction lifecycle events
 * - feature_usage: Feature usage tracking
 */
export async function POST(request: NextRequest) {
  try {
    // ✅ Add CORS headers
    const origin = request.headers.get('origin');
    const headers = {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // ✅ REMOVED CSRF validation for analytics endpoint
    // Analytics is non-critical and auth token validation is sufficient
    // CSRF protection adds unnecessary complexity for background logging

    // Get authenticated user (optional - allow anonymous logging)
    const authHeader = request.headers.get('authorization');
    
    let userId: string | null = null;
    
    if (authHeader) {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser(
          authHeader.replace('Bearer ', '')
        );

        if (!authError && user) {
          userId = user.id;
          logger.log('[Analytics API] User authenticated:', user.id);
        } else {
          logger.warn('[Analytics API] Auth failed (continuing anonymously):', authError?.message || 'No user');
        }
      } catch (authError: any) {
        logger.warn('[Analytics API] Auth error (continuing anonymously):', authError?.message);
      }
    } else {
      logger.log('[Analytics API] No auth header (anonymous logging)');
    }

    // Parse request body
    const { events } = await request.json();

    if (!events || !Array.isArray(events)) {
      return NextResponse.json(
        { error: 'Invalid request: events must be an array' },
        { status: 400, headers }
      );
    }

    if (userId) {
      logger.log(`[Analytics] Processing ${events.length} events for user ${userId}`);
    } else {
      logger.log(`[Analytics] Processing ${events.length} events anonymously (user not authenticated)`);
    }

    // Process all events in batch (only if user is authenticated)
    // If no user, silently ignore events (they'll be re-queued on next login)
    const results = userId ? await Promise.allSettled(
      events.map(async (event: any) => {
        if (event.type === 'transaction_event') {
          return processTransactionEvent(userId!, event);
        }

        if (event.type === 'feature_usage') {
          return processFeatureUsage(userId!, event);
        }

        logger.warn(`[Analytics] Unknown event type: ${event.type}`);
        return null;
      })
    ) : [];

    // Count successes and failures
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    if (userId) {
      if (failed > 0) {
        logger.warn(`[Analytics] Batch completed with errors: ${succeeded} succeeded, ${failed} failed`);
      } else {
        logger.log(`[Analytics] Batch completed successfully: ${succeeded} events processed`);
      }
    } else {
      logger.log(`[Analytics] Events ignored (user not authenticated - will be re-queued on next login)`);
    }

    return NextResponse.json({
      success: true,
      processed: succeeded,
      failed,
      anonymous: !userId,
    }, { headers });

  } catch (error: any) {
    logger.error('[Analytics] Batch log error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// ✅ Add OPTIONS handler for CORS preflight
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}

/**
 * Process a transaction event
 */
async function processTransactionEvent(userId: string, event: any) {
  const {
    eventType,
    chainKey,
    tokenSymbol,
    valueUSD,
    status,
    referenceId,
    metadata,
  } = event;

  // Validate required fields
  if (!eventType || !chainKey || !status) {
    throw new Error('Missing required fields: eventType, chainKey, status');
  }

  // Hash reference ID for privacy (if provided)
  const hashedReferenceId = referenceId ? hashString(referenceId) : null;

  // Insert event into database
  const { error } = await getSupabaseAdmin()
    .from('transaction_events')
    .insert({
      user_id: userId,
      event_type: eventType,
      chain_key: chainKey,
      token_symbol: tokenSymbol || null,
      value_usd: valueUSD || null,
      status,
      reference_id: hashedReferenceId,
      metadata: metadata || {},
    });

  if (error) {
    logger.error('[Analytics] Failed to insert transaction event:', error);
    throw error;
  }

  logger.log(`[Analytics] Transaction event logged: ${eventType} on ${chainKey}`);
}

/**
 * Process a feature usage event
 */
async function processFeatureUsage(userId: string, event: any) {
  const { featureName, metadata } = event;

  if (!featureName) {
    throw new Error('Missing required field: featureName');
  }

  const today = new Date().toISOString().split('T')[0];

  // Call increment function (handles upsert logic)
  const { error } = await getSupabaseAdmin().rpc('increment_feature_usage', {
    p_date: today,
    p_feature_name: featureName,
    p_user_id: userId,
  });

  if (error) {
    logger.error('[Analytics] Failed to increment feature usage:', error);
    throw error;
  }

  logger.log(`[Analytics] Feature usage logged: ${featureName}`);
}


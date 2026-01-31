import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import crypto from 'crypto';

// Validate environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL is required');
}

if (!supabaseServiceKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
}

// Admin client with service role (bypasses RLS)
const supabaseAdmin = createClient(
  supabaseUrl.trim(),
  supabaseServiceKey.trim(),
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

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
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token',
    };

    // ✅ CSRF Token Validation
    const csrfToken = request.headers.get('X-CSRF-Token');
    const cookieHeader = request.headers.get('cookie');
    
    if (!csrfToken || !cookieHeader) {
      logger.warn('[Analytics API] Missing CSRF token or cookie');
      return NextResponse.json(
        { error: 'Invalid CSRF token', message: 'Security check failed. Please refresh the page and try again.' },
        { status: 403, headers }
      );
    }

    // Extract CSRF cookie value
    const csrfCookie = cookieHeader
      .split(';')
      .find(c => c.trim().startsWith('csrfToken='))
      ?.split('=')[1];

    if (csrfToken !== csrfCookie) {
      logger.warn('[Analytics API] CSRF token mismatch');
      return NextResponse.json(
        { error: 'Invalid CSRF token', message: 'Security check failed. Please refresh the page and try again.' },
        { status: 403, headers }
      );
    }

    // Get authenticated user
    const authHeader = request.headers.get('authorization');
    
    logger.log('[Analytics API] Request received:', {
      hasAuth: !!authHeader,
      origin,
      method: request.method,
    });
    
    if (!authHeader) {
      logger.warn('[Analytics API] Missing authorization header');
      return NextResponse.json(
        { error: 'Missing authorization header' },
        { status: 401, headers }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      logger.warn('[Analytics API] Auth failed:', authError?.message || 'No user');
      return NextResponse.json(
        { error: 'Unauthorized', details: authError?.message },
        { status: 401, headers }
      );
    }

    logger.log('[Analytics API] User authenticated:', user.id);

    // Parse request body
    const { events } = await request.json();

    if (!events || !Array.isArray(events)) {
      return NextResponse.json(
        { error: 'Invalid request: events must be an array' },
        { status: 400, headers }
      );
    }

    logger.log(`[Analytics] Processing ${events.length} events for user ${user.id}`);

    // Process all events in batch
    const results = await Promise.allSettled(
      events.map(async (event: any) => {
        if (event.type === 'transaction_event') {
          return processTransactionEvent(user.id, event);
        }

        if (event.type === 'feature_usage') {
          return processFeatureUsage(user.id, event);
        }

        logger.warn(`[Analytics] Unknown event type: ${event.type}`);
        return null;
      })
    );

    // Count successes and failures
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    if (failed > 0) {
      logger.warn(`[Analytics] Batch completed with errors: ${succeeded} succeeded, ${failed} failed`);
    } else {
      logger.log(`[Analytics] Batch completed successfully: ${succeeded} events processed`);
    }

    return NextResponse.json({
      success: true,
      processed: succeeded,
      failed,
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
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token',
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
  const { error } = await supabaseAdmin
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
  const { error } = await supabaseAdmin.rpc('increment_feature_usage', {
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


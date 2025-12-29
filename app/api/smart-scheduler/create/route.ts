// ============================================================================
// 🔥 BLAZE WALLET - SMART SCHEDULER API - CREATE
// ============================================================================
// Creates a new scheduled transaction with optimal gas timing
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { encryptEphemeralKeySymmetric } from '@/lib/scheduled-tx-crypto';
import { apiRateLimiter } from '@/lib/api-rate-limiter';
import { sanitizeError, sanitizeErrorResponse } from '@/lib/error-handler';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface CreateScheduleRequest {
  user_id: string;
  supabase_user_id?: string;
  chain: string;
  from_address: string;
  to_address: string;
  amount: string;
  token_address?: string;
  token_symbol?: string;
  
  // Scheduling options
  schedule_type: 'optimal' | 'specific_time' | 'gas_threshold';
  scheduled_for?: string; // ISO timestamp
  optimal_gas_threshold?: number; // Execute when gas <= X
  max_wait_hours?: number; // Don't wait longer than X hours
  priority?: 'low' | 'standard' | 'high' | 'instant';
  
  // Current gas price for savings calculation
  current_gas_price?: number;
  current_gas_cost_usd?: number;
  
  memo?: string;
  
  // ✅ NEW: Encrypted mnemonic (works for ALL 18 chains)
  encrypted_mnemonic?: string;
  kms_encrypted_ephemeral_key?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: CreateScheduleRequest = await req.json();

    // ✅ Rate limiting per user_id
    const userIdentifier = body.user_id || 'anonymous';
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    
    // 10 requests per minute per user
    if (!apiRateLimiter.check(userIdentifier, 10, 60000)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    logger.log('📥 Received schedule request:', {
      user_id: body.user_id ? `${body.user_id.substring(0, 8)}...` : 'anonymous',
      supabase_user_id: body.supabase_user_id ? 'present' : 'none',
      chain: body.chain,
      token_symbol: body.token_symbol,
      schedule_type: body.schedule_type,
    });

    // Validation
    if (!body.user_id || !body.chain || !body.from_address || !body.to_address || !body.amount) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate chain
    const validChains = [
      'ethereum', 'polygon', 'base', 'arbitrum', 'optimism', 'avalanche',
      'fantom', 'cronos', 'zksync', 'linea', 'solana', 'bitcoin',
      'litecoin', 'dogecoin', 'bitcoincash'
    ];
    
    if (!validChains.includes(body.chain.toLowerCase())) {
      return NextResponse.json(
        { error: `Unsupported chain: ${body.chain}` },
        { status: 400 }
      );
    }

    // Initialize Supabase with service role key (bypasses RLS for write)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    logger.log('🔑 Supabase client initialized with service role key');

    // Calculate expiration time (default: scheduled_for + max_wait_hours)
    let expires_at = null;
    if (body.scheduled_for && body.max_wait_hours) {
      const scheduledDate = new Date(body.scheduled_for);
      expires_at = new Date(scheduledDate.getTime() + body.max_wait_hours * 60 * 60 * 1000).toISOString();
    } else if (body.max_wait_hours) {
      expires_at = new Date(Date.now() + body.max_wait_hours * 60 * 60 * 1000).toISOString();
    }

    logger.log('💾 Inserting scheduled transaction:', {
      user_id: body.user_id,
      supabase_user_id: body.supabase_user_id,
      chain: body.chain.toLowerCase(),
      token_symbol: body.token_symbol,
      expires_at,
    });

    // Encrypt ephemeral key (if provided). On the client we send the raw
    // ephemeral key bytes as base64; here we encrypt it with a symmetric key
    // so that only the backend can recover it during cron execution.
    let encryptedEphemeralKey: string | null = null;
    if (body.kms_encrypted_ephemeral_key) {
      try {
        encryptedEphemeralKey = encryptEphemeralKeySymmetric(body.kms_encrypted_ephemeral_key);
      } catch (err: any) {
        logger.error('❌ Failed to encrypt ephemeral key for scheduled transaction:', err?.message || err);
        return NextResponse.json(
          { error: 'Failed to secure scheduled transaction keys' },
          { status: 500 }
        );
      }
    }

    // Insert scheduled transaction
    const { data, error } = await supabase
      .from('scheduled_transactions')
      .insert({
        user_id: body.user_id,
        supabase_user_id: body.supabase_user_id || null,
        chain: body.chain.toLowerCase(),
        from_address: body.from_address,
        to_address: body.to_address,
        amount: body.amount,
        token_address: body.token_address || null,
        token_symbol: body.token_symbol || null,
        scheduled_for: body.scheduled_for || null,
        optimal_gas_threshold: body.optimal_gas_threshold || null,
        max_wait_hours: body.max_wait_hours || 24,
        priority: body.priority || 'standard',
        status: 'pending',
        estimated_gas_price: body.current_gas_price || null,
        estimated_gas_cost_usd: body.current_gas_cost_usd || null,
        memo: body.memo || null,
        expires_at: expires_at,
        
        // ✅ NEW: Store encrypted mnemonic (already encrypted by client!)
        encrypted_mnemonic: body.encrypted_mnemonic || null,
        // Symmetrically encrypted ephemeral key (never stored in plaintext)
        kms_encrypted_ephemeral_key: encryptedEphemeralKey,
      })
      .select()
      .single();

    if (error) {
      logger.error('❌ Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to create scheduled transaction', details: error.message },
        { status: 500 }
      );
    }

    logger.log('✅ Scheduled transaction created:', data.id);

    // Create notification
    await supabase.from('notifications').insert({
      user_id: body.user_id,
      supabase_user_id: body.supabase_user_id || null,
      type: 'transaction_scheduled',
      title: 'Transaction Scheduled',
      message: `Your ${body.token_symbol || 'native'} transaction will be executed at optimal gas price`,
      data: {
        scheduled_transaction_id: data.id,
        chain: body.chain,
        amount: body.amount,
        token_symbol: body.token_symbol,
      },
    });

    return NextResponse.json({
      success: true,
      data,
    });

  } catch (error: any) {
    logger.error('❌ Smart Scheduler API error:', error);
    return sanitizeErrorResponse(error);
  }
}

// OPTIONS handler for CORS
export async function OPTIONS(req: NextRequest) {
  return NextResponse.json({}, { status: 200 });
}


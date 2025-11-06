// ============================================================================
// 🔥 BLAZE WALLET - SMART SCHEDULER API - CREATE
// ============================================================================
// Creates a new scheduled transaction with optimal gas timing
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface EncryptedAuth {
  ciphertext: string;
  iv: string;
  encrypted_key: string;
  encrypted_at: string;
  expires_at: string;
  key_version: number;
}

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
  
  // 🔐 NEW: Encrypted authorization for automatic execution
  encrypted_auth?: EncryptedAuth;
  
  memo?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: CreateScheduleRequest = await req.json();

    console.log('📥 Received schedule request:', {
      user_id: body.user_id,
      supabase_user_id: body.supabase_user_id,
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

    console.log('🔑 Supabase client initialized with service role key');

    // Calculate expiration time (default: scheduled_for + max_wait_hours)
    let expires_at = null;
    if (body.scheduled_for && body.max_wait_hours) {
      const scheduledDate = new Date(body.scheduled_for);
      expires_at = new Date(scheduledDate.getTime() + body.max_wait_hours * 60 * 60 * 1000).toISOString();
    } else if (body.max_wait_hours) {
      expires_at = new Date(Date.now() + body.max_wait_hours * 60 * 60 * 1000).toISOString();
    }

    console.log('💾 Inserting scheduled transaction:', {
      user_id: body.user_id,
      supabase_user_id: body.supabase_user_id,
      chain: body.chain.toLowerCase(),
      token_symbol: body.token_symbol,
      expires_at,
      has_encrypted_auth: !!body.encrypted_auth,
    });

    // 🔐 Validate encrypted_auth if provided
    if (body.encrypted_auth) {
      if (!body.encrypted_auth.ciphertext || !body.encrypted_auth.encrypted_key || !body.encrypted_auth.iv) {
        console.error('❌ Invalid encrypted_auth structure');
        return NextResponse.json(
          { error: 'Invalid encrypted authorization data' },
          { status: 400 }
        );
      }
      
      // Verify expiry is in the future
      const authExpiry = new Date(body.encrypted_auth.expires_at);
      if (authExpiry < new Date()) {
        console.error('❌ Encrypted auth already expired');
        return NextResponse.json(
          { error: 'Authorization expired' },
          { status: 400 }
        );
      }
      
      console.log('✅ Encrypted auth validated:', {
        key_version: body.encrypted_auth.key_version,
        expires_at: body.encrypted_auth.expires_at,
      });
    } else {
      console.warn('⚠️  No encrypted auth provided - transaction will NOT auto-execute');
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
        encrypted_auth: body.encrypted_auth || null,  // 🔐 Store encrypted auth
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to create scheduled transaction', details: error.message },
        { status: 500 }
      );
    }

    console.log('✅ Scheduled transaction created:', data.id);

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
    console.error('❌ Smart Scheduler API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// OPTIONS handler for CORS
export async function OPTIONS(req: NextRequest) {
  return NextResponse.json({}, { status: 200 });
}


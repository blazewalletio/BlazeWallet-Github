import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

/**
 * Check if a wallet exists for a user
 * Uses admin client for maximum security
 * 
 * @route POST /api/wallet/exists
 * @body { userId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Missing userId' },
        { status: 400 }
      );
    }
    
    logger.log('🔍 [WalletExists] Checking wallet for user:', userId);
    
    // Check if wallet exists with admin client (bypasses RLS)
    const { data, error } = await supabaseAdmin
      .from('wallets')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (error) {
      logger.error('❌ [WalletExists] Database error:', {
        code: error.code,
        message: error.message,
      });
      
      return NextResponse.json(
        { 
          success: false, 
          error: `Failed to check wallet: ${error.message}`,
        },
        { status: 500 }
      );
    }
    
    const exists = !!data;
    
    logger.log(`${exists ? '✅' : '❌'} [WalletExists] Wallet ${exists ? 'exists' : 'does not exist'}`);
    
    return NextResponse.json({
      success: true,
      exists,
    });
    
  } catch (error: any) {
    logger.error('❌ [WalletExists] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to check wallet' },
      { status: 500 }
    );
  }
}


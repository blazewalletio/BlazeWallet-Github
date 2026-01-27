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
 * Server-side endpoint to fetch user's wallet
 * Uses admin client to bypass RLS issues
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID required' },
        { status: 400 }
      );
    }
    
    logger.log('✅ [GetWallet] Fetching wallet for user:', userId);
    
    // Fetch wallet with detailed error logging (using admin client)
    const { data: wallet, error: walletError } = await supabaseAdmin
      .from('wallets')
      .select('encrypted_mnemonic')
      .eq('user_id', userId)
      .single();
    
    if (walletError) {
      logger.error('❌ [GetWallet] Database error:', {
        code: walletError.code,
        message: walletError.message,
        details: walletError.details,
        hint: walletError.hint,
      });
      
      return NextResponse.json(
        { 
          success: false, 
          error: `Database error: ${walletError.message}`,
          details: {
            code: walletError.code,
            hint: walletError.hint,
          }
        },
        { status: 500 }
      );
    }
    
    if (!wallet) {
      logger.error('❌ [GetWallet] Wallet not found for user:', userId);
      return NextResponse.json(
        { success: false, error: 'Wallet not found' },
        { status: 404 }
      );
    }
    
    logger.log('✅ [GetWallet] Wallet found successfully');
    
    return NextResponse.json({
      success: true,
      encrypted_mnemonic: wallet.encrypted_mnemonic,
    });
    
  } catch (error: any) {
    logger.error('❌ [GetWallet] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch wallet' },
      { status: 500 }
    );
  }
}


import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

/**
 * Server-side endpoint to fetch user's wallet
 * This bypasses potential RLS issues on the client
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
    
    const supabase = createRouteHandlerClient({ cookies });
    
    // Verify the session matches the requested user
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session || session.user.id !== userId) {
      logger.error('❌ [GetWallet] Session mismatch or not authenticated');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    logger.log('✅ [GetWallet] Fetching wallet for user:', userId);
    
    // Fetch wallet with detailed error logging
    const { data: wallet, error: walletError } = await supabase
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


import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Create a new wallet for a user
 * Uses admin client for maximum security
 * 
 * @route POST /api/wallet/create
 * @body { userId: string, encryptedMnemonic: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, encryptedMnemonic } = await request.json();
    
    if (!userId || !encryptedMnemonic) {
      return NextResponse.json(
        { success: false, error: 'Missing userId or encryptedMnemonic' },
        { status: 400 }
      );
    }
    
    logger.log('✅ [CreateWallet] Creating wallet for user:', userId);
    
    // Insert wallet with admin client (bypasses RLS)
    const { data, error } = await getSupabaseAdmin()
      .from('wallets')
      .insert({
        user_id: userId,
        encrypted_wallet: encryptedMnemonic,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (error) {
      logger.error('❌ [CreateWallet] Database error:', {
        code: error.code,
        message: error.message,
        details: error.details,
      });
      
      return NextResponse.json(
        { 
          success: false, 
          error: `Failed to create wallet: ${error.message}`,
        },
        { status: 500 }
      );
    }
    
    logger.log('✅ [CreateWallet] Wallet created successfully');
    
    return NextResponse.json({
      success: true,
      walletId: data.id,
    });
    
  } catch (error: any) {
    logger.error('❌ [CreateWallet] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create wallet' },
      { status: 500 }
    );
  }
}


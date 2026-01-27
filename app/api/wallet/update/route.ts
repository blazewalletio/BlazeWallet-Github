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
 * Update/backup a user's wallet
 * Uses upsert to create if not exists, update if exists
 * Uses admin client for maximum security
 * 
 * @route POST /api/wallet/update
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
    
    logger.log('✅ [UpdateWallet] Updating wallet for user:', userId);
    
    // Upsert wallet with admin client (bypasses RLS)
    const { data, error } = await supabaseAdmin
      .from('wallets')
      .upsert({
        user_id: userId,
        encrypted_mnemonic: encryptedMnemonic,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single();
    
    if (error) {
      logger.error('❌ [UpdateWallet] Database error:', {
        code: error.code,
        message: error.message,
        details: error.details,
      });
      
      return NextResponse.json(
        { 
          success: false, 
          error: `Failed to update wallet: ${error.message}`,
        },
        { status: 500 }
      );
    }
    
    logger.log('✅ [UpdateWallet] Wallet updated successfully');
    
    return NextResponse.json({
      success: true,
      walletId: data.id,
    });
    
  } catch (error: any) {
    logger.error('❌ [UpdateWallet] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update wallet' },
      { status: 500 }
    );
  }
}


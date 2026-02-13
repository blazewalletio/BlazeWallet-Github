import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

async function requireAuthenticatedUser(request: NextRequest): Promise<{ userId: string } | NextResponse> {
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!bearerToken) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await getSupabaseAdmin().auth.getUser(bearerToken);
  if (error || !data?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  return { userId: data.user.id };
}

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
    const authResult = await requireAuthenticatedUser(request);
    if (authResult instanceof NextResponse) return authResult;

    const { userId: requestedUserId, encryptedMnemonic } = await request.json();
    const userId = authResult.userId;

    if (requestedUserId && requestedUserId !== userId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: user mismatch' },
        { status: 403 }
      );
    }

    if (!encryptedMnemonic) {
      return NextResponse.json(
        { success: false, error: 'Missing encryptedMnemonic' },
        { status: 400 }
      );
    }
    
    logger.log('✅ [UpdateWallet] Updating wallet for user:', userId);
    
    // Upsert wallet with admin client (bypasses RLS)
    const { data, error } = await getSupabaseAdmin()
      .from('wallets')
      .upsert({
        user_id: userId,
        encrypted_wallet: encryptedMnemonic,
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


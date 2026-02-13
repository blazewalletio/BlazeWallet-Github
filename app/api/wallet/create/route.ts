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
 * Create a new wallet for a user
 * Uses admin client for maximum security
 * 
 * @route POST /api/wallet/create
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


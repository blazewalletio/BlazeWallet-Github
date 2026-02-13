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
 * Check if a wallet exists for a user
 * Uses admin client for maximum security
 * 
 * @route POST /api/wallet/exists
 * @body { userId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthenticatedUser(request);
    if (authResult instanceof NextResponse) return authResult;

    const { userId: requestedUserId } = await request.json();
    const userId = authResult.userId;
    if (requestedUserId && requestedUserId !== userId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: user mismatch' },
        { status: 403 }
      );
    }

    logger.log('🔍 [WalletExists] Checking wallet for user:', userId);
    
    // Check if wallet exists with admin client (bypasses RLS)
    const { data, error } = await getSupabaseAdmin()
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


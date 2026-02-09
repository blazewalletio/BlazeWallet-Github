import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Missing verification token' },
        { status: 400 }
      );
    }

    logger.log('🔐 Verifying email with token:', token.substring(0, 8) + '...');

    // Lookup token in database
    const { data: tokenData, error: tokenError } = await getSupabaseAdmin()
      .from('email_verification_tokens')
      .select('*')
      .eq('token', token)
      .is('used_at', null) // Token not already used
      .single();

    if (tokenError || !tokenData) {
      logger.error('❌ Invalid or expired token:', tokenError);
      return NextResponse.json(
        { success: false, error: 'Invalid or expired verification link' },
        { status: 400 }
      );
    }

    // Check if token expired
    if (new Date(tokenData.expires_at) < new Date()) {
      logger.error('❌ Token expired');
      return NextResponse.json(
        { success: false, error: 'Verification link expired. Please request a new one.' },
        { status: 400 }
      );
    }

    // Get user from Supabase using admin client
    const { data: { user }, error: userError } = await getSupabaseAdmin().auth.admin.getUserById(tokenData.user_id);

    if (userError || !user) {
      logger.error('❌ User not found:', userError);
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 400 }
      );
    }

    // Check if email matches (extra security)
    if (user.email?.toLowerCase() !== tokenData.email.toLowerCase()) {
      logger.error('❌ Email mismatch');
      return NextResponse.json(
        { success: false, error: 'Invalid verification link' },
        { status: 400 }
      );
    }

    // Check if already verified in our CUSTOM tracking table
    const { data: verificationStatus } = await getSupabaseAdmin()
      .from('user_email_verification_status')
      .select('is_verified')
      .eq('user_id', tokenData.user_id)
      .single();

    if (verificationStatus?.is_verified) {
      // Already verified, just mark token as used
      await getSupabaseAdmin()
        .from('email_verification_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('token', token);

      logger.log('✅ Email already verified');
      return NextResponse.json({
        success: true,
        message: 'Email already verified',
      });
    }

    // ✅ Mark user as VERIFIED in our custom tracking table
    const { error: verifyError } = await getSupabaseAdmin().rpc('mark_email_verified', {
      p_user_id: tokenData.user_id
    });

    if (verifyError) {
      logger.error('❌ Failed to mark email as verified:', verifyError);
      return NextResponse.json(
        { success: false, error: 'Failed to verify email' },
        { status: 500 }
      );
    }

    // Also update security score
    await getSupabaseAdmin()
      .from('user_security_scores')
      .update({ email_verified: true, updated_at: new Date().toISOString() })
      .eq('user_id', tokenData.user_id);

    // Mark token as used
    await getSupabaseAdmin()
      .from('email_verification_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('token', token);

    logger.log('✅ Email verified successfully:', tokenData.email);

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully',
    });

  } catch (error: any) {
    logger.error('❌ Email verification error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Verification failed' },
      { status: 500 }
    );
  }
}


import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

// Create admin client with service role key for admin operations
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
    const { data: tokenData, error: tokenError } = await supabaseAdmin
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
    const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(tokenData.user_id);

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

    // Check if already verified
    if (user.email_confirmed_at) {
      // Mark token as used anyway
      await supabaseAdmin
        .from('email_verification_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('token', token);

      logger.log('✅ Email already verified');
      return NextResponse.json({
        success: true,
        message: 'Email already verified',
      });
    }

    // Update user to mark as verified
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      tokenData.user_id,
      { email_confirm: true }
    );

    if (updateError) {
      logger.error('❌ Failed to verify email:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to verify email' },
        { status: 500 }
      );
    }

    // Mark token as used
    await supabaseAdmin
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


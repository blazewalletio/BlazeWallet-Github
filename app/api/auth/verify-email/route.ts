import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const { token, email } = await request.json();

    if (!token || !email) {
      return NextResponse.json(
        { success: false, error: 'Missing token or email' },
        { status: 400 }
      );
    }

    logger.log('🔐 Verifying email:', email, 'with token:', token.substring(0, 8) + '...');

    // Get user from Supabase
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(token);

    if (userError || !user) {
      logger.error('❌ User not found:', userError);
      return NextResponse.json(
        { success: false, error: 'Invalid verification link' },
        { status: 400 }
      );
    }

    // Check if email matches
    if (user.email?.toLowerCase() !== email.toLowerCase()) {
      logger.error('❌ Email mismatch');
      return NextResponse.json(
        { success: false, error: 'Invalid verification link' },
        { status: 400 }
      );
    }

    // Check if already verified
    if (user.email_confirmed_at) {
      logger.log('✅ Email already verified');
      return NextResponse.json({
        success: true,
        message: 'Email already verified',
      });
    }

    // Update user to mark as verified
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      token,
      { email_confirm: true }
    );

    if (updateError) {
      logger.error('❌ Failed to verify email:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to verify email' },
        { status: 500 }
      );
    }

    logger.log('✅ Email verified successfully:', email);

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


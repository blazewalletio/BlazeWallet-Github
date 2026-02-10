import { NextRequest, NextResponse } from 'next/server';
import { sendEmail, generateWelcomeVerificationEmail } from '@/lib/email-service';
import { logger } from '@/lib/logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const { email, userId } = await request.json();

    if (!email || !userId) {
      return NextResponse.json(
        { success: false, error: 'Missing email or userId' },
        { status: 400 }
      );
    }

    logger.log('📧 Resending verification email to:', email);

    // ✅ FIX: Generate secure random token (same as send-welcome-email)
    const token = crypto.randomBytes(32).toString('hex');
    
    // Store token in database with 24 hour expiry
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    
    const { error: dbError } = await getSupabaseAdmin()
      .from('email_verification_tokens')
      .insert({
        user_id: userId,
        token: token,
        email: email,
        expires_at: expiresAt.toISOString(),
      });

    if (dbError) {
      logger.error('Failed to store verification token:', dbError);
      return NextResponse.json(
        { success: false, error: 'Failed to create verification token' },
        { status: 500 }
      );
    }

    // Generate verification link with secure token
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://my.blazewallet.io';
    const verificationLink = `${baseUrl}/auth/verify?token=${token}`;

    // Generate email HTML
    const emailHtml = generateWelcomeVerificationEmail({
      email,
      verificationLink,
    });

    // Send email
    try {
      await sendEmail({
        to: email,
        subject: '🔥 BLAZE Wallet - Verify Your Email',
        html: emailHtml,
      });
    } catch (error: any) {
      logger.error('Failed to send verification email:', error);
      return NextResponse.json(
        { success: false, error: error.message || 'Failed to send email' },
        { status: 500 }
      );
    }

    logger.log('✅ Verification email resent to:', email);

    return NextResponse.json({
      success: true,
      message: 'Verification email sent',
    });

  } catch (error: any) {
    logger.error('❌ Resend email error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to resend email' },
      { status: 500 }
    );
  }
}


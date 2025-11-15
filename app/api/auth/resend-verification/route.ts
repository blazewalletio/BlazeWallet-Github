import { NextRequest, NextResponse } from 'next/server';
import { sendEmail, generateWelcomeVerificationEmail } from '@/lib/email-service';
import { logger } from '@/lib/logger';

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

    // Generate verification link
    const verificationLink = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://my.blazewallet.io'}/auth/verify?token=${userId}&email=${encodeURIComponent(email)}`;

    // Generate email HTML
    const emailHtml = generateWelcomeVerificationEmail({
      email,
      verificationLink,
    });

    // Send email
    const result = await sendEmail({
      to: email,
      subject: '🔥 Welcome to BLAZE Wallet - Verify & Start Trading!',
      html: emailHtml,
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to send email');
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


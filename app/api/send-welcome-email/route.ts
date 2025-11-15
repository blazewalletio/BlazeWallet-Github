import { NextRequest, NextResponse } from 'next/server';
import { sendEmail, generateWelcomeVerificationEmail } from '@/lib/email-service';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const { email, verificationLink } = await request.json();

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    // Generate email HTML
    const emailHtml = generateWelcomeVerificationEmail({
      email,
      verificationLink,
    });

    // Send email
    const result = await sendEmail({
      to: email,
      subject: '🔥 Welcome to BLAZE Wallet - Verify Your Email',
      html: emailHtml,
    });

    if (!result.success) {
      logger.error('Failed to send welcome email:', result.error);
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    logger.log('✅ Welcome email sent to:', email);
    return NextResponse.json({ success: true, messageId: result.messageId });
  } catch (error) {
    logger.error('Error in send-welcome-email API:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send email' },
      { status: 500 }
    );
  }
}


import { NextRequest, NextResponse } from 'next/server';
import { sendEmail, generateWelcomeVerificationEmail } from '@/lib/email-service';
import { logger } from '@/lib/logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import crypto from 'crypto';

async function trackWalletSignupOnWebsite(data: {
  email: string;
  visitorId?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  twclid?: string;
}) {
  const secret = process.env.WALLET_SIGNUP_TRACKING_SECRET;
  const websiteBaseUrl = process.env.WEBSITE_ANALYTICS_BASE_URL || 'https://www.blazewallet.io';

  if (!secret) {
    logger.warn('Skipping wallet-signup tracking: WALLET_SIGNUP_TRACKING_SECRET is not configured');
    return;
  }

  const endpoint = `${websiteBaseUrl.replace(/\/$/, '')}/api/analytics/wallet-signup`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      secret,
      email: data.email,
      visitorId: data.visitorId,
      utmSource: data.utmSource,
      utmMedium: data.utmMedium,
      utmCampaign: data.utmCampaign,
      twclid: data.twclid,
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Website wallet-signup tracking failed (${response.status}): ${text}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { email, userId, visitorId, utmSource, utmMedium, utmCampaign, twclid } = await request.json();

    if (!email || !userId) {
      return NextResponse.json(
        { success: false, error: 'Email and userId are required' },
        { status: 400 }
      );
    }

    // Track new user as unverified; verification badge is enabled after email confirmation.
    try {
      const { error: sqlError } = await getSupabaseAdmin().rpc('track_new_user_email', {
        p_user_id: userId,
        p_email: email
      });

      if (sqlError) {
        logger.error('Failed to track user email via RPC:', sqlError);
      }

      logger.log('User tracked as unverified - login allowed until badge verification');
    } catch (err) {
      logger.error('Error tracking user email:', err);
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const { error: dbError } = await getSupabaseAdmin()
      .from('email_verification_tokens')
      .insert({
        user_id: userId,
        token,
        email,
        expires_at: expiresAt.toISOString(),
      });

    if (dbError) {
      logger.error('Failed to store verification token:', dbError);
      return NextResponse.json(
        { success: false, error: 'Failed to create verification token' },
        { status: 500 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://my.blazewallet.io';
    const verificationLink = `${baseUrl}/auth/verify?token=${token}`;

    const emailHtml = generateWelcomeVerificationEmail({
      email,
      verificationLink,
    });

    let messageId: string | undefined;
    try {
      const sendResult = await sendEmail({
        to: email,
        subject: '🔥 Welcome to BLAZE Wallet - Verify Your Email',
        html: emailHtml,
      });
      messageId = sendResult?.messageId;
    } catch (error: any) {
      logger.error('Failed to send welcome email:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    logger.log('Welcome email sent to:', email);

    try {
      await trackWalletSignupOnWebsite({
        email,
        visitorId,
        utmSource,
        utmMedium,
        utmCampaign,
        twclid,
      });
      logger.log('Website wallet signup tracking sent');
    } catch (trackingError) {
      logger.error('Failed to track wallet signup on website:', trackingError);
    }

    return NextResponse.json({ success: true, messageId });
  } catch (error) {
    logger.error('Error in send-welcome-email API:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send email' },
      { status: 500 }
    );
  }
}

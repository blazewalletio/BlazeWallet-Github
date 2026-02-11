import { NextRequest, NextResponse } from 'next/server';
import { sendEmail, generateWelcomeVerificationEmail } from '@/lib/email-service';
import { logger } from '@/lib/logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { apiRateLimiter } from '@/lib/api-rate-limiter';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    // Auth via bearer token from current logged-in session.
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await getSupabaseAdmin().auth.getUser(token);
    if (authError || !user || !user.email) {
      return NextResponse.json(
        { success: false, error: 'Invalid session' },
        { status: 401 }
      );
    }

    const userId = user.id;
    const email = user.email;

    // Rate limiting (fail-open utility):
    // - per user: max 5 requests / 15 min
    // - per IP: max 15 requests / 15 min
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    if (!apiRateLimiter.check(`resend-email:user:${userId}`, 5, 15 * 60 * 1000)) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.', retryAfterSeconds: 900 },
        { status: 429 }
      );
    }

    if (!apiRateLimiter.check(`resend-email:ip:${ipAddress}`, 15, 15 * 60 * 1000)) {
      return NextResponse.json(
        { success: false, error: 'Too many requests from this network. Please try again later.', retryAfterSeconds: 900 },
        { status: 429 }
      );
    }

    // If already verified, skip sending and return gracefully.
    const { data: verificationStatus } = await getSupabaseAdmin()
      .from('user_email_verification_status')
      .select('is_verified')
      .eq('user_id', userId)
      .single();

    if (verificationStatus?.is_verified) {
      return NextResponse.json({
        success: true,
        message: 'Email is already verified.',
      });
    }

    // Cooldown guard: max one resend per 60s per user.
    const { data: latestToken } = await getSupabaseAdmin()
      .from('email_verification_tokens')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestToken?.created_at) {
      const elapsedMs = Date.now() - new Date(latestToken.created_at).getTime();
      const cooldownMs = 60 * 1000;
      if (elapsedMs < cooldownMs) {
        const retryAfterSeconds = Math.ceil((cooldownMs - elapsedMs) / 1000);
        return NextResponse.json(
          {
            success: false,
            error: `Please wait ${retryAfterSeconds}s before requesting another verification email.`,
            retryAfterSeconds,
          },
          { status: 429 }
        );
      }
    }

    logger.log('📧 Resending verification email to:', email);

    // ✅ FIX: Generate secure random token (same as send-welcome-email)
    const verificationToken = crypto.randomBytes(32).toString('hex');
    
    // Store token in database with 24 hour expiry
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    
    const { error: dbError } = await getSupabaseAdmin()
      .from('email_verification_tokens')
      .insert({
        user_id: userId,
        token: verificationToken,
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
    const verificationLink = `${baseUrl}/auth/verify?token=${verificationToken}`;

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
      cooldownSeconds: 60,
    });

  } catch (error: any) {
    logger.error('❌ Resend email error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to resend email' },
      { status: 500 }
    );
  }
}


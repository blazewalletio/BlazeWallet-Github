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
        { success: false, error: 'Email and userId are required' },
        { status: 400 }
      );
    }

    // ✅ Track new user as UNVERIFIED (but they can still login)
    // This allows us to show "Verified" badge only after email verification
    try {
      const { error: sqlError } = await getSupabaseAdmin().rpc('track_new_user_email', {
        p_user_id: userId,
        p_email: email
      });
      
      if (sqlError) {
        logger.error('Failed to track user email via RPC:', sqlError);
        // Continue anyway - not critical
      }
      
      logger.log('✅ User tracked as unverified - can login but needs verification for badge');
    } catch (err) {
      logger.error('Error tracking user email:', err);
      // Continue anyway - user can still login
    }

    // Generate secure random token (32 bytes = 64 hex characters)
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
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://my.blazewallet.io';
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
        subject: '🔥 Welcome to BLAZE Wallet - Verify Your Email',
        html: emailHtml,
      });
    } catch (error: any) {
      logger.error('Failed to send welcome email:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    logger.log('✅ Welcome email sent to:', email);
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error in send-welcome-email API:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send email' },
      { status: 500 }
    );
  }
}


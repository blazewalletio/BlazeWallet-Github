import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail, generateWelcomeVerificationEmail } from '@/lib/email-service';
import { logger } from '@/lib/logger';
import crypto from 'crypto';

// Create admin client for database operations
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
    const { email, userId } = await request.json();

    if (!email || !userId) {
      return NextResponse.json(
        { success: false, error: 'Email and userId are required' },
        { status: 400 }
      );
    }

    // Mark user as unverified first (in case Supabase auto-verified them)
    const { error: unverifyError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { 
        email_confirm: false,
        // Set email_confirmed_at to null explicitly
        email_confirmed_at: null as any
      }
    );

    if (unverifyError) {
      logger.error('Failed to mark user as unverified:', unverifyError);
      // Continue anyway - not critical
    }

    // Generate secure random token (32 bytes = 64 hex characters)
    const token = crypto.randomBytes(32).toString('hex');
    
    // Store token in database with 24 hour expiry
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    
    const { error: dbError } = await supabaseAdmin
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


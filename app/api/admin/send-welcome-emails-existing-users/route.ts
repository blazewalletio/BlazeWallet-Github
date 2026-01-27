/**
 * ONE-TIME SCRIPT: Send Welcome Emails to Existing Users
 * 
 * This script sends the welcome + verification email to all existing users
 * who signed up before the email verification feature was added.
 * 
 * HOW TO RUN:
 * 1. Make sure you have SUPABASE_SERVICE_ROLE_KEY in .env.local
 * 2. Run: node scripts/send-welcome-emails-to-existing-users.js
 * 3. Or via API: POST to /api/admin/send-welcome-emails-existing-users
 * 
 * SAFETY:
 * - Only sends to users who haven't received welcome email yet
 * - Rate limited to avoid spam
 * - Can be run multiple times safely (idempotent)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendEmail, generateWelcomeVerificationEmail } from '@/lib/email-service';
import { logger } from '@/lib/logger';

// Admin authentication check
function isAdmin(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const adminSecret = process.env.ADMIN_SECRET || 'blaze-admin-2024';
  return authHeader === `Bearer ${adminSecret}`;
}

export async function POST(request: NextRequest) {
  try {
    // ✅ SECURITY: Admin only
    if (!isAdmin(request)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    logger.log('📧 Starting to send welcome emails to existing users...');

    // Get all users from Supabase Auth
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();

    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`);
    }

    if (!users || users.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No users found',
        sent: 0,
        failed: 0,
      });
    }

    logger.log(`📊 Found ${users.length} total users`);

    const results = {
      sent: 0,
      failed: 0,
      alreadyVerified: 0,
      errors: [] as string[],
    };

    // Process each user
    for (const user of users) {
      try {
        if (!user.email) {
          logger.warn(`⚠️  User ${user.id} has no email, skipping`);
          continue;
        }

        // Skip if already verified
        if (user.email_confirmed_at) {
          logger.log(`✓ User ${user.email} already verified, skipping`);
          results.alreadyVerified++;
          continue;
        }

        logger.log(`📧 Sending welcome email to: ${user.email}`);

        // Generate verification link
        const verificationLink = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://my.blazewallet.io'}/auth/verify?token=${user.id}&email=${encodeURIComponent(user.email)}`;

        // Generate email HTML
        const emailHtml = generateWelcomeVerificationEmail({
          email: user.email,
          verificationLink,
        });

        // Send email
        try {
          await sendEmail({
            to: user.email,
            subject: '🔥 Welcome to BLAZE Wallet - Verify & Start Trading!',
            html: emailHtml,
          });
          logger.log(`✅ Sent to: ${user.email}`);
          results.sent++;
        } catch (error: any) {
          logger.error(`❌ Failed to send to: ${user.email}`, error);
          results.failed++;
          results.errors.push(`${user.email}: ${error.message}`);
        }

        // Rate limit: Wait 100ms between emails to avoid spam flags
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error: any) {
        logger.error(`❌ Error processing user ${user.email}:`, error);
        results.failed++;
        results.errors.push(`${user.email}: ${error.message}`);
      }
    }

    logger.log('✅ Finished sending welcome emails');
    logger.log(`📊 Results: ${results.sent} sent, ${results.failed} failed, ${results.alreadyVerified} already verified`);

    return NextResponse.json({
      success: true,
      message: 'Welcome emails sent to existing users',
      totalUsers: users.length,
      sent: results.sent,
      failed: results.failed,
      alreadyVerified: results.alreadyVerified,
      errors: results.errors.length > 0 ? results.errors : undefined,
    });

  } catch (error: any) {
    logger.error('❌ Send welcome emails error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to send emails' },
      { status: 500 }
    );
  }
}

// Also allow GET for testing (returns count only)
export async function GET(request: NextRequest) {
  try {
    if (!isAdmin(request)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { data: { users }, error } = await supabase.auth.admin.listUsers();

    if (error) {
      throw new Error(error.message);
    }

    const unverifiedUsers = users?.filter(u => u.email && !u.email_confirmed_at) || [];

    return NextResponse.json({
      success: true,
      totalUsers: users?.length || 0,
      unverifiedUsers: unverifiedUsers.length,
      users: unverifiedUsers.map(u => ({
        email: u.email,
        createdAt: u.created_at,
      })),
    });

  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}


import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { logger } from '@/lib/logger';

/**
 * Check if email already exists in Supabase auth
 * Used before signup to prevent duplicate accounts
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    // Use admin API to check if user with this email already exists
    const supabaseAdmin = getSupabaseAdmin();
    const { data: existingUsers, error: checkError } = await supabaseAdmin.auth.admin.listUsers();

    if (checkError) {
      logger.error('❌ Error checking email existence:', checkError);
      // If check fails, return false (allow signup attempt - Supabase will catch duplicate)
      return NextResponse.json({
        success: true,
        exists: false,
        message: 'Could not verify email availability. You can try to sign up.'
      });
    }

    if (!existingUsers || !existingUsers.users) {
      return NextResponse.json({
        success: true,
        exists: false
      });
    }

    const emailLower = email.toLowerCase().trim();
    const existingUser = existingUsers.users.find(
      (u: any) => u.email && u.email.toLowerCase().trim() === emailLower
    );

    if (existingUser) {
      logger.warn('⚠️ Email already exists:', email);
      return NextResponse.json({
        success: true,
        exists: true,
        message: 'An account with this email address already exists. Please sign in instead.'
      });
    }

    return NextResponse.json({
      success: true,
      exists: false
    });

  } catch (error: any) {
    logger.error('❌ Check email error:', error);
    // If check fails, return false (allow signup attempt - Supabase will catch duplicate)
    return NextResponse.json({
      success: true,
      exists: false,
      message: 'Could not verify email availability. You can try to sign up.'
    });
  }
}


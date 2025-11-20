import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

// Create admin client with service role key
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

/**
 * Immediately confirm a user after signup to prevent Supabase email sending
 * This endpoint should be called RIGHT AFTER supabase.auth.signUp()
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      );
    }

    // Immediately confirm the user to prevent Supabase from trying to send emails
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      email_confirm: true,
    });

    if (error) {
      logger.error('Failed to confirm user:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    logger.log('✅ User confirmed immediately:', userId);

    return NextResponse.json({
      success: true,
      user: data.user,
    });

  } catch (error: any) {
    logger.error('Error in confirm-user API:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to confirm user' },
      { status: 500 }
    );
  }
}


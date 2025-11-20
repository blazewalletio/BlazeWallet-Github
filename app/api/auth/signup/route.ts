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
 * Custom signup endpoint that creates user with proper identity
 * Fixes: "provider_id" null constraint violation
 */
export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      );
    }

    logger.log('🚀 Creating user via admin.createUser (WITH email_confirm: true):', email);

    // F*CK THE SQL WORKAROUND - just use admin.createUser with email_confirm: true
    // This bypasses Supabase's email sending but still creates a valid user
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // ✅ This confirms the user WITHOUT sending an email
      user_metadata: {
        email_verified_custom: false, // We track our own verification separately
      }
    });

    if (error) {
      logger.error('❌ admin.createUser error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    if (!data.user) {
      logger.error('❌ No user returned from admin.createUser');
      return NextResponse.json(
        { success: false, error: 'Failed to create user' },
        { status: 500 }
      );
    }

    logger.log('✅ User created successfully:', email);
    logger.log('✅ User ID:', data.user.id);
    logger.log('✅ Email confirmed:', data.user.email_confirmed_at ? 'YES' : 'NO');

    return NextResponse.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
      }
    });

  } catch (error: any) {
    logger.error('❌ Error in signup API:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create account' },
      { status: 500 }
    );
  }
}


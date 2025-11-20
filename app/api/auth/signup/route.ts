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

    logger.log('🚀 Creating user via SQL (bypassing broken admin.createUser):', email);

    // Create user directly via SQL to include provider_id
    const { data: userData, error: userError } = await supabaseAdmin.rpc('create_user_with_identity', {
      user_email: email,
      user_password: password,
    });

    if (userError) {
      logger.error('Signup error:', userError);
      
      // Fallback: Try the old way
      logger.log('Trying fallback method...');
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          email_verified_custom: false,
        }
      });

      if (error) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        );
      }

      if (!data.user) {
        return NextResponse.json(
          { success: false, error: 'Failed to create user' },
          { status: 500 }
        );
      }

      logger.log('✅ User created via fallback:', email);

      return NextResponse.json({
        success: true,
        user: {
          id: data.user.id,
          email: data.user.email,
        }
      });
    }

    logger.log('✅ User created successfully via SQL:', email);

    // Return user data
    return NextResponse.json({
      success: true,
      user: {
        id: userData[0].user_id,
        email: email,
      }
    });

  } catch (error: any) {
    logger.error('Error in signup API:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create account' },
      { status: 500 }
    );
  }
}


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
 * 
 * 🔥 EXTREME LOGGING ENABLED FOR DEBUGGING
 */
export async function POST(request: NextRequest) {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔥 [SIGNUP API] REQUEST RECEIVED');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📅 Timestamp:', new Date().toISOString());
  console.log('🌐 URL:', request.url);
  console.log('🔧 Method:', request.method);
  
  try {
    console.log('');
    console.log('📦 [STEP 1] Parsing request body...');
    const body = await request.json();
    console.log('✅ [STEP 1] Body parsed successfully');
    console.log('📧 Email from request:', body.email);
    console.log('🔑 Password length:', body.password?.length || 0);
    
    const { email, password } = body;

    if (!email || !password) {
      console.log('❌ [STEP 1] VALIDATION FAILED: Missing email or password');
      console.log('   Email present:', !!email);
      console.log('   Password present:', !!password);
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      );
    }
    
    console.log('✅ [STEP 1] Validation passed');

    console.log('');
    console.log('🔐 [STEP 2] Checking Supabase configuration...');
    console.log('   SUPABASE_URL present:', !!process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log('   SUPABASE_URL value:', process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) + '...');
    console.log('   SERVICE_ROLE_KEY present:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
    console.log('   SERVICE_ROLE_KEY length:', process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0);
    
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.log('❌ [STEP 2] FATAL: Missing Supabase credentials!');
      return NextResponse.json(
        { success: false, error: 'Server configuration error' },
        { status: 500 }
      );
    }
    
    console.log('✅ [STEP 2] Supabase credentials present');

    console.log('');
    console.log('👤 [STEP 3] Using custom create_user_with_identity function...');
    console.log('   Email:', email);
    console.log('   This bypasses admin.createUser to fix provider_id constraint');
    
    console.log('📤 [STEP 3] Calling database function...');
    const startTime = Date.now();
    
    // Use custom function that properly sets provider_id in auth.identities
    const { data, error } = await supabaseAdmin.rpc('create_user_with_identity', {
      user_email: email,
      user_password: password
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log('📥 [STEP 3] Response received from Supabase');
    console.log('⏱️  Duration:', duration, 'ms');

    if (error) {
      console.log('');
      console.log('❌❌❌ [STEP 3] SUPABASE ERROR DETECTED ❌❌❌');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('Error object:', JSON.stringify(error, null, 2));
      console.log('Error message:', error.message);
      console.log('Error code:', error.code);
      console.log('Error hint:', error.hint);
      console.log('Error details:', error.details);
      console.log('Full error:', error);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      return NextResponse.json(
        { 
          success: false, 
          error: error.message,
          details: {
            code: error.code,
            hint: error.hint,
            details: error.details
          }
        },
        { status: 500 }
      );
    }

    console.log('');
    console.log('🎉 [STEP 4] Checking response data...');
    console.log('   Data present:', !!data);
    console.log('   Data:', JSON.stringify(data, null, 2));
    
    if (!data || data.length === 0) {
      console.log('❌ [STEP 4] NO USER DATA IN RESPONSE!');
      return NextResponse.json(
        { success: false, error: 'No user returned from database function' },
        { status: 500 }
      );
    }

    const userData = Array.isArray(data) ? data[0] : data;

    console.log('');
    console.log('✅✅✅ [STEP 5] USER CREATED SUCCESSFULLY! ✅✅✅');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👤 User ID:', userData.user_id);
    console.log('📧 Email:', userData.user_email_out);
    console.log('✅ Created with proper identity (provider_id set correctly)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    console.log('');
    console.log('📤 [STEP 6] Returning success response...');
    const response = {
      success: true,
      user: {
        id: userData.user_id,
        email: userData.user_email_out,
      }
    };
    console.log('Response:', JSON.stringify(response, null, 2));
    
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ [SIGNUP API] COMPLETED SUCCESSFULLY');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');

    return NextResponse.json(response);

  } catch (error: any) {
    console.log('');
    console.log('💥💥💥 [FATAL ERROR] UNHANDLED EXCEPTION 💥💥💥');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Error type:', typeof error);
    console.log('Error constructor:', error?.constructor?.name);
    console.log('Error message:', error?.message);
    console.log('Error stack:', error?.stack);
    console.log('Full error object:', error);
    console.log('Error stringified:', JSON.stringify(error, null, 2));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create account',
        details: error?.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}


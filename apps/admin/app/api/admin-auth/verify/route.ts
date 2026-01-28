import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/**
 * POST /api/admin-auth/verify
 * Verify if session is still valid
 */
export async function POST(request: NextRequest) {
  try {
    const { sessionToken } = await request.json();

    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Session token required' },
        { status: 400 }
      );
    }

    // Check if session is valid
    const { data: session, error } = await supabaseAdmin
      .from('admin_sessions')
      .select('*, admin_users(*)')
      .eq('session_token', sessionToken)
      .eq('is_valid', true)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !session) {
      return NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 }
      );
    }

    // Update last activity
    await supabaseAdmin
      .from('admin_sessions')
      .update({ last_activity_at: new Date().toISOString() })
      .eq('id', session.id);

    const adminUser = (session as any).admin_users;

    return NextResponse.json({
      valid: true,
      user: {
        id: adminUser.id,
        email: adminUser.email,
        role: adminUser.role,
      },
    });
  } catch (error: any) {
    console.error('[Admin Auth Verify] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


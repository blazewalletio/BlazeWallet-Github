import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

// Simple admin check
function isAdmin(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const adminSecret = process.env.ADMIN_SECRET || 'blaze-admin-2024';
  return authHeader === `Bearer ${adminSecret}`;
}

export async function GET(request: NextRequest) {
  try {
    // ✅ SECURITY: Admin only
    if (!isAdmin(request)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    logger.log('📧 Fetching all registered email addresses...');

    // Create admin client with service role key
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    if (!supabaseServiceKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get all auth users
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();

    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`);
    }

    if (!users || users.length === 0) {
      return NextResponse.json({
        success: true,
        totalUsers: 0,
        verified: [],
        unverified: [],
        allEmails: [],
      });
    }

    const verified = [];
    const unverified = [];
    const allEmails = [];

    for (const user of users) {
      if (!user.email) continue;

      allEmails.push(user.email);

      const userInfo = {
        email: user.email,
        createdAt: user.created_at,
        lastSignIn: user.last_sign_in_at,
        verified: !!user.email_confirmed_at,
      };

      if (user.email_confirmed_at) {
        verified.push(userInfo);
      } else {
        unverified.push(userInfo);
      }
    }

    logger.log(`✅ Found ${users.length} users (${verified.length} verified, ${unverified.length} unverified)`);

    return NextResponse.json({
      success: true,
      totalUsers: users.length,
      verifiedCount: verified.length,
      unverifiedCount: unverified.length,
      verified,
      unverified,
      allEmails,
    });

  } catch (error: any) {
    logger.error('❌ List emails error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to list emails' },
      { status: 500 }
    );
  }
}


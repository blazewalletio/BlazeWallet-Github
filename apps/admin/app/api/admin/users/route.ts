import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { verifyAdminSession } from '@/lib/admin-auth-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET(request: NextRequest) {
  try {
    const adminUser = await verifyAdminSession(request);
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all user profiles
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (profilesError) {
      logger.error('[Admin API] Failed to fetch profiles:', profilesError);
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    // Enrich with wallet and activity data
    const enrichedUsers = await Promise.all(
      profiles.map(async (profile) => {
        // Get email from auth.users (not in user_profiles!)
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(profile.user_id);

        // Get wallet count
        const { count: walletCount } = await supabaseAdmin
          .from('wallets')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', profile.user_id);

        // Get transaction count
        const { count: transactionCount } = await supabaseAdmin
          .from('transaction_events')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', profile.user_id);

        // Get last activity from user_events
        const { data: lastEvent } = await supabaseAdmin
          .from('user_events')
          .select('created_at')
          .eq('user_id', profile.user_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        // Get cohort segment
        const { data: cohort } = await supabaseAdmin
          .from('user_cohorts')
          .select('segment')
          .eq('user_id', profile.user_id)
          .single();

        // Smart display name fallback
        let displayName = profile.display_name;
        if (!displayName || displayName === 'BLAZE User' || displayName.trim() === '') {
          // Fallback: use first part of email or "Anonymous"
          displayName = authUser?.user?.email?.split('@')[0] || 'Anonymous';
        }

        return {
          id: profile.user_id,
          email: authUser?.user?.email || 'No email',
          display_name: displayName,
          created_at: profile.created_at,
          wallet_count: walletCount || 0,
          transaction_count: transactionCount || 0,
          last_activity: lastEvent?.created_at || profile.created_at,
          segment: cohort?.segment || 'new',
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        users: enrichedUsers,
        total: enrichedUsers.length,
      },
    });
  } catch (error: any) {
    logger.error('[Admin API] Users list failed:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

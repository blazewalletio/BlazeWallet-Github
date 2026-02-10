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

    // ✅ STEP 1: Get ALL users from auth.users (the source of truth)
    const { data: { users: authUsers }, error: authUsersError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (authUsersError) {
      logger.error('[Admin API] Failed to fetch auth users:', authUsersError);
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    if (!authUsers || authUsers.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          users: [],
          total: 0,
        },
      });
    }

    logger.log(`[Admin API] Found ${authUsers.length} users in auth.users`);

    // ✅ STEP 2: Get all user profiles and create a lookup map
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('user_profiles')
      .select('*');

    if (profilesError) {
      logger.error('[Admin API] Failed to fetch profiles:', profilesError);
      // Continue anyway - we'll just use defaults for users without profiles
    }

    // Create a lookup map: user_id -> profile
    const profileMap = new Map<string, any>();
    if (profiles) {
      profiles.forEach((profile) => {
        profileMap.set(profile.user_id, profile);
      });
    }

    logger.log(`[Admin API] Found ${profiles?.length || 0} user profiles`);

    // ✅ STEP 3: Enrich each auth user with profile and activity data
    const enrichedUsers = await Promise.all(
      authUsers.map(async (authUser) => {
        const userId = authUser.id;
        const profile = profileMap.get(userId);

        // Get wallet count
        const { count: walletCount } = await supabaseAdmin
          .from('wallets')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId);

        // Get transaction count
        const { count: transactionCount } = await supabaseAdmin
          .from('transaction_events')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId);

        // Get last activity from user_events
        const { data: lastEventData } = await supabaseAdmin
          .from('user_events')
          .select('created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1);
        const lastEvent = lastEventData && lastEventData.length > 0 ? lastEventData[0] : null;

        // Get cohort segment
        const { data: cohortData } = await supabaseAdmin
          .from('user_cohorts')
          .select('segment')
          .eq('user_id', userId)
          .limit(1);
        const cohort = cohortData && cohortData.length > 0 ? cohortData[0] : null;

        // Display name logic:
        // 1. Use profile display_name if set and not default
        // 2. Fallback to email prefix
        let displayName = profile?.display_name;
        if (!displayName || displayName === 'BLAZE User' || displayName.trim() === '') {
          // Fallback: use first part of email
          displayName = authUser.email?.split('@')[0] || 'Anonymous';
        }

        // Use profile created_at if available, otherwise use auth user created_at
        const createdAt = profile?.created_at || authUser.created_at;
        
        // Use profile last_activity if available, otherwise use auth user created_at
        const lastActivity = lastEvent?.created_at || profile?.created_at || authUser.created_at || new Date().toISOString();

        return {
          id: userId,
          email: authUser.email || 'No email',
          display_name: displayName,
          created_at: createdAt,
          wallet_count: walletCount || 0,
          transaction_count: transactionCount || 0,
          last_activity: lastActivity,
          segment: cohort?.segment || 'new',
          has_profile: !!profile, // Flag to indicate if user has a profile
        };
      })
    );

    // ✅ STEP 4: Sort by created_at (newest first)
    enrichedUsers.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateB - dateA;
    });

    logger.log(`[Admin API] Returning ${enrichedUsers.length} enriched users`);

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

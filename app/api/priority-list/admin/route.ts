import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

// Use service role key for admin operations (bypasses RLS)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Admin email whitelist
const ADMIN_EMAILS_RAW = process.env.ADMIN_EMAILS || '';
const ADMIN_EMAILS = ADMIN_EMAILS_RAW.split(',').map(e => e.trim()).filter(e => e.length > 0);

// Fallback admin emails if env var is not set (for development/testing)
const FALLBACK_ADMIN_EMAILS = ['info@blazewallet.io'];
const ALLOWED_ADMINS = ADMIN_EMAILS.length > 0 ? ADMIN_EMAILS : FALLBACK_ADMIN_EMAILS;

logger.log('🔐 Admin emails configured:', {
  fromEnv: ADMIN_EMAILS.length > 0,
  count: ALLOWED_ADMINS.length,
  emails: ALLOWED_ADMINS,
});

// GET /api/priority-list/admin - Admin dashboard data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const adminEmail = searchParams.get('admin');
    
    logger.log('🔍 Admin login attempt:', { 
      adminEmail, 
      allowedEmails: ALLOWED_ADMINS,
      isAllowed: adminEmail ? ALLOWED_ADMINS.includes(adminEmail) : false
    });
    
    // Check admin authorization
    if (!adminEmail || !ALLOWED_ADMINS.includes(adminEmail)) {
      logger.log('❌ Unauthorized admin login attempt:', adminEmail);
      return NextResponse.json(
        { success: false, message: `Unauthorized - Invalid admin email. Allowed: ${ALLOWED_ADMINS.join(', ')}` },
        { status: 401 }
      );
    }

    logger.log('✅ Admin authorized:', adminEmail);

    // Get all registrations
    logger.log('📊 Fetching registrations from Supabase...');
    const { data: registrations, error: regError } = await supabase
      .from('priority_list_registrations')
      .select('*')
      .order('registered_at', { ascending: false });

    if (regError) {
      logger.error('❌ Error fetching registrations:', regError);
      logger.error('Error details:', JSON.stringify(regError, null, 2));
      
      // Return empty data instead of error if table doesn't exist yet
      return NextResponse.json({
        success: true,
        data: {
          registrations: [],
          stats: {
            total_registered: 0,
            verified_count: 0,
            referral_count: 0,
            early_bird_count: 0,
            email_provided_count: 0,
            last_registration: null,
          },
          leaderboard: [],
        },
        message: 'Table not found or empty - this is normal if no registrations yet',
      });
    }
    
    logger.log('✅ Registrations fetched:', registrations?.length || 0);

    // Get stats
    logger.log('📊 Fetching stats from Supabase...');
    const { data: stats, error: statsError } = await supabase
      .from('priority_list_stats')
      .select('*')
      .single();

    if (statsError) {
      logger.warn('⚠️  Error fetching stats (using defaults):', statsError.message);
    }

    // Get leaderboard
    logger.log('🏆 Fetching leaderboard from Supabase...');
    const { data: leaderboard, error: leaderboardError } = await supabase
      .from('referral_leaderboard')
      .select('*')
      .limit(20);

    if (leaderboardError) {
      logger.warn('⚠️  Error fetching leaderboard (using empty):', leaderboardError.message);
    }

    logger.log('✅ Admin data ready:', { 
      registrations: registrations?.length || 0,
      hasStats: !!stats,
      leaderboard: leaderboard?.length || 0
    });

    return NextResponse.json({
      success: true,
      data: {
        registrations: registrations || [],
        stats: stats || null,
        leaderboard: leaderboard || [],
      },
    });
  } catch (error) {
    logger.error('Error in admin API:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/priority-list/admin - Admin actions (verify, delete, etc)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { adminEmail, action, walletAddress } = body;
    
    logger.log('🔍 Admin action attempt:', { adminEmail, action, walletAddress });
    
    // Check admin authorization
    if (!adminEmail || !ALLOWED_ADMINS.includes(adminEmail)) {
      logger.log('❌ Unauthorized admin action attempt:', adminEmail);
      return NextResponse.json(
        { success: false, message: 'Unauthorized - Invalid admin email' },
        { status: 401 }
      );
    }

    if (!action || !walletAddress) {
      return NextResponse.json(
        { success: false, message: 'Action and wallet address required' },
        { status: 400 }
      );
    }

    // Handle different actions
    switch (action) {
      case 'verify':
        const { error: verifyError } = await supabase
          .from('priority_list_registrations')
          .update({ is_verified: true })
          .eq('wallet_address', walletAddress.toLowerCase());

        if (verifyError) {
          logger.error('Verify error:', verifyError);
          return NextResponse.json(
            { success: false, message: 'Failed to verify registration' },
            { status: 500 }
          );
        }

        // Log admin action
        await supabase.from('admin_actions').insert({
          admin_email: adminEmail,
          action_type: 'verify',
          target_wallet: walletAddress,
        });

        return NextResponse.json({
          success: true,
          message: 'Registration verified successfully',
        });

      case 'delete':
        const { error: deleteError } = await supabase
          .from('priority_list_registrations')
          .delete()
          .eq('wallet_address', walletAddress.toLowerCase());

        if (deleteError) {
          logger.error('Delete error:', deleteError);
          return NextResponse.json(
            { success: false, message: 'Failed to delete registration' },
            { status: 500 }
          );
        }

        // Log admin action
        await supabase.from('admin_actions').insert({
          admin_email: adminEmail,
          action_type: 'delete',
          target_wallet: walletAddress,
        });

        return NextResponse.json({
          success: true,
          message: 'Registration deleted successfully',
        });

      default:
        return NextResponse.json(
          { success: false, message: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    logger.error('Error in admin action:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}


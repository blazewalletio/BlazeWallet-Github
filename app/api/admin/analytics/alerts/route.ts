import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

// Admin client with service role
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

// Whitelisted admin emails
const ALLOWED_ADMINS = [
  'ricks_@live.nl',
];

/**
 * Verify admin access
 */
async function verifyAdmin(request: NextRequest): Promise<{ authorized: boolean; email?: string }> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return { authorized: false };
    }

    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: { user }, error } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (error || !user || !user.email) {
      return { authorized: false };
    }

    if (!ALLOWED_ADMINS.includes(user.email)) {
      return { authorized: false };
    }

    return { authorized: true, email: user.email };
  } catch (error) {
    return { authorized: false };
  }
}

/**
 * GET /api/admin/analytics/alerts
 * 
 * Returns all alerts with filtering
 */
export async function GET(request: NextRequest) {
  try {
    const { authorized, email } = await verifyAdmin(request);
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'unread';
    const severity = searchParams.get('severity');
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabaseAdmin
      .from('admin_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    if (severity) {
      query = query.eq('severity', severity);
    }

    const { data: alerts, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: alerts || [],
      count: alerts?.length || 0,
    });

  } catch (error: any) {
    logger.error('[Admin API] Alerts error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/analytics/alerts
 * 
 * Update alert status (mark as read/resolved)
 */
export async function PATCH(request: NextRequest) {
  try {
    const { authorized, email } = await verifyAdmin(request);
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { alertId, status, resolutionNote } = await request.json();

    if (!alertId || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: alertId, status' },
        { status: 400 }
      );
    }

    const updateData: any = {
      status,
      resolved_by: email,
    };

    if (status === 'resolved') {
      updateData.resolved_at = new Date().toISOString();
      if (resolutionNote) {
        updateData.resolution_note = resolutionNote;
      }
    }

    const { data, error } = await supabaseAdmin
      .from('admin_alerts')
      .update(updateData)
      .eq('id', alertId)
      .select()
      .single();

    if (error) throw error;

    logger.log(`[Admin API] Alert ${alertId} updated to ${status} by ${email}`);

    return NextResponse.json({
      success: true,
      data,
    });

  } catch (error: any) {
    logger.error('[Admin API] Update alert error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}


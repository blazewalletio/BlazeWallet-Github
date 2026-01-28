import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { verifyAdminSession } from '@/lib/admin-auth-utils';

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

    const { data: alerts, error } = await supabaseAdmin
      .from('admin_alerts')
      .select('*')
      .eq('status', 'unread')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      logger.error('[Admin API] Failed to fetch alerts:', error);
      return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      alerts: alerts || [],
    });
  } catch (error: any) {
    logger.error('[Admin API] Alerts failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

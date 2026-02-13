import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { apiRateLimiter } from '@/lib/api-rate-limiter';
import { getClientIP } from '@/lib/rate-limiter';

const DEFAULT_PREFERENCES = {
  notifications_enabled: true,
  in_app_enabled: true,
  push_enabled: false,
  transactions_enabled: true,
  security_enabled: true,
  price_alerts_enabled: false,
  news_enabled: false,
  promotions_enabled: false,
};

async function getAuthenticatedUserId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!bearer) return null;

  const { data, error } = await getSupabaseAdmin().auth.getUser(bearer);
  if (error || !data?.user?.id) return null;
  return data.user.id;
}

export async function GET(req: NextRequest) {
  const clientIp = getClientIP(req.headers);
  if (!apiRateLimiter.check(`notifications:preferences:get:${clientIp}`, 120, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message || 'Failed to load preferences' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    preferences: {
      ...DEFAULT_PREFERENCES,
      ...(data || {}),
    },
  });
}

export async function POST(req: NextRequest) {
  const clientIp = getClientIP(req.headers);
  if (!apiRateLimiter.check(`notifications:preferences:post:${clientIp}`, 60, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const updates = {
    notifications_enabled: typeof body.notifications_enabled === 'boolean' ? body.notifications_enabled : undefined,
    in_app_enabled: typeof body.in_app_enabled === 'boolean' ? body.in_app_enabled : undefined,
    push_enabled: typeof body.push_enabled === 'boolean' ? body.push_enabled : undefined,
    transactions_enabled: typeof body.transactions_enabled === 'boolean' ? body.transactions_enabled : undefined,
    security_enabled: typeof body.security_enabled === 'boolean' ? body.security_enabled : undefined,
    price_alerts_enabled: typeof body.price_alerts_enabled === 'boolean' ? body.price_alerts_enabled : undefined,
    news_enabled: typeof body.news_enabled === 'boolean' ? body.news_enabled : undefined,
    promotions_enabled: typeof body.promotions_enabled === 'boolean' ? body.promotions_enabled : undefined,
    updated_at: new Date().toISOString(),
  };

  const payload = Object.fromEntries(Object.entries(updates).filter(([, value]) => value !== undefined));

  const { data, error } = await getSupabaseAdmin()
    .from('notification_preferences')
    .upsert({
      user_id: userId,
      ...payload,
    }, { onConflict: 'user_id' })
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message || 'Failed to save preferences' }, { status: 500 });
  }

  if (payload.notifications_enabled !== undefined) {
    await getSupabaseAdmin()
      .from('user_profiles')
      .update({ notifications_enabled: payload.notifications_enabled })
      .eq('user_id', userId);
  }

  return NextResponse.json({
    success: true,
    preferences: {
      ...DEFAULT_PREFERENCES,
      ...(data || {}),
    },
  });
}



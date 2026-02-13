import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { apiRateLimiter } from '@/lib/api-rate-limiter';
import { getClientIP } from '@/lib/rate-limiter';

async function getAuthenticatedUserId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!bearer) return null;

  const { data, error } = await getSupabaseAdmin().auth.getUser(bearer);
  if (error || !data?.user?.id) return null;
  return data.user.id;
}

export async function POST(req: NextRequest) {
  const clientIp = getClientIP(req.headers);
  if (!apiRateLimiter.check(`notifications:subscribe:${clientIp}`, 40, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const subscription = body?.subscription;
  const endpoint: string | undefined = subscription?.endpoint;
  const p256dh: string | undefined = subscription?.keys?.p256dh;
  const auth: string | undefined = subscription?.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: 'Invalid push subscription payload' }, { status: 400 });
  }

  const platform = ['web', 'pwa', 'ios', 'android'].includes(body?.platform) ? body.platform : 'web';
  const userAgent = req.headers.get('user-agent') || null;
  const nowIso = new Date().toISOString();

  const { error } = await getSupabaseAdmin()
    .from('push_subscriptions')
    .upsert({
      user_id: userId,
      endpoint,
      p256dh,
      auth,
      device_id: typeof body?.deviceId === 'string' ? body.deviceId : null,
      platform,
      user_agent: userAgent,
      enabled: true,
      revoked_at: null,
      last_seen_at: nowIso,
      updated_at: nowIso,
    }, { onConflict: 'endpoint' });

  if (error) {
    return NextResponse.json({ error: error.message || 'Failed to save push subscription' }, { status: 500 });
  }

  // Keep channel prefs in sync once a valid push endpoint exists.
  await getSupabaseAdmin()
    .from('notification_preferences')
    .upsert({
      user_id: userId,
      notifications_enabled: true,
      in_app_enabled: true,
      push_enabled: true,
      updated_at: nowIso,
    }, { onConflict: 'user_id' });

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const clientIp = getClientIP(req.headers);
  if (!apiRateLimiter.check(`notifications:unsubscribe:${clientIp}`, 40, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const endpoint = typeof body?.endpoint === 'string' ? body.endpoint : null;

  let query = getSupabaseAdmin()
    .from('push_subscriptions')
    .update({
      enabled: false,
      revoked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (endpoint) {
    query = query.eq('endpoint', endpoint);
  }

  const { error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message || 'Failed to unsubscribe push endpoint' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}



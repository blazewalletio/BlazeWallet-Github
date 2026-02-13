import { NextRequest, NextResponse } from 'next/server';
import { apiRateLimiter } from '@/lib/api-rate-limiter';
import { getClientIP } from '@/lib/rate-limiter';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { dispatchNotification } from '@/lib/server/notification-dispatcher';

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
  if (!apiRateLimiter.check(`notifications:test:${clientIp}`, 10, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dispatchNotification({
    userId,
    supabaseUserId: userId,
    type: 'system',
    title: 'Notifications enabled',
    message: 'Blaze notifications are working on this device.',
    data: {
      source: 'notifications-test',
      timestamp: new Date().toISOString(),
      url: '/?open=settings',
    },
  });

  return NextResponse.json({ success: true });
}



import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { apiRateLimiter } from '@/lib/api-rate-limiter';
import { getClientIP } from '@/lib/rate-limiter';
import { CHAINS } from '@/lib/chains';

type ChainAddressMap = Record<string, string>;

function isSchemaNotReadyError(error: any): boolean {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  return (
    code === '42P01' || // undefined_table
    code === '42P10' || // invalid_column_reference / missing ON CONFLICT target
    message.includes('does not exist') ||
    message.includes('relation') ||
    message.includes('constraint')
  );
}

function normalizeAddress(chainKey: string, address: string): string {
  const trimmed = String(address || '').trim();
  if (!trimmed) return '';

  // EVM addresses are case-insensitive. Normalize to prevent duplicates.
  const chainId = CHAINS[chainKey]?.id;
  const isEvm = typeof chainId === 'number' && chainId > 0 && chainKey !== 'solana';
  return isEvm ? trimmed.toLowerCase() : trimmed;
}

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
  if (!apiRateLimiter.check(`wallet:chain-addresses:post:${clientIp}`, 60, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const addresses = (body?.addresses || {}) as ChainAddressMap;
  if (!addresses || typeof addresses !== 'object') {
    return NextResponse.json({ error: 'Invalid addresses payload' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const desiredRows = Object.entries(addresses)
    .filter(([chainKey, rawAddress]) => !!CHAINS[chainKey] && typeof rawAddress === 'string')
    .map(([chainKey, rawAddress]) => ({
      user_id: userId,
      chain_key: chainKey,
      address: normalizeAddress(chainKey, rawAddress),
      source: 'wallet_sync',
      is_active: true,
      metadata: { synced_from: 'dashboard' },
      last_seen_at: now,
      updated_at: now,
    }))
    .filter((row) => !!row.address);

  if (desiredRows.length === 0) {
    return NextResponse.json({ success: true, upserted: 0, deactivated: 0 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const desiredKeys = new Set(desiredRows.map((r) => `${r.chain_key}:${r.address}`));

  const { data: currentRows, error: currentError } = await supabaseAdmin
    .from('user_chain_addresses')
    .select('id,chain_key,address')
    .eq('user_id', userId)
    .eq('source', 'wallet_sync')
    .eq('is_active', true);

  if (currentError) {
    if (isSchemaNotReadyError(currentError)) {
      return NextResponse.json({
        success: true,
        upserted: 0,
        deactivated: 0,
        skipped: true,
        reason: 'incoming_watch_schema_not_ready',
      });
    }
    return NextResponse.json({ error: currentError.message || 'Failed to load current addresses' }, { status: 500 });
  }

  const toDeactivate = (currentRows || [])
    .filter((row: any) => !desiredKeys.has(`${row.chain_key}:${row.address}`))
    .map((row: any) => row.id);

  if (toDeactivate.length > 0) {
    await supabaseAdmin
      .from('user_chain_addresses')
      .update({ is_active: false, updated_at: now })
      .in('id', toDeactivate);
  }

  const { error: upsertError } = await supabaseAdmin
    .from('user_chain_addresses')
    .upsert(desiredRows, { onConflict: 'user_id,chain_key,address' });

  if (upsertError) {
    if (isSchemaNotReadyError(upsertError)) {
      return NextResponse.json({
        success: true,
        upserted: 0,
        deactivated: toDeactivate.length,
        skipped: true,
        reason: 'incoming_watch_schema_not_ready',
      });
    }
    return NextResponse.json({ error: upsertError.message || 'Failed to sync addresses' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    upserted: desiredRows.length,
    deactivated: toDeactivate.length,
  });
}


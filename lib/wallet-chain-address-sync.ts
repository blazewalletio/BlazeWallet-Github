import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export async function syncWalletChainAddresses(addresses: Record<string, string>): Promise<void> {
  const sanitizedEntries = Object.entries(addresses || {})
    .filter(([, address]) => typeof address === 'string' && address.trim().length > 0)
    .map(([chain, address]) => [chain, address.trim()]);

  if (sanitizedEntries.length === 0) return;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return;

  const payload = Object.fromEntries(sanitizedEntries);
  const response = await fetch('/api/wallet/chain-addresses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ addresses: payload }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    logger.warn('[ChainAddressSync] Failed to sync addresses:', {
      status: response.status,
      body: body.slice(0, 200),
    });
  }
}


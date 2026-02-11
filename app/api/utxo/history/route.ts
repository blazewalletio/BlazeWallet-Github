import { NextRequest, NextResponse } from 'next/server';
import { BitcoinService } from '@/lib/bitcoin-service';
import { BitcoinForkService, BitcoinForkChain } from '@/lib/bitcoin-fork-service';
import { apiRateLimiter } from '@/lib/api-rate-limiter';
import { logger } from '@/lib/logger';

type SupportedChain = 'bitcoin' | 'litecoin' | 'dogecoin' | 'bitcoincash';

interface CachedHistory {
  transactions: any[];
  expiresAt: number;
}

const HISTORY_CACHE_TTL_MS = 15_000;
const historyCache = new Map<string, CachedHistory>();

function isSupportedChain(chain: string): chain is SupportedChain {
  return chain === 'bitcoin' || chain === 'litecoin' || chain === 'dogecoin' || chain === 'bitcoincash';
}

function isValidAddress(chain: SupportedChain, address: string): boolean {
  if (chain === 'bitcoin') {
    return BitcoinService.isValidAddress(address);
  }
  return BitcoinForkService.isValidAddress(address, chain as BitcoinForkChain);
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chain = (searchParams.get('chain') || '').toLowerCase();
    const address = (searchParams.get('address') || '').trim();
    const limit = Math.max(1, Math.min(100, Number(searchParams.get('limit') || 25)));

    if (!isSupportedChain(chain)) {
      return NextResponse.json({ success: false, error: 'Unsupported chain' }, { status: 400 });
    }

    if (!address) {
      return NextResponse.json({ success: false, error: 'Address is required' }, { status: 400 });
    }

    if (!isValidAddress(chain, address)) {
      return NextResponse.json({ success: false, error: 'Invalid address format' }, { status: 400 });
    }

    const ip = getClientIp(request);
    if (!apiRateLimiter.check(`utxo-history:ip:${ip}`, 90, 60_000)) {
      return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 });
    }

    const cacheKey = `${chain}:${address}:l${limit}`;
    const cached = historyCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json(
        { success: true, chain, address, transactions: cached.transactions, source: 'cache' },
        { headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30' } }
      );
    }

    const transactions =
      chain === 'bitcoin'
        ? await new BitcoinService('mainnet').getTransactionHistory(address, limit)
        : await new BitcoinForkService(chain as BitcoinForkChain).getTransactionHistory(address, limit);

    historyCache.set(cacheKey, {
      transactions,
      expiresAt: Date.now() + HISTORY_CACHE_TTL_MS,
    });

    return NextResponse.json(
      { success: true, chain, address, transactions, source: 'provider' },
      { headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30' } }
    );
  } catch (error) {
    logger.error('❌ [UTXO API] Failed to fetch history:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch history' }, { status: 500 });
  }
}



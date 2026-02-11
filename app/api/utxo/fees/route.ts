import { NextRequest, NextResponse } from 'next/server';
import { BitcoinService, BitcoinUTXO } from '@/lib/bitcoin-service';
import { BitcoinForkService, BitcoinForkChain, BitcoinForkUTXO } from '@/lib/bitcoin-fork-service';
import { apiRateLimiter } from '@/lib/api-rate-limiter';
import { logger } from '@/lib/logger';

type SupportedChain = 'bitcoin' | 'litecoin' | 'dogecoin' | 'bitcoincash';

interface CachedFees {
  fees: any;
  expiresAt: number;
}

const FEES_CACHE_TTL_MS = 15_000;
const feesCache = new Map<string, CachedFees>();

function isSupportedChain(chain: string): chain is SupportedChain {
  return chain === 'bitcoin' || chain === 'litecoin' || chain === 'dogecoin' || chain === 'bitcoincash';
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    if (!apiRateLimiter.check(`utxo-fees:ip:${ip}`, 120, 60_000)) {
      return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const chain = (body?.chain || '').toLowerCase();
    const outputs = Math.max(1, Math.min(8, Number(body?.outputs ?? 1)));
    const utxos = Array.isArray(body?.utxos) ? body.utxos : undefined;

    if (!isSupportedChain(chain)) {
      return NextResponse.json({ success: false, error: 'Unsupported chain' }, { status: 400 });
    }

    const cacheKey = `${chain}:o${outputs}:u${Array.isArray(utxos) ? utxos.length : 0}`;
    const cached = feesCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json(
        { success: true, chain, fees: cached.fees, source: 'cache' },
        { headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30' } }
      );
    }

    const fees =
      chain === 'bitcoin'
        ? await new BitcoinService('mainnet').estimateFees(utxos as BitcoinUTXO[] | undefined, outputs)
        : await new BitcoinForkService(chain as BitcoinForkChain).estimateFees(
            utxos as BitcoinForkUTXO[] | undefined,
            outputs
          );

    feesCache.set(cacheKey, {
      fees,
      expiresAt: Date.now() + FEES_CACHE_TTL_MS,
    });

    return NextResponse.json(
      { success: true, chain, fees, source: 'provider' },
      { headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30' } }
    );
  } catch (error) {
    logger.error('❌ [UTXO API] Failed to estimate fees:', error);
    return NextResponse.json({ success: false, error: 'Failed to estimate fees' }, { status: 500 });
  }
}



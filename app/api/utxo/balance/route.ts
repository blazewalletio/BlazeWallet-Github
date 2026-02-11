import { NextRequest, NextResponse } from 'next/server';
import { BitcoinService } from '@/lib/bitcoin-service';
import { BitcoinForkService, BitcoinForkChain } from '@/lib/bitcoin-fork-service';
import { blockchairService } from '@/lib/blockchair-service';
import { apiRateLimiter } from '@/lib/api-rate-limiter';
import { logger } from '@/lib/logger';

type SupportedChain = 'bitcoin' | 'litecoin' | 'dogecoin' | 'bitcoincash';

interface CachedBalance {
  confirmed: number;
  unconfirmed: number;
  total: number;
  expiresAt: number;
}

const BALANCE_CACHE_TTL_MS = 20_000;
const balanceCache = new Map<string, CachedBalance>();

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

    if (!isSupportedChain(chain)) {
      return NextResponse.json(
        { success: false, error: 'Unsupported chain' },
        { status: 400 }
      );
    }

    if (!address) {
      return NextResponse.json(
        { success: false, error: 'Address is required' },
        { status: 400 }
      );
    }

    if (!isValidAddress(chain, address)) {
      return NextResponse.json(
        { success: false, error: 'Invalid address format' },
        { status: 400 }
      );
    }

    const ip = getClientIp(request);
    if (!apiRateLimiter.check(`utxo-balance:ip:${ip}`, 120, 60_000)) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again shortly.' },
        { status: 429 }
      );
    }

    const cacheKey = `${chain}:${address}`;
    const cached = balanceCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json(
        {
          success: true,
          chain,
          address,
          confirmed: cached.confirmed,
          unconfirmed: cached.unconfirmed,
          total: cached.total,
          source: 'cache',
        },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=40',
          },
        }
      );
    }

    const { info } = await blockchairService.getAddressData(chain, address);
    const confirmed = Math.max(0, info.balance || 0);
    const unconfirmed = 0;
    const total = confirmed + unconfirmed;

    balanceCache.set(cacheKey, {
      confirmed,
      unconfirmed,
      total,
      expiresAt: Date.now() + BALANCE_CACHE_TTL_MS,
    });

    return NextResponse.json(
      {
        success: true,
        chain,
        address,
        confirmed,
        unconfirmed,
        total,
        source: 'provider',
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=40',
        },
      }
    );
  } catch (error) {
    logger.error('❌ [UTXO Balance API] Failed to fetch balance:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch UTXO balance',
        confirmed: 0,
        unconfirmed: 0,
        total: 0,
      },
      { status: 200 }
    );
  }
}



import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { ethers } from 'ethers';
import { apiRateLimiter } from '@/lib/api-rate-limiter';
import { CHAINS } from '@/lib/chains';

export const dynamic = 'force-dynamic';

type CoinListItem = {
  id: string;
  symbol: string;
  name: string;
  platforms?: Record<string, string | null>;
};

type SearchCoinItem = {
  id: string;
  symbol: string;
  name: string;
  market_cap_rank?: number | null;
  thumb?: string;
  large?: string;
};

const COINGECKO_PLATFORM_BY_CHAIN: Record<string, string | null> = {
  ethereum: 'ethereum',
  polygon: 'polygon-pos',
  arbitrum: 'arbitrum-one',
  base: 'base',
  bsc: 'binance-smart-chain',
  optimism: 'optimistic-ethereum',
  avalanche: 'avalanche',
  fantom: 'fantom',
  cronos: 'cronos',
  zksync: 'zksync',
  linea: 'linea',
  solana: 'solana',
  sepolia: 'ethereum',
  bscTestnet: 'binance-smart-chain',
  bitcoin: null,
  litecoin: null,
  dogecoin: null,
  bitcoincash: null,
};

const TESTNET_CHAINS = new Set(['sepolia', 'bscTestnet']);

let coinListCache: { expiresAt: number; data: CoinListItem[] } = {
  expiresAt: 0,
  data: [],
};

const LIST_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h
const BASE_CG_URL = process.env.COINGECKO_API_KEY?.trim()
  ? 'https://pro-api.coingecko.com/api/v3'
  : 'https://api.coingecko.com/api/v3';

function isValidSolanaMint(address: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

function normalizeAddressForChain(chainKey: string, address: string): string | null {
  const raw = address.trim();
  if (!raw) return null;

  if (chainKey === 'solana') {
    return isValidSolanaMint(raw) ? raw : null;
  }

  try {
    return ethers.getAddress(raw);
  } catch {
    return null;
  }
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

function buildQueryUrl(path: string): string {
  return `${BASE_CG_URL}${path}`;
}

async function fetchFromCoinGecko(path: string, timeoutMs: number = 15000): Promise<Response> {
  const apiKey = process.env.COINGECKO_API_KEY?.trim();
  return fetch(buildQueryUrl(path), {
    headers: {
      Accept: 'application/json',
      ...(apiKey ? { 'x-cg-pro-api-key': apiKey } : {}),
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
}

async function getCoinList(): Promise<CoinListItem[]> {
  if (coinListCache.expiresAt > Date.now() && coinListCache.data.length > 0) {
    return coinListCache.data;
  }

  const response = await fetchFromCoinGecko('/coins/list?include_platform=true', 20000);
  if (!response.ok) {
    throw new Error(`Coin list fetch failed (${response.status})`);
  }

  const data = (await response.json()) as CoinListItem[];
  coinListCache = {
    data: Array.isArray(data) ? data : [],
    expiresAt: Date.now() + LIST_CACHE_TTL_MS,
  };
  return coinListCache.data;
}

async function hasContractCode(rpcUrl: string, address: string): Promise<boolean> {
  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getCode',
        params: [address, 'latest'],
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) return false;
    const payload = await response.json();
    const code = typeof payload?.result === 'string' ? payload.result : '0x';
    return code !== '0x' && code !== '0x0';
  } catch {
    return false;
  }
}

async function filterTestnetDeployments(
  chainKey: string,
  tokens: Array<{
    id: string;
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    logoURI: string;
    marketCapRank: number;
  }>,
  targetLimit: number
) {
  const rpcUrl = CHAINS[chainKey]?.rpcUrl;
  if (!rpcUrl) return tokens.slice(0, targetLimit);

  const sample = tokens.slice(0, Math.min(220, Math.max(targetLimit * 8, 80)));
  const deployed: typeof sample = [];

  for (let i = 0; i < sample.length; i += 12) {
    const chunk = sample.slice(i, i + 12);
    const results = await Promise.all(
      chunk.map(async (token) => ({
        token,
        deployed: await hasContractCode(rpcUrl, token.address),
      }))
    );

    for (const result of results) {
      if (result.deployed) {
        deployed.push(result.token);
      }
    }

    if (deployed.length >= targetLimit) break;
  }

  return deployed.slice(0, targetLimit);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = (searchParams.get('q') || '').trim().toLowerCase();
    const chainKey = (searchParams.get('chain') || 'ethereum').trim();
    const limit = Math.max(1, Math.min(60, Number(searchParams.get('limit') || 40)));

    if (!query || query.length < 2) {
      return NextResponse.json({ tokens: [] });
    }

    const ip = getClientIp(request);
    if (!apiRateLimiter.check(`token-search:ip:${ip}`, 120, 60_000)) {
      return NextResponse.json({ tokens: [], error: 'Too many requests' }, { status: 429 });
    }

    const platform = COINGECKO_PLATFORM_BY_CHAIN[chainKey];
    if (!platform) {
      return NextResponse.json({
        tokens: [],
        info: 'Token search via CoinGecko is not available for this chain. Use add-by-address.',
      });
    }

    logger.log(`🔍 [TokenSearch] CoinGecko search "${query}" on ${chainKey} (${platform})`);

    const [coinList, searchResponse] = await Promise.all([
      getCoinList(),
      fetchFromCoinGecko(`/search?query=${encodeURIComponent(query)}`, 12000).catch(() => null),
    ]);

    const searchMeta = new Map<string, SearchCoinItem>();
    if (searchResponse?.ok) {
      const payload = await searchResponse.json();
      const searchCoins: SearchCoinItem[] = Array.isArray(payload?.coins) ? payload.coins : [];
      for (const coin of searchCoins) {
        searchMeta.set(coin.id, coin);
      }
    }

    const candidates = coinList
      .filter((coin) => {
        const symbol = (coin.symbol || '').toLowerCase();
        const name = (coin.name || '').toLowerCase();
        if (!symbol.includes(query) && !name.includes(query)) return false;

        const platformAddress = coin.platforms?.[platform];
        if (!platformAddress) return false;

        const normalized = normalizeAddressForChain(chainKey, platformAddress);
        return Boolean(normalized);
      })
      .map((coin) => {
        const platformAddress = coin.platforms?.[platform] || '';
        const normalizedAddress = normalizeAddressForChain(chainKey, platformAddress) as string;
        const meta = searchMeta.get(coin.id);
        return {
          id: coin.id,
          address: normalizedAddress,
          symbol: (coin.symbol || '').toUpperCase(),
          name: coin.name || coin.symbol || 'Unknown token',
          decimals: chainKey === 'solana' ? 9 : 18, // real decimals fetched when adding token
          logoURI: meta?.large || meta?.thumb || '',
          marketCapRank: Number(meta?.market_cap_rank || 999999),
        };
      });

    const deduped = new Map<string, (typeof candidates)[number]>();
    for (const token of candidates) {
      const key = chainKey === 'solana' ? token.address : token.address.toLowerCase();
      if (!deduped.has(key)) {
        deduped.set(key, token);
      }
    }

    const preRanked = Array.from(deduped.values())
      .sort((a, b) => {
        const aSym = a.symbol.toLowerCase();
        const bSym = b.symbol.toLowerCase();
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();

        // Popularity first (lower market cap rank is better)
        const aKnownRank = a.marketCapRank < 999999;
        const bKnownRank = b.marketCapRank < 999999;
        if (aKnownRank !== bKnownRank) return aKnownRank ? -1 : 1;
        if (a.marketCapRank !== b.marketCapRank) return a.marketCapRank - b.marketCapRank;

        // Then relevance tie-breakers
        const aExact = aSym === query;
        const bExact = bSym === query;
        if (aExact !== bExact) return aExact ? -1 : 1;

        const aStarts = aSym.startsWith(query);
        const bStarts = bSym.startsWith(query);
        if (aStarts !== bStarts) return aStarts ? -1 : 1;

        const aNameStarts = aName.startsWith(query);
        const bNameStarts = bName.startsWith(query);
        if (aNameStarts !== bNameStarts) return aNameStarts ? -1 : 1;

        return aSym.localeCompare(bSym);
      });

    const rankedSource = TESTNET_CHAINS.has(chainKey)
      ? await filterTestnetDeployments(chainKey, preRanked, limit)
      : preRanked.slice(0, limit);

    const ranked = rankedSource.map(({ marketCapRank, ...token }) => token);

    logger.log(`✅ [TokenSearch] Found ${ranked.length} tokens on ${chainKey}`);

    return NextResponse.json(
      {
        tokens: ranked,
        ...(TESTNET_CHAINS.has(chainKey)
          ? {
              info:
                'Showing tokens verified as deployed on this testnet. If your token is missing, use add by address.',
            }
          : {}),
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
        },
      }
    );
  } catch (error: any) {
    logger.error('❌ [TokenSearch] Error:', error);
    return NextResponse.json({ tokens: [] }, { status: 200 });
  }
}


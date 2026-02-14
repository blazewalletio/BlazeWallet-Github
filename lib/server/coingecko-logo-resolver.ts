import { logger } from '@/lib/logger';

const COINGECKO_PRO_API_BASE = 'https://pro-api.coingecko.com/api/v3';
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY?.trim();

const PLATFORM_IDS: Record<string, string> = {
  ethereum: 'ethereum',
  sepolia: 'ethereum',
  polygon: 'polygon-pos',
  arbitrum: 'arbitrum-one',
  base: 'base',
  optimism: 'optimistic-ethereum',
  bsc: 'binance-smart-chain',
  bscTestnet: 'binance-smart-chain',
  avalanche: 'avalanche',
  fantom: 'fantom',
  cronos: 'cronos',
  zksync: 'zksync',
  linea: 'linea',
  solana: 'solana',
};

const NATIVE_COIN_IDS: Record<string, string> = {
  ethereum: 'ethereum',
  sepolia: 'ethereum',
  arbitrum: 'ethereum',
  base: 'ethereum',
  optimism: 'ethereum',
  linea: 'ethereum',
  zksync: 'ethereum',
  polygon: 'matic-network',
  bsc: 'binancecoin',
  bscTestnet: 'binancecoin',
  avalanche: 'avalanche-2',
  fantom: 'fantom',
  cronos: 'cronos',
  solana: 'solana',
  bitcoin: 'bitcoin',
  litecoin: 'litecoin',
  dogecoin: 'dogecoin',
  bitcoincash: 'bitcoin-cash',
};

type CacheEntry = { url: string | null; expiresAt: number };
const logoCache = new Map<string, CacheEntry>();
const SUCCESS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MISS_TTL_MS = 6 * 60 * 60 * 1000;

function getCacheKey(
  chainKey: string,
  isNative: boolean,
  address?: string,
  symbol?: string,
  name?: string
): string {
  if (isNative) return `${chainKey.toLowerCase()}:native`;
  const normalizedAddress = (address || '').toLowerCase();
  if (normalizedAddress) return `${chainKey.toLowerCase()}:addr:${normalizedAddress}`;
  return `${chainKey.toLowerCase()}:meta:${(symbol || '').trim().toLowerCase()}:${(name || '').trim().toLowerCase()}`;
}

function getCached(key: string): string | null | undefined {
  const entry = logoCache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    logoCache.delete(key);
    return undefined;
  }
  return entry.url;
}

function setCached(key: string, url: string | null): void {
  logoCache.set(key, {
    url,
    expiresAt: Date.now() + (url ? SUCCESS_TTL_MS : MISS_TTL_MS),
  });
}

function getImageUrl(data: any): string | null {
  const imageUrl = data?.image?.large || data?.image?.small || data?.image?.thumb || null;
  return imageUrl && !String(imageUrl).includes('missing') ? imageUrl : null;
}

export async function resolveCoinGeckoHistoryLogo(input: {
  chainKey: string;
  isNative: boolean;
  address?: string;
  symbol?: string;
  name?: string;
}): Promise<string | null> {
  const chainKey = input.chainKey;
  const cacheKey = getCacheKey(chainKey, input.isNative, input.address, input.symbol, input.name);
  const cached = getCached(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  if (!COINGECKO_API_KEY) {
    logger.warn('[HistoryLogoResolver] COINGECKO_API_KEY missing');
    setCached(cacheKey, null);
    return null;
  }

  try {
    let url: string | null = null;

    if (input.isNative) {
      const coinId = NATIVE_COIN_IDS[chainKey];
      if (!coinId) {
        setCached(cacheKey, null);
        return null;
      }

      const nativeUrl =
        `${COINGECKO_PRO_API_BASE}/coins/${coinId}` +
        `?x_cg_pro_api_key=${encodeURIComponent(COINGECKO_API_KEY)}` +
        '&localization=false&tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false';

      const response = await fetch(nativeUrl, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(7000),
      });

      if (response.ok) {
        const data = await response.json();
        url = getImageUrl(data);
      }
    } else {
      const platform = PLATFORM_IDS[chainKey];
      const address = input.address?.toLowerCase();
      if (!platform || !address) {
        setCached(cacheKey, null);
        return null;
      }

      const contractUrl =
        `${COINGECKO_PRO_API_BASE}/coins/${platform}/contract/${address}` +
        `?x_cg_pro_api_key=${encodeURIComponent(COINGECKO_API_KEY)}`;

      const response = await fetch(contractUrl, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(7000),
      });

      if (response.ok) {
        const data = await response.json();
        url = getImageUrl(data);
      }

      // Fallback for tokens where CoinGecko contract endpoint misses data:
      // try CoinGecko search by symbol/name and resolve image from coin details.
      if (!url) {
        const query = (input.name || input.symbol || '').trim();
        if (query.length >= 2) {
          const searchUrl =
            `${COINGECKO_PRO_API_BASE}/search?query=${encodeURIComponent(query)}` +
            `&x_cg_pro_api_key=${encodeURIComponent(COINGECKO_API_KEY)}`;
          const searchResponse = await fetch(searchUrl, {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(7000),
          });

          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            const candidates = Array.isArray(searchData?.coins) ? searchData.coins.slice(0, 10) : [];
            const symbol = (input.symbol || '').trim().toLowerCase();
            const name = (input.name || '').trim().toLowerCase();
            const ranked = candidates.sort((a: any, b: any) => {
              const aSymbol = String(a?.symbol || '').toLowerCase();
              const bSymbol = String(b?.symbol || '').toLowerCase();
              const aName = String(a?.name || '').toLowerCase();
              const bName = String(b?.name || '').toLowerCase();
              const score = (s: string, n: string) =>
                (symbol && s === symbol ? 3 : 0) +
                (name && n === name ? 2 : 0) +
                (symbol && s.includes(symbol) ? 1 : 0) +
                (name && n.includes(name) ? 1 : 0);
              return score(bSymbol, bName) - score(aSymbol, aName);
            });

            for (const candidate of ranked) {
              const coinId = String(candidate?.id || '').trim();
              if (!coinId) continue;
              const coinUrl =
                `${COINGECKO_PRO_API_BASE}/coins/${encodeURIComponent(coinId)}` +
                `?x_cg_pro_api_key=${encodeURIComponent(COINGECKO_API_KEY)}` +
                '&localization=false&tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false';
              const coinResponse = await fetch(coinUrl, {
                headers: { Accept: 'application/json' },
                signal: AbortSignal.timeout(7000),
              });
              if (!coinResponse.ok) continue;
              const coinData = await coinResponse.json();

              // If address is known, strongly prefer exact platform contract match.
              if (address && platform) {
                const normalizedAddress = address.toLowerCase();
                const detailPlatforms = coinData?.detail_platforms || {};
                const platformData = detailPlatforms?.[platform];
                const cgAddress = String(platformData?.contract_address || '').toLowerCase();
                if (cgAddress && cgAddress === normalizedAddress) {
                  url = getImageUrl(coinData);
                  break;
                }
              } else {
                // Without address: accept best ranked symbol/name match image.
                url = getImageUrl(coinData);
                if (url) break;
              }
            }
          }
        }
      }
    }

    setCached(cacheKey, url);
    return url;
  } catch (error) {
    logger.warn('[HistoryLogoResolver] Failed to resolve CoinGecko logo', {
      chainKey,
      isNative: input.isNative,
      address: input.address,
      error: error instanceof Error ? error.message : String(error),
    });
    setCached(cacheKey, null);
    return null;
  }
}


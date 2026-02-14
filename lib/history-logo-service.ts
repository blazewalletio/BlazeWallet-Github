import { logger } from '@/lib/logger';

export interface HistoryLogoItem {
  key: string;
  isNative: boolean;
  address?: string;
  symbol?: string;
  name?: string;
}

type CachedEntry = { url: string | null; expiresAt: number };
const memoryCache = new Map<string, CachedEntry>();
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MISS_TTL_MS = 10 * 60 * 1000;

function buildCacheKey(chainKey: string, item: HistoryLogoItem): string {
  if (item.isNative) return `${chainKey}:native`;
  const address = (item.address || '').toLowerCase();
  if (address) return `${chainKey}:addr:${address}`;
  const symbol = (item.symbol || '').trim().toLowerCase();
  const name = (item.name || '').trim().toLowerCase();
  return `${chainKey}:meta:${symbol}:${name}`;
}

function getCached(cacheKey: string): string | null | undefined {
  const entry = memoryCache.get(cacheKey);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    memoryCache.delete(cacheKey);
    return undefined;
  }
  return entry.url;
}

function setCached(cacheKey: string, url: string | null): void {
  memoryCache.set(cacheKey, {
    url,
    expiresAt: Date.now() + (url ? TTL_MS : MISS_TTL_MS),
  });
}

export async function getHistoryLogosBatch(
  chainKey: string,
  items: HistoryLogoItem[]
): Promise<Record<string, string | null>> {
  if (!items.length) return {};

  const logos: Record<string, string | null> = {};
  const missingItems: HistoryLogoItem[] = [];

  for (const item of items) {
    const cacheKey = buildCacheKey(chainKey, item);
    const cached = getCached(cacheKey);
    if (cached !== undefined) {
      logos[item.key] = cached;
    } else {
      missingItems.push(item);
    }
  }

  if (!missingItems.length) return logos;

  try {
    const response = await fetch('/api/history/logos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chainKey, items: missingItems }),
    });
    const data = await response.json();

    if (response.ok && data?.success && data?.logos) {
      for (const item of missingItems) {
        const value = Object.prototype.hasOwnProperty.call(data.logos, item.key)
          ? (data.logos[item.key] as string | null)
          : null;
        logos[item.key] = value;
        setCached(buildCacheKey(chainKey, item), value);
      }
      return logos;
    }
  } catch (error) {
    logger.warn('[HistoryLogoService] Batch logo fetch failed', error);
  }

  for (const item of missingItems) {
    logos[item.key] = null;
    setCached(buildCacheKey(chainKey, item), null);
  }
  return logos;
}

export async function getHistoryLogo(
  chainKey: string,
  item: Omit<HistoryLogoItem, 'key'>
): Promise<string | null> {
  const key = item.isNative ? '__native__' : (item.address || '').toLowerCase();
  const result = await getHistoryLogosBatch(chainKey, [{ ...item, key }]);
  return result[key] ?? null;
}


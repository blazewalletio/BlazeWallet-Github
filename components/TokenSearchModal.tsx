'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Loader2, Check, AlertCircle } from 'lucide-react';
import { CHAINS } from '@/lib/chains';
import { LiFiService, LiFiToken } from '@/lib/lifi-service';
import { logger } from '@/lib/logger';
import { useBlockBodyScroll } from '@/hooks/useBlockBodyScroll';
import { tokenCache } from '@/lib/token-cache';

interface TokenSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  chainKey: string;
  selectedToken?: string;
  onSelectToken: (token: LiFiToken | 'native') => void;
  excludeTokens?: string[]; // Tokens to exclude (e.g., fromToken when selecting toToken)
}

export default function TokenSearchModal({
  isOpen,
  onClose,
  chainKey,
  selectedToken,
  onSelectToken,
  excludeTokens = [],
}: TokenSearchModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [tokens, setTokens] = useState<LiFiToken[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [popularTokens, setPopularTokens] = useState<LiFiToken[]>([]);
  const [isBackgroundLoading, setIsBackgroundLoading] = useState(false);
  const [cacheSize, setCacheSize] = useState(0);

  const chainConfig = CHAINS[chainKey];
  const chainId = chainConfig?.id;

  useBlockBodyScroll(isOpen);

  // ✅ Load tokens on open: Check cache first, show popular tokens instantly
  // Background sync continues in background (non-blocking)
  useEffect(() => {
    if (isOpen && chainId) {
      loadTokensFromCache(); // Instant from cache if available
      // Start background sync in background (non-blocking, doesn't block UI)
      syncTokensInBackground();
    } else {
      setSearchQuery('');
      setTokens([]);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, chainId]);

  // ✅ INSTANT client-side search from cache (no API calls!)
  useEffect(() => {
    if (!isOpen || !chainId) return;

    const timeoutId = setTimeout(async () => {
      if (searchQuery.trim().length >= 2) {
        await performClientSideSearch(searchQuery);
      } else if (searchQuery.trim().length === 0) {
        // Reset to cached tokens when search is cleared
        await loadTokensFromCache();
      }
    }, 150); // Faster debounce for client-side search

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, isOpen, chainId]);

  // ✅ Load tokens from IndexedDB cache (instant!)
  const loadTokensFromCache = async () => {
    if (!chainId) return;

    setIsLoading(true);
    setError(null);

    try {
      logger.log(`💾 [TokenSearchModal] Loading tokens from cache for chain ${chainId}...`);
      
      const cachedTokens = await tokenCache.getTokens(chainId);
      const cacheSize = await tokenCache.getCacheSize(chainId);
      setCacheSize(cacheSize);

      if (cachedTokens.length > 0) {
        // Filter excluded tokens
        const filtered = cachedTokens.filter(token => 
          !excludeTokens.some(excluded => excluded.toLowerCase() === token.address.toLowerCase())
        );

        // Sort: popular first
        const popularSymbols = ['USDC', 'USDT', 'SOL', 'WETH', 'WBTC', 'DAI', 'RAY', 'BONK', 'JUP', 'WIF', 'TRUMP', 'MATIC', 'BNB', 'AVAX'];
        const popular = filtered.filter(t => 
          popularSymbols.includes(t.symbol.toUpperCase())
        ).sort((a, b) => {
          const aIndex = popularSymbols.indexOf(a.symbol.toUpperCase());
          const bIndex = popularSymbols.indexOf(b.symbol.toUpperCase());
          return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
        });

        const others = filtered.filter(t => 
          !popularSymbols.includes(t.symbol.toUpperCase())
        ).sort((a, b) => a.symbol.localeCompare(b.symbol));

        setPopularTokens(popular);
        setTokens([...popular, ...others]);
        logger.log(`✅ [TokenSearchModal] Loaded ${filtered.length} tokens from cache (instant!)`);
      } else {
        // Cache empty, load popular tokens as fallback
        await loadPopularTokensFallback();
      }
    } catch (err: any) {
      logger.error('❌ [TokenSearchModal] Cache load error:', err);
      await loadPopularTokensFallback();
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ Fallback: Load popular tokens when cache is empty
  const loadPopularTokensFallback = async () => {
    if (!chainId) return;

    try {
      logger.log(`⚡ [TokenSearchModal] Loading popular tokens (fallback)...`);

      if (chainKey === 'solana') {
        const jupiterResponse = await fetch('/api/jupiter-tokens');
        if (jupiterResponse.ok) {
          const jupiterTokens: any[] = await jupiterResponse.json();
          const popularSymbols = ['USDC', 'USDT', 'SOL', 'RAY', 'BONK', 'JUP', 'WIF', 'JTO', 'PYTH', 'ORCA', 'TRUMP', 'MNGO'];
          const popular = jupiterTokens
            .filter(t => t.address && t.symbol && popularSymbols.includes(t.symbol.toUpperCase()))
            .slice(0, 50)
            .map(t => ({
              address: t.address,
              symbol: t.symbol,
              name: t.name || t.symbol,
              decimals: t.decimals || 9,
              chainId: chainId,
              logoURI: t.logoURI || '',
              priceUSD: '0',
            }));

          const filtered = popular.filter(token => 
            !excludeTokens.some(excluded => excluded.toLowerCase() === token.address.toLowerCase())
          );

          setPopularTokens(filtered);
          setTokens(filtered);
        }
      } else if (chainKey === 'ethereum') {
        const ethereumResponse = await fetch('/api/ethereum-tokens');
        if (ethereumResponse.ok) {
          const ethereumTokens: any[] = await ethereumResponse.json();
          const popularSymbols = ['USDT', 'USDC', 'WBTC', 'LINK', 'DAI', 'UNI', 'WETH'];
          const popular = ethereumTokens
            .filter(t => t.address && t.symbol && popularSymbols.includes(t.symbol.toUpperCase()))
            .slice(0, 50)
            .map(t => ({
              address: t.address.toLowerCase(),
              symbol: t.symbol,
              name: t.name || t.symbol,
              decimals: t.decimals || 18,
              chainId: chainId,
              logoURI: t.logoURI || '',
              priceUSD: '0',
            }));

          const filtered = popular.filter(token => 
            !excludeTokens.some(excluded => excluded.toLowerCase() === token.address.toLowerCase())
          );

          setPopularTokens(filtered);
          setTokens(filtered);
        }
      }
    } catch (error) {
      logger.error('❌ [TokenSearchModal] Fallback load failed:', error);
    }
  };

  // ✅ Background sync: Load ALL tokens in background and cache them
  const syncTokensInBackground = async () => {
    if (!chainId || isBackgroundLoading) return;

    setIsBackgroundLoading(true);

    try {
      logger.log(`🔄 [TokenSearchModal] Starting background token sync for ${chainKey}...`);

      let allTokens: any[] = [];

      if (chainKey === 'solana') {
        const jupiterResponse = await fetch('/api/jupiter-tokens');
        if (jupiterResponse.ok) {
          allTokens = await jupiterResponse.json();
          logger.log(`🪐 [TokenSearchModal] Fetched ${allTokens.length} tokens from Jupiter`);
        }
      } else if (chainKey === 'ethereum') {
        const ethereumResponse = await fetch('/api/ethereum-tokens');
        if (ethereumResponse.ok) {
          allTokens = await ethereumResponse.json();
          logger.log(`🔷 [TokenSearchModal] Fetched ${allTokens.length} tokens from CoinGecko`);
        }
      } else {
        // Other chains: Try Li.Fi
        const response = await fetch(`/api/lifi/tokens?chainIds=${chainId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.tokens && data.tokens[chainId.toString()]) {
            allTokens = data.tokens[chainId.toString()] || [];
          }
        }
      }

      if (allTokens.length > 0) {
        // Convert to LiFiToken format
        const convertedTokens = allTokens
          .filter(t => t.address && t.symbol)
          .map(t => ({
            address: chainKey === 'ethereum' ? t.address.toLowerCase() : t.address,
            symbol: t.symbol,
            name: t.name || t.symbol,
            decimals: t.decimals || (chainKey === 'ethereum' ? 18 : 9),
            chainId: chainId,
            logoURI: t.logoURI || '',
            priceUSD: '0',
          }));

        // Store in cache
        await tokenCache.storeTokens(chainId, convertedTokens);
        logger.log(`✅ [TokenSearchModal] Cached ${convertedTokens.length} tokens in background`);

        // Update cache size
        const newCacheSize = await tokenCache.getCacheSize(chainId);
        setCacheSize(newCacheSize);

        // If no search query, refresh tokens from cache
        if (!searchQuery.trim()) {
          await loadTokensFromCache();
        }
      }
    } catch (err: any) {
      logger.error('❌ [TokenSearchModal] Background sync failed:', err);
    } finally {
      setIsBackgroundLoading(false);
    }
  };

  // ✅ SMART SEARCH: Try cache first (instant), fallback to server-side (fast)
  // This ensures NO WAITING - always instant results!
  const performClientSideSearch = async (query: string) => {
    if (!chainId || !query || query.length < 2) return;

    setIsSearching(true);
    setError(null);

    try {
      // First, try cache (instant if available)
      const cacheSize = await tokenCache.getCacheSize(chainId);
      
      if (cacheSize > 100) {
        // Cache has tokens - use client-side search (instant!)
        logger.log(`🔍 [TokenSearchModal] Client-side search from cache (${cacheSize} tokens)...`);
        
        const searchResults = await tokenCache.searchTokens(chainId, query, 200);
        
        const filtered = searchResults.filter(token => 
          !excludeTokens.some(excluded => excluded.toLowerCase() === token.address.toLowerCase())
        );

        setTokens(filtered);
        setPopularTokens([]);
        logger.log(`✅ [TokenSearchModal] Found ${filtered.length} tokens (instant from cache!)`);
      } else {
        // Cache empty or small - use server-side search (fast, no waiting!)
        logger.log(`🔍 [TokenSearchModal] Cache empty (${cacheSize} tokens) - using server-side search...`);
        await performServerSideSearch(query);
      }
    } catch (err: any) {
      logger.error('❌ [TokenSearchModal] Client-side search error:', err);
      // Fallback to server-side search if cache fails
      await performServerSideSearch(query);
    } finally {
      setIsSearching(false);
    }
  };

  // ✅ Server-side search: Fast fallback when cache is empty
  // Searches ALL tokens server-side - no waiting for cache!
  const performServerSideSearch = async (query: string) => {
    if (!chainId) return;

    try {
      logger.log(`🔍 [TokenSearchModal] Server-side search for "${query}" on ${chainKey}...`);
      
      const response = await fetch(`/api/tokens/search?q=${encodeURIComponent(query)}&chain=${chainKey}&limit=200`);
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();
      const searchResults: LiFiToken[] = (data.tokens || []).map((t: any) => ({
        address: t.address,
        symbol: t.symbol,
        name: t.name || t.symbol,
        decimals: t.decimals || (chainKey === 'ethereum' ? 18 : 9),
        chainId: chainId,
        logoURI: t.logoURI || '',
        priceUSD: '0',
      })).filter((token: LiFiToken) => 
        !excludeTokens.some(excluded => excluded.toLowerCase() === token.address.toLowerCase())
      );

      setTokens(searchResults);
      setPopularTokens([]);
      logger.log(`✅ [TokenSearchModal] Found ${searchResults.length} tokens via server-side search (fast!)`);
    } catch (err: any) {
      logger.error('❌ [TokenSearchModal] Server-side search failed:', err);
      setError('Search failed. Please try again.');
    }
  };

  // Filter tokens based on search query (including native token check)
  // ✅ No client-side filtering needed - server-side search handles it
  // When searching, tokens already contain only search results
  // When not searching, tokens contain popular tokens
  const filteredTokens = tokens;

  // Always show native token (it's always available for swaps)
  const shouldShowNative = true;

  const handleSelectNative = () => {
    onSelectToken('native');
    onClose();
  };

  const handleSelectToken = (token: LiFiToken) => {
    onSelectToken(token);
    onClose();
  };

  const isNativeSelected = selectedToken === 'native' || 
    (chainConfig && selectedToken === LiFiService.getNativeTokenAddress(chainId));

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto"
      >
        <div className="min-h-full flex flex-col">
          <div className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 pt-safe pb-safe">
            {/* Header */}
            <div className="pt-4 pb-2 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Select token</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>

            {/* Chain Info */}
            <div className="mb-4 flex items-center gap-3">
              {chainConfig?.logoUrl ? (
                <img 
                  src={chainConfig.logoUrl} 
                  alt={chainConfig.name}
                  className="w-6 h-6 rounded-full"
                />
              ) : (
                <span className="text-xl">{chainConfig?.icon}</span>
              )}
              <span className="text-sm font-medium text-gray-700">{chainConfig?.name}</span>
            </div>

            {/* Search Bar */}
            <div className="relative mb-4">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, symbol, or address"
                className="w-full pl-12 pr-4 py-3 bg-white border-2 border-gray-200 rounded-xl font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-500 transition-colors"
                autoFocus
              />
            </div>

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3"
              >
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-700">{error}</p>
                  <button
                    onClick={loadTokensFromCache}
                    className="mt-2 text-sm text-red-600 hover:text-red-700 underline"
                  >
                    Try again
                  </button>
                </div>
              </motion.div>
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                <span className="ml-3 text-gray-600">Loading tokens...</span>
              </div>
            )}

            {/* Token List */}
            {!isLoading && !error && (
              <div className="glass-card overflow-hidden">
                <div className="max-h-[60vh] overflow-y-auto">
                  {/* Native Token Option - Always show if no search, or if search matches */}
                  {chainConfig && shouldShowNative && (
                    <button
                      onClick={handleSelectNative}
                      className={`w-full px-4 py-4 flex items-center justify-between hover:bg-orange-50 transition-colors border-b border-gray-100 ${
                        isNativeSelected ? 'bg-orange-50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {chainConfig.logoUrl ? (
                          <img 
                            src={chainConfig.logoUrl} 
                            alt={chainConfig.nativeCurrency.symbol}
                            className="w-10 h-10 rounded-full flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center flex-shrink-0">
                            <span className="text-white font-bold text-sm">
                              {chainConfig.nativeCurrency.symbol[0]}
                            </span>
                          </div>
                        )}
                        <div className="text-left flex-1 min-w-0">
                          <div className="font-semibold text-gray-900">
                            {chainConfig.nativeCurrency.symbol}
                          </div>
                          <div className="text-sm text-gray-500 truncate">
                            {chainConfig.nativeCurrency.name}
                          </div>
                        </div>
                      </div>
                      {isNativeSelected && (
                        <Check className="w-5 h-5 text-orange-500 flex-shrink-0" />
                      )}
                    </button>
                  )}

                  {/* Popular Tokens Section */}
                  {!searchQuery && popularTokens.length > 0 && (
                    <>
                      <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          Popular
                        </span>
                      </div>
                      {popularTokens.map((token) => {
                        const isSelected = selectedToken === token.address;
                        return (
                          <button
                            key={token.address}
                            onClick={() => handleSelectToken(token)}
                            className={`w-full px-4 py-4 flex items-center justify-between hover:bg-orange-50 transition-colors border-b border-gray-100 ${
                              isSelected ? 'bg-orange-50' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              {token.logoURI ? (
                                <img 
                                  src={token.logoURI} 
                                  alt={token.symbol}
                                  className="w-10 h-10 rounded-full flex-shrink-0"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center flex-shrink-0">
                                  <span className="text-white font-bold text-sm">
                                    {token.symbol[0]}
                                  </span>
                                </div>
                              )}
                              <div className="text-left flex-1 min-w-0">
                                <div className="font-semibold text-gray-900">
                                  {token.symbol}
                                </div>
                                <div className="text-sm text-gray-500 truncate">
                                  {token.name}
                                </div>
                              </div>
                            </div>
                            {isSelected && (
                              <Check className="w-5 h-5 text-orange-500 flex-shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </>
                  )}

                  {/* All Tokens Section */}
                  {searchQuery ? (
                    <>
                      <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          {filteredTokens.length + 1} {(filteredTokens.length + 1) === 1 ? 'token' : 'tokens'} found
                        </span>
                      </div>
                      {filteredTokens.length === 0 ? (
                        <div className="px-4 py-4 text-center border-b border-gray-100">
                          <p className="text-sm text-gray-500">No other tokens found</p>
                          <p className="text-xs text-gray-400 mt-1">
                            Try a different search term
                          </p>
                        </div>
                      ) : (
                        filteredTokens.map((token) => {
                          const isSelected = selectedToken === token.address;
                          return (
                            <button
                              key={token.address}
                              onClick={() => handleSelectToken(token)}
                              className={`w-full px-4 py-4 flex items-center justify-between hover:bg-orange-50 transition-colors border-b border-gray-100 ${
                                isSelected ? 'bg-orange-50' : ''
                              }`}
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                {token.logoURI ? (
                                  <img 
                                    src={token.logoURI} 
                                    alt={token.symbol}
                                    className="w-10 h-10 rounded-full flex-shrink-0"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center flex-shrink-0">
                                    <span className="text-white font-bold text-sm">
                                      {token.symbol[0]}
                                    </span>
                                  </div>
                                )}
                                <div className="text-left flex-1 min-w-0">
                                  <div className="font-semibold text-gray-900">
                                    {token.symbol}
                                  </div>
                                  <div className="text-sm text-gray-500 truncate">
                                    {token.name}
                                  </div>
                                </div>
                              </div>
                              {isSelected && (
                                <Check className="w-5 h-5 text-orange-500 flex-shrink-0" />
                              )}
                            </button>
                          );
                        })
                      )}
                    </>
                  ) : (
                    <>
                      {tokens.filter(t => !popularTokens.includes(t)).length > 0 && (
                        <>
                          <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                              All tokens
                            </span>
                          </div>
                          {tokens
                            .filter(t => !popularTokens.includes(t))
                            .map((token) => {
                              const isSelected = selectedToken === token.address;
                              return (
                                <button
                                  key={token.address}
                                  onClick={() => handleSelectToken(token)}
                                  className={`w-full px-4 py-4 flex items-center justify-between hover:bg-orange-50 transition-colors border-b border-gray-100 ${
                                    isSelected ? 'bg-orange-50' : ''
                                  }`}
                                >
                                  <div className="flex items-center gap-3 flex-1 min-w-0">
                                    {token.logoURI ? (
                                      <img 
                                        src={token.logoURI} 
                                        alt={token.symbol}
                                        className="w-10 h-10 rounded-full flex-shrink-0"
                                        onError={(e) => {
                                          e.currentTarget.style.display = 'none';
                                        }}
                                      />
                                    ) : (
                                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center flex-shrink-0">
                                        <span className="text-white font-bold text-sm">
                                          {token.symbol[0]}
                                        </span>
                                      </div>
                                    )}
                                    <div className="text-left flex-1 min-w-0">
                                      <div className="font-semibold text-gray-900">
                                        {token.symbol}
                                      </div>
                                      <div className="text-sm text-gray-500 truncate">
                                        {token.name}
                                      </div>
                                    </div>
                                  </div>
                                  {isSelected && (
                                    <Check className="w-5 h-5 text-orange-500 flex-shrink-0" />
                                  )}
                                </button>
                              );
                            })}
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}


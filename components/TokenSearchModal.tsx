'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Loader2, Check, AlertCircle } from 'lucide-react';
import { CHAINS } from '@/lib/chains';
import { LiFiService, LiFiToken } from '@/lib/lifi-service';
import { logger } from '@/lib/logger';
import { useBlockBodyScroll } from '@/hooks/useBlockBodyScroll';

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

  const chainConfig = CHAINS[chainKey];
  const chainId = chainConfig?.id;

  useBlockBodyScroll(isOpen);

  // Fetch initial tokens when modal opens (only if no search query)
  useEffect(() => {
    if (isOpen && chainId) {
      if (!searchQuery.trim()) {
        // Only fetch initial tokens if no search query
        fetchTokens();
      }
    } else {
      setSearchQuery('');
      setTokens([]);
      setError(null);
    }
  }, [isOpen, chainId]);

  // Search tokens via API when user types (debounced)
  useEffect(() => {
    if (!isOpen || !chainId) return;

    const timeoutId = setTimeout(async () => {
      if (searchQuery.trim().length >= 2) {
        // Search via API when query is 2+ characters
        await searchTokens(searchQuery.trim());
      } else if (searchQuery.trim().length === 0) {
        // Reset to initial tokens when search is cleared
        await fetchTokens();
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchQuery, isOpen, chainId]);

  const fetchTokens = async () => {
    if (!chainId) return;

    setIsLoading(true);
    setError(null);

    try {
      logger.log(`🔍 [TokenSearchModal] Fetching tokens for chain ${chainId} (${chainKey})...`);

      // Fetch tokens via API route (server-side)
      const response = await fetch(`/api/lifi/tokens?chainIds=${chainId}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch tokens from API');
      }

      const data = await response.json();
      
      // Handle API errors gracefully
      if (!data.success) {
        logger.warn('⚠️ [TokenSearchModal] API returned error:', data.error);
        setError(data.error || 'Failed to load tokens');
        setPopularTokens([]);
        setTokens([]);
        setIsLoading(false);
        return;
      }

      let chainTokens: LiFiToken[] = [];
      
      if (data.tokens && data.tokens[chainId.toString()]) {
        const allTokens: Record<string, LiFiToken[]> = data.tokens;
        chainTokens = allTokens[chainId.toString()] || [];
        logger.log(`✅ [TokenSearchModal] Loaded ${chainTokens.length} tokens from Li.Fi API`);
      } else {
        // Fallback for Solana: Use Jupiter tokens
        if (chainKey === 'solana') {
          logger.log('🪐 [TokenSearchModal] Li.Fi returned no tokens for Solana, trying Jupiter fallback...');
          try {
            const jupiterResponse = await fetch('/api/jupiter-tokens');
            if (jupiterResponse.ok) {
              const jupiterTokens: any[] = await jupiterResponse.json();
              logger.log(`🪐 [TokenSearchModal] Got ${jupiterTokens.length} tokens from Jupiter`);
              
              // Convert Jupiter tokens to LiFiToken format
              chainTokens = jupiterTokens
                .filter(t => t.address && t.symbol) // Only valid tokens
                .map(t => ({
                  address: t.address,
                  symbol: t.symbol,
                  name: t.name || t.symbol,
                  decimals: t.decimals || 9,
                  chainId: chainId,
                  logoURI: t.logoURI || '',
                  priceUSD: '0',
                }))
                .slice(0, 1000); // Limit to first 1000 tokens for performance
              
              logger.log(`✅ [TokenSearchModal] Converted ${chainTokens.length} Jupiter tokens`);
            }
          } catch (jupiterError) {
            logger.error('❌ [TokenSearchModal] Jupiter fallback failed:', jupiterError);
          }
        }
        
        // Fallback for Ethereum: Use CoinGecko tokens
        if (chainKey === 'ethereum' && chainTokens.length === 0) {
          logger.log('🔷 [TokenSearchModal] Li.Fi returned no tokens for Ethereum, trying CoinGecko fallback...');
          try {
            const ethereumResponse = await fetch('/api/ethereum-tokens');
            if (ethereumResponse.ok) {
              const ethereumTokens: any[] = await ethereumResponse.json();
              logger.log(`🔷 [TokenSearchModal] Got ${ethereumTokens.length} tokens from CoinGecko`);
              
              // Convert Ethereum tokens to LiFiToken format
              chainTokens = ethereumTokens
                .filter(t => t.address && t.symbol) // Only valid tokens
                .map(t => ({
                  address: t.address.toLowerCase(), // Ensure lowercase for EVM
                  symbol: t.symbol,
                  name: t.name || t.symbol,
                  decimals: t.decimals || 18,
                  chainId: chainId,
                  logoURI: t.logoURI || '',
                  priceUSD: '0',
                }))
                .slice(0, 1000); // Limit to first 1000 tokens for performance
              
              logger.log(`✅ [TokenSearchModal] Converted ${chainTokens.length} Ethereum tokens`);
            }
          } catch (ethereumError) {
            logger.error('❌ [TokenSearchModal] Ethereum fallback failed:', ethereumError);
          }
        }
        
        if (chainTokens.length === 0) {
          logger.warn('⚠️ [TokenSearchModal] No tokens available for chain', chainId);
          // User can still select native token
          setPopularTokens([]);
          setTokens([]);
          setIsLoading(false);
          return;
        }
      }
      
      // Filter out excluded tokens
      const filteredTokens = chainTokens.filter(
        token => !excludeTokens.some(excluded => 
          excluded.toLowerCase() === token.address.toLowerCase()
        )
      );

      // Sort: popular tokens first (USDC, USDT, native equivalent), then alphabetically
      const popularSymbols = ['USDC', 'USDT', 'WETH', 'WBTC', 'DAI', 'MATIC', 'BNB', 'AVAX'];
      const popular = filteredTokens.filter(t => 
        popularSymbols.includes(t.symbol.toUpperCase())
      ).sort((a, b) => {
        const aIndex = popularSymbols.indexOf(a.symbol.toUpperCase());
        const bIndex = popularSymbols.indexOf(b.symbol.toUpperCase());
        return aIndex - bIndex;
      });
      
      const others = filteredTokens.filter(t => 
        !popularSymbols.includes(t.symbol.toUpperCase())
      ).sort((a, b) => a.symbol.localeCompare(b.symbol));

      setPopularTokens(popular);
      setTokens([...popular, ...others]);

      logger.log(`✅ [TokenSearchModal] Loaded ${filteredTokens.length} tokens for ${chainKey}`);
    } catch (err: any) {
      logger.error('❌ [TokenSearchModal] Failed to fetch tokens:', err);
      setError(err.message || 'Failed to load tokens. Please try again.');
      setTokens([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Search tokens via API
  const searchTokens = async (query: string) => {
    if (!chainId || !query || query.length < 2) return;

    setIsSearching(true);
    setError(null);

    try {
      logger.log(`🔍 [TokenSearchModal] Searching for "${query}" on ${chainKey}...`);

      const response = await fetch(`/api/tokens/search?q=${encodeURIComponent(query)}&chain=${chainKey}&limit=200`);
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const data = await response.json();
      const searchResults: LiFiToken[] = (data.tokens || []).map((t: any) => ({
        address: chainKey === 'ethereum' ? t.address.toLowerCase() : t.address,
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
      setPopularTokens([]); // Clear popular tokens when searching
      logger.log(`✅ [TokenSearchModal] Found ${searchResults.length} tokens matching "${query}"`);
    } catch (err: any) {
      logger.error('❌ [TokenSearchModal] Search failed:', err);
      setError('Search failed. Please try again.');
      setTokens([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Filter tokens (search is done via API, so tokens already contain results)
  const filteredTokens = useMemo(() => {
    // When searching, tokens already contain search results from API
    // When not searching, show all loaded tokens
    return tokens;
  }, [tokens]);

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
                    onClick={fetchTokens}
                    className="mt-2 text-sm text-red-600 hover:text-red-700 underline"
                  >
                    Try again
                  </button>
                </div>
              </motion.div>
            )}

            {/* Loading State */}
            {(isLoading || isSearching) && (
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


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
  const [allTokensLoaded, setAllTokensLoaded] = useState(false);

  const chainConfig = CHAINS[chainKey];
  const chainId = chainConfig?.id;

  useBlockBodyScroll(isOpen);

  // ✅ Load popular tokens on open (fast initial load)
  useEffect(() => {
    if (isOpen && chainId) {
      fetchPopularTokens();
      setAllTokensLoaded(false);
    } else {
      setSearchQuery('');
      setTokens([]);
      setError(null);
      setAllTokensLoaded(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, chainId]);

  // ✅ Debounced search: Search when user types (server-side, fast!)
  useEffect(() => {
    if (!isOpen || !chainId) return;

    const timeoutId = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        performSearch(searchQuery);
      } else if (searchQuery.trim().length === 0) {
        // Reset to popular tokens when search is cleared
        fetchPopularTokens();
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchQuery, isOpen, chainId]);

  // ✅ SMART LOADING: Load only popular tokens initially (fast!)
  const fetchPopularTokens = async () => {
    if (!chainId) return;

    setIsLoading(true);
    setError(null);

    try {
      logger.log(`⚡ [TokenSearchModal] Loading popular tokens for ${chainKey} (fast initial load)...`);

      // For Solana: Load top 200 popular tokens from Jupiter
      if (chainKey === 'solana') {
        try {
          const jupiterResponse = await fetch('/api/jupiter-tokens');
          if (jupiterResponse.ok) {
            const jupiterTokens: any[] = await jupiterResponse.json();
            
            // Get popular tokens first (top 200)
            const popularSymbols = ['USDC', 'USDT', 'SOL', 'RAY', 'BONK', 'JUP', 'WIF', 'JTO', 'PYTH', 'ORCA', 'MNGO', 'SAMO', 'COPE', 'STEP', 'MEDIA', 'ROPE', 'AKT', 'MAPS', 'FIDA', 'KIN', 'LINK', 'XRP', 'DOGE', 'SHIB', 'PEPE', 'FLOKI', 'BABYDOGE'];
            
            const popular = jupiterTokens
              .filter(t => t.address && t.symbol && popularSymbols.includes(t.symbol.toUpperCase()))
              .slice(0, 200)
              .map(t => ({
                address: t.address,
                symbol: t.symbol,
                name: t.name || t.symbol,
                decimals: t.decimals || 9,
                chainId: chainId,
                logoURI: t.logoURI || '',
                priceUSD: '0',
              }));

            // Also include first 100 tokens alphabetically for variety
            const others = jupiterTokens
              .filter(t => t.address && t.symbol && !popularSymbols.includes(t.symbol.toUpperCase()))
              .slice(0, 100)
              .map(t => ({
                address: t.address,
                symbol: t.symbol,
                name: t.name || t.symbol,
                decimals: t.decimals || 9,
                chainId: chainId,
                logoURI: t.logoURI || '',
                priceUSD: '0',
              }));

            const allPopular = [...popular, ...others]
              .filter(token => !excludeTokens.some(excluded => 
                excluded.toLowerCase() === token.address.toLowerCase()
              ));

            setPopularTokens(popular.filter(t => !excludeTokens.some(e => e.toLowerCase() === t.address.toLowerCase())));
            setTokens(allPopular);
            logger.log(`⚡ [TokenSearchModal] Loaded ${allPopular.length} popular tokens (fast!)`);
          }
        } catch (error) {
          logger.error('❌ [TokenSearchModal] Failed to load popular tokens:', error);
        }
      } 
      // For Ethereum: Load top 200 popular tokens
      else if (chainKey === 'ethereum') {
        try {
          const ethereumResponse = await fetch('/api/ethereum-tokens');
          if (ethereumResponse.ok) {
            const ethereumTokens: any[] = await ethereumResponse.json();
            
            const popularSymbols = ['USDT', 'USDC', 'WBTC', 'LINK', 'DAI', 'UNI', 'WETH', 'APE', 'SHIB', 'MATIC', 'AAVE', 'CRV', 'MKR', 'SNX', 'COMP', 'YFI', 'SUSHI', '1INCH'];
            
            const popular = ethereumTokens
              .filter(t => t.address && t.symbol && popularSymbols.includes(t.symbol.toUpperCase()))
              .slice(0, 200)
              .map(t => ({
                address: t.address.toLowerCase(),
                symbol: t.symbol,
                name: t.name || t.symbol,
                decimals: t.decimals || 18,
                chainId: chainId,
                logoURI: t.logoURI || '',
                priceUSD: '0',
              }));

            const others = ethereumTokens
              .filter(t => t.address && t.symbol && !popularSymbols.includes(t.symbol.toUpperCase()))
              .slice(0, 100)
              .map(t => ({
                address: t.address.toLowerCase(),
                symbol: t.symbol,
                name: t.name || t.symbol,
                decimals: t.decimals || 18,
                chainId: chainId,
                logoURI: t.logoURI || '',
                priceUSD: '0',
              }));

            const allPopular = [...popular, ...others]
              .filter(token => !excludeTokens.some(excluded => 
                excluded.toLowerCase() === token.address.toLowerCase()
              ));

            setPopularTokens(popular.filter(t => !excludeTokens.some(e => e.toLowerCase() === t.address.toLowerCase())));
            setTokens(allPopular);
            logger.log(`⚡ [TokenSearchModal] Loaded ${allPopular.length} popular tokens (fast!)`);
          }
        } catch (error) {
          logger.error('❌ [TokenSearchModal] Failed to load popular tokens:', error);
        }
      }
      // For other chains: Try Li.Fi first
      else {
        const response = await fetch(`/api/lifi/tokens?chainIds=${chainId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.tokens && data.tokens[chainId.toString()]) {
            const allTokens: LiFiToken[] = data.tokens[chainId.toString()] || [];
            const popularSymbols = ['USDC', 'USDT', 'WETH', 'WBTC', 'DAI'];
            const popular = allTokens.filter(t => popularSymbols.includes(t.symbol.toUpperCase())).slice(0, 50);
            const others = allTokens.filter(t => !popularSymbols.includes(t.symbol.toUpperCase())).slice(0, 150);
            
            const filtered = [...popular, ...others].filter(token => 
              !excludeTokens.some(excluded => excluded.toLowerCase() === token.address.toLowerCase())
            );
            
            setPopularTokens(popular);
            setTokens(filtered);
            logger.log(`⚡ [TokenSearchModal] Loaded ${filtered.length} tokens from Li.Fi`);
          }
        }
      }
    } catch (err: any) {
      logger.error('❌ [TokenSearchModal] Error fetching popular tokens:', err);
      setError(err.message || 'Failed to load tokens');
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ SERVER-SIDE SEARCH: Fast search without loading all tokens
  const performSearch = async (query: string) => {
    if (!query || query.length < 2) {
      // Reset to popular tokens when search is cleared
      await fetchPopularTokens();
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      logger.log(`🔍 [TokenSearchModal] Searching for "${query}" on ${chainKey}...`);
      
      const response = await fetch(`/api/tokens/search?q=${encodeURIComponent(query)}&chain=${chainKey}&limit=100`);
      
      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      const searchResults: LiFiToken[] = (data.tokens || []).map((t: any) => ({
        address: t.address,
        symbol: t.symbol,
        name: t.name || t.symbol,
        decimals: t.decimals || 9,
        chainId: chainId!,
        logoURI: t.logoURI || '',
        priceUSD: '0',
      })).filter((token: LiFiToken) => 
        !excludeTokens.some(excluded => excluded.toLowerCase() === token.address.toLowerCase())
      );

      setTokens(searchResults);
      setPopularTokens([]); // Clear popular when searching
      logger.log(`✅ [TokenSearchModal] Found ${searchResults.length} tokens matching "${query}"`);
    } catch (err: any) {
      logger.error('❌ [TokenSearchModal] Search error:', err);
      setError('Search failed. Please try again.');
    } finally {
      setIsSearching(false);
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
                    onClick={fetchPopularTokens}
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


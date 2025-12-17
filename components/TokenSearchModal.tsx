'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Loader2, Check, AlertCircle } from 'lucide-react';
import { CHAINS } from '@/lib/chains';
import { LiFiService, LiFiToken } from '@/lib/lifi-service';
import { logger } from '@/lib/logger';
import { useBlockBodyScroll } from '@/hooks/useBlockBodyScroll';
import { supabase } from '@/lib/supabase';

interface TokenSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  chainKey: string;
  selectedToken?: string;
  onSelectToken: (token: LiFiToken | 'native') => void;
  excludeTokens?: string[]; // Tokens to exclude (e.g., fromToken when selecting toToken)
  walletTokens?: Array<{ address: string; balance?: string; symbol?: string; name?: string; logo?: string; decimals?: number }>; // ✅ Tokens with balance from wallet (includes full token data)
  onlyShowTokensWithBalance?: boolean; // ✅ Only show tokens where user has balance > 0
}

export default function TokenSearchModal({
  isOpen,
  onClose,
  chainKey,
  selectedToken,
  onSelectToken,
  excludeTokens = [],
  walletTokens = [],
  onlyShowTokensWithBalance = false, // ✅ Default: show all tokens (for "to" token selection)
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
      // ✅ If onlyShowTokensWithBalance is true, use wallet tokens directly!
      // This ensures ALL tokens with balance are shown, even if they're not in Supabase
      if (onlyShowTokensWithBalance && walletTokens.length > 0) {
        logger.log(`🔍 [TokenSearchModal] Using wallet tokens directly (${walletTokens.length} tokens with balance)...`);
        
        // ✅ Check if native token should be included
        const hasNativeToken = walletTokens.some(wt => wt.address === 'native');
        const nativeTokenInfo = chainConfig?.nativeCurrency;
        
        // Fetch metadata for wallet tokens from Supabase
        const walletTokenAddresses = walletTokens
          .filter(wt => wt.address !== 'native' && parseFloat(wt.balance || '0') > 0)
          .map(wt => wt.address);
        
        // ✅ Always fetch metadata, even if only native token exists
        let tokenMetadata: any[] = [];
        if (walletTokenAddresses.length > 0) {
          // Fetch token metadata from Supabase for wallet tokens
          const { data, error: metadataError } = await supabase
            .from('token_registry')
            .select('*')
            .eq('chain_key', chainKey)
            .in('address', walletTokenAddresses);
          
          if (metadataError) {
            logger.warn('⚠️ [TokenSearchModal] Failed to fetch token metadata:', metadataError);
          } else {
            tokenMetadata = data || [];
          }
        }
        
        // Create a map of address -> metadata for quick lookup
        const metadataMap = new Map(
          tokenMetadata.map((t: any) => [
            chainKey === 'solana' ? t.address : t.address.toLowerCase(),
            t
          ])
        );
        
        // ✅ Start with native token if it exists
        const walletTokensList: LiFiToken[] = [];
        
        if (hasNativeToken && nativeTokenInfo) {
          // Fetch native token metadata from Supabase
          const nativeAddress = LiFiService.getNativeTokenAddress(chainId);
          const { data: nativeMetadata } = await supabase
            .from('token_registry')
            .select('*')
            .eq('chain_key', chainKey)
            .eq('address', nativeAddress)
            .single();
          
          walletTokensList.push({
            address: nativeAddress,
            symbol: nativeTokenInfo.symbol,
            name: nativeTokenInfo.name,
            decimals: nativeTokenInfo.decimals,
            chainId: chainId,
            logoURI: nativeMetadata?.logo_uri || chainConfig?.logoUrl || '',
            priceUSD: nativeMetadata?.price_usd?.toString() || '0',
          });
        }
        
        // Convert wallet tokens to LiFiToken format, using wallet data as PRIMARY source, Supabase as fallback
        walletTokens
          .filter(wt => wt.address !== 'native' && parseFloat(wt.balance || '0') > 0)
          .forEach(wt => {
            // Skip if already excluded
            if (excludeTokens.some(excluded => excluded.toLowerCase() === wt.address.toLowerCase())) {
              return;
            }
            
            // ✅ Use wallet token data as PRIMARY source (has logo, symbol, name from dashboard)
            // ✅ Supabase metadata as fallback/enhancement
            const metadata = metadataMap.get(chainKey === 'solana' ? wt.address : wt.address.toLowerCase());
            
            walletTokensList.push({
              address: chainKey === 'solana' ? wt.address : wt.address.toLowerCase(),
              // ✅ Use wallet token symbol/name/logo FIRST, then Supabase, then fallback
              symbol: wt.symbol || metadata?.symbol || 'UNKNOWN',
              name: wt.name || metadata?.name || 'Unknown Token',
              decimals: wt.decimals || metadata?.decimals || (chainKey === 'ethereum' ? 18 : 9),
              chainId: chainId,
              // ✅ Logo priority: wallet token logo > Supabase logo > empty
              logoURI: wt.logo || metadata?.logo_uri || '',
              priceUSD: metadata?.price_usd?.toString() || '0',
            });
          });
        
        // Sort: popular tokens first, then alphabetical
        const popularSymbols = ['USDC', 'USDT', 'WETH', 'WBTC', 'DAI', 'MATIC', 'BNB', 'AVAX', 'SOL', 'ETH'];
        const popular = walletTokensList.filter(t => 
          popularSymbols.includes(t.symbol.toUpperCase())
        ).sort((a, b) => {
          const aIndex = popularSymbols.indexOf(a.symbol.toUpperCase());
          const bIndex = popularSymbols.indexOf(b.symbol.toUpperCase());
          if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
          if (aIndex !== -1) return -1;
          if (bIndex !== -1) return 1;
          return a.symbol.localeCompare(b.symbol);
        });
        
        const others = walletTokensList.filter(t => 
          !popular.some(p => p.address.toLowerCase() === t.address.toLowerCase())
        ).sort((a, b) => a.symbol.localeCompare(b.symbol));
        
        setPopularTokens(popular);
        setTokens([...popular, ...others]);
        
        logger.log(`✅ [TokenSearchModal] Loaded ${walletTokensList.length} wallet tokens for ${chainKey} (native: ${hasNativeToken ? 'yes' : 'no'})`);
        return;
      }
      
      // ✅ Default: Fetch from Supabase (for "to" token selection or when no wallet tokens)
      logger.log(`🔍 [TokenSearchModal] Fetching popular tokens from Supabase for ${chainKey}...`);

      // ✅ NEW: Fetch popular tokens directly from Supabase (instant, no waiting!)
      const { data: popularData, error: popularError } = await supabase
        .rpc('get_popular_tokens', {
          p_chain_key: chainKey,
          p_limit: 20,
        });

      if (popularError) {
        logger.warn('⚠️ [TokenSearchModal] Failed to fetch popular tokens:', popularError);
      }

      // Also fetch all tokens (limited to 1000 for initial load)
      const { data: allTokensData, error: allTokensError } = await supabase
        .from('token_registry')
        .select('*')
        .eq('chain_key', chainKey)
        .order('is_popular', { ascending: false })
        .order('symbol', { ascending: true })
        .limit(1000);

      if (allTokensError) {
        logger.warn('⚠️ [TokenSearchModal] Failed to fetch all tokens:', allTokensError);
      }

      // Convert Supabase tokens to LiFiToken format
      const chainTokens: LiFiToken[] = (allTokensData || []).map((t: any) => ({
        address: chainKey === 'ethereum' || chainKey !== 'solana' ? t.address.toLowerCase() : t.address,
        symbol: t.symbol,
        name: t.name || t.symbol,
        decimals: t.decimals || (chainKey === 'ethereum' ? 18 : 9),
        chainId: chainId,
        logoURI: t.logo_uri || '',
        priceUSD: t.price_usd?.toString() || '0',
      }));

      // Filter out excluded tokens
      const filteredTokens = chainTokens.filter(token => 
        !excludeTokens.some(excluded => excluded.toLowerCase() === token.address.toLowerCase())
      );

      // Popular tokens (from RPC function or filter)
      const popular = filteredTokens.filter(t => 
        (popularData || []).some((p: any) => p.address.toLowerCase() === t.address.toLowerCase()) ||
        ['USDC', 'USDT', 'WETH', 'WBTC', 'DAI', 'MATIC', 'BNB', 'AVAX'].includes(t.symbol.toUpperCase())
      ).sort((a, b) => {
        const popularSymbols = ['USDC', 'USDT', 'WETH', 'WBTC', 'DAI', 'MATIC', 'BNB', 'AVAX'];
        const aIndex = popularSymbols.indexOf(a.symbol.toUpperCase());
        const bIndex = popularSymbols.indexOf(b.symbol.toUpperCase());
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        return a.symbol.localeCompare(b.symbol);
      });
      
      const others = filteredTokens.filter(t => 
        !popular.some(p => p.address.toLowerCase() === t.address.toLowerCase())
      ).sort((a, b) => a.symbol.localeCompare(b.symbol));

      setPopularTokens(popular);
      setTokens([...popular, ...others]);

      logger.log(`✅ [TokenSearchModal] Loaded ${filteredTokens.length} tokens from Supabase for ${chainKey}`);
    } catch (err: any) {
      logger.error('❌ [TokenSearchModal] Failed to fetch tokens:', err);
      setError(err.message || 'Failed to load tokens. Please try again.');
      setTokens([]);
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ NEW: Search tokens directly from Supabase (instant full-text search!)
  const searchTokens = async (query: string) => {
    if (!chainId || !query || query.length < 2) return;

    setIsSearching(true);
    setError(null);

    try {
      logger.log(`🔍 [TokenSearchModal] Searching Supabase for "${query}" on ${chainKey}...`);

      // Use Supabase RPC function for full-text search (instant!)
      // Limit to 50 (database will cap it), then deduplicate to ~20-30 best tokens
      const { data, error } = await supabase
        .rpc('search_tokens', {
          p_chain_key: chainKey,
          p_query: query,
          p_limit: 50, // Reduced from 200 - quality filtering + deduplication will show ~20-30 best
        });

      if (error) {
        throw error;
      }

      // Convert Supabase tokens to LiFiToken format with metadata for sorting
      interface TokenWithMetadata extends LiFiToken {
        _isPopular?: boolean;
        _isVerified?: boolean;
        _isOfficial?: boolean; // ⭐ Official token flag (highest priority!)
        _priceUsd?: number;
        _liquidityUsd?: number;
        _volume24hUsd?: number;
      }

      let searchResults: TokenWithMetadata[] = (data || []).map((t: any) => ({
        address: chainKey === 'ethereum' || chainKey !== 'solana' ? t.address.toLowerCase() : t.address,
        symbol: t.symbol,
        name: t.name || t.symbol,
        decimals: t.decimals || (chainKey === 'ethereum' ? 18 : 9),
        chainId: chainId,
        logoURI: t.logo_uri || '',
        priceUSD: t.price_usd?.toString() || '0',
        // Store metadata for sorting
        _isPopular: t.is_popular || false,
        _isVerified: t.is_verified || false,
        _isOfficial: t.is_official || false, // ⭐ Official token (highest priority!)
        _priceUsd: parseFloat(t.price_usd || '0'),
        _liquidityUsd: parseFloat(t.liquidity_usd || '0'),
        _volume24hUsd: parseFloat(t.volume_24h_usd || '0'),
      })).filter((token: TokenWithMetadata) => {
        // Exclude tokens in excludeTokens list
        if (excludeTokens.some(excluded => excluded.toLowerCase() === token.address.toLowerCase())) {
          return false;
        }
        
        // ✅ If onlyShowTokensWithBalance is true, only show tokens where user has balance > 0
        if (onlyShowTokensWithBalance && walletTokens.length > 0) {
          // For Solana, addresses are case-sensitive, so we need exact match OR case-insensitive match
          const walletToken = walletTokens.find(wt => {
            // Exact match first (for Solana)
            if (wt.address === token.address) return true;
            // Case-insensitive match (for EVM chains)
            return wt.address.toLowerCase() === token.address.toLowerCase();
          });
          // Include if token has balance > 0
          if (!walletToken || parseFloat(walletToken.balance || '0') <= 0) {
            return false;
          }
        }
        
        return true;
      });

      // ✅ DEDUPLICATION: Group by symbol, keep TOP 3 BEST tokens per symbol
      // This reduces 109 USDT tokens to top 3 best (like MetaMask shows multiple options)
      // We keep multiple per symbol to show variety (official, popular, high liquidity)
      const deduplicatedMap = new Map<string, TokenWithMetadata[]>();
      
      searchResults.forEach((token) => {
        const symbolKey = token.symbol.toUpperCase();
        const existing = deduplicatedMap.get(symbolKey) || [];
        
        // Keep top 3 tokens per symbol (official first, then best by liquidity/volume)
        if (existing.length < 3) {
          existing.push(token);
          existing.sort((a, b) => {
            if (a._isOfficial && !b._isOfficial) return -1;
            if (!a._isOfficial && b._isOfficial) return 1;
            const aLiq = a._liquidityUsd || 0;
            const bLiq = b._liquidityUsd || 0;
            return bLiq - aLiq;
          });
          deduplicatedMap.set(symbolKey, existing);
        } else {
          // Replace worst token if this one is better
          const worst = existing[existing.length - 1];
          if (isBetterToken(token, worst)) {
            existing[existing.length - 1] = token;
            existing.sort((a, b) => {
              if (a._isOfficial && !b._isOfficial) return -1;
              if (!a._isOfficial && b._isOfficial) return 1;
              const aLiq = a._liquidityUsd || 0;
              const bLiq = b._liquidityUsd || 0;
              return bLiq - aLiq;
            });
          }
        }
      });
      
      // Flatten: convert Map of arrays to single array
      let deduplicatedResults = Array.from(deduplicatedMap.values()).flat();
      
      // ✅ Additional client-side sorting to ensure logical ranking (like MetaMask)
      // Database already sorts, but we refine further for perfect results
      const queryLower = query.toLowerCase();
      deduplicatedResults.sort((a, b) => {
        // ⭐ 0. OFFICIAL TOKENS FIRST (HIGHEST PRIORITY - Like MetaMask!)
        if (a._isOfficial && !b._isOfficial) return -1;
        if (!a._isOfficial && b._isOfficial) return 1;
        
        // 1. Exact symbol match (most important after official)
        // "USDT" query should show "USDT" first, not "FIRST USDT" or "Tether USDT"
        const aExact = a.symbol.toLowerCase() === queryLower;
        const bExact = b.symbol.toLowerCase() === queryLower;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        
        // 2. Symbol starts with query (high priority, but after exact match)
        const aStarts = a.symbol.toLowerCase().startsWith(queryLower);
        const bStarts = b.symbol.toLowerCase().startsWith(queryLower);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        
        // 3. Name contains exact query (but symbol match is more important)
        const aNameExact = a.name.toLowerCase() === queryLower;
        const bNameExact = b.name.toLowerCase() === queryLower;
        if (aNameExact && !bNameExact) return -1;
        if (!aNameExact && bNameExact) return 1;
        
        // 4. Higher liquidity = more popular/established (OBJECTIVE METRIC - most reliable!)
        // This is better than manual flags because it's based on real trading data
        const aLiq = (a as any)._liquidityUsd || 0;
        const bLiq = (b as any)._liquidityUsd || 0;
        // Tier-based comparison (like database)
        const aLiqTier = aLiq > 1000000 ? 1 : aLiq > 100000 ? 2 : aLiq > 10000 ? 3 : 4;
        const bLiqTier = bLiq > 1000000 ? 1 : bLiq > 100000 ? 2 : bLiq > 10000 ? 3 : 4;
        if (aLiqTier !== bLiqTier) return aLiqTier - bLiqTier;
        // Fine-grained: higher liquidity within same tier
        if (aLiq > bLiq) return -1;
        if (aLiq < bLiq) return 1;
        
        // 5. Higher volume = actively traded (OBJECTIVE METRIC - shows real usage!)
        const aVol = (a as any)._volume24hUsd || 0;
        const bVol = (b as any)._volume24hUsd || 0;
        // Tier-based comparison (like database)
        const aVolTier = aVol > 500000 ? 1 : aVol > 50000 ? 2 : aVol > 5000 ? 3 : 4;
        const bVolTier = bVol > 500000 ? 1 : bVol > 50000 ? 2 : bVol > 5000 ? 3 : 4;
        if (aVolTier !== bVolTier) return aVolTier - bVolTier;
        // Fine-grained: higher volume within same tier
        if (aVol > bVol) return -1;
        if (aVol < bVol) return 1;
        
        // 6. Popular tokens (fallback if no liquidity/volume data)
        if (a._isPopular && !b._isPopular) return -1;
        if (!a._isPopular && b._isPopular) return 1;
        
        // 7. Verified tokens (fallback if no liquidity/volume data)
        if (a._isVerified && !b._isVerified) return -1;
        if (!a._isVerified && b._isVerified) return 1;
        
        // 8. Tokens with price data (active trading)
        const aPrice = a._priceUsd || 0;
        const bPrice = b._priceUsd || 0;
        if (aPrice > 0 && bPrice === 0) return -1;
        if (aPrice === 0 && bPrice > 0) return 1;
        if (aPrice > 0 && bPrice > 0 && aPrice !== bPrice) {
          return bPrice - aPrice; // Higher price = usually more established
        }
        
        // 9. Shorter symbol = usually better match (cleaner tokens have shorter symbols)
        // "USDT" is better than "FIRST USDT" or "Tether USDT"
        if (a.symbol.length !== b.symbol.length) {
          return a.symbol.length - b.symbol.length;
        }
        
        // 10. Shorter name = usually better match (cleaner tokens have shorter names)
        // "Tether USD" is better than "FIRST USDT" or "Tether USDT Token"
        if (a.name.length !== b.name.length) {
          return a.name.length - b.name.length;
        }
        
        // 11. Alphabetical by symbol (final tiebreaker)
        return a.symbol.localeCompare(b.symbol);
      });
      
      // Limit to top 50 results (after deduplication) - show more variety
      deduplicatedResults = deduplicatedResults.slice(0, 50);
      
      // Remove metadata before setting (clean up)
      const cleanResults: LiFiToken[] = deduplicatedResults.map(({ _isPopular, _isVerified, _isOfficial, _priceUsd, _liquidityUsd, _volume24hUsd, ...token }) => token);
      
      /**
       * Helper function to determine if token A is better than token B
       * Used for deduplication - keeps only the best token per symbol
       * ⭐ OFFICIAL TOKENS ALWAYS WIN (Like MetaMask!)
       */
      function isBetterToken(a: TokenWithMetadata, b: TokenWithMetadata): boolean {
        // ⭐ 0. OFFICIAL TOKENS ALWAYS WIN (highest priority!)
        if (a._isOfficial && !b._isOfficial) return true;
        if (!a._isOfficial && b._isOfficial) return false;
        
        // 1. Higher liquidity = better
        const aLiq = a._liquidityUsd || 0;
        const bLiq = b._liquidityUsd || 0;
        if (aLiq > bLiq) return true;
        if (aLiq < bLiq) return false;
        
        // 2. Higher volume = better
        const aVol = a._volume24hUsd || 0;
        const bVol = b._volume24hUsd || 0;
        if (aVol > bVol) return true;
        if (aVol < bVol) return false;
        
        // 3. Verified = better
        if (a._isVerified && !b._isVerified) return true;
        if (!a._isVerified && b._isVerified) return false;
        
        // 4. Popular = better
        if (a._isPopular && !b._isPopular) return true;
        if (!a._isPopular && b._isPopular) return false;
        
        // 5. Higher price = better
        const aPrice = a._priceUsd || 0;
        const bPrice = b._priceUsd || 0;
        if (aPrice > bPrice) return true;
        if (aPrice < bPrice) return false;
        
        // 6. Shorter name = usually better (less spam)
        if (a.name.length < b.name.length) return true;
        if (a.name.length > b.name.length) return false;
        
        // 7. Alphabetical (deterministic tie-breaker)
        return a.address < b.address;
      }

      setTokens(cleanResults);
      setPopularTokens([]); // Clear popular tokens when searching
      logger.log(`✅ [TokenSearchModal] Found ${cleanResults.length} quality tokens matching "${query}" (${data?.length || 0} before deduplication, filtered by quality!)`);
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
            {!isLoading && !isSearching && !error && (
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
                              {token.logoURI && token.logoURI.trim() ? (
                                <img 
                                  src={token.logoURI} 
                                  alt={token.symbol}
                                  className="w-10 h-10 rounded-full flex-shrink-0 object-cover"
                                  onError={(e) => {
                                    // Fallback to gradient with first letter
                                    const target = e.currentTarget;
                                    target.style.display = 'none';
                                    if (target.parentElement) {
                                      const fallback = document.createElement('div');
                                      fallback.className = 'w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center flex-shrink-0';
                                      fallback.innerHTML = `<span class="text-white font-bold text-sm">${token.symbol[0]}</span>`;
                                      target.parentElement.insertBefore(fallback, target);
                                    }
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
                              {token.logoURI && token.logoURI.trim() ? (
                                <img 
                                  src={token.logoURI} 
                                  alt={token.symbol}
                                  className="w-10 h-10 rounded-full flex-shrink-0 object-cover"
                                  onError={(e) => {
                                    // Fallback to gradient with first letter
                                    const target = e.currentTarget;
                                    target.style.display = 'none';
                                    if (target.parentElement) {
                                      const fallback = document.createElement('div');
                                      fallback.className = 'w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center flex-shrink-0';
                                      fallback.innerHTML = `<span class="text-white font-bold text-sm">${token.symbol[0]}</span>`;
                                      target.parentElement.insertBefore(fallback, target);
                                    }
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
                              {token.logoURI && token.logoURI.trim() ? (
                                <img 
                                  src={token.logoURI} 
                                  alt={token.symbol}
                                  className="w-10 h-10 rounded-full flex-shrink-0 object-cover"
                                  onError={(e) => {
                                    // Fallback to gradient with first letter
                                    const target = e.currentTarget;
                                    target.style.display = 'none';
                                    if (target.parentElement) {
                                      const fallback = document.createElement('div');
                                      fallback.className = 'w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center flex-shrink-0';
                                      fallback.innerHTML = `<span class="text-white font-bold text-sm">${token.symbol[0]}</span>`;
                                      target.parentElement.insertBefore(fallback, target);
                                    }
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


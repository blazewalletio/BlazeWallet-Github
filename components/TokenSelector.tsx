'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, Loader2, CheckCircle, Search, Plus } from 'lucide-react';
import { useWalletStore } from '@/lib/wallet-store';
import { CHAINS } from '@/lib/chains';
import { Token } from '@/lib/types';
import { ethers } from 'ethers';
import { PublicKey } from '@solana/web3.js';
import { getSPLTokenMetadata } from '@/lib/spl-token-metadata';
import { getCurrencyLogoSync } from '@/lib/currency-logo-service';
import { logger } from '@/lib/logger';

interface TokenSelectorProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchableToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
}

export default function TokenSelector({ isOpen, onClose }: TokenSelectorProps) {
  const { currentChain, addToken, tokens } = useWalletStore();
  const [customAddress, setCustomAddress] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchableToken[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchInfo, setSearchInfo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const chainConfig = CHAINS[currentChain];
  const isSolana = currentChain === 'solana';
  const isBitcoinFork = ['bitcoin', 'litecoin', 'dogecoin', 'bitcoincash', 'dash'].includes(currentChain);
  // EVM chains are all chains that have an 'id' and are not Solana or Bitcoin forks
  const isEVM = chainConfig && !isSolana && !isBitcoinFork;

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setCustomAddress('');
      setSearchQuery('');
      setSearchResults([]);
      setSearchInfo(null);
      setError(null);
      setSuccess(false);
    }
  }, [isOpen]);

  const normalizeAddress = (address: string): string => {
    return isSolana ? address : address.toLowerCase();
  };

  const isNativeTokenAddress = (address: string): boolean => {
    if (address === '0x0000000000000000000000000000000000000000') return true;
    if (isSolana && address === 'So11111111111111111111111111111111111111112') return true;
    return false;
  };

  // Check if token already exists
  const isTokenAlreadyAdded = (address: string): boolean => {
    const normalizedAddress = normalizeAddress(address);
    return tokens.some(token => normalizeAddress(token.address) === normalizedAddress);
  };

  useEffect(() => {
    if (!isOpen || isBitcoinFork) return;

    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchResults([]);
      setSearchInfo(null);
      return;
    }

    let isCancelled = false;
    const runSearch = async () => {
      setIsSearching(true);
      setError(null);
      setSearchInfo(null);
      try {
        const response = await fetch(
          `/api/tokens/search?chain=${encodeURIComponent(currentChain)}&q=${encodeURIComponent(query)}&limit=40`,
          { signal: AbortSignal.timeout(12000) }
        );
        const payload = await response.json();

        const apiTokens = Array.isArray(payload?.tokens) ? payload.tokens : [];
        const info = typeof payload?.info === 'string' ? payload.info : null;
        const sortedResults = apiTokens
          .filter((token: SearchableToken) => !isNativeTokenAddress(token.address))
          .filter((token: SearchableToken) => !isTokenAlreadyAdded(token.address));

        if (!isCancelled) {
          setSearchResults(sortedResults);
          setSearchInfo(info);
        }
      } catch (searchError) {
        logger.error('❌ Token search failed:', searchError);
        if (!isCancelled) {
          setSearchResults([]);
          setSearchInfo('Search temporarily unavailable. You can still add by contract address.');
        }
      } finally {
        if (!isCancelled) {
          setIsSearching(false);
        }
      }
    };

    const timeoutId = setTimeout(runSearch, 250);
    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, [searchQuery, isOpen, currentChain, isBitcoinFork, tokens]);

  const handleAddFromSearch = async (candidate: SearchableToken) => {
    if (isTokenAlreadyAdded(candidate.address)) {
      setError('This token has already been added to your wallet');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setSuccess(false);
    try {
      if (isSolana) {
        await handleAddSolanaToken(candidate.address);
      } else if (isEVM) {
        await handleAddEVMToken(candidate.address);
      } else {
        setError('Token imports not supported for this chain');
      }
    } catch (err: any) {
      logger.error('❌ Error adding token from search:', err);
      setError(err.message || 'Failed to add token');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddCustomToken = async () => {
    const trimmedAddress = customAddress.trim();
    
    if (!trimmedAddress) {
      setError('Please enter a token address');
      return;
    }

    // Check for duplicates
    if (isTokenAlreadyAdded(trimmedAddress)) {
      setError('This token has already been added to your wallet');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      if (isSolana) {
        await handleAddSolanaToken(trimmedAddress);
      } else if (isEVM) {
        await handleAddEVMToken(trimmedAddress);
      } else {
        setError('Token imports not supported for this chain');
      }
    } catch (err: any) {
      logger.error('❌ Error adding token:', err);
      setError(err.message || 'Failed to add token');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSolanaToken = async (address: string) => {
    try {
      // Validate Solana address
      const mintAddress = new PublicKey(address);
      
      logger.log('🔍 Fetching SPL token metadata:', mintAddress.toBase58());
      
      // Fetch metadata using our 7-tier system
      const metadata = await getSPLTokenMetadata(mintAddress.toBase58());
      
      // Get proper logo using our currency logo service
      const logo = getCurrencyLogoSync(metadata.symbol) || metadata.logoURI || '/crypto-solana.png';
      
      const token: Token = {
        address: mintAddress.toBase58(),
        symbol: metadata.symbol,
        name: metadata.name,
        decimals: metadata.decimals,
        logo,
      };

      logger.log('✅ SPL token metadata fetched:', token);
      
      addToken(token);
      setSuccess(true);
      setCustomAddress('');
      
      // Auto-close after success
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      logger.error('❌ Failed to add Solana token:', err);
      throw new Error('Invalid SPL token address or token not found');
    }
  };

  const handleAddEVMToken = async (address: string) => {
    try {
      // Validate and checksum EVM address
      if (!ethers.isAddress(address)) {
        throw new Error('Invalid token address');
      }

      // Get checksummed address
      const checksummedAddress = ethers.getAddress(address);

      const rpcUrl = chainConfig.rpcUrl;
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      
      const tokenContract = new ethers.Contract(
        checksummedAddress,
        [
          'function name() view returns (string)',
          'function symbol() view returns (string)',
          'function decimals() view returns (uint8)',
        ],
        provider
      );

      logger.log('🔍 Fetching ERC20 token metadata:', checksummedAddress);

      const [name, symbol, decimals] = await Promise.all([
        tokenContract.name(),
        tokenContract.symbol(),
        tokenContract.decimals(),
      ]);

      // Get proper logo using our currency logo service
      const logo = getCurrencyLogoSync(symbol) || '/crypto-eth.png';

      const token: Token = {
        address: checksummedAddress,
        symbol,
        name,
        decimals: Number(decimals),
        logo,
      };

      logger.log('✅ ERC20 token metadata fetched:', token);
      
      addToken(token);
      setSuccess(true);
      setCustomAddress('');
      
      // Auto-close after success
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      logger.error('❌ Failed to add EVM token:', err);
      throw new Error('Invalid token address or unable to fetch token data');
    }
  };

  // Handle Enter key press
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isLoading && customAddress.trim()) {
      handleAddCustomToken();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          />
          
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] overflow-hidden"
          >
            <div className="glass-card rounded-t-3xl p-6 overflow-y-auto max-h-[85vh]">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Add token</h2>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={onClose}
                  className="glass p-2 rounded-lg hover:bg-theme-bg-secondary"
                >
                  <X className="w-5 h-5" />
                </motion.button>
              </div>

              {/* Chain Info */}
              <div className="glass-card bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border border-orange-500/20 mb-6">
                <div className="flex items-center gap-3">
                  <img 
                    src={chainConfig?.logoUrl || '/crypto-solana.png'} 
                    alt={chainConfig?.name}
                    className="w-10 h-10 rounded-full"
                  />
                  <div>
                    <p className="font-semibold text-gray-900">{chainConfig?.name || currentChain}</p>
                    <p className="text-xs text-gray-600">
                      {isSolana && 'SPL Token (Solana)'}
                      {isEVM && `ERC20 Token (${chainConfig?.name})`}
                      {isBitcoinFork && 'Native tokens only'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Bitcoin Fork Warning */}
              {isBitcoinFork && (
                <div className="glass-card bg-blue-500/10 border border-blue-500/20 mb-6">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-gray-700">
                      <p className="font-semibold mb-1">Native chain only</p>
                      <p className="text-xs text-gray-600">
                        {chainConfig?.name} doesn't support custom tokens. You can only send and receive native {chainConfig?.nativeCurrency.symbol}.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Success Message */}
              {success && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="glass-card bg-emerald-500/10 border border-emerald-500/20 mb-6"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    <div className="text-sm text-emerald-700">
                      <p className="font-semibold">Token added successfully!</p>
                      <p className="text-xs text-emerald-600">Check your Assets tab to view the token.</p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Instructions */}
              {!isBitcoinFork && !success && (
                <div className="glass-card bg-blue-500/10 border border-blue-500/20 mb-6">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-gray-700">
                      <p className="font-semibold mb-1">How to add a token</p>
                      <p className="text-xs text-gray-600">
                        {isSolana && 'Enter the SPL token mint address below. The token will appear in your Assets after adding.'}
                        {isEVM && 'Enter the ERC20 contract address below. The token will appear in your Assets after adding.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Custom Token Address */}
              {!isBitcoinFork && (
                <div className="space-y-4">
                  {/* Search tokens by name/symbol */}
                  {!success && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Search token by name or ticker
                      </label>
                      <div className="relative">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input aria-label="Search token"
                          type="text"
                          value={searchQuery}
                          onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setError(null);
                            setSuccess(false);
                          }}
                          placeholder="e.g. USDC, Tether, BONK"
                          className="input-field text-sm pl-10"
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck="false"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Search is scoped to the selected network: {chainConfig?.name || currentChain}
                      </p>

                      {searchQuery.trim().length >= 2 && (
                        <div className="mt-3 glass-card border border-gray-200 overflow-hidden">
                          {isSearching ? (
                            <div className="p-4 flex items-center justify-center gap-2 text-sm text-gray-600">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Searching tokens...</span>
                            </div>
                          ) : searchResults.length > 0 ? (
                            <div className="max-h-64 overflow-y-auto divide-y divide-gray-100">
                              {searchResults.map((token) => (
                                <div
                                  key={`${currentChain}-${token.address}`}
                                  className="px-3 py-3 flex items-center justify-between gap-3 hover:bg-gray-50/80 transition-colors"
                                >
                                  <div className="min-w-0 flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600 overflow-hidden flex-shrink-0">
                                      <img
                                        src={token.logoURI || getCurrencyLogoSync(token.symbol) || '/crypto-placeholder.png'}
                                        alt={token.symbol}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                          e.currentTarget.style.display = 'none';
                                          if (e.currentTarget.parentElement) {
                                            e.currentTarget.parentElement.textContent = token.symbol?.slice(0, 1)?.toUpperCase() || '?';
                                          }
                                        }}
                                      />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="text-sm font-semibold text-gray-900 truncate">
                                        {token.symbol}
                                      </div>
                                      <div className="text-xs text-gray-500 truncate">
                                        {token.name}
                                      </div>
                                    </div>
                                  </div>
                                  <motion.button
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() => handleAddFromSearch(token)}
                                    disabled={isLoading || isTokenAlreadyAdded(token.address)}
                                    className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-orange-200 bg-white text-orange-600 hover:bg-orange-50 hover:border-orange-300 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5 shadow-sm"
                                  >
                                    {isTokenAlreadyAdded(token.address) ? (
                                      <>
                                        <CheckCircle className="w-3.5 h-3.5" />
                                        Added
                                      </>
                                    ) : (
                                      <>
                                        <Plus className="w-3.5 h-3.5" />
                                        Add token
                                      </>
                                    )}
                                  </motion.button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-4 text-center text-xs text-gray-500">
                              No tokens found on this network for "{searchQuery.trim()}".
                            </div>
                          )}
                        </div>
                      )}
                      {searchInfo && (
                        <p className="text-xs text-gray-500 mt-2">{searchInfo}</p>
                      )}
                    </div>
                  )}

                  {!success && (
                    <div className="flex items-center gap-2">
                      <div className="h-px bg-gray-200 flex-1" />
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">or add by address</span>
                      <div className="h-px bg-gray-200 flex-1" />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      {isSolana && 'SPL Token Mint Address'}
                      {isEVM && 'ERC20 Contract Address'}
                    </label>
                    <input aria-label="Text input"
                      type="text"
                      value={customAddress}
                      onChange={(e) => {
                        setCustomAddress(e.target.value);
                        setError(null);
                        setSuccess(false);
                      }}
                      onKeyPress={handleKeyPress}
                      onPaste={(e) => {
                        // Clean up pasted content
                        const pastedText = e.clipboardData.getData('text');
                        const cleaned = pastedText.trim();
                        setCustomAddress(cleaned);
                        setError(null);
                        setSuccess(false);
                        e.preventDefault();
                      }}
                      placeholder={isSolana ? 'Token mint address (e.g., EPjFWdd5...)' : '0x...'}
                      className="input-field text-sm font-mono"
                      disabled={isLoading || success}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck="false"
                    />
                  </div>

                  {/* Error Message */}
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="glass-card bg-red-500/10 border border-red-500/20"
                    >
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-red-700">{error}</p>
                      </div>
                    </motion.div>
                  )}

                  {/* Add Button */}
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={handleAddCustomToken}
                    disabled={isLoading || !customAddress.trim() || success}
                    className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Adding token...</span>
                      </div>
                    ) : success ? (
                      <div className="flex items-center justify-center gap-2">
                        <CheckCircle className="w-5 h-5" />
                        <span>Token added!</span>
                      </div>
                    ) : (
                      'Add token'
                    )}
                  </motion.button>

                  {/* Help Text */}
                  {!success && (
                    <div className="text-center">
                      <p className="text-xs text-gray-500">
                        Token not appearing? Check the contract address and try again.
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Press Enter or tap the button to add
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowDown, Flame, AlertCircle, Loader2, RefreshCw, CheckCircle, Repeat, TrendingUp, Zap, ShieldCheck } from 'lucide-react';
import { useWalletStore } from '@/lib/wallet-store';
import { useBlockBodyScroll } from '@/hooks/useBlockBodyScroll';
import { CHAINS, POPULAR_TOKENS } from '@/lib/chains';
import { SwapService } from '@/lib/swap-service';
import { ethers } from 'ethers';
import { logger } from '@/lib/logger';

interface SwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  // AI Assistant pre-fill data
  prefillData?: {
    fromToken?: string;
    toToken?: string;
    amount?: string;
  };
}

type SwapProvider = '1inch' | 'price-estimate';

export default function SwapModal({ isOpen, onClose, prefillData }: SwapModalProps) {
  const { address, currentChain, balance, wallet } = useWalletStore();
  const [fromToken, setFromToken] = useState<string>('native');
  const [toToken, setToToken] = useState<string>('');
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [quote, setQuote] = useState<any>(null);
  const [swapProvider, setSwapProvider] = useState<SwapProvider>('price-estimate');

  const chain = CHAINS[currentChain];
  const popularTokens = POPULAR_TOKENS[currentChain] || [];

  // Block body scroll when overlay is open
  useBlockBodyScroll(isOpen);

  // Set default toToken when modal opens
  useEffect(() => {
    if (isOpen && !toToken && popularTokens.length > 0) {
      setToToken(popularTokens[0].address);
    }
  }, [isOpen, popularTokens]);

  // ✅ AI Assistant Pre-fill Effect
  useEffect(() => {
    if (isOpen && prefillData) {
      logger.log('🤖 [SwapModal] Applying AI pre-fill data:', prefillData);
      
      // Pre-fill fromToken
      if (prefillData.fromToken) {
        const tokenSymbol = prefillData.fromToken.toUpperCase();
        
        // Check if it's native token
        if (tokenSymbol === chain?.nativeCurrency.symbol.toUpperCase()) {
          setFromToken('native');
          logger.log('🤖 [SwapModal] Set from token: native');
        } else {
          // Find matching token in popular tokens
          const matchingToken = popularTokens.find(
            token => token.symbol.toUpperCase() === tokenSymbol
          );
          if (matchingToken) {
            setFromToken(matchingToken.address);
            logger.log('🤖 [SwapModal] Set from token:', matchingToken.symbol);
          }
        }
      }
      
      // Pre-fill toToken
      if (prefillData.toToken) {
        const tokenSymbol = prefillData.toToken.toUpperCase();
        
        // Check if it's native token
        if (tokenSymbol === chain?.nativeCurrency.symbol.toUpperCase()) {
          setToToken('native');
          logger.log('🤖 [SwapModal] Set to token: native');
        } else {
          // Find matching token in popular tokens
          const matchingToken = popularTokens.find(
            token => token.symbol.toUpperCase() === tokenSymbol
          );
          if (matchingToken) {
            setToToken(matchingToken.address);
            logger.log('🤖 [SwapModal] Set to token:', matchingToken.symbol);
          }
        }
      }
      
      // Pre-fill amount (handle 'max'/'all' keywords)
      if (prefillData.amount) {
        if (prefillData.amount === 'max' || prefillData.amount === 'all') {
          // Use full balance
          setFromAmount(balance || '0');
          logger.log('🤖 [SwapModal] Set max amount:', balance);
        } else {
          setFromAmount(prefillData.amount);
          logger.log('🤖 [SwapModal] Set amount:', prefillData.amount);
        }
      }
    }
  }, [isOpen, prefillData, popularTokens, chain, balance]);

  // Get quote when amount changes (with debounce)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (fromAmount && parseFloat(fromAmount) > 0 && fromToken && toToken) {
        fetchQuote();
      } else {
        setToAmount('');
        setQuote(null);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [fromAmount, fromToken, toToken]);

  const fetchQuote = async () => {
    if (!fromAmount || !fromToken || !toToken) return;

    setIsLoadingQuote(true);
    setError('');
    setQuote(null);

    try {
      const amountInWei = ethers.parseEther(fromAmount).toString();
      const fromAddress = fromToken === 'native' 
        ? '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
        : fromToken;

      // Get quote from server (1inch or price estimate)
      const swapService = new SwapService(chain.id);
      const quoteData = await swapService.getQuote(
        fromAddress,
        toToken,
        amountInWei
      );

      // API can return either 'toAmount' or 'toTokenAmount' depending on source
      const outputAmount = (quoteData as any)?.toTokenAmount || (quoteData as any)?.toAmount;
      const sourceProvider = (quoteData as any)?.source;
      
      logger.log('Quote received:', {
        outputAmount,
        source: sourceProvider,
        protocols: (quoteData as any)?.protocols
      });
      
      if (quoteData && outputAmount && outputAmount !== '0') {
        logger.log('✅ Quote success!');
        setQuote(quoteData);
        
        // Format output amount based on token decimals
        const decimals = toToken === '0xdAC17F958D2ee523a2206206994597C13D831ec7' ? 6 : 18;
        const formatted = ethers.formatUnits(outputAmount, decimals);
        setToAmount(formatted);
        
        setSwapProvider(sourceProvider === '1inch' ? '1inch' : 'price-estimate');
      } else {
        logger.error('Quote check failed:', {
          hasQuoteData: !!quoteData,
          outputAmount,
          sourceProvider
        });
        setError('No quote available for this token pair');
      }
    } catch (err: any) {
      logger.error('Quote error:', err);
      setError(err.message || 'Error fetching quote');
    } finally {
      setIsLoadingQuote(false);
    }
  };

  const handleSwap = async () => {
    if (!wallet || !quote || !fromAmount) {
      setError('Wallet, quote or amount missing');
      return;
    }

    setIsSwapping(true);
    setError('');

    try {
      const amountInWei = ethers.parseEther(fromAmount).toString();
      const fromAddress = fromToken === 'native' 
        ? '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
        : fromToken;

      let txHash: string;

      // Execute swap via 1inch
      if (swapProvider === '1inch') {
        logger.log('Executing 1inch swap...');
        const swapService = new SwapService(chain.id);
        
        const txData = await swapService.getSwapTransaction(
          fromAddress,
          toToken,
          amountInWei,
          wallet.address,
          1 // 1% slippage
        );

        if (!txData || !txData.tx) {
          throw new Error('Could not get swap transaction from 1inch');
        }

        // Send transaction
        const provider = new ethers.JsonRpcProvider(chain.rpcUrl);
        const signer = wallet.connect(provider);

        const tx = await signer.sendTransaction({
          to: txData.tx.to,
          data: txData.tx.data,
          value: txData.tx.value || '0',
          gasLimit: txData.tx.gas || '300000',
        });

        await tx.wait();
        txHash = tx.hash;
      } else {
        throw new Error('Direct swapping not possible. Add 1inch API key (see ONEINCH_API_SETUP.md) or use external DEX.');
      }

      logger.log('✅ Swap successful:', txHash);
      setSuccess(true);
      
      // Reset form after 2 seconds
      setTimeout(() => {
        setFromAmount('');
        setToAmount('');
        setQuote(null);
        setSuccess(false);
        onClose();
      }, 2000);

    } catch (err: any) {
      logger.error('Swap error:', err);
      setError(err.message || 'Swap failed');
    } finally {
      setIsSwapping(false);
    }
  };

  const getTokenSymbol = (address: string): string => {
    if (address === 'native') return chain.nativeCurrency.symbol;
    const token = popularTokens.find(t => t.address.toLowerCase() === address.toLowerCase());
    return token?.symbol || 'Token';
  };

  const getExchangeRate = (): string => {
    if (!quote || !fromAmount || parseFloat(fromAmount) === 0 || !toAmount || parseFloat(toAmount) === 0) return '0.0';
    const rate = parseFloat(toAmount) / parseFloat(fromAmount);
    return rate.toFixed(6);
  };

  const getProviderLabel = (): string => {
    switch (swapProvider) {
      case '1inch':
        return '1inch';
      case 'price-estimate':
        return 'Price estimate';
      default:
        return 'Unknown';
    }
  };

  const getProviderColor = (): string => {
    switch (swapProvider) {
      case '1inch':
        return 'text-orange-500';
      case 'price-estimate':
        return 'text-gray-600';
      default:
        return 'text-gray-600';
    }
  };

  const canSwap = (): boolean => {
    return quote && 
           fromAmount && 
           parseFloat(fromAmount) > 0 && 
           swapProvider === '1inch' &&
           !isLoadingQuote &&
           !isSwapping;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto"
      >
        <div className="max-w-4xl mx-auto p-6">
          {/* Back Button */}
          <button
            onClick={onClose}
            className="mb-4 text-gray-600 hover:text-gray-900 flex items-center gap-2 font-semibold transition-colors"
          >
            ← Back
          </button>

          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-xl flex items-center justify-center">
                <Flame className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Swap</h2>
                <p className="text-sm text-gray-600">
                  Exchange tokens at the best rates
                </p>
              </div>
            </div>
          </div>

          {/* Coming Soon Overlay */}
          <div className="relative max-w-2xl mx-auto">
            <div className="space-y-6 opacity-30 pointer-events-none">

          {/* Success Message */}
          {success && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-card p-4 bg-emerald-50 border border-emerald-200 flex items-center gap-3"
            >
              <CheckCircle className="w-6 h-6 text-emerald-500" />
              <p className="text-sm font-medium text-emerald-700">Swap successful!</p>
            </motion.div>
          )}

          {/* From Token */}
          <div className="glass-card p-6">
            <div className="text-sm font-medium text-gray-600 mb-3">From</div>
            <div className="flex items-center gap-4">
              <input
                type="number"
                value={fromAmount}
                onChange={(e) => setFromAmount(e.target.value)}
                placeholder="0.0"
                className="flex-1 bg-transparent text-3xl font-bold outline-none min-w-0 text-gray-900"
                disabled={isSwapping}
              />
              <select
                value={fromToken}
                onChange={(e) => setFromToken(e.target.value)}
                className="bg-gray-100 px-4 py-3 rounded-xl font-semibold outline-none flex-shrink-0 border border-gray-200 hover:bg-white hover:border-orange-300 transition-all text-gray-900"
                disabled={isSwapping}
              >
                <option value="native">{chain.nativeCurrency.symbol}</option>
                {popularTokens.map(token => (
                  <option key={token.address} value={token.address}>
                    {token.symbol}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-sm text-gray-500 mt-3">
              Balance: {balance} {chain.nativeCurrency.symbol}
            </div>
          </div>

          {/* Swap Arrow */}
          <div className="flex justify-center -my-3 relative z-10">
            <button
              onClick={() => {
                // Swap tokens
                const temp = fromToken;
                setFromToken(toToken === '' ? 'native' : toToken);
                setToToken(temp === 'native' ? (popularTokens[0]?.address || '') : temp);
              }}
              className="p-4 glass-card hover:bg-white hover:shadow-md rounded-full transition-all border border-gray-200"
              disabled={isSwapping}
            >
              <ArrowDown className="w-6 h-6 text-orange-500" />
            </button>
          </div>

          {/* To Token */}
          <div className="glass-card p-6">
            <div className="text-sm font-medium text-gray-600 mb-3">To</div>
            <div className="flex items-center gap-4">
              <input
                type="text"
                value={toAmount}
                readOnly
                placeholder="0.0"
                className="flex-1 bg-transparent text-3xl font-bold outline-none text-emerald-500 min-w-0"
              />
              <select
                value={toToken}
                onChange={(e) => setToToken(e.target.value)}
                className="bg-gray-100 px-4 py-3 rounded-xl font-semibold outline-none flex-shrink-0 border border-gray-200 hover:bg-white hover:border-orange-300 transition-all text-gray-900"
                disabled={isSwapping}
              >
                <option value="">Select token</option>
                {popularTokens.map(token => (
                  <option key={token.address} value={token.address}>
                    {token.symbol}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Exchange Rate Info */}
          {quote && !error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-6 space-y-3 text-sm"
            >
              <div className="flex justify-between">
                <span className="text-gray-600">Exchange rate</span>
                <span className="font-semibold text-gray-900">
                  1 {getTokenSymbol(fromToken)} = {getExchangeRate()} {getTokenSymbol(toToken)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Estimated gas</span>
                <span className="font-semibold text-gray-900">{(parseInt(quote.estimatedGas || '180000') / 1000).toFixed(0)}k</span>
              </div>
              <div className="h-px bg-gray-200"></div>
              <div className="flex justify-between">
                <span className="text-gray-600 flex items-center gap-1">
                  <Flame className="w-4 h-4" />
                  Powered by
                </span>
                <span className={`font-semibold ${getProviderColor()}`}>
                  {getProviderLabel()}
                </span>
              </div>
            </motion.div>
          )}

          {/* Loading State */}
          {isLoadingQuote && (
            <div className="flex items-center justify-center gap-3 text-orange-600 py-4">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm font-medium">Fetching best rate...</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-red-700">{error}</p>
            </motion.div>
          )}

          {/* Info */}
          <div className={`glass-card p-4 ${swapProvider === '1inch' ? 'bg-gradient-to-r from-orange-50 to-yellow-50 border-orange-200' : 'bg-amber-50 border-amber-200'} border`}>
            <p className={`text-sm ${swapProvider === '1inch' ? 'text-orange-700' : 'text-amber-700'}`}>
              <Flame className="w-4 h-4 inline mr-2" />
              {swapProvider === '1inch' ? 
                '1inch finds the best rates by comparing 100+ DEXes' : 
                'Add 1inch API key for real swaps (see ONEINCH_API_SETUP.md)'
              }
            </p>
          </div>

          {/* Swap Button */}
          <motion.button
            whileTap={{ scale: canSwap() ? 0.98 : 1 }}
            onClick={handleSwap}
            disabled={!canSwap()}
            className="w-full py-4 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 rounded-xl font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-xl"
          >
            {isSwapping ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Swapping...
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5" />
                {canSwap() ? 'Swap now' : 'Not available'}
              </>
            )}
          </motion.button>

          {/* Additional Info */}
          <p className="text-xs text-gray-500 text-center">
            Always verify the details before swapping. Slippage tolerance: 1%
          </p>
          </div>

            {/* Coming Soon Overlay Card */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="absolute inset-0 flex items-center justify-center px-4"
            >
              <div className="bg-gradient-to-br from-orange-500/20 to-yellow-500/20 backdrop-blur-xl border-2 border-orange-500/30 rounded-2xl p-8 max-w-md w-full shadow-2xl">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Repeat className="w-8 h-8 text-white" />
                  </div>
                  
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    Coming Soon
                  </h3>
                  
                  <p className="text-gray-700 mb-4 leading-relaxed">
                    Swap feature is currently in development. Soon you'll be able to exchange tokens at the best rates across all chains!
                  </p>
                  
                  <div className="flex flex-col gap-2 text-sm text-gray-600">
                    <div className="flex items-center justify-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-500" />
                      <span>Best rates guaranteed</span>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <Zap className="w-4 h-4 text-yellow-500" />
                      <span>Lightning fast swaps</span>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-blue-500" />
                      <span>Multi-chain support</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

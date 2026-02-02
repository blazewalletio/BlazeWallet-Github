'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Loader2, CheckCircle2, ArrowUpRight, ChevronDown, Check, AlertTriangle, Lightbulb, Users, Zap, TurtleIcon as Turtle, Gauge, Rocket } from 'lucide-react';
import { useWalletStore } from '@/lib/wallet-store';
import { supabase } from '@/lib/supabase';
import { useBlockBodyScroll } from '@/hooks/useBlockBodyScroll';
import { MultiChainService } from '@/lib/multi-chain-service';
import { BlockchainService } from '@/lib/blockchain';
import { CHAINS } from '@/lib/chains';
import { priceService } from '@/lib/price-service';
import ParticleEffect from './ParticleEffect';
import SmartScheduleModal from './SmartScheduleModal';
import AddressBook from './AddressBook';
import { logger } from '@/lib/logger';
import { logTransactionEvent } from '@/lib/analytics-tracker';
import { useCurrency } from '@/contexts/CurrencyContext';

interface Asset {
  symbol: string;
  name: string;
  balance: string;
  decimals: number;
  logo?: string;
  address?: string;
  priceUSD: number;
  valueUSD: number;
  isNative: boolean;
}

interface SendModalProps {
  isOpen: boolean;
  onClose: () => void;
  // AI Assistant pre-fill data
  prefillData?: {
    amount?: string;
    token?: string;
    recipient?: string;
  };
}

export default function SendModal({ isOpen, onClose, prefillData }: SendModalProps) {
  const { wallet, currentChain, mnemonic, getCurrentAddress } = useWalletStore();
  const [step, setStep] = useState<'input' | 'confirm' | 'sending' | 'success'>('input');
  
  const [selectedChain, setSelectedChain] = useState(currentChain);
  const [availableAssets, setAvailableAssets] = useState<Asset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  
  // Dropdown states
  const [showChainDropdown, setShowChainDropdown] = useState(false);
  const [showAssetDropdown, setShowAssetDropdown] = useState(false);
  
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const { formatUSDSync, symbol } = useCurrency();
  const [gasPrice, setGasPrice] = useState<{ slow: string; standard: string; fast: string } | null>(null);
  const [selectedGas, setSelectedGas] = useState<'slow' | 'standard' | 'fast'>('standard');
  const [error, setError] = useState('');
  const [txHash, setTxHash] = useState('');
  const [showSuccessParticles, setShowSuccessParticles] = useState(false);
  const [balanceWarning, setBalanceWarning] = useState<{
    message: string;
    details: { need: string; have: string; missing: string; missingUSD: string };
  } | null>(null);
  
  // Smart Schedule Modal state
  const [showSmartSchedule, setShowSmartSchedule] = useState(false);
  
  // Address Book state
  const [showAddressBook, setShowAddressBook] = useState(false);

  // ✅ Use singleton instance (prevents re-initialization)
  const blockchain = MultiChainService.getInstance(selectedChain);

  useBlockBodyScroll(isOpen);

  useEffect(() => {
    if (isOpen) {
      setSelectedChain(currentChain);
      fetchAssetsForChain(currentChain);
      fetchGasPrice();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && selectedChain) {
      fetchAssetsForChain(selectedChain);
      fetchGasPrice();
    }
  }, [selectedChain]);

  // ✅ AI Assistant Pre-fill Effect
  useEffect(() => {
    if (isOpen && prefillData && availableAssets.length > 0) {
      logger.log('🤖 [SendModal] Applying AI pre-fill data:', prefillData);
      
      // Pre-fill recipient address
      if (prefillData.recipient) {
        setToAddress(prefillData.recipient);
      }
      
      // Pre-fill amount (handle 'max'/'all' keywords)
      if (prefillData.amount) {
        if (prefillData.amount === 'max' || prefillData.amount === 'all') {
          // Will be handled after asset selection
          logger.log('🤖 [SendModal] Will set max amount after asset selection');
        } else {
          setAmount(prefillData.amount);
        }
      }
      
      // Pre-fill token/asset
      if (prefillData.token) {
        const tokenSymbol = prefillData.token.toUpperCase();
        const matchingAsset = availableAssets.find(
          asset => asset.symbol.toUpperCase() === tokenSymbol
        );
        
        if (matchingAsset) {
          setSelectedAsset(matchingAsset);
          logger.log('🤖 [SendModal] Selected asset:', matchingAsset.symbol);
          
          // If amount was 'max'/'all', set it now
          if (prefillData.amount === 'max' || prefillData.amount === 'all') {
            setAmount(matchingAsset.balance);
            logger.log('🤖 [SendModal] Set max amount:', matchingAsset.balance);
          }
        } else {
          logger.warn('⚠️ [SendModal] Token not found:', tokenSymbol);
        }
      }
    }
  }, [isOpen, prefillData, availableAssets]);

  const fetchAssetsForChain = async (chain: string) => {
    setIsLoadingAssets(true);
    try {
      // ✅ Get address for the SELECTED chain, not current chain
      const { getChainTokens } = useWalletStore.getState();
      const chainConfig = CHAINS[chain];
      const chainService = MultiChainService.getInstance(chain);
      
      // ✅ FIXED: Get correct address for ALL chains
      let displayAddress: string;
      if (chain === 'solana') {
        const { solanaAddress } = useWalletStore.getState();
        displayAddress = solanaAddress || '';
      } else if (chain === 'bitcoin') {
        const { bitcoinAddress } = useWalletStore.getState();
        displayAddress = bitcoinAddress || '';
      } else if (chain === 'litecoin') {
        const { litecoinAddress } = useWalletStore.getState();
        displayAddress = litecoinAddress || '';
      } else if (chain === 'dogecoin') {
        const { dogecoinAddress } = useWalletStore.getState();
        displayAddress = dogecoinAddress || '';
      } else if (chain === 'bitcoincash') {
        const { bitcoincashAddress } = useWalletStore.getState();
        displayAddress = bitcoincashAddress || '';
      } else {
        // EVM chains (Ethereum, Polygon, Arbitrum, Base, BSC, Optimism, etc.)
        const { address } = useWalletStore.getState();
        displayAddress = address || '';
      }

      if (!displayAddress) {
        logger.error('❌ No wallet address available for', chain);
        setIsLoadingAssets(false);
        return;
      }

      logger.log(`🔍 [SendModal] Fetching assets for ${chain} (address: ${displayAddress})`);
      
      const nativeBalance = await chainService.getBalance(displayAddress);
      const nativeSymbol = chainConfig.nativeCurrency.symbol;
      const prices = await priceService.getMultiplePrices([nativeSymbol]);
      const nativePrice = prices[nativeSymbol]?.price || 0;
      
      const assets: Asset[] = [
        {
          symbol: nativeSymbol,
          name: chainConfig.nativeCurrency.name,
          balance: nativeBalance,
          decimals: chainConfig.nativeCurrency.decimals,
          logo: chainConfig.logoUrl,
          isNative: true,
          priceUSD: nativePrice,
          valueUSD: parseFloat(nativeBalance) * nativePrice,
        }
      ];

      // ✅ Fetch tokens for Solana
      if (chain === 'solana') {
        const solanaService = chainService as any;
        if (solanaService.getSPLTokenBalances) {
          const splTokens = await solanaService.getSPLTokenBalances(displayAddress);
          const splSymbols = splTokens.map((t: any) => t.symbol);
          const splPrices = await priceService.getMultiplePrices(splSymbols);
          
          splTokens.forEach((token: any) => {
            const price = splPrices[token.symbol]?.price || 0;
            const balance = parseFloat(token.balance || '0');
            assets.push({
              symbol: token.symbol,
              name: token.name,
              balance: token.balance,
              decimals: token.decimals,
              logo: token.logo,
              address: token.address,
              isNative: false,
              priceUSD: price,
              valueUSD: balance * price,
            });
          });
        }
      } 
      // ✅ Fetch ERC20 tokens for EVM chains from wallet store
      else {
        const chainTokens = getChainTokens(chain);
        logger.log(`🪙 [SendModal] Found ${chainTokens.length} cached tokens for ${chain}`);
        
        // ✅ Get fresh prices for all tokens
        const tokenSymbols = chainTokens
          .filter(t => t.address && parseFloat(t.balance || '0') > 0)
          .map(t => t.symbol);
        
        const tokenPrices = tokenSymbols.length > 0 
          ? await priceService.getMultiplePrices(tokenSymbols)
          : {};
        
        for (const token of chainTokens) {
          // Skip native currency (already added)
          if (!token.address) continue;
          
          const balance = parseFloat(token.balance || '0');
          if (balance > 0) {
            // ✅ FIXED: Use fresh price from API, not stale cache
            const freshPrice = tokenPrices[token.symbol]?.price || token.priceUSD || 0;
            const valueUSD = balance * freshPrice;
            
            assets.push({
              symbol: token.symbol,
              name: token.name,
              balance: token.balance || '0',
              decimals: token.decimals,
              logo: token.logo,
              address: token.address,
              isNative: false,
              priceUSD: freshPrice,
              valueUSD: valueUSD,
            });
          }
        }
      }

      assets.sort((a, b) => b.valueUSD - a.valueUSD);
      setAvailableAssets(assets);
      
      if (assets.length > 0) {
        setSelectedAsset(assets[0]);
      }
      
      logger.log(`✅ Loaded ${assets.length} assets for ${chain}:`, assets);
    } catch (error) {
      logger.error('❌ Failed to fetch assets:', error);
      setAvailableAssets([]);
      setSelectedAsset(null);
    } finally {
      setIsLoadingAssets(false);
    }
  };

  const fetchGasPrice = async () => {
    const prices = await blockchain.getGasPrice();
    setGasPrice(prices);
  };

  // ✅ Real-time balance validation
  useEffect(() => {
    if (!amount || !selectedAsset || !gasPrice) {
      setBalanceWarning(null);
      return;
    }

    const checkBalance = async () => {
      try {
        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
          setBalanceWarning(null);
          return;
        }

        const chainConfig = CHAINS[selectedChain];
        const isSolana = selectedChain === 'solana';
        
        let estimatedGasAmount: number;
        
        if (isSolana) {
          // Solana has fixed low fees (~0.000005 SOL for simple transfers)
          // For SPL tokens with account creation: ~0.002 SOL
          estimatedGasAmount = selectedAsset.isNative ? 0.000005 : 0.002;
        } else {
          // EVM chains: calculate based on gas price
          const gas = gasPrice[selectedGas];
          estimatedGasAmount = selectedAsset.isNative
            ? (parseFloat(gas) * 21000 / 1e9)
            : (parseFloat(gas) * 65000 / 1e9);
        }

        // For SPL/ERC20 tokens: check if we have enough native currency for gas
        if (!selectedAsset.isNative) {
          // Get native balance from availableAssets
          const nativeAsset = availableAssets.find(a => a.isNative);
          if (!nativeAsset) return;

          const nativeBalance = parseFloat(nativeAsset.balance);
          
          if (nativeBalance < estimatedGasAmount) {
            const needed = estimatedGasAmount;
            const have = nativeBalance;
            const missing = needed - have;
            const missingUSD = missing * nativeAsset.priceUSD;
            
            setBalanceWarning({
              message: `Insufficient ${chainConfig.nativeCurrency.symbol} for transaction fees`,
              details: {
                need: `${needed.toFixed(6)} ${chainConfig.nativeCurrency.symbol}`,
                have: `${have.toFixed(6)} ${chainConfig.nativeCurrency.symbol}`,
                missing: `${missing.toFixed(6)} ${chainConfig.nativeCurrency.symbol}`,
                missingUSD: formatUSDSync(missingUSD),
              }
            });
            return;
          }
        }

        // For native currency: check total (amount + gas)
        if (selectedAsset.isNative) {
          const total = amountNum + estimatedGasAmount;
          const available = parseFloat(selectedAsset.balance);
          
          if (total > available) {
            const needed = total;
            const have = available;
            const missing = needed - have;
            const missingUSD = missing * selectedAsset.priceUSD;
            
            setBalanceWarning({
              message: `Insufficient balance (including transaction fees)`,
              details: {
                need: `${needed.toFixed(6)} ${selectedAsset.symbol}`,
                have: `${have.toFixed(6)} ${selectedAsset.symbol}`,
                missing: `${missing.toFixed(6)} ${selectedAsset.symbol}`,
                missingUSD: formatUSDSync(missingUSD),
              }
            });
            return;
          }
        }

        setBalanceWarning(null);
      } catch (err) {
        logger.error('Error checking balance:', err);
        setBalanceWarning(null);
      }
    };

    checkBalance();
  }, [amount, selectedAsset, gasPrice, selectedGas, availableAssets, selectedChain]);

  const handleMaxAmount = () => {
    if (!selectedAsset) return;
    
    if (selectedAsset.isNative) {
      const max = Math.max(0, parseFloat(selectedAsset.balance) - 0.001);
      setAmount(max.toFixed(6));
    } else {
      setAmount(selectedAsset.balance);
    }
  };

  const handleContinue = () => {
    setError('');
    
    if (!selectedAsset) {
      setError('Please select an asset to send');
      return;
    }
    
    if (!blockchain.isValidAddress(toAddress)) {
      setError(`Invalid ${blockchain.getAddressFormatHint()}`);
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Invalid amount');
      return;
    }

    if (amountNum > parseFloat(selectedAsset.balance)) {
      setError('Insufficient balance');
      return;
    }

    setStep('confirm');
  };

  const handleSend = async () => {
    if (!gasPrice || !selectedAsset) return;
    
    const isSolana = selectedChain === 'solana';
    if (isSolana && !mnemonic) {
      setError('Mnemonic required for Solana transactions');
      return;
    }
    if (!isSolana && !wallet) {
      setError('Wallet not initialized');
      return;
    }

    setStep('sending');
    setError('');

    // Track send initiation
    const sendValueUSD = parseFloat(amount) * (selectedAsset.priceUSD || 0);
    await logTransactionEvent({
      eventType: 'send_initiated',
      chainKey: selectedChain,
      tokenSymbol: selectedAsset.symbol,
      valueUSD: sendValueUSD,
      status: 'pending',
      metadata: {
        isNative: selectedAsset.isNative,
        toAddress,
      },
    });

    try {
      const gas = gasPrice[selectedGas];
      
      let tx;
      // ✅ Check if sending token or native currency
      if (selectedAsset.isNative) {
        // Send native currency (ETH, SOL, etc.)
        tx = await blockchain.sendTransaction(
          isSolana ? mnemonic! : wallet!,
          toAddress,
          amount,
          gas
        );
      } else {
        // Send token (ERC20, SPL)
        if (!selectedAsset.address) {
          throw new Error('Token address is required for token transfers');
        }
        tx = await blockchain.sendTokenTransaction(
          isSolana ? mnemonic! : wallet!,
          selectedAsset.address,
          toAddress,
          amount,
          selectedAsset.decimals,
          gas
        );
      }
      
      const hash = typeof tx === 'string' ? tx : tx.hash;
      setTxHash(hash);
      setStep('success');
      setShowSuccessParticles(true);
      
      // Track successful send
      await logTransactionEvent({
        eventType: 'send_confirmed',
        chainKey: selectedChain,
        tokenSymbol: selectedAsset.symbol,
        valueUSD: sendValueUSD,
        status: 'success',
        referenceId: hash,
        metadata: {
          isNative: selectedAsset.isNative,
          toAddress,
        },
      });

      // ✅ NEW: Track transaction in database for cross-device stats
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const currentAddress = selectedChain === 'solana' 
            ? useWalletStore.getState().solanaAddress 
            : useWalletStore.getState().address;
            
          await fetch('/api/transactions/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.id,
              chainKey: selectedChain,
              txHash: hash,
              transactionType: 'send',
              direction: 'sent',
              fromAddress: currentAddress,
              toAddress,
              tokenSymbol: selectedAsset.symbol,
              tokenAddress: selectedAsset.address || null,
              tokenDecimals: selectedAsset.decimals,
              isNative: selectedAsset.isNative,
              amount: amount,
              amountUSD: sendValueUSD,
              gasCostUSD: parseFloat(gas) * (selectedAsset.priceUSD || 0) * 0.000000001, // Rough estimate
              status: 'confirmed',
              metadata: {
                gasSpeed: selectedGas,
                toAddress
              }
            })
          });
          logger.log('✅ Transaction tracked in database');
        }
      } catch (trackError) {
        logger.error('Failed to track transaction:', trackError);
        // Don't fail the whole transaction if tracking fails
      }
      
      // ✅ CRITICAL: Invalidate cache after successful transaction!
      // This ensures balance updates immediately on next view
      logger.log('🗑️ [SendModal] Clearing cache after successful transaction');
      const { tokenBalanceCache } = await import('@/lib/token-balance-cache');
      const currentAddress = selectedChain === 'solana' 
        ? useWalletStore.getState().solanaAddress 
        : useWalletStore.getState().address;
      
      if (currentAddress) {
        await tokenBalanceCache.clear(selectedChain, currentAddress);
      }
      
      if (typeof tx !== 'string' && tx.wait) {
        await tx.wait();
      }
    } catch (err: any) {
      logger.error('Error sending transaction:', err);
      
      // ✅ User-friendly error messages
      let userMessage = 'Transaction failed';
      let technicalDetails = '';
      
      if (err.message) {
        const msg = err.message.toLowerCase();
        
        // Store technical error for debugging
        technicalDetails = err.message;
        
        if (msg.includes('insufficient funds') || msg.includes('insufficient balance')) {
          userMessage = 'Insufficient balance to cover transaction and gas fees';
        } else if (msg.includes('user rejected') || msg.includes('user denied')) {
          userMessage = 'Transaction was cancelled';
        } else if (msg.includes('gas required exceeds allowance') || msg.includes('out of gas')) {
          userMessage = 'Transaction requires more gas. Try increasing gas limit.';
        } else if (msg.includes('nonce too low')) {
          userMessage = 'Transaction conflict detected. Please try again.';
        } else if (msg.includes('replacement transaction underpriced')) {
          userMessage = 'Transaction pending. Please wait before sending another.';
        } else if (msg.includes('no response') || msg.includes('failed to send tx') || msg.includes('unknown error')) {
          userMessage = 'Network error. RPC temporarily unavailable. Please try again in a moment.';
        } else if (msg.includes('invalid address')) {
          userMessage = 'Invalid recipient address';
        } else if (msg.includes('execution reverted')) {
          userMessage = 'Transaction rejected by contract. Check token approval or balance.';
        } else if (msg.includes('unsupported protocol') || msg.includes('cannot start up')) {
          userMessage = 'RPC connection error. Please try again in a moment.';
          technicalDetails = 'Failed to connect to blockchain network';
        } else {
          // Show first 100 chars of error if it's somewhat readable
          const cleanError = err.message.replace(/Error: /gi, '').trim();
          if (cleanError.length < 100 && !cleanError.includes('{') && !cleanError.includes('0x')) {
            userMessage = cleanError;
          } else {
            // If error is too technical, show generic message with reason
            userMessage = 'Transaction failed. Please try again.';
          }
        }
      }
      
      // Add technical details for debugging if available
      if (technicalDetails && technicalDetails !== userMessage) {
        logger.error('📋 Technical error details:', technicalDetails);
      }
      
      setError(userMessage);
      setStep('confirm');
      
      // Track failed send
      await logTransactionEvent({
        eventType: 'send_failed',
        chainKey: selectedChain,
        tokenSymbol: selectedAsset.symbol,
        valueUSD: sendValueUSD,
        status: 'failed',
        metadata: {
          isNative: selectedAsset.isNative,
          toAddress,
          error: technicalDetails || userMessage,
        },
      });
    }
  };

  const handleClose = () => {
    setStep('input');
    setToAddress('');
    setAmount('');
    setError('');
    setTxHash('');
    setShowSuccessParticles(false);
    setSelectedChain(currentChain);
    setAvailableAssets([]);
    setSelectedAsset(null);
    setShowChainDropdown(false);
    setShowAssetDropdown(false);
    onClose();
  };

  const estimatedFee = gasPrice && selectedAsset
    ? selectedAsset.isNative
      ? (parseFloat(gasPrice[selectedGas]) * 21000 / 1e9).toFixed(6)
      : (parseFloat(gasPrice[selectedGas]) * 65000 / 1e9).toFixed(6)
    : '0';

  const getExplorerUrl = (hash: string) => {
    const chainConfig = CHAINS[selectedChain];
    return `${chainConfig.explorerUrl}/tx/${hash}`;
  };

  if (!isOpen) return null;

  const selectedChainConfig = CHAINS[selectedChain];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto"
      >
        <div className="min-h-full flex flex-col">
          <div className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 pt-safe pb-safe">
            <div className="pt-4 pb-2">
              <button
                onClick={handleClose}
                className="text-gray-600 hover:text-gray-900 flex items-center gap-2 font-semibold transition-colors"
              >
                ← Back
              </button>
            </div>

            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <ArrowUpRight className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Send crypto</h2>
                  <p className="text-sm text-gray-600">
                    Transfer funds to another wallet
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-6 pb-6">

          {step === 'input' && (
            <div className="glass-card p-6 space-y-6">
              {/* ✨ STYLED: Chain Selector with Logo */}
              <div>
                <label className="text-sm font-medium text-gray-900 mb-2 block">
                  From network
                </label>
                <div className="relative">
                  <button
                    onClick={() => setShowChainDropdown(!showChainDropdown)}
                    className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl font-medium text-gray-900 hover:border-orange-300 transition-colors focus:outline-none focus:border-orange-500 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      {selectedChainConfig.logoUrl ? (
                        <img 
                          src={selectedChainConfig.logoUrl} 
                          alt={selectedChainConfig.name}
                          className="w-6 h-6 rounded-full"
                        />
                      ) : (
                        <span className="text-xl">{selectedChainConfig.icon}</span>
                      )}
                      <span>{selectedChainConfig.name}</span>
                    </div>
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  </button>
                  
                  {showChainDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute z-10 w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-xl overflow-hidden"
                    >
                      {Object.entries(CHAINS).map(([key, chain]) => (
                        <button
                          key={key}
                          onClick={() => {
                            setSelectedChain(key);
                            setShowChainDropdown(false);
                          }}
                          className={`w-full px-4 py-3 flex items-center justify-between hover:bg-orange-50 transition-colors ${
                            selectedChain === key ? 'bg-orange-50' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {chain.logoUrl ? (
                              <img 
                                src={chain.logoUrl} 
                                alt={chain.name}
                                className="w-6 h-6 rounded-full"
                              />
                            ) : (
                              <span className="text-xl">{chain.icon}</span>
                            )}
                            <span className="font-medium text-gray-900">{chain.name}</span>
                          </div>
                          {selectedChain === key && (
                            <Check className="w-5 h-5 text-orange-500" />
                          )}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </div>
              </div>

              {/* ✨ STYLED: Asset Selector with Logo */}
              <div>
                <label className="text-sm font-medium text-gray-900 mb-2 block">
                  Asset to send
                </label>
                {isLoadingAssets ? (
                  <div className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl flex items-center justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
                    <span className="ml-2 text-gray-600">Loading assets...</span>
                  </div>
                ) : availableAssets.length === 0 ? (
                  <div className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl text-gray-600 text-center">
                    No assets available
                  </div>
                ) : (
                  <div className="relative">
                    <button
                      onClick={() => setShowAssetDropdown(!showAssetDropdown)}
                      className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl font-medium text-gray-900 hover:border-orange-300 transition-colors focus:outline-none focus:border-orange-500 flex items-center justify-between"
                    >
                      {selectedAsset && (
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center overflow-hidden border border-gray-200">
                            {selectedAsset.logo && (selectedAsset.logo.startsWith('http') || selectedAsset.logo.startsWith('/') || selectedAsset.logo.startsWith('data:') || selectedAsset.logo.startsWith('blob:')) ? (
                              <img 
                                src={selectedAsset.logo} 
                                alt={selectedAsset.symbol}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  e.currentTarget.parentElement!.textContent = selectedAsset.symbol[0];
                                }}
                              />
                            ) : (
                              <span className="text-sm font-bold">{selectedAsset.symbol[0]}</span>
                            )}
                          </div>
                          <div className="text-left">
                            <div className="font-semibold">{selectedAsset.symbol}</div>
                            <div className="text-xs text-gray-500">
                              {parseFloat(selectedAsset.balance).toFixed(6)}
                            </div>
                          </div>
                        </div>
                      )}
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    </button>
                    
                    {showAssetDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="absolute z-10 w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-xl overflow-hidden max-h-80 overflow-y-auto"
                      >
                        {availableAssets.map((asset) => (
                          <button
                            key={asset.symbol}
                            onClick={() => {
                              setSelectedAsset(asset);
                              setShowAssetDropdown(false);
                            }}
                            className={`w-full px-4 py-3 flex items-center justify-between hover:bg-orange-50 transition-colors ${
                              selectedAsset?.symbol === asset.symbol ? 'bg-orange-50' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center overflow-hidden border border-gray-200">
                                {asset.logo && (asset.logo.startsWith('http') || asset.logo.startsWith('/') || asset.logo.startsWith('data:') || asset.logo.startsWith('blob:')) ? (
                                  <img 
                                    src={asset.logo} 
                                    alt={asset.symbol}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                      e.currentTarget.parentElement!.textContent = asset.symbol[0];
                                    }}
                                  />
                                ) : (
                                  <span className="text-sm font-bold">{asset.symbol[0]}</span>
                                )}
                              </div>
                              <div className="text-left">
                                <div className="font-semibold text-gray-900">{asset.symbol}</div>
                                <div className="text-xs text-gray-500">
                                  {parseFloat(asset.balance).toFixed(6)}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-medium text-gray-900">
                                {formatUSDSync(asset.valueUSD)}
                              </div>
                              {selectedAsset?.symbol === asset.symbol && (
                                <Check className="w-5 h-5 text-orange-500 ml-2 inline" />
                              )}
                            </div>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </div>
                )}
                {selectedAsset && (
                  <div className="text-sm text-gray-600 mt-2">
                    ≈ {formatUSDSync(selectedAsset.valueUSD)}
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-gray-900 mb-2 block">
                  To address
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={toAddress}
                    onChange={(e) => setToAddress(e.target.value)}
                    placeholder={selectedChain === 'solana' ? 'Solana address...' : '0x...'}
                    className="input-field font-mono text-sm pr-12"
                  />
                  <button
                    onClick={() => setShowAddressBook(true)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-gradient-to-br from-orange-100 to-orange-50 hover:from-orange-200 hover:to-orange-100 rounded-xl flex items-center justify-center transition-all group"
                    title="Open address book"
                  >
                    <Users className="w-4 h-4 text-orange-600 group-hover:scale-110 transition-transform" />
                  </button>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium text-gray-900">
                    Amount {selectedAsset ? `(${selectedAsset.symbol})` : ''}
                  </label>
                  <span className="text-sm text-gray-600">
                    Available: {selectedAsset ? parseFloat(selectedAsset.balance).toFixed(6) : '0'} {selectedAsset?.symbol}
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.000001"
                    className="input-field pr-20"
                    disabled={!selectedAsset}
                  />
                  <button
                    onClick={handleMaxAmount}
                    disabled={!selectedAsset}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-orange-600 hover:text-orange-700 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    MAX
                  </button>
                </div>
                {amount && selectedAsset && (
                  <div className="text-sm text-gray-600 mt-2">
                    ≈ {formatUSDSync(parseFloat(amount) * selectedAsset.priceUSD)}
                  </div>
                )}
              </div>

              {/* ⚠️ BALANCE WARNING BOX - Blaze Wallet Styled */}
              {balanceWarning && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gradient-to-r from-orange-50 to-yellow-50 border-2 border-orange-200 rounded-xl p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-full flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                        {balanceWarning.message}
                      </h4>
                      <div className="space-y-1.5 text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Required:</span>
                          <span className="font-medium text-gray-900">{balanceWarning.details.need}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Available:</span>
                          <span className="font-medium text-gray-900">{balanceWarning.details.have}</span>
                        </div>
                        <div className="h-px bg-orange-200 my-2" />
                        <div className="flex justify-between items-center">
                          <span className="text-gray-700 font-medium">Missing:</span>
                          <span className="font-semibold text-orange-600">
                            {balanceWarning.details.missing} ({balanceWarning.details.missingUSD})
                          </span>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-orange-200">
                        <p className="text-xs text-gray-600">
                          <Lightbulb className="w-4 h-4 flex-shrink-0" />
                          <span className="font-medium">Tip:</span> Try lowering the amount or switching to a slower gas speed to reduce fees.
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {selectedChain !== 'solana' && gasPrice && (
                <div>
                  <label className="text-sm font-medium text-gray-900 mb-3 block flex items-center gap-2">
                    <Gauge className="w-4 h-4 text-orange-500" />
                    Transaction Speed
                  </label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {/* Slow */}
                    <button
                      onClick={() => setSelectedGas('slow')}
                      className={`p-3 rounded-xl text-center transition-all border-2 relative overflow-hidden group ${
                        selectedGas === 'slow'
                          ? 'bg-blue-50 border-blue-500 shadow-lg scale-[1.02]'
                          : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-md'
                      }`}
                    >
                      {selectedGas === 'slow' && (
                        <div className="absolute top-1.5 right-1.5">
                          <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        </div>
                      )}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-1.5 transition-all ${
                        selectedGas === 'slow' ? 'bg-blue-100 scale-110' : 'bg-gray-100'
                      }`}>
                        <Turtle className={`w-4 h-4 ${selectedGas === 'slow' ? 'text-blue-600' : 'text-gray-400'}`} />
                      </div>
                      <div className={`font-bold text-xs mb-0.5 ${selectedGas === 'slow' ? 'text-blue-700' : 'text-gray-700'}`}>
                        Slow
                      </div>
                      <div className="text-[10px] text-gray-500 mb-1.5">
                        ~5-10 min
                      </div>
                      <div className={`font-bold text-lg leading-none mb-0.5 ${selectedGas === 'slow' ? 'text-blue-600' : 'text-gray-900'}`}>
                        {parseFloat(gasPrice.slow).toFixed(1)}
                      </div>
                      <div className="text-[9px] text-gray-400 uppercase tracking-wider">
                        Gwei
                      </div>
                    </button>

                    {/* Standard (Recommended) */}
                    <button
                      onClick={() => setSelectedGas('standard')}
                      className={`p-3 rounded-xl text-center transition-all border-2 relative overflow-hidden group ${
                        selectedGas === 'standard'
                          ? 'bg-gradient-to-br from-orange-50 to-orange-100/50 border-orange-500 shadow-lg scale-[1.02]'
                          : 'bg-white border-gray-200 hover:border-orange-300 hover:shadow-md'
                      }`}
                    >
                      {selectedGas === 'standard' && (
                        <div className="absolute top-1.5 right-1.5">
                          <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        </div>
                      )}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-1.5 transition-all ${
                        selectedGas === 'standard' ? 'bg-orange-100 scale-110' : 'bg-gray-100'
                      }`}>
                        <Gauge className={`w-4 h-4 ${selectedGas === 'standard' ? 'text-orange-600' : 'text-gray-400'}`} />
                      </div>
                      <div className={`font-bold text-xs mb-0.5 ${selectedGas === 'standard' ? 'text-orange-700' : 'text-gray-700'}`}>
                        Standard
                      </div>
                      <div className="text-[10px] text-orange-600 mb-1.5 font-semibold">
                        ✓ Recommended
                      </div>
                      <div className={`font-bold text-lg leading-none mb-0.5 ${selectedGas === 'standard' ? 'text-orange-600' : 'text-gray-900'}`}>
                        {parseFloat(gasPrice.standard).toFixed(1)}
                      </div>
                      <div className="text-[9px] text-gray-400 uppercase tracking-wider">
                        Gwei
                      </div>
                    </button>

                    {/* Fast */}
                    <button
                      onClick={() => setSelectedGas('fast')}
                      className={`p-3 rounded-xl text-center transition-all border-2 relative overflow-hidden group ${
                        selectedGas === 'fast'
                          ? 'bg-green-50 border-green-500 shadow-lg scale-[1.02]'
                          : 'bg-white border-gray-200 hover:border-green-300 hover:shadow-md'
                      }`}
                    >
                      {selectedGas === 'fast' && (
                        <div className="absolute top-1.5 right-1.5">
                          <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        </div>
                      )}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-1.5 transition-all ${
                        selectedGas === 'fast' ? 'bg-green-100 scale-110' : 'bg-gray-100'
                      }`}>
                        <Rocket className={`w-4 h-4 ${selectedGas === 'fast' ? 'text-green-600' : 'text-gray-400'}`} />
                      </div>
                      <div className={`font-bold text-xs mb-0.5 ${selectedGas === 'fast' ? 'text-green-700' : 'text-gray-700'}`}>
                        Fast
                      </div>
                      <div className="text-[10px] text-gray-500 mb-1.5">
                        ~30 sec
                      </div>
                      <div className={`font-bold text-lg leading-none mb-0.5 ${selectedGas === 'fast' ? 'text-green-600' : 'text-gray-900'}`}>
                        {parseFloat(gasPrice.fast).toFixed(1)}
                      </div>
                      <div className="text-[9px] text-gray-400 uppercase tracking-wider">
                        Gwei
                      </div>
                    </button>
                  </div>
                  
                  {/* Estimated Fee Display */}
                  <div className="mt-3 p-3 bg-gradient-to-r from-gray-50 to-gray-100/50 rounded-xl border border-gray-200">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 font-medium">Estimated Network Fee:</span>
                      <span className="font-bold text-gray-900">
                        ~{estimatedFee} {selectedChainConfig.nativeCurrency.symbol}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-red-700 text-sm font-medium">{error}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowSmartSchedule(true)}
                  disabled={!toAddress || !amount || !selectedAsset}
                  className="flex-1 py-4 px-2 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 rounded-xl font-semibold text-white transition-all shadow-lg hover:shadow-xl min-w-0"
                >
                  <Zap className="w-4 h-4 flex-shrink-0" />
                  <span className="whitespace-nowrap text-xs sm:text-sm">Smart schedule</span>
                </button>
                <button
                  onClick={handleContinue}
                  disabled={!toAddress || !amount || !selectedAsset}
                  className="flex-1 py-4 px-2 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 rounded-xl font-semibold text-white transition-all shadow-lg hover:shadow-xl min-w-0"
                >
                  <span className="whitespace-nowrap text-xs sm:text-sm">Send now</span>
                  <ArrowRight className="w-4 h-4 flex-shrink-0" />
                </button>
              </div>
            </div>
          )}

          {step === 'confirm' && selectedAsset && (
            <div className="space-y-6">
              <div className="glass-card p-6 bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border border-orange-200">
                <div className="text-sm text-gray-600 mb-1">You're sending</div>
                <div className="text-4xl font-bold text-gray-900 mb-1">
                  {amount} {selectedAsset.symbol}
                </div>
                <div className="text-sm text-gray-600">
                  ≈ {formatUSDSync(parseFloat(amount) * selectedAsset.priceUSD)}
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  on {CHAINS[selectedChain].name}
                </div>
              </div>

              <div className="glass-card p-6 space-y-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">To</span>
                  <span className="font-mono font-medium text-gray-900">{BlockchainService.formatAddress(toAddress)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Gas fee</span>
                  <span className="font-medium text-gray-900">
                    {estimatedFee} {CHAINS[selectedChain].nativeCurrency.symbol}
                  </span>
                </div>
                <div className="h-px bg-gray-200" />
                <div className="flex justify-between font-semibold text-base">
                  <span className="text-gray-900">Total</span>
                  <span className="text-gray-900">
                    {selectedAsset.isNative 
                      ? (parseFloat(amount) + parseFloat(estimatedFee)).toFixed(6)
                      : amount
                    } {selectedAsset.symbol}
                  </span>
                </div>
                {!selectedAsset.isNative && (
                  <div className="text-xs text-gray-500">
                    + {estimatedFee} {CHAINS[selectedChain].nativeCurrency.symbol} gas fee
                  </div>
                )}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-red-700 text-sm font-medium">{error}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('input')}
                  className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-all"
                >
                  Back
                </button>
                <button
                  onClick={handleSend}
                  className="flex-1 py-4 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl"
                >
                  Send
                </button>
              </div>
            </div>
          )}

          {step === 'sending' && (
            <div className="glass-card p-12 text-center">
              <Loader2 className="w-16 h-16 animate-spin text-orange-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Sending...</h3>
              <p className="text-gray-600">Your transaction is being processed</p>
            </div>
          )}

          {step === 'success' && (
            <div className="glass-card p-12 text-center">
              <ParticleEffect trigger={showSuccessParticles} type="celebration" />
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4"
              >
                <CheckCircle2 className="w-12 h-12 text-emerald-500" />
              </motion.div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Sent!</h3>
              <p className="text-gray-600 mb-6">
                Your transaction was sent successfully
              </p>
              
              {txHash && (
                <a
                  href={getExplorerUrl(txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-600 hover:text-orange-700 text-sm font-mono block mb-6 break-all hover:underline"
                >
                  View on {CHAINS[selectedChain].name} explorer →
                </a>
              )}

              <button
                onClick={handleClose}
                className="w-full py-4 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 rounded-xl font-semibold text-lg transition-all shadow-lg hover:shadow-xl"
              >
                Close
              </button>
            </div>
          )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Smart Schedule Modal */}
      {selectedAsset && (
        <SmartScheduleModal
          isOpen={showSmartSchedule}
          onClose={() => setShowSmartSchedule(false)}
          chain={selectedChain}
          fromAddress={getCurrentAddress() || ''}
          toAddress={toAddress}
          amount={amount}
          tokenAddress={selectedAsset.address}
          tokenSymbol={selectedAsset.symbol}
          onScheduled={() => {
            setShowSmartSchedule(false);
            onClose();
          }}
        />
      )}

      {/* Address Book Picker */}
      <AddressBook
        isOpen={showAddressBook}
        onClose={() => setShowAddressBook(false)}
        filterChain={selectedChain}
        onSelectContact={(contact) => {
          setToAddress(contact.address);
          setShowAddressBook(false);
        }}
      />
    </AnimatePresence>
  );
}

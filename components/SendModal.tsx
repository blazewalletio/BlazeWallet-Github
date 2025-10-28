'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Loader2, CheckCircle2, Flame, ChevronDown } from 'lucide-react';
import { useWalletStore } from '@/lib/wallet-store';
import { useBlockBodyScroll } from '@/hooks/useBlockBodyScroll';
import { MultiChainService } from '@/lib/multi-chain-service';
import { BlockchainService } from '@/lib/blockchain';
import { CHAINS } from '@/lib/chains';
import { priceService } from '@/lib/price-service';
import ParticleEffect from './ParticleEffect';

interface Asset {
  symbol: string;
  name: string;
  balance: string;
  decimals: number;
  logo?: string;
  address?: string; // For ERC20/SPL tokens (undefined for native)
  priceUSD: number;
  valueUSD: number;
  isNative: boolean;
}

interface SendModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SendModal({ isOpen, onClose }: SendModalProps) {
  const { wallet, currentChain, mnemonic, getCurrentAddress } = useWalletStore();
  const [step, setStep] = useState<'input' | 'confirm' | 'sending' | 'success'>('input');
  
  // ✅ NEW: Chain & Asset Selection
  const [selectedChain, setSelectedChain] = useState(currentChain);
  const [availableAssets, setAvailableAssets] = useState<Asset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  
  // Existing states
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [gasPrice, setGasPrice] = useState<{ slow: string; standard: string; fast: string } | null>(null);
  const [selectedGas, setSelectedGas] = useState<'slow' | 'standard' | 'fast'>('standard');
  const [error, setError] = useState('');
  const [txHash, setTxHash] = useState('');
  const [showSuccessParticles, setShowSuccessParticles] = useState(false);

  const blockchain = new MultiChainService(selectedChain);

  useBlockBodyScroll(isOpen);

  // ✅ Fetch assets when modal opens or chain changes
  useEffect(() => {
    if (isOpen) {
      setSelectedChain(currentChain); // Reset to current chain
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

  // ✅ Fetch all assets (native + tokens) for selected chain
  const fetchAssetsForChain = async (chain: string) => {
    setIsLoadingAssets(true);
    try {
      const displayAddress = getCurrentAddress();
      if (!displayAddress) {
        console.error('❌ No wallet address available');
        setIsLoadingAssets(false);
        return;
      }

      const chainConfig = CHAINS[chain];
      const chainService = new MultiChainService(chain);
      
      // Fetch native token balance
      const nativeBalance = await chainService.getBalance(displayAddress);
      
      // Fetch native token price
      const nativeSymbol = chainConfig.nativeCurrency.symbol;
      const prices = await priceService.getMultiplePrices([nativeSymbol]);
      const nativePrice = prices[nativeSymbol] || 0;
      
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

      // Fetch tokens (ERC20 for EVM, SPL for Solana)
      if (chain === 'solana') {
        // Fetch SPL tokens
        const solanaService = chainService as any;
        if (solanaService.getSPLTokenBalances) {
          const splTokens = await solanaService.getSPLTokenBalances(displayAddress);
          
          // Get prices for SPL tokens
          const splSymbols = splTokens.map((t: any) => t.symbol);
          const splPrices = await priceService.getMultiplePrices(splSymbols);
          
          splTokens.forEach((token: any) => {
            const price = splPrices[token.symbol] || 0;
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
      } else {
        // Fetch ERC20 tokens for EVM chains
        // TODO: Implement ERC20 token fetching (similar to Dashboard)
        // For now, we'll just use native token
      }

      // Sort by USD value (highest first)
      assets.sort((a, b) => b.valueUSD - a.valueUSD);
      
      setAvailableAssets(assets);
      
      // Auto-select asset with highest value
      if (assets.length > 0) {
        setSelectedAsset(assets[0]);
      }
      
      console.log(`✅ Loaded ${assets.length} assets for ${chain}:`, assets);
    } catch (error) {
      console.error('❌ Failed to fetch assets:', error);
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

  const handleMaxAmount = () => {
    if (!selectedAsset) return;
    
    // For native tokens, reserve some for gas
    if (selectedAsset.isNative) {
      const max = Math.max(0, parseFloat(selectedAsset.balance) - 0.001);
      setAmount(max.toFixed(6));
    } else {
      // For tokens, can send full balance
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

    try {
      const gas = gasPrice[selectedGas];
      
      // Send transaction
      const tx = await blockchain.sendTransaction(
        isSolana ? mnemonic! : wallet!,
        toAddress,
        amount,
        gas
      );
      
      const hash = typeof tx === 'string' ? tx : tx.hash;
      setTxHash(hash);
      setStep('success');
      setShowSuccessParticles(true);
      
      if (typeof tx !== 'string' && tx.wait) {
        await tx.wait();
      }
    } catch (err: any) {
      setError(err.message || 'Transaction failed');
      setStep('confirm');
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
    onClose();
  };

  const estimatedFee = gasPrice && selectedAsset
    ? selectedAsset.isNative
      ? (parseFloat(gasPrice[selectedGas]) * 21000 / 1e9).toFixed(6)
      : (parseFloat(gasPrice[selectedGas]) * 65000 / 1e9).toFixed(6) // ERC20 uses more gas
    : '0';

  const getExplorerUrl = (hash: string) => {
    const chainConfig = CHAINS[selectedChain];
    return `${chainConfig.explorerUrl}/tx/${hash}`;
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
        <div className="min-h-full flex flex-col">
          <div className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 pt-safe pb-safe">
            {/* Back Button */}
            <div className="pt-4 pb-2">
              <button
                onClick={handleClose}
                className="text-gray-600 hover:text-gray-900 flex items-center gap-2 font-semibold transition-colors"
              >
                ← Back
              </button>
            </div>

            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Flame className="w-6 h-6 text-white" />
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
              {/* ✅ NEW: Chain Selector */}
              <div>
                <label className="text-sm font-medium text-gray-900 mb-2 block">
                  From network
                </label>
                <div className="relative">
                  <select
                    value={selectedChain}
                    onChange={(e) => setSelectedChain(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl font-medium text-gray-900 appearance-none cursor-pointer hover:border-orange-300 transition-colors focus:outline-none focus:border-orange-500"
                  >
                    {Object.entries(CHAINS).map(([key, chain]) => (
                      <option key={key} value={key}>
                        {chain.icon} {chain.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* ✅ NEW: Asset Selector */}
              <div>
                <label className="text-sm font-medium text-gray-900 mb-2 block">
                  Asset to send
                </label>
                {isLoadingAssets ? (
                  <div className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl flex items-center justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
                    <span className="ml-2 text-gray-600">Loading assets...</span>
                  </div>
                ) : availableAssets.length === 0 ? (
                  <div className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-600 text-center">
                    No assets available
                  </div>
                ) : (
                  <div className="relative">
                    <select
                      value={selectedAsset?.symbol}
                      onChange={(e) => {
                        const asset = availableAssets.find(a => a.symbol === e.target.value);
                        setSelectedAsset(asset || null);
                      }}
                      className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl font-medium text-gray-900 appearance-none cursor-pointer hover:border-orange-300 transition-colors focus:outline-none focus:border-orange-500"
                    >
                      {availableAssets.map((asset) => (
                        <option key={asset.symbol} value={asset.symbol}>
                          {asset.symbol} - {parseFloat(asset.balance).toFixed(6)} (${asset.valueUSD.toFixed(2)})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                  </div>
                )}
                {selectedAsset && (
                  <div className="text-sm text-gray-600 mt-2">
                    ≈ ${selectedAsset.valueUSD.toFixed(2)} USD
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-gray-900 mb-2 block">
                  To address
                </label>
                <input
                  type="text"
                  value={toAddress}
                  onChange={(e) => setToAddress(e.target.value)}
                  placeholder={selectedChain === 'solana' ? 'Solana address...' : '0x...'}
                  className="input-field font-mono text-sm"
                />
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
                    ≈ ${(parseFloat(amount) * selectedAsset.priceUSD).toFixed(2)}
                  </div>
                )}
              </div>

              {/* Gas speed (only for non-Solana chains) */}
              {selectedChain !== 'solana' && (
                <div>
                  <label className="text-sm font-medium text-gray-900 mb-3 block">
                    Gas speed
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {gasPrice && ['slow', 'standard', 'fast'].map((speed) => (
                      <button
                        key={speed}
                        onClick={() => setSelectedGas(speed as any)}
                        className={`p-3 rounded-xl text-center transition-all border-2 ${
                          selectedGas === speed
                            ? 'bg-orange-50 border-orange-500'
                            : 'bg-gray-50 border-gray-200 hover:border-orange-300'
                        }`}
                      >
                        <div className="text-xs text-gray-600 capitalize mb-1 font-medium">
                          {speed === 'slow' ? 'Slow' : speed === 'standard' ? 'Standard' : 'Fast'}
                        </div>
                        <div className="font-semibold text-xs text-gray-900 break-words">
                          {parseFloat(gasPrice[speed as keyof typeof gasPrice]).toFixed(2)}
                        </div>
                        <div className="text-[10px] text-gray-500 mt-0.5">
                          Gwei
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-red-700 text-sm font-medium">{error}</p>
                </div>
              )}

              <button
                onClick={handleContinue}
                disabled={!toAddress || !amount || !selectedAsset}
                className="w-full py-4 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 rounded-xl font-semibold text-lg transition-all shadow-lg hover:shadow-xl"
              >
                Continue
                <ArrowRight className="w-5 h-5" />
              </button>
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
                  ≈ ${(parseFloat(amount) * selectedAsset.priceUSD).toFixed(2)}
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
    </AnimatePresence>
  );
}

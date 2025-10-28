'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Loader2, CheckCircle2, Flame } from 'lucide-react';
import { useWalletStore } from '@/lib/wallet-store';
import { useBlockBodyScroll } from '@/hooks/useBlockBodyScroll';
import { MultiChainService } from '@/lib/multi-chain-service';
import { BlockchainService } from '@/lib/blockchain'; // Keep for formatAddress utility
import ParticleEffect from './ParticleEffect';

interface SendModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SendModal({ isOpen, onClose }: SendModalProps) {
  const { wallet, balance, currentChain, mnemonic } = useWalletStore();
  const [step, setStep] = useState<'input' | 'confirm' | 'sending' | 'success'>('input');
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [gasPrice, setGasPrice] = useState<{ slow: string; standard: string; fast: string } | null>(null);
  const [selectedGas, setSelectedGas] = useState<'slow' | 'standard' | 'fast'>('standard');
  const [error, setError] = useState('');
  const [txHash, setTxHash] = useState('');
  const [showSuccessParticles, setShowSuccessParticles] = useState(false);

  // ✅ Use MultiChainService with current chain
  const blockchain = new MultiChainService(currentChain);

  // Block body scroll when overlay is open
  useBlockBodyScroll(isOpen);

  useEffect(() => {
    if (isOpen) {
      fetchGasPrice();
    }
  }, [isOpen]);

  const fetchGasPrice = async () => {
    const prices = await blockchain.getGasPrice();
    setGasPrice(prices);
  };

  const handleMaxAmount = () => {
    // Reserve some for gas
    const max = Math.max(0, parseFloat(balance) - 0.001);
    setAmount(max.toFixed(6));
  };

  const handleContinue = () => {
    setError('');
    
    // ✅ Use MultiChainService for address validation
    if (!blockchain.isValidAddress(toAddress)) {
      setError(`Invalid ${blockchain.getAddressFormatHint()}`);
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Invalid amount');
      return;
    }

    if (amountNum > parseFloat(balance)) {
      setError('Insufficient balance');
      return;
    }

    setStep('confirm');
  };

  const handleSend = async () => {
    if (!gasPrice) return;
    
    // ✅ For Solana: use mnemonic, for EVM: use wallet
    const isSolana = currentChain === 'solana';
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
      
      // ✅ Send transaction with correct wallet/mnemonic format
      const tx = await blockchain.sendTransaction(
        isSolana ? mnemonic! : wallet!,
        toAddress,
        amount,
        gas
      );
      
      // ✅ Handle different response types (Solana returns string, EVM returns TransactionResponse)
      const hash = typeof tx === 'string' ? tx : tx.hash;
      setTxHash(hash);
      setStep('success');
      setShowSuccessParticles(true);
      
      // Wait for confirmation (EVM only)
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
    onClose();
  };

  const estimatedFee = gasPrice ? 
    (parseFloat(gasPrice[selectedGas]) * 21000 / 1e9).toFixed(6) : '0';

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
            {/* Back Button - with safe area padding */}
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
              <div>
                <label className="text-sm font-medium text-gray-900 mb-2 block">
                  To address
                </label>
                <input
                  type="text"
                  value={toAddress}
                  onChange={(e) => setToAddress(e.target.value)}
                  placeholder="0x..."
                  className="input-field font-mono text-sm"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium text-gray-900">
                    Amount (ETH)
                  </label>
                  <span className="text-sm text-gray-600">
                    Available: {parseFloat(balance).toFixed(6)} ETH
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
                  />
                  <button
                    onClick={handleMaxAmount}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-orange-600 hover:text-orange-700 text-sm font-semibold"
                  >
                    MAX
                  </button>
                </div>
                {amount && (
                  <div className="text-sm text-gray-600 mt-2">
                    ≈ ${(parseFloat(amount) * 1700).toFixed(2)}
                  </div>
                )}
              </div>

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

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-red-700 text-sm font-medium">{error}</p>
                </div>
              )}

              <button
                onClick={handleContinue}
                disabled={!toAddress || !amount}
                className="w-full py-4 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 rounded-xl font-semibold text-lg transition-all shadow-lg hover:shadow-xl"
              >
                Continue
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {step === 'confirm' && (
            <div className="space-y-6">
              <div className="glass-card p-6 bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border border-orange-200">
                <div className="text-sm text-gray-600 mb-1">You're sending</div>
                <div className="text-4xl font-bold text-gray-900 mb-1">{amount} ETH</div>
                <div className="text-sm text-gray-600">
                  ≈ ${(parseFloat(amount) * 1700).toFixed(2)}
                </div>
              </div>

              <div className="glass-card p-6 space-y-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">To</span>
                  <span className="font-mono font-medium text-gray-900">{BlockchainService.formatAddress(toAddress)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Gas fee</span>
                  <span className="font-medium text-gray-900">{estimatedFee} ETH</span>
                </div>
                <div className="h-px bg-gray-200" />
                <div className="flex justify-between font-semibold text-base">
                  <span className="text-gray-900">Total</span>
                  <span className="text-gray-900">{(parseFloat(amount) + parseFloat(estimatedFee)).toFixed(6)} ETH</span>
                </div>
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
                  href={`https://etherscan.io/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-600 hover:text-orange-700 text-sm font-mono block mb-6 break-all hover:underline"
                >
                  View on Etherscan →
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

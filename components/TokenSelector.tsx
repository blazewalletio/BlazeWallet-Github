'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, AlertCircle, Loader2 } from 'lucide-react';
import { useWalletStore } from '@/lib/wallet-store';
import { CHAINS } from '@/lib/chains';
import { Token } from '@/lib/types';
import { ethers } from 'ethers';
import { Connection, PublicKey } from '@solana/web3.js';
import { getSPLTokenMetadata } from '@/lib/spl-token-metadata';

interface TokenSelectorProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TokenSelector({ isOpen, onClose }: TokenSelectorProps) {
  const { currentChain, addToken, address } = useWalletStore();
  const [customAddress, setCustomAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chainConfig = CHAINS[currentChain];
  const isSolana = currentChain === 'solana';
  const isEVM = chainConfig?.type === 'evm';
  const isBitcoinFork = ['bitcoin', 'litecoin', 'dogecoin', 'bitcoincash', 'dash'].includes(currentChain);

  const handleAddCustomToken = async () => {
    if (!customAddress.trim()) {
      setError('Please enter a token address');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (isSolana) {
        await handleAddSolanaToken();
      } else if (isEVM) {
        await handleAddEVMToken();
      } else {
        setError('Token imports not supported for this chain');
      }
    } catch (err: any) {
      console.error('❌ Error adding token:', err);
      setError(err.message || 'Failed to add token');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSolanaToken = async () => {
    try {
      // Validate Solana address
      const mintAddress = new PublicKey(customAddress.trim());
      
      console.log('🔍 Fetching SPL token metadata:', mintAddress.toBase58());
      
      // Fetch metadata using our 7-tier system
      const metadata = await getSPLTokenMetadata(mintAddress.toBase58());
      
      const token: Token = {
        address: mintAddress.toBase58(),
        symbol: metadata.symbol,
        name: metadata.name,
        decimals: metadata.decimals,
        logo: metadata.logoURI || '/crypto-solana.png',
      };

      console.log('✅ SPL token metadata fetched:', token);
      
      addToken(token);
      setCustomAddress('');
      onClose();
    } catch (err: any) {
      console.error('❌ Failed to add Solana token:', err);
      throw new Error('Invalid SPL token address or token not found');
    }
  };

  const handleAddEVMToken = async () => {
    try {
      // Validate EVM address
      if (!ethers.isAddress(customAddress.trim())) {
        throw new Error('Invalid token address');
      }

      const rpcUrl = chainConfig.rpcUrl;
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      
      const tokenContract = new ethers.Contract(
        customAddress,
        [
          'function name() view returns (string)',
          'function symbol() view returns (string)',
          'function decimals() view returns (uint8)',
        ],
        provider
      );

      console.log('🔍 Fetching ERC20 token metadata:', customAddress);

      const [name, symbol, decimals] = await Promise.all([
        tokenContract.name(),
        tokenContract.symbol(),
        tokenContract.decimals(),
      ]);

      const token: Token = {
        address: customAddress,
        symbol,
        name,
        decimals: Number(decimals),
        logo: `https://assets.coingecko.com/coins/images/small/${symbol.toLowerCase()}.png`,
      };

      console.log('✅ ERC20 token metadata fetched:', token);
      
      addToken(token);
      setCustomAddress('');
      onClose();
    } catch (err: any) {
      console.error('❌ Failed to add EVM token:', err);
      throw new Error('Invalid token address or unable to fetch token data');
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
            <div className="glass-card rounded-t-3xl p-6">
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
                    src={chainConfig?.logo || '/crypto-solana.png'} 
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

              {/* Instructions */}
              {!isBitcoinFork && (
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
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      {isSolana && 'SPL Token Mint Address'}
                      {isEVM && 'ERC20 Contract Address'}
                    </label>
                    <input
                      type="text"
                      value={customAddress}
                      onChange={(e) => {
                        setCustomAddress(e.target.value);
                        setError(null);
                      }}
                      placeholder={isSolana ? 'Token mint address (e.g., EPjFWdd5...)' : '0x...'}
                      className="input-field text-sm font-mono"
                      disabled={isLoading}
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
                    disabled={isLoading || !customAddress.trim()}
                    className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Adding token...</span>
                      </div>
                    ) : (
                      'Add token'
                    )}
                  </motion.button>

                  {/* Help Text */}
                  <div className="text-center">
                    <p className="text-xs text-gray-500">
                      Token not appearing? Check the contract address and try again.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

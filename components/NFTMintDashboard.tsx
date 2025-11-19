'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Palette, Sparkles, AlertCircle, CheckCircle2, Zap, Crown, Star } from 'lucide-react';
import { useWalletStore } from '@/lib/wallet-store';
import { useBlockBodyScroll } from '@/hooks/useBlockBodyScroll';
import { NFTService, NFTCollection, NFTStats } from '@/lib/nft-service';
import { logger } from '@/lib/logger';

interface NFTMintDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NFTMintDashboard({ isOpen, onClose }: NFTMintDashboardProps) {
  const { wallet } = useWalletStore();
  const [selectedSkin, setSelectedSkin] = useState<number | null>(null);
  const [isMinting, setIsMinting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Real data from contracts
  const [collections, setCollections] = useState<NFTCollection[]>([]);
  const [stats, setStats] = useState<NFTStats | null>(null);
  const [nftService, setNftService] = useState<NFTService | null>(null);

  // Block body scroll when modal is open
  useBlockBodyScroll(isOpen);

  // Load data when modal opens
  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, wallet]);

  const loadData = async () => {
    if (!wallet) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const service = new NFTService(wallet);
      setNftService(service);
      
      const [collectionsData, statsData] = await Promise.all([
        service.getCollections(),
        service.getNFTStats(await wallet.getAddress()),
      ]);
      
      setCollections(collectionsData);
      setStats(statsData);
    } catch (err: any) {
      logger.error('Error loading NFT data:', err);
      setError(err.message || 'Failed to load NFT data');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper functions
  const getRarity = (collection: NFTCollection) => {
    if (collection.maxSupply <= 100) return 'Legendary';
    if (collection.maxSupply <= 500) return 'Epic';
    if (collection.maxSupply <= 1000) return 'Rare';
    return 'Common';
  };

  const getGradient = (name: string) => {
    const nameLower = name.toLowerCase();
    if (nameLower.includes('neon')) return 'from-purple-500 to-pink-500';
    if (nameLower.includes('galaxy')) return 'from-blue-500 to-cyan-500';
    if (nameLower.includes('diamond')) return 'from-orange-500 to-yellow-500';
    return 'from-green-500 to-emerald-500';
  };

  const getBenefits = (rarity: string) => {
    switch (rarity) {
      case 'Legendary':
        return ['Exclusive theme', 'Personal manager', 'All features unlocked', 'Custom everything', 'Exclusive events'];
      case 'Epic':
        return ['Exclusive theme', 'VIP support', 'Alpha access', 'Custom sounds', 'Special effects'];
      case 'Rare':
        return ['Exclusive theme', 'Premium support', 'Beta access', 'Custom animations'];
      default:
        return ['Exclusive theme', 'Priority support', 'Early access to features'];
    }
  };

  const getRarityIcon = (rarity: string) => {
    switch (rarity) {
      case 'Legendary':
        return Crown;
      case 'Epic':
        return Sparkles;
      case 'Rare':
        return Star;
      default:
        return Zap;
    }
  };

  const handleMint = async () => {
    if (selectedSkin === null || !nftService) return;
    
    try {
      setIsMinting(true);
      setError(null);
      setSuccess(null);
      
      const collection = collections[selectedSkin];
      logger.log('Minting NFT from collection:', collection.name);
      
      const txHash = await nftService.mintNFT(collection.id);
      
      setSuccess(`Successfully minted ${collection.name}! Transaction: ${txHash.slice(0, 10)}...`);
      setSelectedSkin(null);
      
      // Reload data
      await loadData();
    } catch (err: any) {
      logger.error('Error minting NFT:', err);
      setError(err.message || 'Failed to mint NFT');
    } finally {
      setIsMinting(false);
    }
  };

  if (!isOpen) return null;

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto"
      >
        <div className="max-w-4xl mx-auto p-6">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading NFT collections...</p>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto"
      >
        <div className="max-w-4xl mx-auto p-6 pb-24">
          {/* Back Button */}
          <button
            onClick={onClose}
            className="mb-4 text-gray-600 hover:text-gray-900 flex items-center gap-2 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
          >
            ← Back to Dashboard
          </button>

          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                <Palette className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">NFT Wallet Skins</h2>
                <p className="text-sm text-gray-600">
                  Customize your wallet with exclusive NFT themes
                </p>
              </div>
            </div>
          </div>

          {/* Error/Success Messages */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="glass-card p-4 mb-6 border-l-4 border-red-500"
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-red-700 text-sm font-medium">{error}</p>
                  </div>
                  <button 
                    onClick={() => setError(null)} 
                    className="text-red-500 hover:text-red-700 text-xl font-bold leading-none"
                  >
                    ×
                  </button>
                </div>
              </motion.div>
            )}

            {success && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="glass-card p-4 mb-6 border-l-4 border-green-500"
              >
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-green-700 text-sm font-medium">{success}</p>
                  </div>
                  <button 
                    onClick={() => setSuccess(null)} 
                    className="text-green-500 hover:text-green-700 text-xl font-bold leading-none"
                  >
                    ×
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20"
              >
                <div className="flex items-center gap-2 text-purple-600 mb-2">
                  <Palette className="w-5 h-5" />
                  <span className="text-sm font-semibold">Your NFTs</span>
                </div>
                <div className="text-3xl font-bold text-gray-900">{stats.userNFTs}</div>
                <div className="text-sm text-gray-500 mt-1">
                  Skins collected
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="glass-card bg-gradient-to-br from-orange-500/10 to-yellow-500/10 border border-orange-500/20"
              >
                <div className="flex items-center gap-2 text-orange-600 mb-2">
                  <Sparkles className="w-5 h-5" />
                  <span className="text-sm font-semibold">Total Minted</span>
                </div>
                <div className="text-3xl font-bold text-gray-900">{stats.totalMinted}</div>
                <div className="text-sm text-gray-500 mt-1">
                  Across all collections
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass-card bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20"
              >
                <div className="flex items-center gap-2 text-green-600 mb-2">
                  <Crown className="w-5 h-5" />
                  <span className="text-sm font-semibold">Premium Status</span>
                </div>
                <div className="text-base font-bold text-gray-900">{stats.premiumStatus ? 'Active' : 'Inactive'}</div>
                <div className="text-sm text-gray-500 mt-1">
                  {stats.premiumStatus ? `${stats.premiumDiscount}% discount` : 'No discount'}
                </div>
              </motion.div>
            </div>
          )}

          {/* Info Notice */}
          <div className="glass-card mb-6 bg-gradient-to-br from-purple-500/5 to-pink-500/5 border border-purple-500/20">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <Palette className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">NFT Wallet Skins</h3>
                <p className="text-sm text-gray-600">
                  Each NFT skin provides a unique theme for your wallet interface. Some rare skins unlock exclusive features and premium support!
                </p>
              </div>
            </div>
          </div>

          {/* NFT Collections */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {collections.map((collection, index) => {
              const rarity = getRarity(collection);
              const gradient = getGradient(collection.name);
              const benefits = getBenefits(rarity);
              const RarityIcon = getRarityIcon(rarity);
              const progress = (collection.minted / collection.maxSupply) * 100;
              
              return (
                <motion.div
                  key={collection.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="glass-card group hover:shadow-xl transition-all"
                >
                  {/* Preview */}
                  <div className={`h-48 bg-gradient-to-br ${gradient} rounded-xl mb-4 flex items-center justify-center relative overflow-hidden`}>
                    <div className="absolute inset-0 bg-black/20" />
                    <Palette className="w-16 h-16 text-white relative z-10" />
                    <div className={`absolute top-3 right-3 px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 ${
                      rarity === 'Legendary' ? 'bg-gradient-to-r from-orange-500 to-yellow-500' :
                      rarity === 'Epic' ? 'bg-gradient-to-r from-purple-500 to-pink-500' :
                      rarity === 'Rare' ? 'bg-gradient-to-r from-blue-500 to-cyan-500' :
                      'bg-gradient-to-r from-green-500 to-emerald-500'
                    } text-white shadow-lg`}>
                      <RarityIcon className="w-3 h-3" />
                      {rarity}
                    </div>
                  </div>

                  {/* Details */}
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{collection.name}</h3>
                  
                  {/* Progress */}
                  <div className="mb-4">
                    <div className="flex justify-between items-center text-sm mb-1">
                      <span className="text-gray-600">Minted</span>
                      <span className="font-semibold text-gray-900">
                        {collection.minted} / {collection.maxSupply}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-full bg-gradient-to-r ${gradient} rounded-full transition-all duration-500`}
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Benefits */}
                  <div className="space-y-2 mb-4">
                    {benefits.slice(0, 3).map((benefit, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                        <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span>{benefit}</span>
                      </div>
                    ))}
                  </div>

                  {/* Mint Button */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setSelectedSkin(index);
                      handleMint();
                    }}
                    disabled={isMinting || collection.minted >= collection.maxSupply}
                    className={`w-full py-3 bg-gradient-to-r ${gradient} hover:opacity-90 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg`}
                  >
                    {isMinting && selectedSkin === index ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Minting...
                      </>
                    ) : collection.minted >= collection.maxSupply ? (
                      <>
                        Sold Out
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5" />
                        Mint for {collection.priceFormatted} BLAZE
                      </>
                    )}
                  </motion.button>
                </motion.div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
